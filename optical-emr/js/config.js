/* ============================================================
   js/config.js — Configuration page logic, invoices, batches, vault, queue
   ============================================================ */

// ============================================================
// QUEUE PAGE
// ============================================================
window.init_queue = async function() {
  const page = document.getElementById('page-content');
  if (!page) return;
  page.innerHTML = `
    <div id="queue-page">
      ${isFrontDesk() ? `
        <div class="queue-rank-display">
          <div class="qrd-label">Your Facility</div>
          <div style="font-size:20px;font-weight:700;margin:4px 0">${sanitize(APP.profile.facilities?.name||'—')}</div>
          <div class="qrd-sub">${sanitize(APP.profile.facilities?.emirate||'')}</div>
        </div>
      ` : ''}
      <div class="card">
        <div class="card-header">
          <span style="font-size:16px">🔢</span>
          <div><div class="card-title">Live Claims Queue</div>
          <div class="card-subtitle">Sorted by submission time · Auto-refreshes every 30s</div></div>
          <button class="btn btn-secondary btn-sm" style="margin-left:auto" onclick="loadQueue()">🔄 Refresh</button>
        </div>
        <div class="card-body" style="padding:0">
          <div class="qtw">
            <table class="qt">
              <thead><tr>
                <th style="width:60px;text-align:center">Rank</th>
                <th>Claim #</th>
                <th>Patient</th>
                <th>Facility</th>
                <th>Insurance</th>
                <th>Submitted At</th>
                <th>EID</th>
              </tr></thead>
              <tbody id="queue-tbody">
                <tr><td colspan="7" class="text-center" style="padding:40px">
                  <div class="spinner" style="margin:0 auto 8px"></div>
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
  await loadQueue();
  // Auto refresh
  if (window._queueTimer) clearInterval(window._queueTimer);
  window._queueTimer = setInterval(loadQueue, 30000);
};

async function loadQueue() {
  const tbody = document.getElementById('queue-tbody');
  if (!tbody) return;
  try {
    const claims = await Claims.list({ status:'pending' });
    if (!claims.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:30px">
        <div class="es-icon">✅</div><div class="es-title">Queue is clear!</div>
        <div class="es-text">No pending claims at the moment</div>
      </div></td></tr>`;
      return;
    }

    const myFacId = APP.profile?.facility_id;
    tbody.innerHTML = claims.map((c, i) => {
      const isMyFac = c.facility_id === myFacId;
      const rankCls = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-n';
      return `
        <tr style="${isMyFac?'background:#fffbeb;':''}">
          <td style="text-align:center">
            <div class="rank-badge ${rankCls}" style="margin:0 auto">${c.queue_position||i+1}</div>
          </td>
          <td class="mono" style="color:var(--teal2);font-weight:600;font-size:11px">${sanitize(c.claim_number)}</td>
          <td style="font-weight:${isMyFac?'700':'400'}">${sanitize(c.patient_name)}
            ${isMyFac?'<span class="badge bt" style="margin-left:6px;font-size:9px">Your Facility</span>':''}
          </td>
          <td style="font-size:11.5px">${sanitize(c.facilities?.name||'—')}</td>
          <td style="font-size:11px;color:var(--muted)">${sanitize(c.insurance_companies?.name||'—')}</td>
          <td style="font-size:11px;color:var(--muted);white-space:nowrap">${fmtDateTime(c.submitted_at)}</td>
          <td class="mono" style="font-size:10.5px">${sanitize(c.emirates_id||'—')}</td>
        </tr>
      `;
    }).join('');
  } catch(e) { console.error(e); }
}

// ============================================================
// INVOICES PAGE
// ============================================================
window.init_invoices = async function() {
  const page = document.getElementById('page-content');
  page.innerHTML = `
    <div id="invoices-page">
      <div class="card mb-16">
        <div class="card-body" style="padding:14px 20px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <select class="fi" id="inv-facility" style="width:200px" onchange="loadInvoicesList()">
              <option value="">All Facilities</option>
            </select>
            <select class="fi" id="inv-insurance" style="width:200px" onchange="loadInvoicesList()">
              <option value="">All Insurance Companies</option>
            </select>
            <button class="btn btn-secondary btn-sm" onclick="loadInvoicesList()">🔄 Refresh</button>
            <button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openBatchModal()">
              📦 Create Batch
            </button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body" style="padding:0">
          <div class="qtw">
            <table class="qt">
              <thead><tr>
                <th>Invoice #</th>
                <th>Claim #</th>
                <th>Patient</th>
                <th>Facility</th>
                <th>Insurance</th>
                <th>Date</th>
                <th style="text-align:right">Gross</th>
                <th style="text-align:right">VAT</th>
                <th style="text-align:right">Patient Share</th>
                <th style="text-align:right">Claim Amt</th>
                <th>Actions</th>
              </tr></thead>
              <tbody id="inv-tbody">
                <tr><td colspan="11" class="text-center" style="padding:40px">
                  <div class="spinner" style="margin:0 auto 8px"></div>
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- INVOICE PREVIEW MODAL -->
    <div class="modal-overlay" id="modal-invoice-preview">
      <div class="modal modal-xl">
        <div class="modal-header">
          <div class="modal-title">🧾 Invoice Preview</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm" onclick="printInvoice()">🖨 Print</button>
            <button class="modal-close" onclick="closeModal('modal-invoice-preview')">✕</button>
          </div>
        </div>
        <div class="modal-body" id="invoice-preview-body" style="overflow-x:auto;background:#eef2f7">
        </div>
      </div>
    </div>

    <!-- BATCH MODAL -->
    <div class="modal-overlay" id="modal-batch">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">📦 Create Invoice Batch</div>
          <button class="modal-close" onclick="closeModal('modal-batch')">✕</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-info">Select facility and insurance to batch all their unbatched invoices for bulk submission.</div>
          <div class="fg">
            <label>Batch Name <span class="req">*</span></label>
            <input type="text" class="fi" id="batch-name" placeholder="e.g. Dubai - Daman - May 2026 (1st Half)" />
          </div>
          <div class="fg">
            <label>Facility</label>
            <select class="fi" id="batch-facility">
              <option value="">All Facilities</option>
            </select>
          </div>
          <div class="fg">
            <label>Insurance Company <span class="req">*</span></label>
            <select class="fi" id="batch-insurance">
              <option value="">— Select —</option>
            </select>
          </div>
          <div id="batch-summary" style="margin-top:12px"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal('modal-batch')">Cancel</button>
          <button class="btn btn-primary" onclick="createBatch()">📦 Create Batch &amp; Generate ZIP</button>
        </div>
      </div>
    </div>
  `;

  await loadFacilityOptions('inv-facility');
  await loadInsuranceOptions('inv-insurance');
  await loadInvoicesList();
};

