/**
 * Central Property Eligibility Logic for PlotPin
 * Enforces unified discovery, search, recommendation, map, and action rules.
 */

/**
 * Checks if a property is eligible for public discovery (search, explore, maps, recommendations, etc.)
 * @param {Object} prop - Property object
 * @param {string|null} viewerId - Authenticated user ID (if any)
 * @returns {boolean}
 */
function isPropertyPubliclyEligible(prop, viewerId = null) {
  if (!prop) return false;

  // 1. Must not be permanently removed
  if (
    prop.isRemoved || 
    prop.status === 'removed' || 
    prop.publicationStatus === 'removed' || 
    prop.verificationStatus === 'removed' ||
    prop.availabilityStatus === 'removed'
  ) {
    return false;
  }

  // 2. Must not have a pending revision waiting for admin reapproval
  if (
    prop.hasPendingRevision === true || 
    prop.verificationStatus === 'pending_revision' || 
    prop.publicationStatus === 'pending_revision' ||
    prop.isTemporarilyHidden === true
  ) {
    return false;
  }

  // 3. Must be approved and published
  const isApproved = prop.verificationStatus === 'approved' || prop.verification_status === 'approved' || prop.status === 'approved';
  const isPublished = prop.publicationStatus === 'published' || prop.publication_status === 'published' || prop.status === 'published' || prop.status === 'approved';
  if (!isApproved || !isPublished) {
    return false;
  }

  // 4. Must not be suspended, sold, rented, completed, or otherwise restricted
  if (
    prop.publicationStatus === 'suspended' ||
    prop.availabilityStatus === 'suspended' ||
    prop.availabilityStatus === 'sold' ||
    prop.availabilityStatus === 'rented' ||
    prop.status === 'sold' ||
    prop.status === 'rented' ||
    prop.publicationStatus === 'completed' ||
    prop.availability_status === 'sold' ||
    prop.availability_status === 'rented' ||
    prop.publication_status === 'completed'
  ) {
    return false;
  }

  // 5. Authenticated viewer is NEVER shown their own properties in public discovery (search, maps, AI matcher)!
  if (viewerId) {
    const vId = typeof viewerId === 'object' ? String(viewerId._id || viewerId.id || viewerId.auth_id || '') : String(viewerId || '');
    const vEmail = typeof viewerId === 'object' ? String(viewerId.email || '').toLowerCase().trim() : '';
    const vPhone = typeof viewerId === 'object' ? String(viewerId.mobile || '').replace(/\D/g, '').slice(-10) : '';

    const owner = String(prop.ownerId || prop.owner_id || '').trim();
    const ownerEmail = String(prop.ownerEmail || prop.owner_email || '').toLowerCase().trim();
    const ownerPhone = String(prop.ownerPhone || prop.owner_phone || '').replace(/\D/g, '').slice(-10);

    if (owner && vId && owner === vId) {
      return false;
    }
    if (vEmail && ownerEmail && vEmail === ownerEmail) {
      return false;
    }
    if (vPhone && ownerPhone && vPhone === ownerPhone) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if a property is eligible for buyer actions (visits, offers, calls, inquiries)
 * @param {Object} prop - Property object
 * @param {string|null} viewerId - Authenticated user ID
 * @returns {{ eligible: boolean, reason?: string, code?: string }}
 */
function isPropertyActionEligible(prop, viewerId = null) {
  if (!prop) {
    return { eligible: false, reason: "Property listing not found", code: "NOT_FOUND" };
  }

  // 1. Permanently removed
  if (
    prop.isRemoved || 
    prop.status === 'removed' || 
    prop.publicationStatus === 'removed' || 
    prop.verificationStatus === 'removed' ||
    prop.availabilityStatus === 'removed'
  ) {
    return { eligible: false, reason: "This property listing has been permanently removed", code: "PROPERTY_REMOVED" };
  }

  // 2. Inactive, sold, rented, or suspended (takes precedence over buyer identity)
  if (
    prop.publicationStatus === 'suspended' ||
    prop.availabilityStatus === 'suspended' ||
    prop.availabilityStatus === 'sold' ||
    prop.availabilityStatus === 'rented' ||
    prop.status === 'sold' ||
    prop.status === 'rented' ||
    prop.publicationStatus === 'completed' ||
    prop.availability_status === 'sold' ||
    prop.availability_status === 'rented' ||
    prop.publication_status === 'completed'
  ) {
    return { 
      eligible: false, 
      reason: "This property is no longer available (sold, rented, or closed)", 
      code: "PROPERTY_NOT_AVAILABLE" 
    };
  }

  // 3. Owner check: owners cannot act as buyers on their own listings
  if (viewerId) {
    const owner = prop.ownerId || prop.owner_id;
    if (owner && String(owner) === String(viewerId)) {
      return { 
        eligible: false, 
        reason: "Property owners cannot perform buyer actions on their own listings", 
        code: "OWNER_SELF_ACTION" 
      };
    }
  }

  // 4. Pending revision
  if (
    prop.hasPendingRevision === true || 
    prop.verificationStatus === 'pending_revision' || 
    prop.publicationStatus === 'pending_revision' ||
    prop.isTemporarilyHidden === true
  ) {
    return { 
      eligible: false, 
      reason: "This property is temporarily unavailable while proposed updates undergo administrative review", 
      code: "PENDING_REVISION" 
    };
  }

  // 5. Must be approved and published
  if (prop.verificationStatus !== 'approved' || prop.publicationStatus !== 'published') {
    return { 
      eligible: false, 
      reason: "This property is undergoing administrative verification review and is not open for transactions", 
      code: "NOT_ACTIVE" 
    };
  }

  return { eligible: true };
}

module.exports = {
  isPropertyPubliclyEligible,
  isPropertyActionEligible
};
