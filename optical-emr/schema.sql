-- ============================================================
-- AL AMIN OPTICALS — OPTICAL CLAIMS EMR
-- Supabase PostgreSQL Schema
-- Run this in Supabase > SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SEQUENCE FOR CLAIM & INVOICE NUMBERS
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS claim_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 5000;

-- ============================================================
-- TPA COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS tpa_companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  internal_name text,
  address       text,
  phone         text,
  email         text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- INSURANCE COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS insurance_companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  internal_name text,
  address       text,
  emirate       text,
  tpa_id        uuid REFERENCES tpa_companies(id),
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- ICD CODES (Diagnosis)
-- ============================================================
CREATE TABLE IF NOT EXISTS icd_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  description text NOT NULL,
  category    text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- HCPCS CODES (Procedures / Products)
-- ============================================================
CREATE TABLE IF NOT EXISTS hcpcs_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  description text NOT NULL,
  unit_price  decimal(10,2) DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- FACILITIES (Branches)
-- ============================================================
CREATE TABLE IF NOT EXISTS facilities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  internal_name text,
  emirate       text NOT NULL,
  address       text,
  license_no    text,
  trn_no        text,
  phone         text,
  email         text,
  seal_url      text,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- USERS (Staff)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  email       text UNIQUE NOT NULL,
  role        text NOT NULL CHECK (role IN ('frontdesk','coordinator','manager','rcm','stakeholder')),
  facility_id uuid REFERENCES facilities(id),
  emirate     text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- OPTOMETRISTS (per facility)
-- ============================================================
CREATE TABLE IF NOT EXISTS optometrists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid REFERENCES facilities(id) NOT NULL,
  name        text NOT NULL,
  dha_license text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- CLAIMS (Core Table)
-- ============================================================
CREATE TABLE IF NOT EXISTS claims (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number    text UNIQUE NOT NULL DEFAULT ('CLM-' || LPAD(nextval('claim_number_seq')::text, 6, '0')),
  facility_id     uuid REFERENCES facilities(id) NOT NULL,
  submitted_by    uuid REFERENCES profiles(id),

  -- Patient
  patient_name    text NOT NULL,
  phone           text,
  emirates_id     text NOT NULL,
  policy_expiry   date,
  member_id       text,

  -- Insurance
  insurance_id    uuid REFERENCES insurance_companies(id),
  tpa_id          uuid REFERENCES tpa_companies(id),

  -- Clinical
  diagnosis_notes text,
  icd_codes       jsonb DEFAULT '[]',    -- [{id, code, description}]
  hcpcs_items     jsonb DEFAULT '[]',    -- [{id, code, description, qty, unit_price}]
  prescription_type text CHECK (prescription_type IN ('own','external')),
  optometrist_id  uuid REFERENCES optometrists(id),
  external_dr_name text,

  -- Queue
  status          text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  queue_position  integer,
  submitted_at    timestamptz DEFAULT now(),

  -- Approval (filled when approved)
  approval_code         text,
  approved_doctor_name  text,
  approval_date         date,
  approved_amount       decimal(10,2),
  copay_amount          decimal(10,2),
  vat_percent           decimal(5,2) DEFAULT 5,
  approved_hcpcs        jsonb DEFAULT '[]',
  approved_icd          jsonb DEFAULT '[]',
  approval_screenshot_url text,

  -- Rejection
  rejection_reason      text,
  rejection_screenshot_url text,

  -- Cancellation
  cancellation_reason   text,
  cancelled_by          uuid REFERENCES profiles(id),
  cancelled_at          timestamptz,

  -- Resubmission
  parent_claim_id       uuid REFERENCES claims(id),
  resubmission_count    integer DEFAULT 0,

  -- Invoice
  invoice_id            uuid,

  updated_at            timestamptz DEFAULT now()
);

-- ============================================================
-- CLAIM DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS claim_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  doc_type     text NOT NULL CHECK (doc_type IN (
                  'emirates_id','claim_form','prescription',
                  'sales_order','eligibility','other_1','other_2'
               )),
  file_url     text NOT NULL,
  file_name    text,
  file_size    bigint,
  uploaded_by  uuid REFERENCES profiles(id),
  uploaded_at  timestamptz DEFAULT now()
);

-- ============================================================
-- CLAIM STATUS HISTORY (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS claim_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id     uuid REFERENCES claims(id) ON DELETE CASCADE NOT NULL,
  old_status   text,
  new_status   text NOT NULL,
  changed_by   uuid REFERENCES profiles(id),
  notes        text,
  changed_at   timestamptz DEFAULT now()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number       text UNIQUE NOT NULL DEFAULT ('INV-' || LPAD(nextval('invoice_number_seq')::text, 6, '0')),
  claim_id             uuid REFERENCES claims(id),
  facility_id          uuid REFERENCES facilities(id),
  insurance_id         uuid REFERENCES insurance_companies(id),
  batch_id             uuid,

  patient_name         text,
  member_id            text,
  emirates_id          text,
  doctor_name          text,
  doctor_license       text,
  approval_code        text,
  invoice_date         date DEFAULT CURRENT_DATE,

  gross_amount         decimal(10,2),
  discount             decimal(10,2) DEFAULT 0,
  vat_percent          decimal(5,2) DEFAULT 5,
  vat_amount           decimal(10,2),
  net_amount           decimal(10,2),
  patient_share        decimal(10,2),
  claim_amount         decimal(10,2),

  line_items           jsonb DEFAULT '[]',
  pdf_url              text,

  created_by           uuid REFERENCES profiles(id),
  created_at           timestamptz DEFAULT now()
);

