/**
 * Administrator Verification & Moderation Controller
 * All endpoints strictly enforce requireAdmin middleware and write to AuditLog.
 */
const { db } = require('../config/database');
const emailService = require('../services/emailService');
const { findPropertyById, invalidateSearchCache, parseIndianCurrency } = require('./propertyController');
const { cacheService } = require('../services/cacheService');

exports.getOverview = async (req, res) => {
  const cacheKey = 'admin:overview';
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const pendingReviewCount = db.properties.filter(p => p.verificationStatus === 'pending_review' || p.verificationStatus === 'submitted').length;
  const approvedCount = db.properties.filter(p => p.verificationStatus === 'approved').length;
  const publishedCount = db.properties.filter(p => p.publicationStatus === 'published').length;
  const totalUsers = db.users.length;
  const activeInquiries = db.inquiries.length;
  const scheduledAppointments = db.appointments.length;
  const activeDealsCount = (db.escrows || []).length;
  const activeMediationCallsCount = (db.callRequests || []).length;

  const payload = {
    success: true,
    kpis: {
      pendingReviewCount,
      approvedCount,
      publishedCount,
      totalUsers,
      activeInquiries,
      scheduledAppointments,
      activeMediationCallsCount,
      activeDealsCount
    }
  };

  await cacheService.set(cacheKey, payload, 60);
  res.json(payload);
};

exports.getReviewQueue = (req, res) => {
  const queue = db.properties.filter(p => 
    !p.isRemoved && p.status !== 'removed' && p.verificationStatus !== 'rejected' && (
      p.verificationStatus === 'pending_review' || 
      p.verificationStatus === 'needs_changes' ||
      p.verificationStatus === 'submitted' ||
      p.hasPendingRevision === true ||
      p.verificationStatus === 'pending_revision' ||
      p.verificationStatus === 'flagged_dual_claim' ||
      p.hasDualClaim === true
    )
  );

  // Attach associated document metadata, owner details, and revision diff information
  const queueWithDocs = queue.map(prop => {
    const isRevision = Boolean(prop.hasPendingRevision && prop.pendingRevision);
    const attached = (Array.isArray(prop.documents) && prop.documents.length > 0)
      ? prop.documents
      : db.documents.filter(d => d.propertyId === prop._id);

    const owner = db.users.find(u => u._id === prop.ownerId) || { name: prop.ownerName || 'Property Owner', mobile: '' };

    return {
      ...prop,
      isRevision,
      reviewType: isRevision ? 'edit' : 'new_listing',
      ownerName: owner.name,
      ownerPhone: owner.mobile,
      submissionDate: isRevision ? prop.pendingRevision?.submittedAt : (prop.submittedAt || prop.createdAt),
      proposedChanges: isRevision ? prop.pendingRevision?.changes : null,
      previousApprovedState: isRevision ? prop.pendingRevision?.previousState : null,
      revisionId: isRevision ? prop.pendingRevision?._id : null,
      revisionVersion: isRevision ? prop.pendingRevision?.version : null,
      documents: attached,
      documentsCount: attached.length
    };
  });

  res.json({
    success: true,
    count: queueWithDocs.length,
    properties: queueWithDocs
  });
};

exports.getApprovedProperties = (req, res) => {
  const approvedList = db.properties.filter(p => 
    !p.isRemoved && p.status !== 'removed' && (
      p.verificationStatus === 'approved' ||
      p.publicationStatus === 'published' ||
      p.publicationStatus === 'suspended'
    )
  );

  const enriched = approvedList.map(prop => {
    const owner = db.users.find(u => u._id === (prop.ownerId || prop.owner_id)) || {
      name: prop.ownerName || 'Property Owner',
      mobile: prop.ownerPhone || ''
    };
    return {
      ...prop,
      ownerName: owner.name,
      ownerPhone: owner.mobile || prop.ownerPhone || ''
    };
  });

  res.json({
    success: true,
    count: enriched.length,
    properties: enriched
  });
};

