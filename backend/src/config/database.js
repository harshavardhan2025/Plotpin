/**
 * Supabase Database Connection & Adapter
 * Strictly configured via environment variables. Hardcoded secret keys removed.
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('FATAL: SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variables must be defined.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Properties collection initially empty (zero data)
const initialProperties = [];

const initialUsers = [
  {
    _id: 'usr_admin_corp',
    name: 'Admin PlotPin',
    email: 'admin@plotpin.com',
    mobile: '+91 9845000001',
    passwordHash: '$2a$10$U6Lg6PXqGOeBArwXZaDezOmWwtzqJPiMW30wAioW/ovdA4E.koLH6',
    emailVerified: true,
    roles: ['admin', 'user'],
    accountStatus: 'active',
    activeMode: 'admin'
  }
];

const initialDocuments = [];
const initialCallRequests = [];

class SupabaseDatabaseStore {
  constructor() {
    this.supabase = supabase;
    this.users = [...initialUsers];
    this.properties = [...initialProperties];
    this.documents = [];
    this.appointments = [];
    this.inquiries = [];
    this.callRequests = [...initialCallRequests];
    this.supportTickets = [];
    this.escrows = [];
    this.deals = [];
    this.auditLogs = [];

    this._lastSyncTime = 0;
    this._syncPromise = null;

    // Asynchronously synchronize initial data without blocking constructor
    this.syncFromSupabase(true).catch(e => console.warn('Initial sync warning:', e.message));
  }

  async syncFromSupabase(force = false) {
    const now = Date.now();
    // Throttle background syncs to at most once per 60 seconds unless forced
    if (!force && this._lastSyncTime && (now - this._lastSyncTime < 60000)) {
      return;
    }

    if (this._syncPromise) {
      return this._syncPromise;
    }

    this._syncPromise = (async () => {
      try {
        // Query remote tables concurrently rather than sequentially
        const [propsRes, usersRes, aptsRes, inqsRes, tktsRes, logsRes] = await Promise.allSettled([
          this.supabase.from('properties').select('*'),
          this.supabase.from('users').select('*'),
          this.supabase.from('appointments').select('*'),
          this.supabase.from('inquiries').select('*'),
          this.supabase.from('support_tickets').select('*'),
          this.supabase.from('audit_logs').select('*').limit(100)
        ]);

        if (propsRes.status === 'fulfilled' && !propsRes.value.error && propsRes.value.data?.length > 0) {
          const dbProps = propsRes.value.data;
          const syncedProps = dbProps.map(p => ({
            _id: p.id,
            ownerId: p.owner_id,
            title: p.title,
            description: p.description,
            category: p.category,
            propertyType: p.property_type,
            purpose: p.purpose,
            price: Number(p.price),
            currency: p.currency || 'INR',
            area: p.area,
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
            amenities: p.amenities,
            location: p.location,
            images: p.images,
            cadastralVerified: p.cadastral_verified,
            verificationStatus: p.verification_status,
            publicationStatus: p.publication_status,
            availabilityStatus: p.availability_status,
            typeSpecificData: p.type_specific_data || {},
            landDetails: p.land_details || {},
            reviewNotes: p.review_notes,
            reviewedBy: p.reviewed_by,
            reviewedAt: p.reviewed_at ? new Date(p.reviewed_at) : null,
            publishedAt: p.published_at ? new Date(p.published_at) : null,
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at)
          }));

          const merged = syncedProps.map(sp => {
            const existing = this.properties.find(ep => ep._id === sp._id);
            if (existing) {
              return {
                ...sp,
                ...existing,
                hasPendingRevision: existing.hasPendingRevision ?? false,
                pendingRevision: existing.pendingRevision || null,
                isTemporarilyHidden: existing.isTemporarilyHidden ?? false,
                typeSpecificData: existing.typeSpecificData || sp.typeSpecificData || {},
                landDetails: existing.landDetails || sp.landDetails || {},
                documents: existing.documents || sp.documents || []
              };
            }
            return sp;
          });

          const syncedIds = new Set(syncedProps.map(p => p._id));
          const unsyncedLocal = this.properties.filter(p => !syncedIds.has(p._id));
          this.properties = [...unsyncedLocal, ...merged];
        }

        if (usersRes.status === 'fulfilled' && !usersRes.value.error) {
          const dbUsers = usersRes.value.data || [];
          const syncedUsers = dbUsers.map(u => ({
            _id: u.id,
            auth_id: u.auth_id || null,
            name: u.name,
            email: u.email,
            emailVerified: Boolean(u.email_verified),
            mobile: u.mobile,
            mobileVerified: Boolean(u.mobile_verified),
            accountStatus: u.account_status,
            roles: u.roles || ['user', 'buyer', 'seller'],
            activeMode: u.active_mode || 'buyer',
            preferences: u.preferences,
            createdAt: new Date(u.created_at),
            updatedAt: new Date(u.updated_at)
          }));

          const validEmails = new Set(syncedUsers.map(u => (u.email || '').toLowerCase()));
          const initialMap = new Map(initialUsers.map(u => [u.email.toLowerCase(), u]));
          const syncedIds = new Set(syncedUsers.map(u => u._id));
          const localOnly = this.users.filter(u => {
            const id = u._id || u.id;
            return !syncedIds.has(id) && !initialUsers.some(iu => iu._id === id);
          });

          // In-memory users = initial system users + active users in public.users + unsynced local users
          this.users = [...initialUsers];
          for (const su of syncedUsers) {
            if (!initialMap.has((su.email || '').toLowerCase())) {
              this.users.push(su);
            }
          }
          for (const lu of localOnly) {
            if (!this.users.some(u => (u._id === (lu._id || lu.id) || u.id === (lu._id || lu.id)))) {
              this.users.push(lu);
            }
          }

          // If a user was deleted from public.users in Supabase UI, clean up orphan in auth.users
          try {
            const { data: authData } = await this.supabase.auth.admin.listUsers({ perPage: 1000 });
            if (authData?.users?.length > 0) {
              for (const au of authData.users) {
                if (!au.email) continue;
                const em = au.email.toLowerCase();
                const isInitial = initialMap.has(em);
                const inDb = validEmails.has(em);
                if (!isInitial && !inDb) {
                  // User deleted from database! Purge orphan auth account so re-registration works cleanly
                  await this.supabase.auth.admin.deleteUser(au.id).catch(() => {});
                }
              }
            }
          } catch (cleanErr) {}
        }

        if (aptsRes.status === 'fulfilled' && !aptsRes.value.error && aptsRes.value.data?.length > 0) {
          const dbApts = aptsRes.value.data;
          const syncedApts = dbApts.map(a => ({
            _id: a.id,
            propertyId: a.property_id,
            buyerId: a.buyer_id,
            ownerId: a.owner_id,
            startAt: new Date(a.start_at),
            endAt: new Date(a.end_at),
            status: a.status || 'confirmed',
            notes: a.notes,
            createdAt: new Date(a.created_at)
          }));
          const syncedIds = new Set(syncedApts.map(a => a._id));
          const unsyncedLocal = this.appointments.filter(a => !syncedIds.has(a._id));
          this.appointments = [...unsyncedLocal, ...syncedApts];
        }

        if (inqsRes.status === 'fulfilled' && !inqsRes.value.error && inqsRes.value.data?.length > 0) {
          const dbInqs = inqsRes.value.data;
          const syncedInqs = dbInqs.map(i => ({
            _id: i.id,
            propertyId: i.property_id,
            buyerId: i.buyer_id,
            message: i.message,
            status: i.status || 'open',
            createdAt: new Date(i.created_at)
          }));
          const syncedIds = new Set(syncedInqs.map(i => i._id));
          const unsyncedLocal = this.inquiries.filter(i => !syncedIds.has(i._id));
          this.inquiries = [...unsyncedLocal, ...syncedInqs];
        }

        if (tktsRes.status === 'fulfilled' && !tktsRes.value.error && tktsRes.value.data?.length > 0) {
          const dbTickets = tktsRes.value.data;
          const syncedTickets = dbTickets.map(t => ({
            _id: t.id,
            userId: t.user_id,
            subject: t.subject,
            details: t.details || t.message || '',
            message: t.details || t.message || '',
            category: t.category || 'General Inquiry',
            priority: t.priority || 'medium',
            assignedStaff: t.assigned_staff || 'Support Desk',
            status: t.status || 'open',
            adminReply: t.admin_reply,
            createdAt: new Date(t.created_at)
          }));
          const syncedIds = new Set(syncedTickets.map(t => t._id));
          const unsyncedLocal = this.supportTickets.filter(t => !syncedIds.has(t._id));
          this.supportTickets = [...unsyncedLocal, ...syncedTickets];
        }

        if (logsRes.status === 'fulfilled' && !logsRes.value.error && logsRes.value.data?.length > 0) {
          const dbLogs = logsRes.value.data;
          this.auditLogs = dbLogs.map(l => ({
            _id: l.id,
            actorId: l.actor_id,
            actorName: l.actor_name,
            action: l.action,
            entity: l.entity,
            entityId: l.entity_id,
            details: l.details,
            timestamp: new Date(l.timestamp)
          }));
        }

        this._lastSyncTime = Date.now();
      } catch (e) {
        console.warn('Background Supabase sync warning:', e.message);
      } finally {
        this._syncPromise = null;
      }
    })();

    return this._syncPromise;
  }

  // Supabase Persistence Operations
  async insertProperty(prop) {
    const existingIdx = this.properties.findIndex(p => p._id === prop._id);
    if (existingIdx !== -1) {
      this.properties[existingIdx] = prop;
    } else {
      this.properties.unshift(prop);
    }
    try {
      const loc = prop.location || {
        address: 'Near Pragati College, ADB Road, Surampalem',
        locality: 'Surampalem',
        city: 'Kakinada',
        state: 'Andhra Pradesh',
        pincode: '533437',
        coordinates: [82.2474, 16.9890]
      };
      const payload = {
        id: prop._id,
        owner_id: prop.ownerId || prop.owner_id || 'usr_client_001',
        title: prop.title,
        description: prop.description || '',
        category: prop.category || 'residential',
        property_type: prop.propertyType || prop.property_type || 'flat',
        purpose: prop.purpose || 'sale',
        price: prop.price,
        currency: prop.currency || 'INR',
        area: prop.area || { value: 1000, unit: 'sqft' },
        bedrooms: prop.bedrooms ?? 2,
        bathrooms: prop.bathrooms ?? 2,
        amenities: prop.amenities || ['parking'],
        location: loc,
        images: prop.images || [],
        cadastral_verified: prop.cadastralVerified ?? prop.cadastral_verified ?? true,
        verification_status: prop.verificationStatus || prop.verification_status || 'pending_review',
        publication_status: prop.publicationStatus || prop.publication_status || 'unpublished',
        availability_status: prop.availabilityStatus || prop.availability_status || 'available'
      };
      // Ensure owner user exists in Supabase users table to satisfy foreign key constraint
      const ownerUser = this.users.find(u => u._id === payload.owner_id);
      if (ownerUser) {
        try {
          await this.supabase.from('users').upsert([{
            id: ownerUser._id,
            name: ownerUser.name || 'Property Owner',
            email: ownerUser.email || `${ownerUser._id}@plotpin.local`,
            mobile: ownerUser.mobile || '',
            account_status: ownerUser.accountStatus || 'active',
            roles: ownerUser.roles || ['user']
          }]);
        } catch (uErr) {
          // Non-blocking user upsert
        }
      }

      const { error } = await this.supabase.from('properties').upsert([payload]);
      if (error) {
        console.error('Supabase property upsert error:', error.message);
      }
    } catch (e) {
      console.error('Supabase property upsert error:', e);
    }
    return prop;
  }

  async insertUser(user) {
    const existingIdx = this.users.findIndex(u => u._id === user._id);
    if (existingIdx !== -1) {
      this.users[existingIdx] = user;
    } else {
      this.users.unshift(user);
    }
    try {
      const payload = {
        id: user._id,
        auth_id: user.auth_id || null,
        name: user.name,
        email: user.email,
        email_verified: user.emailVerified ?? true,
        mobile: user.mobile,
        mobile_verified: user.mobileVerified ?? true,
        account_status: user.accountStatus || 'active',
        roles: user.roles || ['user'],
        active_mode: user.activeMode || 'buyer',
        preferences: user.preferences || {}
      };
      const { error } = await this.supabase.from('users').upsert([payload]);
      if (error) {
        console.error('Supabase user upsert error:', error.message);
      }
    } catch (e) {
      console.error('Supabase user upsert exception:', e);
    }
    return user;
  }

  async updateUser(id, updates) {
    const idx = this.users.findIndex(u => u._id === id);
    if (idx !== -1) {
      this.users[idx] = { ...this.users[idx], ...updates, updatedAt: new Date() };
    }
    try {
      const dbUpdates = {};
      if (updates.auth_id !== undefined) dbUpdates.auth_id = updates.auth_id;
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.mobile !== undefined) dbUpdates.mobile = updates.mobile;
      if (updates.accountStatus !== undefined) dbUpdates.account_status = updates.accountStatus;
      if (updates.roles !== undefined) dbUpdates.roles = updates.roles;
      if (updates.activeMode !== undefined) dbUpdates.active_mode = updates.activeMode;
      if (updates.preferences !== undefined) dbUpdates.preferences = updates.preferences;
      dbUpdates.updated_at = new Date().toISOString();

      const { error } = await this.supabase.from('users').update(dbUpdates).eq('id', id);
      if (error) {
        console.error('Supabase user update error:', error.message);
      }
    } catch (e) {
      console.error('Supabase user update exception:', e);
    }
    return this.users[idx];
  }

  async updateProperty(id, updates) {
    const idx = this.properties.findIndex(p => p._id === id);
    if (idx !== -1) {
      this.properties[idx] = { ...this.properties[idx], ...updates, updatedAt: new Date() };
    }
    try {
      const dbUpdates = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.propertyType !== undefined || updates.property_type !== undefined) {
        dbUpdates.property_type = updates.propertyType || updates.property_type;
      }
      if (updates.purpose !== undefined) dbUpdates.purpose = updates.purpose;
      if (updates.area !== undefined) dbUpdates.area = updates.area;
      if (updates.bedrooms !== undefined) dbUpdates.bedrooms = updates.bedrooms;
      if (updates.bathrooms !== undefined) dbUpdates.bathrooms = updates.bathrooms;
      if (updates.amenities !== undefined) dbUpdates.amenities = updates.amenities;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.images !== undefined || updates.photos !== undefined) {
        dbUpdates.images = updates.images || updates.photos;
      }
      if (updates.typeSpecificData !== undefined || updates.type_specific_data !== undefined) {
        dbUpdates.type_specific_data = updates.typeSpecificData || updates.type_specific_data;
      }
      if (updates.landDetails !== undefined || updates.land_details !== undefined) {
        dbUpdates.land_details = updates.landDetails || updates.land_details;
      }
      if (updates.verificationStatus !== undefined) dbUpdates.verification_status = updates.verificationStatus;
      if (updates.publicationStatus !== undefined) dbUpdates.publication_status = updates.publicationStatus;
      if (updates.availabilityStatus !== undefined) dbUpdates.availability_status = updates.availabilityStatus;
      if (updates.cadastralVerified !== undefined) dbUpdates.cadastral_verified = updates.cadastralVerified;
      if (updates.reviewNotes !== undefined) dbUpdates.review_notes = updates.reviewNotes;
      if (updates.rejectionReason !== undefined) dbUpdates.review_notes = updates.rejectionReason;
      if (updates.reviewedBy !== undefined) dbUpdates.reviewed_by = updates.reviewedBy;
      if (updates.reviewedAt !== undefined) dbUpdates.reviewed_at = updates.reviewedAt;
      if (updates.publishedAt !== undefined) dbUpdates.published_at = updates.publishedAt;
      dbUpdates.updated_at = new Date().toISOString();

      await this.supabase.from('properties').update(dbUpdates).eq('id', id);
    } catch (e) {
      console.error('Supabase property update error:', e);
    }
    return this.properties[idx];
  }

  async deleteProperty(id) {
    this.properties = this.properties.filter(p => p._id !== id);
    try {
      await this.supabase.from('properties').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase property delete error:', e);
    }
  }

  async insertAppointment(apt) {
    this.appointments.unshift(apt);
    try {
      await this.supabase.from('appointments').insert([{
        id: apt._id,
        property_id: apt.propertyId,
        buyer_id: apt.buyerId,
        owner_id: apt.ownerId,
        start_at: apt.startAt instanceof Date ? apt.startAt.toISOString() : apt.startAt,
        end_at: apt.endAt instanceof Date ? apt.endAt.toISOString() : apt.endAt,
        status: apt.status || 'confirmed',
        notes: apt.notes || ''
      }]);
    } catch (e) {
      console.error('Supabase appointment insert error:', e);
    }
    return apt;
  }

  async updateAppointment(id, updates) {
    const idx = this.appointments.findIndex(a => a._id === id);
    if (idx !== -1) {
      this.appointments[idx] = { ...this.appointments[idx], ...updates };
    }
    try {
      const dbUpdates = {};
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.startAt !== undefined) dbUpdates.start_at = updates.startAt;
      if (updates.endAt !== undefined) dbUpdates.end_at = updates.endAt;

      await this.supabase.from('appointments').update(dbUpdates).eq('id', id);
    } catch (e) {
      console.error('Supabase appointment update error:', e);
    }
    return this.appointments[idx];
  }

  async insertInquiry(inq) {
    this.inquiries.unshift(inq);
    try {
      await this.supabase.from('inquiries').insert([{
        id: inq._id,
        property_id: inq.propertyId,
        buyer_id: inq.buyerId,
        message: inq.message || '',
        status: inq.status || 'open'
      }]);
    } catch (e) {
      console.error('Supabase inquiry insert error:', e);
    }
    return inq;
  }

  async insertAuditLog(log) {
    this.auditLogs.unshift(log);
    try {
      await this.supabase.from('audit_logs').insert([{
        id: log._id,
        actor_id: log.actorId,
        actor_name: log.actorName,
        action: log.action,
        entity: log.entity,
        entity_id: log.entityId,
        details: log.details || ''
      }]);
    } catch (e) {
      console.error('Supabase audit log insert error:', e);
    }
    return log;
  }

  async insertSupportTicket(ticket) {
    this.supportTickets.unshift(ticket);
    try {
      await this.supabase.from('support_tickets').insert([{
        id: ticket._id,
        user_id: ticket.userId,
        subject: ticket.subject,
        message: ticket.message,
        status: ticket.status || 'open'
      }]);
    } catch (e) {
      console.error('Supabase ticket insert error:', e);
    }
    return ticket;
  }

  async updateSupportTicket(id, updates) {
    const idx = this.supportTickets.findIndex(t => t._id === id);
    if (idx !== -1) {
      this.supportTickets[idx] = { ...this.supportTickets[idx], ...updates };
    }
    try {
      const dbUpdates = {};
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.adminReply !== undefined) dbUpdates.admin_reply = updates.adminReply;

      await this.supabase.from('support_tickets').update(dbUpdates).eq('id', id);
    } catch (e) {
      console.error('Supabase ticket update error:', e);
    }
    return this.supportTickets[idx];
  }

  generateId(prefix = 'id') {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
  }
}

const db = new SupabaseDatabaseStore();

module.exports = {
  db,
  supabase
};
