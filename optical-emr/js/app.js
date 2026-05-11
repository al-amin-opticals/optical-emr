/* ============================================================
   AL AMIN OPTICALS — CLAIMS EMR
   js/app.js  —  Core: Supabase, Auth, Router, Utils
   ============================================================ */

// ============================================================
// SUPABASE CONFIG — Replace with your actual project values
// ============================================================
const SUPABASE_URL = 'https://lmqrmwjowkqkbqkxgdfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtcXJtd2pvd2txa2Jxa3hnZGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMDgzMDQsImV4cCI6MjA5Mzg4NDMwNH0.g57KmhThj5HexheiRmODFMqE3TAf1IIcVxjAzGk-wK4';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// GLOBAL STATE
// ============================================================
window.APP = {
  user: null,
  profile: null,
  db,
  page: null,
};

// ============================================================
// UTILITIES
// ============================================================
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg, type = 'info', duration = 3200) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
  t.innerHTML = `<span>${icons[type]||'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

function showLoader(show = true) {
  const el = document.getElementById('page-loader');
  if (el) el.classList.toggle('hidden', !show);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtAED(n) {
  if (n == null) return '—';
  return 'AED ' + Number(n).toLocaleString('en-AE', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function fmtNum(n, d=2) {
  return Number(n||0).toFixed(d);
}

function claimStatusBadge(status) {
  const map = {
    pending:   { cls:'ba',   label:'Pending' },
    approved:  { cls:'bg2-c', label:'Approved' },
    rejected:  { cls:'br2',  label:'Rejected' },
    cancelled: { cls:'bp3',  label:'Cancelled' },
  };
  const s = map[status] || { cls:'bt', label: status };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function getRoleLabel(role) {
  const m = {
    frontdesk:   'Front Desk',
    coordinator: 'Ins. Coordinator',
    manager:     'Ins. Manager',
    rcm:         'RCM Manager',
    stakeholder: 'Stakeholder',
  };
  return m[role] || role;
}

function getEmirateColor(e) {
  const m = {
    'Dubai':       '#0f6060',
    'Abu Dhabi':   '#1a6090',
    'Sharjah':     '#6040a0',
    'Ajman':       '#b06020',
    'Ras Al Khaimah': '#b03030',
    'Fujairah':    '#208060',
    'Umm Al Quwain':'#806020',
  };
  return m[e] || '#718096';
}

function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// debounce
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// generate a simple local ID
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// AUTH
// ============================================================
async function getSession() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

async function loadProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('*, facilities(*)')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await db.auth.signOut();
  APP.user = null;
  APP.profile = null;
  window.location.href = 'login.html';
}

// ============================================================
// ROLE / ACCESS
// ============================================================
function canAccess(minRole) {
  const order = ['frontdesk','coordinator','manager','rcm','stakeholder'];
  const p = APP.profile;
  if (!p) return false;
  // stakeholder is read-only at same level as manager for viewing
  if (p.role === 'stakeholder') return minRole === 'stakeholder' || minRole === 'frontdesk';
  return order.indexOf(p.role) >= order.indexOf(minRole);
}

function isFrontDesk()   { return APP.profile?.role === 'frontdesk'; }
function isCoordinator() { return APP.profile?.role === 'coordinator'; }
function isManager()     { return APP.profile?.role === 'manager'; }
function isRCM()         { return APP.profile?.role === 'rcm'; }
function isStakeholder() { return APP.profile?.role === 'stakeholder'; }
function isOperations()  { return ['coordinator','manager','rcm'].includes(APP.profile?.role); }

// ============================================================
// NAV BUILDER  (role-aware)
// ============================================================
function buildNav(role) {
  const navEl = document.getElementById('sidebar-nav');
  if (!navEl) return;

  const sections = [];

  // Front Desk
  if (role === 'frontdesk') {
    sections.push({
      label: 'Claims',
      items: [
        { icon:'📋', label:'Dashboard',      page:'dashboard',       id:'nav-dashboard' },
        { icon:'➕', label:'New Claim',       page:'new-claim',       id:'nav-new-claim' },
        { icon:'📂', label:'My Claims',       page:'claims',          id:'nav-claims' },
        { icon:'🔢', label:'Queue Status',    page:'queue',           id:'nav-queue' },
      ]
    });
  }

  // Operations
  if (isOperations()) {
    sections.push({
      label: 'Operations',
      items: [
        { icon:'📊', label:'Dashboard',       page:'dashboard',       id:'nav-dashboard' },
        { icon:'📥', label:'Claims Queue',    page:'claims',          id:'nav-claims' },
        { icon:'✅', label:'Approved',        page:'claims-approved', id:'nav-approved' },
        { icon:'❌', label:'Rejected',        page:'claims-rejected', id:'nav-rejected' },
        { icon:'🚫', label:'Cancelled',       page:'claims-cancelled',id:'nav-cancelled' },
      ]
    });
    sections.push({
      label: 'Billing',
      items: [
        { icon:'🧾', label:'Invoices',         page:'invoices',        id:'nav-invoices' },
        { icon:'📦', label:'Batch Submission', page:'batches',         id:'nav-batches' },
        { icon:'🔒', label:'Vault',            page:'vault',           id:'nav-vault' },
      ]
    });
  }

  // Stakeholder
  if (role === 'stakeholder') {
    sections.push({
      label: 'Insights',
      items: [
        { icon:'📊', label:'Dashboard',        page:'dashboard',       id:'nav-dashboard' },
        { icon:'📋', label:'All Claims',        page:'claims',          id:'nav-claims' },
        { icon:'🧾', label:'Invoices',          page:'invoices',        id:'nav-invoices' },
      ]
    });
  }

  // Config — only RCM/Manager
  if (['rcm','manager'].includes(role)) {
    sections.push({
      label: 'Configuration',
      items: [
        { icon:'🏥', label:'Facilities',        page:'config-facilities',  id:'nav-cf' },
        { icon:'🏢', label:'Insurance Cos',     page:'config-insurance',   id:'nav-ci' },
        { icon:'🤝', label:'TPA Companies',     page:'config-tpa',         id:'nav-ct' },
        { icon:'💊', label:'HCPCS Codes',       page:'config-hcpcs',       id:'nav-ch' },
        { icon:'🩺', label:'ICD Codes',         page:'config-icd',         id:'nav-cd' },
        { icon:'👤', label:'Users',             page:'config-users',       id:'nav-cu' },
        { icon:'👨‍⚕️', label:'Optometrists',     page:'config-opto',        id:'nav-co' },
      ]
    });
  }

  navEl.innerHTML = sections.map(s => `
    <div class="nav-section">
      <div class="nav-section-label">${s.label}</div>
      ${s.items.map(i => `
        <a class="nav-item" id="${i.id}" data-page="${i.page}" href="${i.page}.html">
          <span class="icon">${i.icon}</span>
          <span>${i.label}</span>
        </a>
      `).join('')}
    </div>
  `).join('');

  // Highlight active
  const current = document.body.dataset.page;
  $$('.nav-item').forEach(el => {
    if (el.dataset.page === current) el.classList.add('active');
    el.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(el.dataset.page);
    });
  });
}

// ============================================================
// ROUTER (SPA-style via hash)
// ============================================================
const PAGES = {
  'dashboard':          'pages/dashboard.html',
  'new-claim':          'pages/new-claim.html',
  'claims':             'pages/claims.html',
  'claims-approved':    'pages/claims.html',
  'claims-rejected':    'pages/claims.html',
  'claims-cancelled':   'pages/claims.html',
  'queue':              'pages/queue.html',
  'invoices':           'pages/invoices.html',
  'batches':            'pages/batches.html',
  'vault':              'pages/vault.html',
  'config-facilities':  'pages/config-facilities.html',
  'config-insurance':   'pages/config-insurance.html',
  'config-tpa':         'pages/config-tpa.html',
  'config-hcpcs':       'pages/config-hcpcs.html',
  'config-icd':         'pages/config-icd.html',
  'config-users':       'pages/config-users.html',
  'config-opto':        'pages/config-opto.html',
  'claim-detail':       'pages/claim-detail.html',
};

async function navigateTo(page, params = {}) {
  const url = PAGES[page];
  if (!url) return;
  APP.page = page;
  APP.pageParams = params;
  showLoader(true);
  try {
    const res = await fetch(url);
    const html = await res.text();
const content = document.getElementById('page-content');
content.innerHTML = html;
content.querySelectorAll('script').forEach(oldScript => {
  const newScript = document.createElement('script');
  newScript.textContent = oldScript.textContent;
  document.body.appendChild(newScript);
});
     document.body.dataset.page = page;
    $$('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    document.getElementById('topbar-title').textContent = pageTitles[page] || page;
    // Fire page init
    if (typeof window[`init_${page.replace(/-/g,'_')}`] === 'function') {
      await window[`init_${page.replace(/-/g,'_')}`](params);
    }
  } catch(e) {
    console.error(e);
    toast('Failed to load page', 'error');
  }
  showLoader(false);
}

const pageTitles = {
  'dashboard':         'Dashboard',
  'new-claim':         'New Claim Submission',
  'claims':            'All Claims',
  'claims-approved':   'Approved Claims',
  'claims-rejected':   'Rejected Claims',
  'claims-cancelled':  'Cancelled Claims',
  'queue':             'Queue Status',
  'invoices':          'Invoices',
  'batches':           'Batch Submissions',
  'vault':             'Document Vault',
  'config-facilities': 'Facilities Configuration',
  'config-insurance':  'Insurance Companies',
  'config-tpa':        'TPA Companies',
  'config-hcpcs':      'HCPCS Codes',
  'config-icd':        'ICD Codes',
  'config-users':      'User Management',
  'config-opto':       'Optometrists',
  'claim-detail':      'Claim Detail',
};

// ============================================================
// FILE UPLOAD HELPERS (Supabase Storage)
// ============================================================
async function uploadFile(file, bucket, path) {
  const { data, error } = await db.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: { publicUrl } } = db.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

async function uploadClaimDoc(file, claimId, docType) {
  const ext = file.name.split('.').pop();
  const path = `claims/${claimId}/${docType}_${Date.now()}.${ext}`;
  return uploadFile(file, 'claim-documents', path);
}

async function uploadScreenshot(file, claimId, type) {
  const ext = file.name.split('.').pop();
  const path = `screenshots/${claimId}/${type}_${Date.now()}.${ext}`;
  return uploadFile(file, 'claim-documents', path);
}

async function uploadSeal(file, facilityId) {
  const ext = file.name.split('.').pop();
  const path = `seals/facility_${facilityId}.${ext}`;
  return uploadFile(file, 'facility-assets', path);
}

// ============================================================
// UPLOAD ZONE WIDGET
// ============================================================
function initUploadZone(zoneId, { accept = '*', label = 'Click or drag file', sub = 'Max 10MB', onFile }) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.innerHTML = `
    <input type="file" accept="${accept}" />
    <div class="uz-icon">📎</div>
    <div class="uz-text">${label}</div>
    <div class="uz-sub">${sub}</div>
  `;

  const input = zone.querySelector('input');

  const handle = (file) => {
    if (!file) return;
    zone.classList.add('has-file');
    zone.querySelector('.uz-icon').textContent = file.type.includes('pdf') ? '📄' : '🖼️';
    zone.querySelector('.uz-text').textContent = file.name;
    zone.querySelector('.uz-sub').textContent = (file.size / 1024).toFixed(1) + ' KB';
    if (onFile) onFile(file);
  };

  input.addEventListener('change', () => handle(input.files[0]));
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handle(e.dataTransfer.files[0]);
  });
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
function closeAllModals() {
  $$('.modal-overlay').forEach(m => m.classList.remove('open'));
}

// Close on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllModals();
});

// ============================================================
// CONFIG LOADERS (cached)
// ============================================================
let _cache = {};

async function fetchConfig(table, select = '*') {
  if (_cache[table]) return _cache[table];
  const { data, error } = await db.from(table).select(select)
    .eq('is_active', true).order('created_at', { ascending: true });
  if (error) throw error;
  _cache[table] = data || [];
  return _cache[table];
}

function clearCache(table) {
  Object.keys(_cache).filter(k => k.startsWith(table)).forEach(k => delete _cache[k]);
}

async function loadInsuranceOptions(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const data = await fetchConfig('insurance_companies');
  el.innerHTML = '<option value="">— Select Insurance —</option>' +
    data.map(i => `<option value="${i.id}">${sanitize(i.name)}</option>`).join('');
}

async function loadTPAOptions(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const data = await fetchConfig('tpa_companies');
  el.innerHTML = '<option value="">— Select TPA —</option>' +
    data.map(i => `<option value="${i.id}">${sanitize(i.name)}</option>`).join('');
}

async function loadFacilityOptions(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const data = await fetchConfig('facilities');
  el.innerHTML = '<option value="">— Select Facility —</option>' +
    data.map(i => `<option value="${i.id}">${sanitize(i.name)} (${i.emirate})</option>`).join('');
}

async function loadICDOptions(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const data = await fetchConfig('icd_codes');
  el.innerHTML = '<option value="">— Select ICD Code —</option>' +
    data.map(i => `<option value="${i.id}" data-code="${i.code}">${i.code} — ${sanitize(i.description)}</option>`).join('');
}

async function loadHCPCSOptions(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const data = await fetchConfig('hcpcs_codes');
  el.innerHTML = '<option value="">— Select HCPCS Code —</option>' +
    data.map(i => `<option value="${i.id}" data-code="${i.code}" data-price="${i.unit_price}">${i.code} — ${sanitize(i.description)}</option>`).join('');
}

async function loadOptoOptions(selectId, facilityId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  let q = db.from('optometrists').select('*').eq('is_active', true);
  if (facilityId) q = q.eq('facility_id', facilityId);
  const { data } = await q;
  el.innerHTML = '<option value="">— Select Optometrist —</option>' +
    (data||[]).map(o => `<option value="${o.id}">${sanitize(o.name)}${o.dha_license ? ' ('+o.dha_license+')' : ''}</option>`).join('');
}

// ============================================================
// INIT — fires on every page load
// ============================================================
async function initApp() {
  showLoader(true);
  try {
    const session = await getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    APP.user = session.user;
    APP.profile = await loadProfile(session.user.id);

    // Render sidebar user info
    const avatar = document.getElementById('sidebar-avatar');
    const uname  = document.getElementById('sidebar-uname');
    const urole  = document.getElementById('sidebar-urole');
    if (avatar) avatar.textContent = APP.profile.full_name?.charAt(0)?.toUpperCase() || '?';
    if (uname)  uname.textContent  = APP.profile.full_name;
    if (urole)  urole.textContent  = getRoleLabel(APP.profile.role);

    buildNav(APP.profile.role);

    // Set facility badge on topbar if frontdesk
    const facBadge = document.getElementById('topbar-facility');
    if (facBadge && APP.profile.facilities) {
      facBadge.textContent = APP.profile.facilities.name;
      facBadge.style.display = 'inline-flex';
    }

    // Load default page based on role
    const hash = location.hash.replace('#','') || 'dashboard';
    await navigateTo(hash);

  } catch(e) {
    console.error(e);
    toast('Session error. Please login again.', 'error');
    setTimeout(() => window.location.href = 'login.html', 2000);
  }
  showLoader(false);
}

// ============================================================
// CLAIMS API
// ============================================================
const Claims = {
  async list(filters = {}) {
    let q = db.from('claims')
      .select(`*, facilities(name, emirate), insurance_companies(name), profiles!claims_submitted_by_fkey(full_name)`)
      .order('submitted_at', { ascending: false });

    if (filters.status)      q = q.eq('status', filters.status);
    if (filters.facility_id) q = q.eq('facility_id', filters.facility_id);
    if (filters.emirate) {
      // filter via facility emirate
      const { data: facs } = await db.from('facilities').select('id').eq('emirate', filters.emirate);
      const ids = facs?.map(f => f.id) || [];
      if (ids.length) q = q.in('facility_id', ids);
    }
    if (filters.search) {
      q = q.or(`patient_name.ilike.%${filters.search}%,claim_number.ilike.%${filters.search}%,emirates_id.ilike.%${filters.search}%`);
    }
    if (filters.limit) q = q.limit(filters.limit);

    // Coordinator: only their emirate
    if (isCoordinator() && APP.profile.emirate) {
      const { data: facs } = await db.from('facilities').select('id').eq('emirate', APP.profile.emirate);
      const ids = facs?.map(f => f.id) || [];
      if (ids.length) q = q.in('facility_id', ids);
    }
    // Front desk: only own facility
    if (isFrontDesk()) q = q.eq('facility_id', APP.profile.facility_id);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await db.from('claims')
      .select(`*, facilities(*), insurance_companies(*), tpa_companies(*), optometrists(*), profiles!claims_submitted_by_fkey(full_name)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getDocs(claimId) {
    const { data, error } = await db.from('claim_documents')
      .select('*')
      .eq('claim_id', claimId);
    if (error) throw error;
    return data || [];
  },

  async getHistory(claimId) {
    const { data, error } = await db.from('claim_history')
      .select(`*, profiles(full_name)`)
      .eq('claim_id', claimId)
      .order('changed_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async submit(formData) {
    const { data, error } = await db.from('claims').insert([formData]).select().single();
    if (error) throw error;
    return data;
  },

  async uploadDoc(claimId, file, docType) {
    const url = await uploadClaimDoc(file, claimId, docType);
    const { data, error } = await db.from('claim_documents').insert([{
      claim_id: claimId,
      doc_type: docType,
      file_url: url,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: APP.user.id,
    }]);
    if (error) throw error;
    return url;
  },

  async updateStatus(claimId, status, extra = {}, notes = '') {
    const claim = await this.get(claimId);
    // Update claim
    const { error } = await db.from('claims').update({
      status,
      ...extra
    }).eq('id', claimId);
    if (error) throw error;
    // Log history
    await db.from('claim_history').insert([{
      claim_id: claimId,
      old_status: claim.status,
      new_status: status,
      changed_by: APP.user.id,
      notes,
    }]);
    return true;
  },

  async approve(claimId, approvalData, screenshotFile) {
    let screenshotUrl = null;
    if (screenshotFile) {
      screenshotUrl = await uploadScreenshot(screenshotFile, claimId, 'approval');
    }
    return this.updateStatus(claimId, 'approved', {
      ...approvalData,
      approval_screenshot_url: screenshotUrl,
    }, 'Claim approved by insurance company');
  },

  async reject(claimId, reason, screenshotFile) {
    let screenshotUrl = null;
    if (screenshotFile) {
      screenshotUrl = await uploadScreenshot(screenshotFile, claimId, 'rejection');
    }
    return this.updateStatus(claimId, 'rejected', {
      rejection_reason: reason,
      rejection_screenshot_url: screenshotUrl,
    }, `Rejected: ${reason}`);
  },

  async cancel(claimId, reason) {
    return this.updateStatus(claimId, 'cancelled', {
      cancellation_reason: reason,
      cancelled_by: APP.user.id,
      cancelled_at: new Date().toISOString(),
    }, `Cancelled: ${reason}`);
  },

  async getQueueRank(claimId) {
    const { data } = await db.from('queue_counter').select('global_rank').eq('claim_id', claimId).single();
    return data?.global_rank;
  },

  async getFacilityQueue(facilityId) {
    const { data } = await db.from('claims')
      .select('id, claim_number, patient_name, submitted_at, status, queue_position')
      .eq('facility_id', facilityId)
      .eq('status', 'pending')
      .order('queue_position', { ascending: true });
    return data || [];
  },
};