exports.approveProperty = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop || prop.isRemoved || prop.status === 'removed' || (db.removedPropertyIds && db.removedPropertyIds.has(req.params.id))) {
      return res.status(404).json({ error: "Property not found or permanently removed" });
    }

    // CRITICAL SECURITY RULE: Pure sellers cannot approve their own listings (admin role authorized)
    if (prop.ownerId === req.user._id && (!req.user.roles || !req.user.roles.includes('admin'))) {
      return res.status(403).json({ error: "Sellers cannot approve their own listings for verification" });
    }

    // CASE 1: Reviewing an edit revision
    if (prop.hasPendingRevision && prop.pendingRevision) {
      const { revisionId, version } = req.body || {};

      // Concurrency protection: prevent stale approval from overwriting newer edit
      if (revisionId && revisionId !== prop.pendingRevision._id) {
        return res.status(409).json({ 
          error: "Revision mismatch: A newer edit has been submitted by the owner. Please refresh the review queue.",
          code: "REVISION_MISMATCH" 
        });
      }
      if (version && version !== prop.pendingRevision.version) {
        return res.status(409).json({ 
          error: "Version mismatch: The revision version has changed. Please refresh the review queue.",
          code: "VERSION_MISMATCH" 
        });
      }

      const revChanges = prop.pendingRevision.changes || {};
      const approvedRevId = prop.pendingRevision._id;
      const approvedVersion = prop.pendingRevision.version;

      // Atomically promote pending revision to approved live listing
      Object.assign(prop, revChanges);
      prop.version = approvedVersion;
      prop.verificationStatus = "approved";
      prop.publicationStatus = "published";
      prop.availabilityStatus = "available";
      prop.hasPendingRevision = false;
      prop.isTemporarilyHidden = false;
      prop.publishedAt = new Date();
      prop.reviewedBy = req.user._id;
      prop.reviewedAt = new Date();
      prop.updatedAt = new Date();

      prop.revisionHistory = prop.revisionHistory || [];
      prop.revisionHistory.push({
        ...prop.pendingRevision,
        status: "approved",
        approvedAt: new Date(),
        approvedBy: req.user._id
      });
      prop.pendingRevision = null;

      await db.updateProperty(prop._id, {
        ...revChanges,
        version: prop.version,
        verificationStatus: "approved",
        publicationStatus: "published",
        availabilityStatus: "available",
        hasPendingRevision: false,
        isTemporarilyHidden: false,
        pendingRevision: null,
        publishedAt: prop.publishedAt,
        reviewedBy: req.user._id,
        reviewedAt: prop.reviewedAt,
        updatedAt: new Date()
      });

      invalidateSearchCache();

      await db.insertAuditLog({
        _id: db.generateId('log'),
        actorId: req.user._id,
        actorName: req.user.name,
        action: "PROPERTY_REVISION_APPROVED",
        entity: "Property",
        entityId: prop._id,
        details: `Revision ${approvedRevId} (v${approvedVersion}) approved by ${req.user.name}. Updated changes published and live actions restored.`,
        timestamp: new Date()
      });

      return res.json({
        success: true,
        message: "Property revision approved and changes published to live search.",
        property: prop
      });
    }

    // CASE 2: Initial listing approval (New property)
    const updates = {
      verificationStatus: "approved",
      verification_status: "approved",
      publicationStatus: "published",
      publication_status: "published",
      availabilityStatus: "available",
      availability_status: "available",
      status: "approved",
      publishedAt: new Date(),
      published_at: new Date(),
      cadastralVerified: true,
      cadastral_verified: true,
      hasPendingRevision: false,
      isTemporarilyHidden: false,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      updatedAt: new Date()
    };

    Object.assign(prop, updates);
    const updated = await db.updateProperty(prop._id, updates);
    invalidateSearchCache();

    // Mark documents as approved
    db.documents
      .filter(d => d.propertyId === prop._id)
      .forEach(doc => {
        doc.reviewStatus = "approved";
        doc.reviewerId = req.user._id;
        doc.reviewedAt = new Date();
      });

    // Write to Audit Log in Supabase
    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "PROPERTY_APPROVED",
      entity: "Property",
      entityId: prop._id,
      details: `Listing title verified & e-Khata approved by ${req.user.name}. Published to live search.`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Property verification approved and published to live search successfully.",
      property: updated || prop
    });
  } catch (error) {
    next(error);
  }
};

