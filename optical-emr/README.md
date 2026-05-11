# Al Amin Opticals — Insurance Claims EMR
## Complete Setup & Deployment Guide

---

## 🏗 PROJECT STRUCTURE

```
optical-emr/
├── index.html              ← Main app shell (SPA)
├── login.html              ← Login page
├── schema.sql              ← Run this in Supabase SQL Editor FIRST
├── css/
│   └── app.css             ← Full stylesheet
├── js/
│   ├── app.js              ← Core: Supabase client, auth, router, APIs
│   ├── dashboard.js        ← Dashboard analytics helpers
│   ├── claims.js           ← Claims utilities, resubmission, export
│   ├── invoice.js          ← Invoice HTML renderer
│   └── config.js           ← All config pages + vault + queue + batches
└── pages/
    ├── dashboard.html      ← Dashboard page
    ├── new-claim.html      ← New claim submission form
    ├── claims.html         ← Claims list + approve/reject/cancel modals
    ├── queue.html          ← Live queue page
    ├── invoices.html       ← Invoice list + preview
    ├── batches.html        ← Batch creation + management
    └── vault.html          ← Document vault
```

---

## 🚀 STEP 1: SUPABASE SETUP

### 1.1 Create Project
1. Go to https://supabase.com
2. Click **New Project**
3. Name: `alamin-optical-emr`
4. Region: **Middle East (UAE North)** — important for data residency
5. Save your database password

### 1.2 Run Schema
1. In Supabase dashboard → **SQL Editor**
2. Open `schema.sql` from this project
3. Click **Run** — this creates all tables, indexes, RLS policies, seed data

### 1.3 Create Storage Buckets
In Supabase → **Storage** → Create these buckets:

| Bucket Name        | Public? | Purpose                          |
|--------------------|---------|----------------------------------|
| `claim-documents`  | No      | EID, claim forms, prescriptions  |
| `facility-assets`  | Yes     | Facility seals/stamps            |

For `claim-documents`, add this Storage Policy (SQL Editor):
```sql
-- Allow authenticated users to upload
CREATE POLICY "auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'claim-documents');

-- Allow authenticated users to read
CREATE POLICY "auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'claim-documents');
```

### 1.4 Create Demo User Accounts
In Supabase → **Authentication** → **Users** → **Add User**:

Create these 5 users (all password: `Demo@1234`):
1. `rcm@alaminopticals.ae`
2. `manager@alaminopticals.ae`
3. `coord.dubai@alaminopticals.ae`
4. `branch01@alaminopticals.ae`
5. `stake@alaminopticals.ae`

Then in SQL Editor, insert their profiles (replace UUIDs with actual auth user IDs):
```sql
-- First get the UUIDs from auth.users:
SELECT id, email FROM auth.users;

-- Then insert profiles (replace each UUID):
INSERT INTO profiles (id, full_name, email, role, emirate) VALUES
  ('<rcm-uuid>',        'Ahmed Al Mansouri',  'rcm@alaminopticals.ae',         'rcm',         NULL),
  ('<manager-uuid>',    'Sara Al Hashimi',    'manager@alaminopticals.ae',      'manager',     NULL),
  ('<coord-uuid>',      'Mohammed Khalid',    'coord.dubai@alaminopticals.ae',  'coordinator', 'Dubai'),
  ('<stake-uuid>',      'Investor View',      'stake@alaminopticals.ae',        'stakeholder', NULL);

-- For front desk, first create a facility, then:
-- Get the facility ID and insert:
INSERT INTO profiles (id, full_name, email, role, facility_id) VALUES
  ('<branch01-uuid>', 'Reception Karama', 'branch01@alaminopticals.ae', 'frontdesk', '<facility-uuid>');
```

### 1.5 Add Sample Facility
```sql
INSERT INTO facilities (name, internal_name, emirate, address, license_no, trn_no)
VALUES (
  'Al Amin Opticals LLC',
  'BR-DXB-KARAMA',
  'Dubai',
  'Al Attar Centre, Karama, Dubai, UAE',
  'DHA-F-3422089',
  '100473209300003'
);
```

---

## 🔧 STEP 2: CONFIGURE THE APP

### 2.1 Set Your Supabase Credentials
Open `js/app.js` and replace lines 8–9:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

Find these in: Supabase → **Settings** → **API**
- Copy **Project URL**
- Copy **anon/public** key (NOT the service_role key)

---

## 🌐 STEP 3: HOSTING / DEPLOYMENT

### Option A: Cloudflare Pages (Recommended — Free + UAE CDN)
1. Push project to GitHub
2. Go to https://pages.cloudflare.com
3. Connect GitHub repo → Select `optical-emr` folder
4. Build command: (none — static files)
5. Output directory: `/`
6. Deploy → get URL like `alamin-emr.pages.dev`
7. Add custom domain (e.g. `emr.alaminopticals.ae`)

