-- ==============================================================================
-- LANDPIN PROPERTY MARKETPLACE — SECURITY & RLS HARDENING MIGRATION
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/uvticruppilaigbmjwji/sql
-- ==============================================================================

-- 1. Ensure Row Level Security is Enabled on All Core Tables
ALTER TABLE IF EXISTS public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop Insecure / Overly Permissive Legacy Policies
DROP POLICY IF EXISTS "Public can view approved and published properties" ON public.properties;
DROP POLICY IF EXISTS "Allow all public read" ON public.properties;
DROP POLICY IF EXISTS "Allow all insert" ON public.properties;
DROP POLICY IF EXISTS "Allow all update" ON public.properties;
DROP POLICY IF EXISTS "Owners and admins only can view private deeds" ON public.property_documents;
DROP POLICY IF EXISTS "Allow document access" ON public.property_documents;

-- 3. Strict Public Property Visibility Invariant
-- Anonymous and public users can ONLY query listings that are simultaneously approved, published, and not sold/rented
CREATE POLICY "Strict public visibility for verified listings"
  ON public.properties FOR SELECT
  USING (
    (verification_status = 'approved' AND publication_status = 'published' AND availability_status = 'available')
    OR (auth.uid()::text = owner_id)
    OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role = 'admin'))
  );

-- 4. Seller Property Creation & Lifecycle Restrictions
-- Sellers can only insert properties in 'draft' or 'pending_review' with their own owner_id
CREATE POLICY "Sellers can insert their own draft properties"
  ON public.properties FOR INSERT
  WITH CHECK (
    auth.uid()::text = owner_id
    AND verification_status IN ('draft', 'pending_review')
    AND publication_status = 'unpublished'
  );

-- Sellers can only update their own unapproved / needs_changes properties
CREATE POLICY "Sellers can update their own editable properties"
  ON public.properties FOR UPDATE
  USING (
    auth.uid()::text = owner_id
    AND verification_status IN ('draft', 'needs_changes')
  )
  WITH CHECK (
    auth.uid()::text = owner_id
    AND verification_status IN ('draft', 'pending_review')
  );

-- 5. Strict Document Privacy & Private Deed Protection
-- Private legal deeds (e-Khata, 7/12, Sale Deed) are NEVER publicly accessible.
-- Only the confirmed property owner or a verified administrator can access document metadata.
CREATE POLICY "Strict document access for owner and admin only"
  ON public.property_documents FOR SELECT
  USING (
    auth.uid()::text = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "Owners can upload documents to own properties"
  ON public.property_documents FOR INSERT
  WITH CHECK (
    auth.uid()::text = owner_id
  );

-- 6. Appointment Isolation Policy
CREATE POLICY "Users can only view their own appointments"
  ON public.appointments FOR SELECT
  USING (
    auth.uid()::text = buyer_id 
    OR auth.uid()::text = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role = 'admin')
  );

-- 7. Audit Log Tamper-Proof Invariant
-- Ordinary users cannot modify, truncate, or delete audit logs.
DROP POLICY IF EXISTS "Audit logs are append only" ON public.audit_logs;
CREATE POLICY "Audit logs readable by admins only"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()::text AND role = 'admin')
  );

-- Prevent UPDATE or DELETE on audit logs entirely
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, authenticated, anon;

-- 8. High-Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_properties_discovery_composite 
  ON public.properties (verification_status, publication_status, availability_status, category, purpose, price);

CREATE INDEX IF NOT EXISTS idx_properties_owner_status 
  ON public.properties (owner_id, verification_status);

CREATE INDEX IF NOT EXISTS idx_property_documents_privacy 
  ON public.property_documents (property_id, owner_id);

CREATE INDEX IF NOT EXISTS idx_appointments_scheduling 
  ON public.appointments (property_id, status, start_at, end_at);