exports.requestChanges = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop || prop.isRemoved || prop.status === 'removed' || (db.removedPropertyIds && db.removedPropertyIds.has(req.params.id))) {
      return res.status(404).json({ error: "Property not found" });
    }

    const { notes } = req.body;
    if (!notes) return res.status(400).json({ error: "Review correction notes are required" });

    const updates = {
      verificationStatus: "needs_changes",
      publicationStatus: "unpublished", // Ensure stays hidden
      reviewNotes: notes,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      updatedAt: new Date()
    };

    const updated = await db.updateProperty(prop._id, updates);
    invalidateSearchCache();

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "PROPERTY_REQUESTED_CHANGES",
      entity: "Property",
      entityId: prop._id,
      details: `Correction requested: ${notes}`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Listing marked as Needs Changes. Owner notified with review notes.",
      property: updated || prop
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectProperty = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop || prop.isRemoved || prop.status === 'removed' || (db.removedPropertyIds && db.removedPropertyIds.has(req.params.id))) {
      return res.status(404).json({ error: "Property not found or permanently removed" });
    }

    const { reason, revisionId, version } = req.body || {};
    if (!reason) return res.status(400).json({ error: "Rejection reason is required" });

    // CASE 1: Rejecting an edit revision
    // Requirement 2: Discard proposed changes, restore previous approved version to public discovery!
    if (prop.hasPendingRevision && prop.pendingRevision) {
      if (revisionId && revisionId !== prop.pendingRevision._id) {
        return res.status(409).json({ 
          error: "Revision mismatch: A newer edit has been submitted by the owner.",
          code: "REVISION_MISMATCH" 
        });
      }

      const rejectedRevId = prop.pendingRevision._id;

      prop.revisionHistory = prop.revisionHistory || [];
      prop.revisionHistory.push({
        ...prop.pendingRevision,
        status: "rejected",
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedBy: req.user._id
      });

      // Discard proposed changes (the base approved fields were never modified!)
      // Restore previously approved version back to public discovery
      prop.verificationStatus = "approved";
      prop.publicationStatus = "published";
      prop.availabilityStatus = "available";
      prop.hasPendingRevision = false;
      prop.isTemporarilyHidden = false;
      prop.lastRejectedRevision = {
        revisionId: rejectedRevId,
        rejectionReason: reason,
        rejectedAt: new Date()
      };
      prop.rejectionReason = reason;
      prop.pendingRevision = null;
      prop.updatedAt = new Date();

      await db.updateProperty(prop._id, {
        verificationStatus: "approved",
        publicationStatus: "published",
        availabilityStatus: "available",
        hasPendingRevision: false,
        isTemporarilyHidden: false,
        pendingRevision: null,
        rejectionReason: reason,
        updatedAt: new Date()
      });

      invalidateSearchCache();

      await db.insertAuditLog({
        _id: db.generateId('log'),
        actorId: req.user._id,
        actorName: req.user.name,
        action: "PROPERTY_REVISION_REJECTED",
        entity: "Property",
        entityId: prop._id,
        details: `Revision ${rejectedRevId} rejected by ${req.user.name}: ${reason}. Previously approved listing restored to published status.`,
        timestamp: new Date()
      });

      return res.json({
        success: true,
        message: "Revision rejected. Last approved listing version restored to public discovery.",
        property: prop
      });
    }

    // CASE 2: Rejecting initial listing
    const updates = {
      verificationStatus: "rejected",
      verification_status: "rejected",
      publicationStatus: "unpublished",
      publication_status: "unpublished",
      rejectionReason: reason,
      reviewNotes: reason,
      hasPendingRevision: false,
      hasDualClaim: false,
      has_dual_claim: false,
      isTemporarilyHidden: false,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      updatedAt: new Date()
    };

    Object.assign(prop, updates);
    const updated = await db.updateProperty(prop._id, updates);
    invalidateSearchCache();

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "PROPERTY_REJECTED",
      entity: "Property",
      entityId: prop._id,
      details: `Disqualified: ${reason}`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Property listing rejected and remains unpublished.",
      property: updated || prop
    });
  } catch (error) {
    next(error);
  }
};