### Option B: Supabase Storage Hosting (Quick test)
1. Supabase → Storage → Create bucket `app-hosting` (public)
2. Upload all files maintaining folder structure
3. Access via `https://YOUR_PROJECT.supabase.co/storage/v1/object/public/app-hosting/index.html`

### Option C: Self-Hosted (Ubuntu Server)
```bash
# Install nginx
sudo apt install nginx

# Copy files
sudo cp -r optical-emr/* /var/www/html/

# Configure HTTPS with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d emr.alaminopticals.ae
```

---

## 📱 STEP 4: ADDING YOUR 40 BRANCHES

After logging in as RCM Manager:

1. Go to **Configuration → Facilities**
2. Click **Add Facility** for each branch
3. Fill: Name, Internal Code (e.g. BR-DXB-01), Emirate, License No, TRN No, Address
4. Upload the facility seal/stamp image
5. Go to **Configuration → Optometrists** → add optometrists per facility
6. Go to **Configuration → Users** → first create in Supabase Auth, then assign facility

---

## ⚙️ STEP 5: CONFIGURE INSURANCE & TPA

1. **Configuration → TPA Companies** — Add NAS, Mednet, Neuron, etc.
2. **Configuration → Insurance Companies** — Add Daman, AXA, MetLife, ADNIC, Oman, MSH, etc.
   - Link each to the correct TPA
3. **Configuration → HCPCS Codes** — Pre-seeded with common optical codes. Add/edit as needed.
4. **Configuration → ICD Codes** — Pre-seeded with common optical diagnosis codes.

---

## 🔒 SECURITY NOTES

| Security Control | Implementation |
|-----------------|----------------|
| Authentication | Supabase Auth (email + password) |
| Authorization | Row Level Security (RLS) on all tables |
| Data Residency | Supabase UAE North region |
| File Storage | Private Supabase bucket (authenticated access only) |
| HTTPS | Enforced by Cloudflare / hosting provider |
| Audit Trail | `claim_history` table logs every status change with user |

---

## 👥 USER ROLES SUMMARY

| Role | Access |
|------|--------|
| **Front Desk** | Submit claims, view own facility claims + queue position |
| **Coordinator** | View + process claims for their emirate |
| **Insurance Manager** | Full access to all emirates + invoices + batches |
| **RCM Manager** | Full access + configuration |
| **Stakeholder** | Read-only dashboard, claims, invoices |

---

## 📋 WORKFLOW SUMMARY

```
FRONT DESK BRANCH                    CENTRAL OPERATIONS
─────────────────                    ──────────────────
1. Fill patient details     ──────►  4. Claim arrives in queue
2. Enter ICD + HCPCS items           5. Coordinator reviews
3. Upload 5 documents                6. Submit to insurer portal
   - Emirates ID                     7a. APPROVED → Enter approval
   - Claim Form                          details → Auto-generate invoice
   - Prescription                    7b. REJECTED → Upload screenshot
   - Sales Order                         → Mark rejected
   - Eligibility                     7c. CANCELLED → Select reason
                                         → Branch notified → Resubmit
                                     8. Batch invoices (2x monthly)
                                     9. Export batch CSV + ZIP
                                    10. All docs saved to Vault 🔒
```

---

## 🔄 MONTHLY BILLING CYCLE

1. Mid-month & end-of-month: Go to **Invoices**
2. Filter by insurance company
3. Click **Batch Submission** → Create New Batch
4. Name it: `Daman - Dubai - June 2026 (1st Half)`
5. Preview confirms invoice count + total amount
6. Click **Create Batch** → invoices grouped
7. Open batch → **Export CSV** for your records
8. Upload documents from Vault to insurer portal manually
9. Mark batch as **Submitted** then **Acknowledged**

---

## 📞 SUPPORT & CUSTOMIZATION

This is your fully owned system. To customize:
- **Add insurance portal codes**: `config-insurance` page → map codes
- **Change VAT %**: Update default in `schema.sql` or per-claim
- **Add new HCPCS/ICD codes**: Configuration pages
- **Multiple seals**: Each facility has its own seal upload
- **Reports**: Coming next phase — charts, trends, payer analysis

---

## 🗄 DATABASE BACKUP

In Supabase → **Settings** → **Database** → **Backups**
- Daily automatic backups included in Supabase Pro plan
- For manual backup: Supabase CLI → `supabase db dump`

---

*Al Amin Opticals Claims EMR · Built for UAE Optical Retail*
*Version 1.0 · May 2026*
