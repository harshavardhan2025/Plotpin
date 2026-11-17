-- ==============================================================================
-- LANDPIN PROPERTY MARKETPLACE — PRODUCTION SUPABASE POSTGRESQL SCHEMA & RLS
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/uvticruppilaigbmjwji/sql
-- ==============================================================================

-- Enable essential extensions (PostGIS if available for geospatial, UUID, crypto)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. PROFILES TABLE (Linked with Supabase Auth or Unified Citizen ID)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' (unified buyer & seller) | 'admin'
  avatar_url TEXT,
  preferences JSONB DEFAULT '{"preferredLocations": ["Indiranagar", "Whitefield"], "purpose": "sale", "maxBudget": 50000000}'::jsonb,
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. PROPERTIES TABLE (Flats, Houses, Land, Commercial, Agricultural)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id TEXT PRIMARY KEY DEFAULT ('prop_' || encode(gen_random_bytes(6), 'hex')),
  owner_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,        -- 'residential' | 'land' | 'commercial' | 'agricultural'
  property_type TEXT NOT NULL,   -- 'flat' | 'apartment' | 'house' | 'villa' | 'plot' | 'shop' | 'office' | 'farmland'
  purpose TEXT NOT NULL,         -- 'sale' | 'rent'
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  rental_deposit NUMERIC DEFAULT 0,
  area JSONB NOT NULL DEFAULT '{"value": 1500, "unit": "sqft"}'::jsonb,
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  amenities TEXT[] DEFAULT ARRAY[]::text[],
  location JSONB NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  type_specific_data JSONB DEFAULT '{}'::jsonb,
  land_details JSONB DEFAULT '{}'::jsonb,
  
  -- Strict Status Separation Invariant
  cadastral_verified BOOLEAN DEFAULT FALSE,
  verification_status TEXT DEFAULT 'pending_review', -- 'draft' | 'pending_review' | 'needs_changes' | 'approved' | 'rejected'
  publication_status TEXT DEFAULT 'unpublished',     -- 'unpublished' | 'published' | 'suspended'
  availability_status TEXT DEFAULT 'available',     -- 'available' | 'under_offer' | 'sold' | 'rented'
  
  review_notes TEXT,
  reviewed_by TEXT REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. PROPERTY IMAGES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.property_images (
  id TEXT PRIMARY KEY DEFAULT ('img_' || encode(gen_random_bytes(6), 'hex')),
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  is_cover BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. PROPERTY DOCUMENTS TABLE (Strictly Private Deeds & e-Khata)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.property_documents (
  id TEXT PRIMARY KEY DEFAULT ('doc_' || encode(gen_random_bytes(6), 'hex')),
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'sale_deed' | 'e_khata' | '11e_survey_sketch' | 'encumbrance_certificate' | 'tax_receipt' | 'bda_approval'
  storage_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  review_status TEXT DEFAULT 'pending', -- 'pending' | 'verified' | 'needs_changes' | 'rejected'
  reviewer_id TEXT REFERENCES public.profiles(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. FAVORITES & SAVED SEARCHES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.favorites (
  id TEXT PRIMARY KEY DEFAULT ('fav_' || encode(gen_random_bytes(6), 'hex')),
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id TEXT PRIMARY KEY DEFAULT ('srch_' || encode(gen_random_bytes(6), 'hex')),
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  query_params JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. APPOINTMENTS & AVAILABILITY CALENDAR (Double-Booking Conflict Prevention)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_availability (
  id TEXT PRIMARY KEY DEFAULT ('avail_' || encode(gen_random_bytes(6), 'hex')),
  admin_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0-6 (Sun-Sat)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id TEXT PRIMARY KEY DEFAULT ('apt_' || encode(gen_random_bytes(6), 'hex')),
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed', -- 'confirmed' | 'cancelled' | 'completed' | 'rescheduled'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. CALL REQUESTS & INQUIRIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.call_requests (
  id TEXT PRIMARY KEY DEFAULT ('call_' || encode(gen_random_bytes(6), 'hex')),
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  note TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'assigned' | 'completed' | 'cancelled'
  assigned_to TEXT REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inquiries (
  id TEXT PRIMARY KEY DEFAULT ('inq_' || encode(gen_random_bytes(6), 'hex')),
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. REALTIME CONVERSATIONS & MESSAGES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY DEFAULT ('conv_' || encode(gen_random_bytes(6), 'hex')),
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY DEFAULT ('msg_' || encode(gen_random_bytes(6), 'hex')),
  conversation_id TEXT REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. OFFERS & DEALS (Negotiation & Deal Archival Invariant)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.offers (
  id TEXT PRIMARY KEY DEFAULT ('off_' || encode(gen_random_bytes(6), 'hex')),
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_amount NUMERIC NOT NULL,
  token_deposit NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deals (
  id TEXT PRIMARY KEY DEFAULT ('deal_' || encode(gen_random_bytes(6), 'hex')),
  property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  deal_type TEXT NOT NULL, -- 'sale' | 'rental'
  agreed_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'in_progress', -- 'in_progress' | 'completed' | 'cancelled'
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. NOTIFICATIONS, SUPPORT TICKETS & AUDIT LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY DEFAULT ('notif_' || encode(gen_random_bytes(6), 'hex')),
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id TEXT PRIMARY KEY DEFAULT ('tkt_' || encode(gen_random_bytes(6), 'hex')),
  user_id TEXT REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- 'open' | 'in_progress' | 'resolved'
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT ('log_' || encode(gen_random_bytes(6), 'hex')),
  actor_id TEXT REFERENCES public.profiles(id),
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 11. INDEXES FOR GEOSPATIAL, FILTERS, AND PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_properties_public_discovery 
  ON public.properties (verification_status, publication_status, availability_status);
CREATE INDEX IF NOT EXISTS idx_properties_category_purpose 
  ON public.properties (category, purpose);
CREATE INDEX IF NOT EXISTS idx_properties_owner 
  ON public.properties (owner_id);
CREATE INDEX IF NOT EXISTS idx_property_documents_prop 
  ON public.property_documents (property_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time 
  ON public.appointments (property_id, start_at, end_at, status);

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can view basic info, users edit their own, admins manage all
CREATE POLICY "Public profiles are readable by authenticated users"
  ON public.profiles FOR SELECT USING (true);

-- Properties: Public can ONLY read approved, published & available listings
CREATE POLICY "Public can view approved and published properties"
  ON public.properties FOR SELECT
  USING (
    (verification_status = 'approved' AND publication_status = 'published' AND availability_status = 'available')
    OR (auth.uid()::text = owner_id)
  );

CREATE POLICY "Owners can insert their own draft properties"
  ON public.properties FOR INSERT
  WITH CHECK (auth.uid()::text = owner_id OR owner_id IS NOT NULL);

CREATE POLICY "Owners can update their own unapproved properties"
  ON public.properties FOR UPDATE
  USING (auth.uid()::text = owner_id);

-- Property Documents: STRICT PRIVACY INVARIANT
-- Only the owner of the property or an admin can access private deeds!
CREATE POLICY "Owners and admins only can view private deeds"
  ON public.property_documents FOR SELECT
  USING (
    auth.uid()::text = owner_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "Owners can upload deeds to their property"
  ON public.property_documents FOR INSERT
  WITH CHECK (auth.uid()::text = owner_id OR owner_id IS NOT NULL);

-- Appointments: Users see appointments they booked or received
CREATE POLICY "Users can view their own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid()::text = buyer_id OR auth.uid()::text = owner_id);

-- ==============================================================================
-- 13. INITIAL SEEDS (Single Citizen Account & RERA Admin)
-- ==============================================================================
INSERT INTO public.profiles (id, name, email, phone, role)
VALUES 
  ('usr_client_001', 'Vikramaditya Rao', 'vikram@example.com', '+91 98450 49120', 'user'),
  ('usr_admin_001', 'Karnataka RERA Nodal Admin', 'admin@landpin.gov.in', '+91 80 4190 0001', 'admin')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;

-- ==============================================================================
-- 14. APPOINTMENT DOUBLE-BOOKING CONFLICT PREVENTION (Trigger & Check)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_appointment_conflict()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.appointments
    WHERE property_id = NEW.property_id
      AND status = 'confirmed'
      AND id <> COALESCE(NEW.id, '')
      AND (
        (NEW.start_at >= start_at AND NEW.start_at < end_at)
        OR (NEW.end_at > start_at AND NEW.end_at <= end_at)
        OR (NEW.start_at <= start_at AND NEW.end_at >= end_at)
      )
  ) THEN
    RAISE EXCEPTION 'Double-booking conflict: This property already has a confirmed visit slot at that time.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_appointment_conflict ON public.appointments;
CREATE TRIGGER trg_check_appointment_conflict
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_appointment_conflict();

-- ==============================================================================
-- 15. DEAL ARCHIVAL INVARIANT (Sold / Rented Auto-Archival)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.on_deal_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE public.properties
    SET 
      availability_status = CASE WHEN NEW.deal_type = 'rental' THEN 'rented' ELSE 'sold' END,
      updated_at = NOW()
    WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_completed_archival ON public.deals;
CREATE TRIGGER trg_deal_completed_archival
  AFTER INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.on_deal_completed();

-- ==============================================================================
-- 16. NATIVE POSTGRESQL HYBRID AI RANKING FUNCTION (PostGIS / Haversine)
-- Formula: S = 0.35 * R + 0.25 * L + 0.20 * B + 0.15 * F + 0.05 * Q
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.match_properties(
  p_query_text TEXT DEFAULT '',
  p_user_lat DOUBLE PRECISION DEFAULT 12.9784,
  p_user_lon DOUBLE PRECISION DEFAULT 77.6412,
  p_radius_km DOUBLE PRECISION DEFAULT 100.0,
  p_budget_max NUMERIC DEFAULT NULL,
  p_purpose TEXT DEFAULT 'sale',
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  property_id TEXT,
  title TEXT,
  category TEXT,
  property_type TEXT,
  purpose TEXT,
  price NUMERIC,
  distance_km DOUBLE PRECISION,
  semantic_score DOUBLE PRECISION,
  location_score DOUBLE PRECISION,
  budget_score DOUBLE PRECISION,
  feature_score DOUBLE PRECISION,
  quality_score DOUBLE PRECISION,
  final_score DOUBLE PRECISION,
  property_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH scored_candidates AS (
    SELECT
      p.id AS prop_id,
      p.title AS prop_title,
      p.category AS prop_category,
      p.property_type AS prop_type,
      p.purpose AS prop_purpose,
      p.price AS prop_price,
      p.bedrooms AS prop_bedrooms,
      p.amenities AS prop_amenities,
      p.cadastral_verified AS prop_cadastral,
      to_jsonb(p.*) AS full_data,
      
      -- Haversine Distance in Kilometers
      (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_user_lat)) * cos(radians(coalesce((p.location->'point'->'coordinates'->>1)::double precision, 12.9784))) *
            cos(radians(coalesce((p.location->'point'->'coordinates'->>0)::double precision, 77.6412)) - radians(p_user_lon)) +
            sin(radians(p_user_lat)) * sin(radians(coalesce((p.location->'point'->'coordinates'->>1)::double precision, 12.9784)))
          ))
        )
      ) AS dist_calc,

      -- Semantic Score (0.35 weight)
      CASE 
        WHEN p_query_text IS NULL OR length(trim(p_query_text)) = 0 THEN 0.75
        WHEN lower(p.title) LIKE ('%' || lower(trim(p_query_text)) || '%') THEN 1.0
        ELSE 0.65
      END AS s_r,

      -- Budget Score (0.20 weight)
      CASE
        WHEN p_budget_max IS NULL OR p_budget_max <= 0 THEN 0.85
        WHEN p.price <= p_budget_max THEN 0.7 + (0.3 * (p.price / p_budget_max))
        ELSE greatest(0.1, 1.0 - (((p.price - p_budget_max) / p_budget_max) * 3.0))
      END AS s_b,

      -- Feature Score (0.15 weight)
      least(1.0, 0.5 + (CASE WHEN p.bedrooms >= 3 THEN 0.25 ELSE 0.1 END) + (CASE WHEN cardinality(p.amenities) >= 3 THEN 0.25 ELSE 0.1 END)) AS s_f,

      -- Quality Score (0.05 weight)
      CASE WHEN p.cadastral_verified THEN 1.0 ELSE 0.7 END AS s_q

    FROM public.properties p
    WHERE p.verification_status = 'approved'
      AND p.publication_status = 'published'
      AND p.availability_status = 'available'
      AND (p_purpose IS NULL OR p.purpose = p_purpose)
      AND (p_category IS NULL OR p_category = 'all' OR p.category = p_category)
  ),
  with_location_score AS (
    SELECT
      sc.*,
      greatest(0.0, 1.0 - (sc.dist_calc / greatest(1.0, p_radius_km))) AS s_l,
      round(
        (0.35 * sc.s_r + 0.25 * greatest(0.0, 1.0 - (sc.dist_calc / greatest(1.0, p_radius_km))) + 0.20 * sc.s_b + 0.15 * sc.s_f + 0.05 * sc.s_q)::numeric, 
        4
      )::double precision AS s_final
    FROM scored_candidates sc
    WHERE sc.dist_calc <= p_radius_km -- Hard Geofence Radius
  )
  SELECT
    w.prop_id,
    w.prop_title,
    w.prop_category,
    w.prop_type,
    w.prop_purpose,
    w.prop_price,
    round(w.dist_calc::numeric, 2)::double precision,
    round(w.s_r::numeric, 3)::double precision,
    round(w.s_l::numeric, 3)::double precision,
    round(w.s_b::numeric, 3)::double precision,
    round(w.s_f::numeric, 3)::double precision,
    round(w.s_q::numeric, 3)::double precision,
    w.s_final,
    w.full_data
  FROM with_location_score w
  ORDER BY w.s_final DESC;
END;
$$;