exports.publishProperty = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // CRITICAL SECURITY INVARIANT: Must be approved before publication
    if (prop.verificationStatus !== 'approved') {
      return res.status(400).json({
        error: "Cannot publish unapproved property. Verification must be completed and approved first.",
        currentStatus: prop.verificationStatus
      });
    }

    const updates = {
      publicationStatus: "published",
      publication_status: "published",
      availabilityStatus: "available",
      availability_status: "available",
      isTemporarilyHidden: false,
      publishedAt: new Date(),
      updatedAt: new Date()
    };

    Object.assign(prop, updates);
    const updated = await db.updateProperty(prop._id, updates);
    invalidateSearchCache();

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "PROPERTY_PUBLISHED",
      entity: "Property",
      entityId: prop._id,
      details: "Listing published to public search and AI discovery feed.",
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Property listing published successfully! Now visible in public search.",
      property: updated || prop
    });
  } catch (error) {
    next(error);
  }
};

exports.suspendProperty = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    const { reason } = req.body || {};

    const updates = {
      publicationStatus: "suspended",
      publication_status: "suspended",
      availabilityStatus: "suspended",
      availability_status: "suspended",
      reviewNotes: reason || 'Administrative suspension',
      isTemporarilyHidden: true,
      updatedAt: new Date()
    };

    Object.assign(prop, updates);
    const updated = await db.updateProperty(prop._id, updates);
    invalidateSearchCache();

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "PROPERTY_SUSPENDED",
      entity: "Property",
      entityId: prop._id,
      details: `Suspended from public discovery: ${reason || 'Administrative action'}`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Property suspended from public visibility.",
      property: updated || prop
    });
  } catch (error) {
    next(error);
  }
};

