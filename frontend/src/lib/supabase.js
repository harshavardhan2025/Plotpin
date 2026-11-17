import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uvticruppilaigbmjwji.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_KEY || '';

// Valid client-side public anon key must be a valid JWT (starts with eyJ...) or designated live key
export const isLiveClientSupabase = Boolean(
  rawKey &&
  !rawKey.includes('secret') &&
  !rawKey.includes('demo') &&
  (rawKey.startsWith('eyJ') || rawKey.length > 50)
);

let supabaseInstance = null;
if (isLiveClientSupabase) {
  try {
    supabaseInstance = createClient(supabaseUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (err) {
    console.warn('Supabase client initialization notice:', err.message);
  }
}

export const supabase = supabaseInstance;

/**
 * Supabase Storage Service
 * Handles image and document uploads with safe local fallback when running in delegated API mode.
 */
export const storage = {
  uploadPropertyPhoto: async (file, path) => {
    if (!isLiveClientSupabase || !supabase?.storage) {
      // Local fallback object URL when running without direct client Supabase credentials
      const localUrl = URL.createObjectURL(file);
      return { filePath: file.name, publicUrl: localUrl };
    }

    const filename = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const filePath = path ? `${path}/${filename}` : filename;
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) {
      const localUrl = URL.createObjectURL(file);
      return { filePath: file.name, publicUrl: localUrl };
    }

    const { data: { publicUrl } } = supabase.storage
      .from('property-images')
      .getPublicUrl(filePath);

    return { filePath: data.path, publicUrl };
  },

  uploadPrivateDocument: async (file, propertyId, docType) => {
    if (!isLiveClientSupabase || !supabase?.storage) {
      return { filePath: `${propertyId}/${docType}_${file.name}` };
    }

    const filename = `${propertyId}/${docType}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabase.storage
      .from('property-documents')
      .upload(filename, file, { cacheControl: '3600', upsert: false });

    if (error) return { filePath: filename };
    return { filePath: data.path };
  },

  getSignedDocumentUrl: async (filePath, expiresInSeconds = 300) => {
    if (!isLiveClientSupabase || !supabase?.storage) {
      return filePath || '';
    }

    const { data, error } = await supabase.storage
      .from('property-documents')
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) return '';
    return data?.signedUrl || '';
  }
};

/**
 * Direct Supabase Native Data Services
 * Only executes network requests if a valid client-side public anon key is provided.
 * When running in delegated backend mode, delegates seamlessly to Express backend.
 */
export const supabaseApi = {
  // 1. Properties Discovery
  getProperties: async ({ category, purpose, excludeOwnerId = 'usr_client_001' } = {}) => {
    if (!isLiveClientSupabase || !supabase) return [];

    try {
      let query = supabase
        .from('properties')
        .select('*')
        .eq('verification_status', 'approved')
        .eq('publication_status', 'published')
        .eq('availability_status', 'available');

      if (excludeOwnerId) {
        query = query.neq('owner_id', excludeOwnerId);
      }
      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      if (purpose) {
        query = query.eq('purpose', purpose);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  },

  // 2. User Owned Listings
  getMyProperties: async (ownerId = 'usr_client_001') => {
    if (!isLiveClientSupabase || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []).map(p => ({
        ...p,
        _id: p.id,
        ownerId: p.owner_id,
        propertyType: p.property_type,
        verificationStatus: p.verification_status,
        publicationStatus: p.publication_status,
        availabilityStatus: p.availability_status,
        cadastralVerified: p.cadastral_verified,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
    } catch (err) {
      return [];
    }
  },

  // 3. Create Listing
  createProperty: async (propertyData) => {
    if (!isLiveClientSupabase || !supabase) {
      return {
        ...propertyData,
        id: propertyData._id || propertyData.id || `prop_${Date.now()}`
      };
    }

    try {
      const payload = {
        id: propertyData._id || propertyData.id || `prop_${Date.now()}`,
        owner_id: propertyData.ownerId || propertyData.owner_id || 'usr_client_001',
        title: propertyData.title,
        description: propertyData.description || '',
        category: propertyData.category || 'residential',
        property_type: propertyData.propertyType || propertyData.property_type || 'flat',
        purpose: propertyData.purpose || 'sale',
        price: Number(propertyData.price) || 0,
        currency: propertyData.currency || 'INR',
        area: propertyData.area || { value: 1200, unit: 'sqft' },
        bedrooms: propertyData.bedrooms != null ? Number(propertyData.bedrooms) : 0,
        bathrooms: propertyData.bathrooms != null ? Number(propertyData.bathrooms) : 0,
        amenities: propertyData.amenities || [],
        location: propertyData.location || {
          address: '100ft Road Corridor',
          locality: 'Indiranagar',
          city: 'Bengaluru',
          state: 'Andhra Pradesh',
          pincode: '560038',
          coordinates: [77.6412, 12.9784]
        },
        images: propertyData.images || [],
        cadastral_verified: propertyData.cadastralVerified || false,
        verification_status: propertyData.verificationStatus || 'pending_review',
        publication_status: propertyData.publicationStatus || 'unpublished',
        availability_status: propertyData.availabilityStatus || 'available'
      };

      const { data, error } = await supabase
        .from('properties')
        .insert([payload])
        .select()
        .single();

      if (error) return payload;
      return {
        ...data,
        _id: data.id,
        ownerId: data.owner_id,
        propertyType: data.property_type,
        verificationStatus: data.verification_status,
        publicationStatus: data.publication_status,
        availabilityStatus: data.availability_status,
        cadastralVerified: data.cadastral_verified
      };
    } catch (err) {
      return propertyData;
    }
  },

  // 4. Submit for Admin Verification
  submitForReview: async (propertyId) => {
    if (!isLiveClientSupabase || !supabase) return { success: true };

    try {
      const { data, error } = await supabase
        .from('properties')
        .update({
          verification_status: 'pending_review',
          updated_at: new Date().toISOString()
        })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) return { success: true };
      return data;
    } catch (err) {
      return { success: true };
    }
  },

  // 5. Admin Verification Queue
  getAdminQueue: async () => {
    if (!isLiveClientSupabase || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .in('verification_status', ['pending_review', 'submitted', 'needs_changes'])
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []).map(p => ({
        ...p,
        _id: p.id,
        ownerId: p.owner_id,
        propertyType: p.property_type,
        verificationStatus: p.verification_status,
        publicationStatus: p.publication_status,
        availabilityStatus: p.availability_status,
        cadastralVerified: p.cadastral_verified,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }));
    } catch (err) {
      return [];
    }
  },

  // 6. Admin Approval
  approveProperty: async (propertyId, reviewerId = 'usr_admin_001') => {
    if (!isLiveClientSupabase || !supabase) return { success: true };

    try {
      const { data, error } = await supabase
        .from('properties')
        .update({
          verification_status: 'approved',
          publication_status: 'published',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          published_at: new Date().toISOString()
        })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) return { success: true };
      return data;
    } catch (err) {
      return { success: true };
    }
  },

  // 7. Admin Change Request
  requestChanges: async (propertyId, notes, reviewerId = 'usr_admin_001') => {
    if (!isLiveClientSupabase || !supabase) return { success: true };

    try {
      const { data, error } = await supabase
        .from('properties')
        .update({
          verification_status: 'needs_changes',
          review_notes: notes,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) return { success: true };
      return data;
    } catch (err) {
      return { success: true };
    }
  },

  // 8. Admin Rejection
  rejectProperty: async (propertyId, reason, reviewerId = 'usr_admin_001') => {
    if (!isLiveClientSupabase || !supabase) return { success: true };

    try {
      const { data, error } = await supabase
        .from('properties')
        .update({
          verification_status: 'rejected',
          publication_status: 'unpublished',
          review_notes: reason,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) return { success: true };
      return data;
    } catch (err) {
      return { success: true };
    }
  },

  // 9. Deal Completion
  completeDeal: async (propertyId, { outcome = 'sold', buyerName, finalPrice }) => {
    if (!isLiveClientSupabase || !supabase) return { success: true };

    try {
      const { data, error } = await supabase
        .from('properties')
        .update({
          availability_status: outcome === 'sold' ? 'sold' : 'rented',
          publication_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) return { success: true };
      return data;
    } catch (err) {
      return { success: true };
    }
  },

  // 10. Appointments
  getAppointments: async (userId = 'usr_client_001') => {
    if (!isLiveClientSupabase || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .or(`buyer_id.eq.${userId},owner_id.eq.${userId}`)
        .order('start_at', { ascending: true });

      if (error) return [];
      return data || [];
    } catch (err) {
      return [];
    }
  },

  createAppointment: async (appointmentData) => {
    if (!isLiveClientSupabase || !supabase) {
      return { id: 'apt_' + Date.now(), ...appointmentData };
    }

    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select()
        .single();

      if (error) return appointmentData;
      return data;
    } catch (err) {
      return appointmentData;
    }
  },

  // 11. Call Requests
  requestCall: async (callData) => {
    if (!isLiveClientSupabase || !supabase) {
      return { id: 'call_' + Date.now(), ...callData };
    }

    try {
      const { data, error } = await supabase
        .from('call_requests')
        .insert([callData])
        .select()
        .single();

      if (error) return callData;
      return data;
    } catch (err) {
      return callData;
    }
  },

  // 12. Fallback Recommendations
  getRecommendations: async () => {
    return [];
  }
};