// ============================================================
// INVOICES API
// ============================================================
const Invoices = {
  async create(claimId) {
    const claim = await Claims.get(claimId);
    const facility = claim.facilities;
    const ins = claim.insurance_companies;

    const grossAmount = claim.approved_amount || 0;
    const discount = 0;
    const vatAmt = grossAmount * (claim.vat_percent || 5) / 100;
    const netAmount = grossAmount + vatAmt;
    const patientShare = claim.copay_amount || 0;
    const claimAmount = netAmount - patientShare;

    const invData = {
      claim_id: claimId,
      facility_id: claim.facility_id,
      insurance_id: claim.insurance_id,
      patient_name: claim.patient_name,
      member_id: claim.member_id,
      emirates_id: claim.emirates_id,
      doctor_name: claim.approved_doctor_name,
      doctor_license: '',
      approval_code: claim.approval_code,
      invoice_date: new Date().toISOString().split('T')[0],
      gross_amount: grossAmount,
      discount: discount,
      vat_percent: claim.vat_percent || 5,
      vat_amount: vatAmt,
      net_amount: netAmount,
      patient_share: patientShare,
      claim_amount: claimAmount,
      line_items: claim.approved_hcpcs || claim.hcpcs_items || [],
      created_by: APP.user.id,
    };

    const { data, error } = await db.from('invoices').insert([invData]).select().single();
    if (error) throw error;

    // Update claim with invoice_id
    await db.from('claims').update({ invoice_id: data.id }).eq('id', claimId);

    return data;
  },

  async list(filters = {}) {
    let q = db.from('invoices')
      .select(`*, facilities(name), insurance_companies(name)`)
      .order('created_at', { ascending: false });
    if (filters.facility_id) q = q.eq('facility_id', filters.facility_id);
    if (filters.insurance_id) q = q.eq('insurance_id', filters.insurance_id);
    if (filters.batch_id) q = q.eq('batch_id', filters.batch_id);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  async createBatch(facilityId, insuranceId, invoiceIds, batchName) {
    // Create batch record
    const totalData = await db.from('invoices')
      .select('claim_amount')
      .in('id', invoiceIds);
    const total = (totalData.data||[]).reduce((s,i) => s + (+i.claim_amount||0), 0);

    const { data: batch, error: bErr } = await db.from('invoice_batches').insert([{
      batch_name: batchName,
      facility_id: facilityId,
      insurance_id: insuranceId,
      invoice_count: invoiceIds.length,
      total_amount: total,
      created_by: APP.user.id,
    }]).select().single();
    if (bErr) throw bErr;

    // Tag invoices with batch_id
    await db.from('invoices').update({ batch_id: batch.id }).in('id', invoiceIds);

    return batch;
  }
};

// ============================================================
// STATS API
// ============================================================
const Stats = {
  async summary() {
    const isFD = isFrontDesk();
    const facId = APP.profile?.facility_id;

    let q = db.from('claims').select('status, facility_id, approved_amount, claim_amount');
    if (isFD) q = q.eq('facility_id', facId);
    if (isCoordinator() && APP.profile.emirate) {
      const { data: facs } = await db.from('facilities').select('id').eq('emirate', APP.profile.emirate);
      const ids = facs?.map(f => f.id) || [];
      if (ids.length) q = q.in('facility_id', ids);
    }

    const { data: claims } = await q;
    const total     = claims?.length || 0;
    const pending   = claims?.filter(c => c.status === 'pending').length || 0;
    const approved  = claims?.filter(c => c.status === 'approved').length || 0;
    const rejected  = claims?.filter(c => c.status === 'rejected').length || 0;
    const cancelled = claims?.filter(c => c.status === 'cancelled').length || 0;
    const totalAmt  = claims?.filter(c => c.status === 'approved')
                             .reduce((s,c) => s + (+c.approved_amount||0), 0) || 0;

    return { total, pending, approved, rejected, cancelled, totalAmt };
  }
};