exports.completeDeal = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Concurrency & duplicate sale protection
    if (prop.availabilityStatus === 'sold' || prop.availability_status === 'sold' || 
        prop.publicationStatus === 'completed' || prop.publication_status === 'completed') {
      return res.status(409).json({ 
        error: "Concurrency Lock: This property listing has already completed its transaction.",
        code: "DEAL_ALREADY_COMPLETED" 
      });
    }

    const { outcome, buyerName, buyerPhone, buyerEmail, buyerId, finalPrice, sourceId, sourceType, closureNotes } = req.body;
    let newStatus = 'sold';
    if (outcome) {
      newStatus = outcome === 'rented' ? 'rented' : 'sold';
    } else if (prop.purpose === 'rent') {
      newStatus = 'rented';
    }
    const parsedFinalPrice = finalPrice ? parseIndianCurrency(finalPrice) : prop.price;

    // Resolve buyer user if possible
    let resolvedBuyerId = buyerId;
    if (!resolvedBuyerId && (buyerEmail || buyerPhone)) {
      const matchedUser = (db.users || []).find(u => 
        (buyerEmail && u.email && u.email.toLowerCase() === buyerEmail.toLowerCase()) ||
        (buyerPhone && u.mobile && u.mobile.replace(/\D/g, '').endsWith(buyerPhone.replace(/\D/g, '').slice(-10)))
      );
      if (matchedUser) resolvedBuyerId = matchedUser._id;
    }
    if (!resolvedBuyerId) resolvedBuyerId = 'usr_client_001';
    
    const updates = {
      availabilityStatus: newStatus,
      availability_status: newStatus,
      status: newStatus,
      publicationStatus: 'completed',
      publication_status: 'completed',
      buyerId: resolvedBuyerId,
      buyerName: buyerName || 'Verified Citizen Buyer',
      buyerPhone: buyerPhone || '',
      buyerEmail: buyerEmail || '',
      finalPrice: parsedFinalPrice,
      closedAt: new Date(),
      dealType: newStatus,
      adminNotes: closureNotes || `Deal closed as ${newStatus.toUpperCase()} by Super Admin`,
      saleMetadata: {
        buyerReference: buyerName,
        buyerPhone: buyerPhone || '',
        buyerEmail: buyerEmail || '',
        salePrice: parsedFinalPrice,
        closedAt: new Date().toISOString()
      },
      updatedAt: new Date()
    };

    const updated = await db.updateProperty(prop._id, updates);
    invalidateSearchCache();

    // Cascading Deal Closure Effects:
    // 1. If source was a booking, mark that specific booking as completed
    if (sourceType === 'booking' && sourceId && db.appointments) {
      const apt = db.appointments.find(a => a._id === sourceId || a.id === sourceId);
      if (apt) {
        apt.status = 'completed';
        apt.closureReason = `Deal successfully closed (${newStatus.toUpperCase()})`;
      }
    }
    // 2. If source was a call, mark that call as completed
    if (sourceType === 'call' && sourceId && db.callRequests) {
      const call = db.callRequests.find(c => c._id === sourceId || c.id === sourceId);
      if (call) {
        call.status = 'completed';
        call.notes = (call.notes ? call.notes + ' | ' : '') + `Deal closed (${newStatus.toUpperCase()})`;
      }
    }
    const competingLeads = [];

    // 3. Automatically reject and close remaining pending/confirmed appointments for this listing
    if (db.appointments && Array.isArray(db.appointments)) {
      for (const apt of db.appointments) {
        const isMatch = (apt.propertyId === prop._id || apt.property_id === prop._id);
        const isDifferent = (apt._id !== sourceId && apt.id !== sourceId);
        const isActive = ['scheduled', 'pending', 'confirmed', 'rescheduled'].includes(apt.status);
        if (isMatch && isDifferent && isActive) {
          const reason = `Sorry for the rejection: this land/plot deal has already been closed and finalized with another customer. You are welcome to search and explore other verified properties with the same features on PlotPin.`;
          apt.status = 'rejected';
          apt.cancellationReason = reason;
          apt.notes = (apt.notes ? apt.notes + ' | ' : '') + reason;
          if (apt.customerEmail || apt.email) {
            competingLeads.push({
              name: apt.customerName || apt.name || 'Citizen Buyer',
              email: apt.customerEmail || apt.email,
              type: 'booking'
            });
          } else if (apt.buyerId) {
            const u = (db.users || []).find(user => user._id === apt.buyerId);
            if (u && u.email) {
              competingLeads.push({
                name: u.name || 'Citizen Buyer',
                email: u.email,
                type: 'booking'
              });
            }
          }
        }
      }
    }

    // 3b. Automatically reject and close remaining active call requests for this listing
    if (db.callRequests && Array.isArray(db.callRequests)) {
      for (const call of db.callRequests) {
        const isMatch = (call.propertyId === prop._id || call.property_id === prop._id);
        const isDifferent = (call._id !== sourceId && call.id !== sourceId);
        const isActive = ['pending', 'requested', 'follow_up', 'scheduled'].includes(call.status);
        if (isMatch && isDifferent && isActive) {
          const reason = `Sorry for the rejection: this land/plot deal has already been closed and finalized with another customer. You are welcome to search and explore other verified properties with the same features on PlotPin.`;
          call.status = 'rejected';
          call.adminNotes = (call.adminNotes ? call.adminNotes + ' | ' : '') + reason;
          if (call.customerEmail || call.buyerEmail || call.email) {
            competingLeads.push({
              name: call.customerName || call.buyerName || call.name || 'Citizen Enquirer',
              email: call.customerEmail || call.buyerEmail || call.email,
              type: 'call'
            });
          } else if (call.buyerId) {
            const u = (db.users || []).find(user => user._id === call.buyerId);
            if (u && u.email) {
              competingLeads.push({
                name: u.name || 'Citizen Enquirer',
                email: u.email,
                type: 'call'
              });
            }
          }
        }
      }
    }

    // 4. Archive competing active offers in escrows
    if (db.escrows && Array.isArray(db.escrows)) {
      for (const deal of db.escrows) {
        if (deal.propertyId === prop._id && deal.status === 'active') {
          deal.status = 'archived';
          deal.stage = 'Closed: Superseded by accepted transaction';
          deal.updatedAt = new Date();
        }
      }
    }

    // Create completed deal in escrows
    if (!db.escrows) db.escrows = [];
    const dealRef = `DEAL-AP-${Date.now().toString().slice(-6)}`;
    const newDeal = {
      _id: db.generateId('deal'),
      propertyId: prop._id,
      propertyTitle: prop.title,
      propertyImage: (prop.images && prop.images[0]?.storageKey) || '',
      buyerId: resolvedBuyerId,
      buyerName: buyerName || 'Verified Citizen Buyer',
      buyerPhone: buyerPhone || '',
      buyerEmail: buyerEmail || '',
      sellerId: prop.ownerId,
      sellerName: prop.ownerName || 'Property Owner',
      totalPropertyValue: prop.price,
      dealAmount: parsedFinalPrice || prop.price,
      offerAmount: parsedFinalPrice || prop.price,
      currency: "INR",
      dealReference: dealRef,
      stage: outcome === 'rented' ? "Tenancy Agreement Executed" : "Title Deed Transferred · Deal Completed",
      status: "completed",
      outcome: newStatus,
      dealType: newStatus,
      clearedChecks: ["Meebhoomi Encumbrance Search", "AP MAUD e-Khata Digital QR", "Final Consideration Transferred", "100% Stamp Duty Discharged"],
      pendingChecks: [],
      completedAt: new Date(),
      createdAt: new Date(),
      property: {
        ...prop,
        ...updates
      }
    };
    db.escrows.unshift(newDeal);

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: outcome === 'rented' ? "PROPERTY_RENTED_DEAL_CLOSED" : "PROPERTY_SOLD_DEAL_CLOSED",
      entity: "Property",
      entityId: prop._id,
      details: `Deal completed: Property marked as ${newStatus}. Buyer/Tenant: ${buyerName || 'Private Party'} at ₹${finalPrice ? Number(finalPrice).toLocaleString('en-IN') : prop.price?.toLocaleString('en-IN')}`,
      timestamp: new Date()
    });

    // Resolve seller / owner contact for deal closed email
    const seller = (db.users || []).find(u => u._id === prop.ownerId);
    const sellerEmail = seller?.email || prop.ownerEmail || '';
    const sellerName = seller?.name || prop.ownerName || 'Property Owner';

    // Dispatch deal closure confirmation emails to both Buyer and Seller
    emailService.sendDealClosedEmails({
      propertyTitle: prop.title,
      buyerName: buyerName || 'Verified Citizen Buyer',
      buyerEmail: buyerEmail,
      sellerName: sellerName,
      sellerEmail: sellerEmail,
      outcome: newStatus,
      finalPrice: parsedFinalPrice,
      dealReference: dealRef
    }).catch(err => console.warn('[AdminController] Deal closed email delivery warning:', err.message));

    // Note: Competing leads are NOT notified via email as requested;
    // their rejection notices and apologies are displayed directly in their in-app Site Visits & Call queues.

    res.json({
      success: true,
      message: `Deal closed! Property marked as ${newStatus} and archived from live search. Confirmation emails dispatched to buyer and seller.`,
      property: updated || prop,
      deal: newDeal
    });
  } catch (error) {
    next(error);
  }
};