-- ============================================================
-- INVOICE BATCHES (Monthly Bulk Submissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_batches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name           text NOT NULL,
  insurance_id         uuid REFERENCES insurance_companies(id),
  facility_id          uuid REFERENCES facilities(id),
  period_start         date,
  period_end           date,
  invoice_count        integer DEFAULT 0,
  total_amount         decimal(10,2) DEFAULT 0,
  zip_url              text,
  status               text DEFAULT 'created' CHECK (status IN ('created','submitted','acknowledged')),
  created_by           uuid REFERENCES profiles(id),
  created_at           timestamptz DEFAULT now()
);

-- ============================================================
-- VAULT (Document Archive)
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type   text NOT NULL CHECK (entry_type IN ('invoice','batch','claim_doc','approval')),
  reference_id uuid,
  file_url     text NOT NULL,
  file_name    text,
  description  text,
  facility_id  uuid REFERENCES facilities(id),
  tags         text[],
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- ============================================================
-- QUEUE COUNTER (per emirate, resets daily)
-- ============================================================
CREATE TABLE IF NOT EXISTS queue_counter (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id      uuid UNIQUE REFERENCES claims(id),
  global_rank   integer NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims            ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_entries     ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own profile, admins see all
CREATE POLICY "profiles_self" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_admin" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('rcm','manager'))
);

-- Claims: frontdesk sees own facility, coordinators see their emirate, managers/rcm see all
CREATE POLICY "claims_frontdesk_select" ON claims FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (
    p.role IN ('manager','rcm','stakeholder') OR
    (p.role = 'coordinator' AND EXISTS (
      SELECT 1 FROM facilities f WHERE f.id = claims.facility_id AND f.emirate = p.emirate
    )) OR
    (p.role = 'frontdesk' AND p.facility_id = claims.facility_id)
  ))
);
CREATE POLICY "claims_frontdesk_insert" ON claims FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'frontdesk' AND p.facility_id = facility_id)
);
CREATE POLICY "claims_update" ON claims FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('coordinator','manager','rcm'))
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_claims_facility    ON claims(facility_id);
CREATE INDEX IF NOT EXISTS idx_claims_status      ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_submitted   ON claims(submitted_at);
CREATE INDEX IF NOT EXISTS idx_claims_insurance   ON claims(insurance_id);
CREATE INDEX IF NOT EXISTS idx_docs_claim         ON claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_history_claim      ON claim_history(claim_id);
CREATE INDEX IF NOT EXISTS idx_invoices_claim     ON invoices(claim_id);
CREATE INDEX IF NOT EXISTS idx_invoices_batch     ON invoices(batch_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto update updated_at on claims
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Assign queue position on claim insert
CREATE OR REPLACE FUNCTION assign_queue_position()
RETURNS TRIGGER AS $$
DECLARE v_rank integer;
BEGIN
  SELECT COALESCE(MAX(global_rank), 0) + 1 INTO v_rank FROM queue_counter;
  NEW.queue_position := v_rank;
  INSERT INTO queue_counter(claim_id, global_rank) VALUES (NEW.id, v_rank);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claims_queue_position
  BEFORE INSERT ON claims
  FOR EACH ROW EXECUTE FUNCTION assign_queue_position();

-- ============================================================
-- SEED DATA — Common ICD Codes for Optical
-- ============================================================
INSERT INTO icd_codes (code, description, category) VALUES
  ('H52.1',  'Myopia',                             'Refractive Errors'),
  ('H52.2',  'Astigmatism',                        'Refractive Errors'),
  ('H52.0',  'Hypermetropia',                      'Refractive Errors'),
  ('H52.4',  'Presbyopia',                         'Refractive Errors'),
  ('H40.10', 'Open-angle glaucoma, unspecified',   'Glaucoma'),
  ('H25.9',  'Age-related cataract, unspecified',  'Cataract'),
  ('H35.30', 'Macular degeneration',               'Retinal Disorders'),
  ('H11.3',  'Conjunctival haemorrhage',           'Conjunctival Disorders'),
  ('H10.9',  'Conjunctivitis, unspecified',        'Conjunctival Disorders'),
  ('H04.1',  'Dry eye syndrome',                   'Lacrimal System'),
  ('H53.2',  'Diplopia',                           'Visual Disturbances'),
  ('H57.1',  'Ocular pain',                        'Other Eye Disorders')
ON CONFLICT (code) DO NOTHING;

-- Common HCPCS Codes for Optical
INSERT INTO hcpcs_codes (code, description, unit_price) VALUES
  ('V2020', 'Frames, purchases',                      400.00),
  ('V2100', 'Sphere, single vision, 0.00 to ±4.00',   250.00),
  ('V2103', 'Sphere, bifocal, plano to ±4.00',        430.00),
  ('V2200', 'Sphere, single vision, >±4.00',          300.00),
  ('V2300', 'Progressive lens',                        600.00),
  ('V2410', 'Variable asphericity lens',              450.00),
  ('V2500', 'Contact lens, PMMA',                     200.00),
  ('V2510', 'Contact lens, gas permeable',            350.00),
  ('V2521', 'Contact lens, soft, toric',              400.00),
  ('V2600', 'Low vision aids, hand held magnifier',   180.00),
  ('V2702', 'Deluxe frame',                           600.00),
  ('V2750', 'Anti-reflective coating, per lens',       80.00),
  ('V2755', 'UV lens, per lens',                       60.00),
  ('V2761', 'Progressive lens, add 2.25 to 3.00',    650.00),
  ('92004', 'Comprehensive ophthalmologic exam',      300.00),
  ('92012', 'Ophthalmologic exam, established patient', 200.00)
ON CONFLICT (code) DO NOTHING;