async function loadInvoicesList() {
  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;
  try {
    const filters = {
      facility_id:  document.getElementById('inv-facility')?.value || '',
      insurance_id: document.getElementById('inv-insurance')?.value || '',
    };
    Object.keys(filters).forEach(k => { if (!filters[k]) delete filters[k]; });
    const invs = await Invoices.list(filters);

    if (!invs.length) {
      tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state" style="padding:30px">
        <div class="es-icon">🧾</div><div class="es-title">No invoices yet</div>
        <div class="es-text">Approve claims to generate invoices</div>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = invs.map(inv => `
      <tr>
        <td class="mono" style="color:var(--teal2);font-weight:600;font-size:11px">${sanitize(inv.invoice_number)}</td>
        <td class="mono" style="font-size:11px;color:var(--muted)">${sanitize(inv.claim_id?.toString().slice(-8)||'—')}</td>
        <td style="font-size:12px;font-weight:500">${sanitize(inv.patient_name||'—')}</td>
        <td style="font-size:11.5px">${sanitize(inv.facilities?.name||'—')}</td>
        <td style="font-size:11.5px">${sanitize(inv.insurance_companies?.name||'—')}</td>
        <td style="font-size:11px;color:var(--muted)">${fmtDate(inv.invoice_date)}</td>
        <td class="text-right mono" style="font-size:11px">${fmtNum(inv.gross_amount)}</td>
        <td class="text-right mono" style="font-size:11px">${fmtNum(inv.vat_amount)}</td>
        <td class="text-right mono" style="font-size:11px">${fmtNum(inv.patient_share)}</td>
        <td class="text-right mono" style="font-size:11px;font-weight:700;color:var(--green)">${fmtNum(inv.claim_amount)}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary btn-sm" onclick="previewInvoice('${inv.id}')">👁 Preview</button>
            ${inv.pdf_url ? `<a href="${inv.pdf_url}" target="_blank" class="btn btn-secondary btn-sm">⬇ PDF</a>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch(e) { console.error(e); toast('Failed to load invoices', 'error'); }
}

async function previewInvoice(invId) {
  const body = document.getElementById('invoice-preview-body');
  body.innerHTML = '<div class="text-center" style="padding:40px"><div class="spinner" style="margin:0 auto"></div></div>';
  openModal('modal-invoice-preview');

  try {
    const { data: inv } = await db.from('invoices').select('*').eq('id', invId).single();
    const { data: fac } = await db.from('facilities').select('*').eq('id', inv.facility_id).single();
    const { data: ins } = await db.from('insurance_companies').select('*').eq('id', inv.insurance_id).single();
    body.innerHTML = `<div style="padding:20px;display:flex;justify-content:center">
      ${renderInvoiceHTML(inv, fac, ins)}
    </div>`;
  } catch(e) {
    body.innerHTML = `<div class="alert alert-error">Failed to load invoice: ${e.message}</div>`;
  }
}

async function openBatchModal() {
  await loadFacilityOptions('batch-facility');
  await loadInsuranceOptions('batch-insurance');
  document.getElementById('batch-name').value = '';
  document.getElementById('batch-summary').innerHTML = '';
  openModal('modal-batch');
}

async function createBatch() {
  const name    = document.getElementById('batch-name').value?.trim();
  const facId   = document.getElementById('batch-facility').value;
  const insId   = document.getElementById('batch-insurance').value;
  if (!name || !insId) { toast('Please fill batch name and insurance company', 'error'); return; }

  try {
    // Get all unbatched invoices for this combination
    let q = db.from('invoices').select('id').is('batch_id', null);
    if (facId) q = q.eq('facility_id', facId);
    if (insId) q = q.eq('insurance_id', insId);
    const { data: invs } = await q;
    if (!invs?.length) { toast('No unbatched invoices found for this selection', 'warning'); return; }

    const batch = await Invoices.createBatch(facId||null, insId, invs.map(i=>i.id), name);

    // Save to vault
    await db.from('vault_entries').insert([{
      entry_type:   'batch',
      reference_id: batch.id,
      file_url:     '#',
      file_name:    name + '.zip',
      description:  `Batch: ${name} · ${invs.length} invoices`,
      facility_id:  facId || null,
      tags:         ['batch', 'invoice'],
      created_by:   APP.user.id,
    }]);

    toast(`Batch created: ${invs.length} invoices grouped`, 'success');
    closeModal('modal-batch');
    await loadInvoicesList();
  } catch(e) {
    toast('Batch error: ' + e.message, 'error');
  }
}

// ============================================================
// VAULT PAGE
// ============================================================
window.init_vault = async function() {
  const page = document.getElementById('page-content');
  page.innerHTML = `
    <div id="vault-page">
      <div class="alert alert-info mb-16">
        <span>🔒</span>
        <span>The Document Vault stores all invoices, batches and claim documents for audit purposes. All files are retained permanently.</span>
      </div>
      <div class="card mb-16">
        <div class="card-body" style="padding:14px 20px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input type="text" class="fi" id="vault-search" placeholder="🔍 Search vault…" style="width:260px" oninput="loadVault()" />
            <select class="fi" id="vault-type" style="width:180px" onchange="loadVault()">
              <option value="">All Types</option>
              <option value="invoice">Invoices</option>
              <option value="batch">Batches</option>
              <option value="claim_doc">Claim Documents</option>
              <option value="approval">Approvals</option>
            </select>
            <button class="btn btn-secondary btn-sm" onclick="loadVault()">🔄 Refresh</button>
            <div style="margin-left:auto;font-size:11px;color:var(--muted)" id="vault-count">—</div>
          </div>
        </div>
      </div>
      <div class="vault-grid" id="vault-grid">
        <div style="grid-column:1/-1;text-align:center;padding:40px">
          <div class="spinner" style="margin:0 auto 8px"></div>
          <div class="text-muted text-sm">Loading vault…</div>
        </div>
      </div>
    </div>
  `;
  await loadVault();
};

async function loadVault() {
  const grid = document.getElementById('vault-grid');
  if (!grid) return;

  try {
    let q = db.from('vault_entries')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });

    const search = document.getElementById('vault-search')?.value?.trim();
    const type   = document.getElementById('vault-type')?.value;
    if (type) q = q.eq('entry_type', type);
    if (search) q = q.or(`file_name.ilike.%${search}%,description.ilike.%${search}%`);

    const { data: entries } = await q;
    document.getElementById('vault-count').textContent = `${entries?.length||0} entries`;

    if (!entries?.length) {
      grid.innerHTML = `<div style="grid-column:1/-1"><div class="empty-state">
        <div class="es-icon">🔒</div><div class="es-title">Vault is empty</div>
        <div class="es-text">Documents will appear here after invoices are created</div>
      </div></div>`;
      return;
    }

    const icons = { invoice:'🧾', batch:'📦', claim_doc:'📄', approval:'✅' };
    grid.innerHTML = entries.map(e => `
      <div class="vault-item" onclick="${e.file_url !== '#' ? `window.open('${e.file_url}','_blank')` : 'void(0)'}">
        <div class="vi-icon">${icons[e.entry_type]||'📁'}</div>
        <div class="vi-name" title="${sanitize(e.file_name||'')}">
          ${sanitize(e.file_name || e.description || 'File')}
        </div>
        <div class="vi-meta">${fmtDate(e.created_at)}</div>
        <div class="vi-meta text-muted">${sanitize(e.profiles?.full_name||'System')}</div>
        <span class="badge vi-badge ${e.entry_type==='batch'?'bp3':e.entry_type==='invoice'?'bg2-c':'bt'}">
          ${e.entry_type}
        </span>
      </div>
    `).join('');
  } catch(e) { console.error(e); }
}

// ============================================================
// CONFIG — GENERIC CRUD TABLE
// ============================================================
function renderConfigPage(config) {
  const page = document.getElementById('page-content');
  page.innerHTML = `
    <div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
        <button class="btn btn-primary" onclick="openConfigModal_${config.key}()">➕ Add ${config.singular}</button>
      </div>
      <div class="card">
        <div class="card-body" style="padding:0">
          <div class="qtw">
            <table class="qt">
              <thead><tr>
                ${config.columns.map(c => `<th${c.right?' style="text-align:right"':''}>${c.label}</th>`).join('')}
                <th style="width:100px">Actions</th>
              </tr></thead>
              <tbody id="cfg-tbody-${config.key}">
                <tr><td colspan="${config.columns.length+1}" class="text-center" style="padding:40px">
                  <div class="spinner" style="margin:0 auto 8px"></div>
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ADD/EDIT MODAL -->
      <div class="modal-overlay" id="modal-cfg-${config.key}">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title" id="cfg-modal-title-${config.key}">Add ${config.singular}</div>
            <button class="modal-close" onclick="closeModal('modal-cfg-${config.key}')">✕</button>
          </div>
          <div class="modal-body" id="cfg-modal-body-${config.key}">
            ${config.formHTML}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal('modal-cfg-${config.key}')">Cancel</button>
            <button class="btn btn-primary" onclick="saveConfig_${config.key}()">💾 Save</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// CONFIG — FACILITIES
// ============================================================
window.init_config_facilities = async function() {
  renderConfigPage({
    key: 'facilities',
    singular: 'Facility',
    columns: [
      { label:'Name' }, { label:'Internal Name' },
      { label:'Emirate' }, { label:'License No' },
      { label:'TRN No' }, { label:'Status' }
    ],
    formHTML: `
      <div class="g2">
        <div class="fg"><label>Facility Name <span class="req">*</span></label>
          <input type="text" class="fi" id="fac-name" /></div>
        <div class="fg"><label>Internal / Short Name</label>
          <input type="text" class="fi" id="fac-iname" placeholder="e.g. BR-DXB-01" /></div>
      </div>
      <div class="g2">
        <div class="fg"><label>Emirate <span class="req">*</span></label>
          <select class="fi" id="fac-emirate">
            <option value="">— Select —</option>
            <option>Dubai</option><option>Abu Dhabi</option><option>Sharjah</option>
            <option>Ajman</option><option>Ras Al Khaimah</option>
            <option>Fujairah</option><option>Umm Al Quwain</option>
          </select></div>
        <div class="fg"><label>Address</label>
          <input type="text" class="fi" id="fac-addr" /></div>
      </div>
      <div class="g2">
        <div class="fg"><label>Facility License No</label>
          <input type="text" class="fi fi-mono" id="fac-license" placeholder="DHA-F-XXXXXXX" /></div>
        <div class="fg"><label>TRN No</label>
          <input type="text" class="fi fi-mono" id="fac-trn" placeholder="100XXXXXXXXX003" /></div>
      </div>
      <div class="g2">
        <div class="fg"><label>Phone</label>
          <input type="tel" class="fi" id="fac-phone" /></div>
        <div class="fg"><label>Email</label>
          <input type="email" class="fi" id="fac-email" /></div>
      </div>
      <div class="fg"><label>Facility Seal (Image)</label>
        <div class="upload-zone" id="uz-fac-seal">
          <input type="file" accept=".png,.jpg,.jpeg" />
          <div class="uz-icon">🔵</div>
          <div class="uz-text">Upload facility seal / stamp image</div>
          <div class="uz-sub">PNG, JPG · Transparent background preferred</div>
        </div>
      </div>
      <input type="hidden" id="fac-id" />
    `
  });

  await loadConfigTable_facilities();
  let _facSealFile = null;
  initUploadZone('uz-fac-seal', { accept:'.png,.jpg,.jpeg', onFile:(f)=>{ _facSealFile = f; } });
  window._facSealFile = () => _facSealFile;
};

async function loadConfigTable_facilities() {
  const tbody = document.getElementById('cfg-tbody-facilities');
  if (!tbody) return;
  const data = await fetchConfig('facilities', '*', {});
  clearCache('facilities');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:20px">
      <div class="es-icon">🏥</div><div class="es-title">No facilities added yet</div>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(f => `
    <tr>
      <td style="font-weight:600">${sanitize(f.name)}</td>
      <td class="mono text-sm">${sanitize(f.internal_name||'—')}</td>
      <td><span class="badge bt">${sanitize(f.emirate)}</span></td>
      <td class="mono text-sm">${sanitize(f.license_no||'—')}</td>
      <td class="mono text-sm">${sanitize(f.trn_no||'—')}</td>
      <td><span class="badge ${f.is_active?'bg2-c':'br2'}">${f.is_active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editFacility('${f.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="toggleActive('facilities','${f.id}',${!f.is_active})">
            ${f.is_active?'🚫':'✅'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.openConfigModal_facilities = function() {
  document.getElementById('cfg-modal-title-facilities').textContent = 'Add Facility';
  ['fac-name','fac-iname','fac-addr','fac-license','fac-trn','fac-phone','fac-email','fac-id'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  openModal('modal-cfg-facilities');
};

function editFacility(id) {
  fetchConfig('facilities','*',{}).then(data => {
    const f = data.find(x => x.id === id);
    if (!f) return;
    document.getElementById('cfg-modal-title-facilities').textContent = 'Edit Facility';
    document.getElementById('fac-id').value      = f.id;
    document.getElementById('fac-name').value    = f.name;
    document.getElementById('fac-iname').value   = f.internal_name || '';
    document.getElementById('fac-emirate').value = f.emirate;
    document.getElementById('fac-addr').value    = f.address || '';
    document.getElementById('fac-license').value = f.license_no || '';
    document.getElementById('fac-trn').value     = f.trn_no || '';
    document.getElementById('fac-phone').value   = f.phone || '';
    document.getElementById('fac-email').value   = f.email || '';
    openModal('modal-cfg-facilities');
  });
}

window.saveConfig_facilities = async function() {
  const id     = document.getElementById('fac-id').value;
  const name   = document.getElementById('fac-name').value?.trim();
  const emirate= document.getElementById('fac-emirate').value;
  if (!name || !emirate) { toast('Name and emirate are required', 'error'); return; }

  const payload = {
    name, emirate,
    internal_name: document.getElementById('fac-iname').value || null,
    address:       document.getElementById('fac-addr').value || null,
    license_no:    document.getElementById('fac-license').value || null,
    trn_no:        document.getElementById('fac-trn').value || null,
    phone:         document.getElementById('fac-phone').value || null,
    email:         document.getElementById('fac-email').value || null,
  };

  // Upload seal if selected
  const sealFile = window._facSealFile?.();
  if (sealFile && id) {
    payload.seal_url = await uploadSeal(sealFile, id);
  }

  try {
    if (id) {
      await db.from('facilities').update(payload).eq('id', id);
    } else {
      await db.from('facilities').insert([payload]);
    }
    clearCache('facilities');
    toast('Facility saved!', 'success');
    closeModal('modal-cfg-facilities');
    await loadConfigTable_facilities();
  } catch(e) { toast('Error: '+e.message, 'error'); }
};

// ============================================================
// CONFIG — INSURANCE COMPANIES
// ============================================================
window.init_config_insurance = async function() {
  renderConfigPage({
    key: 'insurance',
    singular: 'Insurance Company',
    columns: [
      { label:'Name' }, { label:'Internal Name' },
      { label:'Emirate' }, { label:'TPA' }, { label:'Status' }
    ],
    formHTML: `
      <div class="g2">
        <div class="fg"><label>Company Name <span class="req">*</span></label>
          <input type="text" class="fi" id="ins-name" /></div>
        <div class="fg"><label>Internal Name</label>
          <input type="text" class="fi" id="ins-iname" /></div>
      </div>
      <div class="g2">
        <div class="fg"><label>Emirate</label>
          <select class="fi" id="ins-emirate">
            <option value="">All Emirates</option>
            <option>Dubai</option><option>Abu Dhabi</option><option>Sharjah</option>
            <option>Ajman</option><option>Ras Al Khaimah</option>
            <option>Fujairah</option><option>Umm Al Quwain</option>
          </select></div>
        <div class="fg"><label>TPA</label>
          <select class="fi" id="ins-tpa"><option value="">— No TPA —</option></select></div>
      </div>
      <div class="fg"><label>Address</label>
        <input type="text" class="fi" id="ins-addr" /></div>
      <div class="g2">
        <div class="fg"><label>Phone</label><input type="tel" class="fi" id="ins-phone" /></div>
        <div class="fg"><label>Email</label><input type="email" class="fi" id="ins-email" /></div>
      </div>
      <input type="hidden" id="ins-id" />
    `
  });
  await loadTPAOptions('ins-tpa');
  await loadConfigTable_insurance();
};

async function loadConfigTable_insurance() {
  const tbody = document.getElementById('cfg-tbody-insurance');
  if (!tbody) return;
  const { data } = await db.from('insurance_companies').select('*, tpa_companies(name)').order('created_at');
  clearCache('insurance_companies');
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:20px">
      <div class="es-icon">🏢</div><div class="es-title">No insurance companies added</div>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(i => `
    <tr>
      <td style="font-weight:600">${sanitize(i.name)}</td>
      <td class="text-muted text-sm">${sanitize(i.internal_name||'—')}</td>
      <td>${sanitize(i.emirate||'All')}</td>
      <td class="text-sm">${sanitize(i.tpa_companies?.name||'—')}</td>
      <td><span class="badge ${i.is_active?'bg2-c':'br2'}">${i.is_active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editInsurance('${i.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="toggleActive('insurance_companies','${i.id}',${!i.is_active})">
            ${i.is_active?'🚫':'✅'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.openConfigModal_insurance = function() {
  document.getElementById('cfg-modal-title-insurance').textContent = 'Add Insurance Company';
  ['ins-name','ins-iname','ins-addr','ins-phone','ins-email','ins-id'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  openModal('modal-cfg-insurance');
};

function editInsurance(id) {
  db.from('insurance_companies').select('*').eq('id',id).single().then(({data:i}) => {
    if (!i) return;
    document.getElementById('cfg-modal-title-insurance').textContent = 'Edit Insurance Company';
    document.getElementById('ins-id').value      = i.id;
    document.getElementById('ins-name').value    = i.name;
    document.getElementById('ins-iname').value   = i.internal_name||'';
    document.getElementById('ins-emirate').value = i.emirate||'';
    document.getElementById('ins-tpa').value     = i.tpa_id||'';
    document.getElementById('ins-addr').value    = i.address||'';
    document.getElementById('ins-phone').value   = i.phone||'';
    document.getElementById('ins-email').value   = i.email||'';
    openModal('modal-cfg-insurance');
  });
}

window.saveConfig_insurance = async function() {
  const id   = document.getElementById('ins-id').value;
  const name = document.getElementById('ins-name').value?.trim();
  if (!name) { toast('Company name required','error'); return; }
  const payload = {
    name,
    internal_name: document.getElementById('ins-iname').value||null,
    emirate:       document.getElementById('ins-emirate').value||null,
    tpa_id:        document.getElementById('ins-tpa').value||null,
    address:       document.getElementById('ins-addr').value||null,
    phone:         document.getElementById('ins-phone').value||null,
    email:         document.getElementById('ins-email').value||null,
  };
  try {
    id ? await db.from('insurance_companies').update(payload).eq('id',id)
       : await db.from('insurance_companies').insert([payload]);
    clearCache('insurance_companies');
    toast('Saved!','success');
    closeModal('modal-cfg-insurance');
    await loadConfigTable_insurance();
  } catch(e) { toast('Error: '+e.message,'error'); }
};

// ============================================================
// CONFIG — HCPCS CODES
// ============================================================
window.init_config_hcpcs = async function() {
  renderConfigPage({
    key:'hcpcs',
    singular:'HCPCS Code',
    columns:[{label:'Code'},{label:'Description'},{label:'Unit Price',right:true},{label:'Status'}],
    formHTML:`
      <div class="g2">
        <div class="fg"><label>HCPCS Code <span class="req">*</span></label>
          <input type="text" class="fi fi-mono" id="hc-code" placeholder="e.g. V2020" style="text-transform:uppercase" /></div>
        <div class="fg"><label>Unit Price (AED)</label>
          <input type="number" class="fi fi-mono" id="hc-price" step="0.01" value="0" /></div>
      </div>
      <div class="fg"><label>Description <span class="req">*</span></label>
        <input type="text" class="fi" id="hc-desc" /></div>
      <input type="hidden" id="hc-id" />
    `
  });
  await loadConfigTable_hcpcs();
};

async function loadConfigTable_hcpcs() {
  const tbody = document.getElementById('cfg-tbody-hcpcs');
  if (!tbody) return;
  const data = await fetchConfig('hcpcs_codes','*',{});
  clearCache('hcpcs_codes');
  tbody.innerHTML = data.map(h => `
    <tr>
      <td><span class="code-tag">${sanitize(h.code)}</span></td>
      <td>${sanitize(h.description)}</td>
      <td class="text-right mono fw-600">AED ${fmtNum(h.unit_price)}</td>
      <td><span class="badge ${h.is_active?'bg2-c':'br2'}">${h.is_active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editHcpcs('${h.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="toggleActive('hcpcs_codes','${h.id}',${!h.is_active})">${h.is_active?'🚫':'✅'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.openConfigModal_hcpcs = function() {
  ['hc-code','hc-desc','hc-id'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('hc-price').value='0';
  openModal('modal-cfg-hcpcs');
};
function editHcpcs(id) {
  fetchConfig('hcpcs_codes','*',{}).then(data => {
    const h = data.find(x=>x.id===id); if(!h) return;
    document.getElementById('hc-id').value   = h.id;
    document.getElementById('hc-code').value = h.code;
    document.getElementById('hc-desc').value = h.description;
    document.getElementById('hc-price').value= h.unit_price||0;
    openModal('modal-cfg-hcpcs');
  });
}
window.saveConfig_hcpcs = async function() {
  const id   = document.getElementById('hc-id').value;
  const code = document.getElementById('hc-code').value?.trim()?.toUpperCase();
  const desc = document.getElementById('hc-desc').value?.trim();
  const price= parseFloat(document.getElementById('hc-price').value)||0;
  if (!code||!desc) { toast('Code and description required','error'); return; }
  try {
    const payload = { code, description:desc, unit_price:price };
    id ? await db.from('hcpcs_codes').update(payload).eq('id',id)
       : await db.from('hcpcs_codes').insert([payload]);
    clearCache('hcpcs_codes');
    toast('Saved!','success');
    closeModal('modal-cfg-hcpcs');
    await loadConfigTable_hcpcs();
  } catch(e) { toast('Error: '+e.message,'error'); }
};

// ============================================================
// CONFIG — ICD CODES
// ============================================================
window.init_config_icd = async function() {
  renderConfigPage({
    key:'icd',
    singular:'ICD Code',
    columns:[{label:'Code'},{label:'Description'},{label:'Category'},{label:'Status'}],
    formHTML:`
      <div class="g2">
        <div class="fg"><label>ICD Code <span class="req">*</span></label>
          <input type="text" class="fi fi-mono" id="icd-code" placeholder="e.g. H52.1" /></div>
        <div class="fg"><label>Category</label>
          <input type="text" class="fi" id="icd-cat" placeholder="e.g. Refractive Errors" /></div>
      </div>
      <div class="fg"><label>Description <span class="req">*</span></label>
        <input type="text" class="fi" id="icd-desc-cfg" /></div>
      <input type="hidden" id="icd-cfg-id" />
    `
  });
  await loadConfigTable_icd();
};
async function loadConfigTable_icd() {
  const tbody = document.getElementById('cfg-tbody-icd');
  if (!tbody) return;
  const data = await fetchConfig('icd_codes','*',{});
  clearCache('icd_codes');
  tbody.innerHTML = data.map(h => `
    <tr>
      <td><span class="code-tag">${sanitize(h.code)}</span></td>
      <td>${sanitize(h.description)}</td>
      <td class="text-muted text-sm">${sanitize(h.category||'—')}</td>
      <td><span class="badge ${h.is_active?'bg2-c':'br2'}">${h.is_active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editIcd('${h.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="toggleActive('icd_codes','${h.id}',${!h.is_active})">${h.is_active?'🚫':'✅'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}
window.openConfigModal_icd = function() {
  ['icd-code','icd-cat','icd-desc-cfg','icd-cfg-id'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openModal('modal-cfg-icd');
};
function editIcd(id) {
  fetchConfig('icd_codes','*',{}).then(data=>{
    const h=data.find(x=>x.id===id); if(!h) return;
    document.getElementById('icd-cfg-id').value    = h.id;
    document.getElementById('icd-code').value       = h.code;
    document.getElementById('icd-desc-cfg').value   = h.description;
    document.getElementById('icd-cat').value        = h.category||'';
    openModal('modal-cfg-icd');
  });
}
window.saveConfig_icd = async function() {
  const id   = document.getElementById('icd-cfg-id').value;
  const code = document.getElementById('icd-code').value?.trim();
  const desc = document.getElementById('icd-desc-cfg').value?.trim();
  const cat  = document.getElementById('icd-cat').value?.trim();
  if (!code||!desc) { toast('Code and description required','error'); return; }
  try {
    const payload = { code, description:desc, category:cat||null };
    id ? await db.from('icd_codes').update(payload).eq('id',id)
       : await db.from('icd_codes').insert([payload]);
    clearCache('icd_codes');
    toast('Saved!','success');
    closeModal('modal-cfg-icd');
    await loadConfigTable_icd();
  } catch(e) { toast('Error: '+e.message,'error'); }
};

// ============================================================
// CONFIG — USERS
// ============================================================
window.init_config_users = async function() {
  renderConfigPage({
    key:'users',
    singular:'User',
    columns:[{label:'Name'},{label:'Email'},{label:'Role'},{label:'Facility'},{label:'Status'}],
    formHTML:`
      <div class="alert alert-info" style="font-size:11px">User accounts are created via Supabase Auth. Create user in Supabase Auth first, then assign profile here.</div>
      <div class="g2">
        <div class="fg"><label>Full Name <span class="req">*</span></label>
          <input type="text" class="fi" id="usr-name" /></div>
        <div class="fg"><label>Email <span class="req">*</span></label>
          <input type="email" class="fi" id="usr-email" /></div>
      </div>
      <div class="g2">
        <div class="fg"><label>Role <span class="req">*</span></label>
          <select class="fi" id="usr-role">
            <option value="">— Select Role —</option>
            <option value="frontdesk">Front Desk</option>
            <option value="coordinator">Insurance Coordinator</option>
            <option value="manager">Insurance Manager</option>
            <option value="rcm">RCM Manager</option>
            <option value="stakeholder">Stakeholder</option>
          </select></div>
        <div class="fg"><label>Emirate (for coordinators)</label>
          <select class="fi" id="usr-emirate">
            <option value="">All Emirates</option>
            <option>Dubai</option><option>Abu Dhabi</option><option>Sharjah</option>
            <option>Ajman</option><option>Ras Al Khaimah</option>
            <option>Fujairah</option><option>Umm Al Quwain</option>
          </select></div>
      </div>
      <div class="fg"><label>Facility (for front desk)</label>
        <select class="fi" id="usr-facility"><option value="">— Select Facility —</option></select></div>
      <input type="hidden" id="usr-id" />
    `
  });
  await loadFacilityOptions('usr-facility');
  await loadConfigTable_users();
};

async function loadConfigTable_users() {
  const tbody = document.getElementById('cfg-tbody-users');
  if (!tbody) return;
  const { data } = await db.from('profiles').select('*, facilities(name)').order('created_at');
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:20px">
      <div class="es-icon">👤</div><div class="es-title">No users yet</div>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(u => `
    <tr>
      <td style="font-weight:600">${sanitize(u.full_name)}</td>
      <td class="mono text-sm">${sanitize(u.email)}</td>
      <td><span class="badge bt">${getRoleLabel(u.role)}</span></td>
      <td class="text-sm">${sanitize(u.facilities?.name||'—')}</td>
      <td><span class="badge ${u.is_active?'bg2-c':'br2'}">${u.is_active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editUser('${u.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="toggleActive('profiles','${u.id}',${!u.is_active})">${u.is_active?'🚫':'✅'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.openConfigModal_users = function() {
  ['usr-name','usr-email','usr-id'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openModal('modal-cfg-users');
};
function editUser(id) {
  db.from('profiles').select('*').eq('id',id).single().then(({data:u})=>{
    if(!u) return;
    document.getElementById('usr-id').value      = u.id;
    document.getElementById('usr-name').value    = u.full_name;
    document.getElementById('usr-email').value   = u.email;
    document.getElementById('usr-role').value    = u.role;
    document.getElementById('usr-emirate').value = u.emirate||'';
    document.getElementById('usr-facility').value= u.facility_id||'';
    openModal('modal-cfg-users');
  });
}
window.saveConfig_users = async function() {
  const id   = document.getElementById('usr-id').value;
  const name = document.getElementById('usr-name').value?.trim();
  const role = document.getElementById('usr-role').value;
  if (!name||!role) { toast('Name and role required','error'); return; }
  const payload = {
    full_name:   name,
    role,
    emirate:     document.getElementById('usr-emirate').value||null,
    facility_id: document.getElementById('usr-facility').value||null,
  };
  try {
    if (id) {
      await db.from('profiles').update(payload).eq('id',id);
    } else {
      toast('To create a new user, first add them via Supabase Auth, then edit here.','warning');
      return;
    }
    toast('User updated!','success');
    closeModal('modal-cfg-users');
    await loadConfigTable_users();
  } catch(e) { toast('Error: '+e.message,'error'); }
};

// ============================================================
// CONFIG — OPTOMETRISTS
// ============================================================
window.init_config_opto = async function() {
  renderConfigPage({
    key:'opto',
    singular:'Optometrist',
    columns:[{label:'Name'},{label:'DHA License'},{label:'Facility'},{label:'Status'}],
    formHTML:`
      <div class="g2">
        <div class="fg"><label>Full Name <span class="req">*</span></label>
          <input type="text" class="fi" id="opto-name" /></div>
        <div class="fg"><label>DHA License No</label>
          <input type="text" class="fi fi-mono" id="opto-lic" placeholder="DHA-P-XXXXXXX" /></div>
      </div>
      <div class="fg"><label>Facility <span class="req">*</span></label>
        <select class="fi" id="opto-facility"><option value="">— Select Facility —</option></select></div>
      <input type="hidden" id="opto-id" />
    `
  });
  await loadFacilityOptions('opto-facility');
  await loadConfigTable_opto();
};

async function loadConfigTable_opto() {
  const tbody = document.getElementById('cfg-tbody-opto');
  if (!tbody) return;
  const { data } = await db.from('optometrists').select('*, facilities(name)').order('created_at');
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:20px">
      <div class="es-icon">👨‍⚕️</div><div class="es-title">No optometrists added</div>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(o => `
    <tr>
      <td style="font-weight:600">${sanitize(o.name)}</td>
      <td class="mono text-sm">${sanitize(o.dha_license||'—')}</td>
      <td>${sanitize(o.facilities?.name||'—')}</td>
      <td><span class="badge ${o.is_active?'bg2-c':'br2'}">${o.is_active?'Active':'Inactive'}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editOpto('${o.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="toggleActive('optometrists','${o.id}',${!o.is_active})">${o.is_active?'🚫':'✅'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}
window.openConfigModal_opto = function() {
  ['opto-name','opto-lic','opto-id'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openModal('modal-cfg-opto');
};
function editOpto(id) {
  db.from('optometrists').select('*').eq('id',id).single().then(({data:o})=>{
    if(!o) return;
    document.getElementById('opto-id').value       = o.id;
    document.getElementById('opto-name').value     = o.name;
    document.getElementById('opto-lic').value      = o.dha_license||'';
    document.getElementById('opto-facility').value = o.facility_id||'';
    openModal('modal-cfg-opto');
  });
}
window.saveConfig_opto = async function() {
  const id  = document.getElementById('opto-id').value;
  const name= document.getElementById('opto-name').value?.trim();
  const fac = document.getElementById('opto-facility').value;
  if (!name||!fac) { toast('Name and facility required','error'); return; }
  const payload = { name, dha_license:document.getElementById('opto-lic').value||null, facility_id:fac };
  try {
    id ? await db.from('optometrists').update(payload).eq('id',id)
       : await db.from('optometrists').insert([payload]);
    toast('Saved!','success');
    closeModal('modal-cfg-opto');
    await loadConfigTable_opto();
  } catch(e) { toast('Error: '+e.message,'error'); }
};

// ============================================================
// CONFIG — TPA
// ============================================================
window.init_config_tpa = async function() {
  renderConfigPage({
    key:'tpa',
    singular:'TPA Company',
    columns:[{label:'Name'},{label:'Internal Name'},{label:'Phone'},{label:'Status'}],
    formHTML:`
      <div class="g2">
        <div class="fg"><label>TPA Name <span class="req">*</span></label>
          <input type="text" class="fi" id="tpa-name" /></div>
        <div class="fg"><label>Internal Name</label>
          <input type="text" class="fi" id="tpa-iname" /></div>
      </div>
      <div class="fg"><label>Address</label><input type="text" class="fi" id="tpa-addr" /></div>
      <div class="g2">
        <div class="fg"><label>Phone</label><input type="tel" class="fi" id="tpa-phone" /></div>
        <div class="fg"><label>Email</label><input type="email" class="fi" id="tpa-email" /></div>
      </div>
      <input type="hidden" id="tpa-id" />
    `
  });
  await loadConfigTable_tpa();
};
async function loadConfigTable_tpa() {
  const tbody=document.getElementById('cfg-tbody-tpa');
  if(!tbody) return;
  const data=await fetchConfig('tpa_companies','*',{});
  clearCache('tpa_companies');
  tbody.innerHTML=data.map(t=>`
    <tr>
      <td style="font-weight:600">${sanitize(t.name)}</td>
      <td class="text-muted text-sm">${sanitize(t.internal_name||'—')}</td>
      <td class="text-sm">${sanitize(t.phone||'—')}</td>
      <td><span class="badge ${t.is_active?'bg2-c':'br2'}">${t.is_active?'Active':'Inactive'}</span></td>
      <td><div style="display:flex;gap:4px">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="editTpa('${t.id}')">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="toggleActive('tpa_companies','${t.id}',${!t.is_active})">${t.is_active?'🚫':'✅'}</button>
      </div></td>
    </tr>
  `).join('');
}
window.openConfigModal_tpa=function(){
  ['tpa-name','tpa-iname','tpa-addr','tpa-phone','tpa-email','tpa-id'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  openModal('modal-cfg-tpa');
};
function editTpa(id){
  fetchConfig('tpa_companies','*',{}).then(data=>{
    const t=data.find(x=>x.id===id);if(!t)return;
    document.getElementById('tpa-id').value    =t.id;
    document.getElementById('tpa-name').value  =t.name;
    document.getElementById('tpa-iname').value =t.internal_name||'';
    document.getElementById('tpa-addr').value  =t.address||'';
    document.getElementById('tpa-phone').value =t.phone||'';
    document.getElementById('tpa-email').value =t.email||'';
    openModal('modal-cfg-tpa');
  });
}
window.saveConfig_tpa=async function(){
  const id=document.getElementById('tpa-id').value;
  const name=document.getElementById('tpa-name').value?.trim();
  if(!name){toast('Name required','error');return;}
  const payload={name,internal_name:document.getElementById('tpa-iname').value||null,
    address:document.getElementById('tpa-addr').value||null,
    phone:document.getElementById('tpa-phone').value||null,
    email:document.getElementById('tpa-email').value||null};
  try{
    id?await db.from('tpa_companies').update(payload).eq('id',id)
      :await db.from('tpa_companies').insert([payload]);
    clearCache('tpa_companies');
    toast('Saved!','success');
    closeModal('modal-cfg-tpa');
    await loadConfigTable_tpa();
  }catch(e){toast('Error: '+e.message,'error');}
};

// ============================================================
// SHARED — Toggle active/inactive
// ============================================================
async function toggleActive(table, id, newVal) {
  try {
    await db.from(table).update({ is_active: newVal }).eq('id', id);
    clearCache(table);
    toast(newVal ? 'Activated' : 'Deactivated', 'success');
    // Re-load current config page
    const page = APP.page;
    if (typeof window[`init_${page.replace(/-/g,'_')}`] === 'function') {
      await window[`init_${page.replace(/-/g,'_')}`]();
    }
  } catch(e) { toast('Error: '+e.message,'error'); }
}