exports.getAuditLogs = (req, res) => {
  res.json({
    success: true,
    logs: db.auditLogs.slice().reverse()
  });
};

exports.getUsers = (req, res) => {
  const users = (db.users || []).map(u => ({
    id: u._id || u.id,
    _id: u._id || u.id,
    name: u.name || 'Citizen User',
    email: u.email || '',
    phone: u.mobile || u.phone || '',
    mobile: u.mobile || u.phone || '',
    role: Array.isArray(u.roles) ? u.roles.join(', ') : (u.role || 'user'),
    roles: u.roles || ['user', 'buyer', 'seller'],
    emailVerified: u.emailVerified ?? true,
    mobileVerified: u.mobileVerified ?? true,
    accountStatus: u.accountStatus || 'active',
    activeMode: u.activeMode || 'buyer',
    createdAt: u.createdAt || new Date()
  }));
  res.json({
    success: true,
    count: users.length,
    users
  });
};

// =========================================================================
// OFFERS & DEALS REGISTRY (Admin Mediated Transactions)
// =========================================================================
// =========================================================================
exports.getEscrows = (req, res) => {
  res.json({
    success: true,
    count: (db.escrows || []).length,
    escrows: db.escrows || []
  });
};

exports.releaseEscrow = (req, res) => {
  const { id } = req.params;
  const { buyerConfirmed = false, transactionEvidenceRef, notes } = req.body || {};
  const deal = (db.escrows || []).find(e => e._id === id);
  if (!deal) return res.status(404).json({ error: "Deal record not found", code: "NOT_FOUND" });

  // 1. Concurrency and already released check
  if (deal.status === 'completed' && deal.fundsReleased) {
    return res.status(409).json({
      error: "Escrow funds have already been released for this transaction",
      code: "ALREADY_RELEASED"
    });
  }

  // 2. State transition check: cannot release while on mediation hold
  if (deal.status === 'on_hold' || deal.status === 'frozen') {
    return res.status(400).json({
      error: "Security Check Failed: Cannot release funds while escrow is under mediation hold. Administrative clearance required.",
      code: "ESCROW_FROZEN"
    });
  }

  // 3. Multi-party verification: buyer confirmation or verified transaction evidence required
  const hasBuyerConfirmation = buyerConfirmed === true || deal.buyerConfirmed === true || deal.buyerApproved === true;
  if (!hasBuyerConfirmation && !transactionEvidenceRef) {
    return res.status(400).json({
      error: "Security Check Failed: Escrow release requires verified buyer milestone confirmation or verified transaction evidence reference.",
      code: "BUYER_CONFIRMATION_REQUIRED"
    });
  }

  deal.status = "completed";
  deal.fundsReleased = true;
  deal.buyerConfirmed = true;
  deal.releasedBy = req.user._id;
  deal.releasedAt = new Date();
  deal.transactionEvidenceRef = transactionEvidenceRef || deal.dealReference || `TXN-ESC-${Date.now()}`;
  deal.stage = "Escrow Consideration Disbursed · Title Deed Executed";

  db.auditLogs.push({
    _id: db.generateId('log'),
    actorId: req.user._id,
    actorName: req.user.name,
    action: "ESCROW_FUNDS_RELEASED",
    entity: "Deal",
    entityId: deal._id,
    details: `Authorized escrow disbursement of ₹${deal.offerAmount?.toLocaleString('en-IN') || deal.totalPropertyValue?.toLocaleString('en-IN')} for ${deal.propertyTitle}. Evidence: ${deal.transactionEvidenceRef}. Authorized by Admin ${req.user.name}.`,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: `Escrow funds authorized and released for ${deal.propertyTitle}.`,
    escrow: deal
  });
};

exports.freezeEscrow = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const deal = (db.escrows || []).find(e => e._id === id);
  if (!deal) return res.status(404).json({ error: "Deal record not found" });

  deal.status = "on_hold";
  deal.stage = `Mediation Hold: ${reason || 'Document discrepancy under review'}`;

  db.auditLogs.push({
    _id: db.generateId('log'),
    actorId: req.user._id,
    actorName: req.user.name,
    action: "DEAL_HELD_FOR_MEDIATION",
    entity: "Deal",
    entityId: deal._id,
    details: `Deal #${deal._id} put on hold: ${reason || 'Buyer/Seller request'}`,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: `Deal #${deal._id} placed on hold for PlotPin mediation.`,
    escrow: deal
  });
};

// =========================================================================
// SUPPORT HELPDESK & TICKETS
// =========================================================================
exports.getSupportTickets = (req, res) => {
  const enriched = (db.supportTickets || []).map(t => {
    const user = (db.users || []).find(u => u._id === t.userId);
    return {
      ...t,
      customerName: user?.name || t.customerName || 'Citizen User',
      customerEmail: user?.email || t.customerEmail || '',
      customerPhone: user?.mobile || user?.phone || t.customerPhone || ''
    };
  });
  res.json({
    success: true,
    count: enriched.length,
    tickets: enriched
  });
};

exports.replySupportTicket = (req, res) => {
  const { id } = req.params;
  const { replyText, newStatus } = req.body;
  const ticket = (db.supportTickets || []).find(t => t._id === id);
  if (!ticket) return res.status(404).json({ error: "Support ticket not found" });

  if (replyText) {
    if (!ticket.replies) ticket.replies = [];
    ticket.replies.push({
      sender: `Admin Support (${req.user.name})`,
      text: replyText,
      timestamp: new Date()
    });
    ticket.adminReply = replyText;
  }

  if (newStatus) {
    ticket.status = newStatus;
    if (newStatus === 'resolved') {
      ticket.resolvedAt = new Date();
    }
  }

  db.auditLogs.push({
    _id: db.generateId('log'),
    actorId: req.user._id,
    actorName: req.user.name,
    action: "SUPPORT_TICKET_REPLIED",
    entity: "SupportTicket",
    entityId: ticket._id,
    details: `Support ticket #${ticket._id} updated to ${ticket.status}`,
    timestamp: new Date()
  });

  res.json({
    success: true,
    message: "Support response sent and ticket status updated.",
    ticket
  });
};

