/* ============================================================
   js/claims.js — Claims helpers, resubmission logic, batch actions
   ============================================================ */

// ============================================================
// RESUBMIT (acts as brand new submission, ends of queue)
// ============================================================
async function resubmitClaim(originalClaimId) {
  try {
    const original = await Claims.get(originalClaimId);
    if (!['cancelled', 'rejected'].includes(original.status)) {
      toast('Only cancelled or rejected claims can be resubmitted', 'warning');
      return;
    }

    // Clone the claim as new, referencing parent
    const newClaim = await Claims.submit({
      facility_id:        original.facility_id,
      submitted_by:       APP.user.id,
      patient_name:       original.patient_name,
      phone:              original.phone,
      emirates_id:        original.emirates_id,
      member_id:          original.member_id,
      policy_expiry:      original.policy_expiry,
      insurance_id:       original.insurance_id,
      tpa_id:             original.tpa_id,
      diagnosis_notes:    original.diagnosis_notes,
      icd_codes:          original.icd_codes,
      hcpcs_items:        original.hcpcs_items,
      prescription_type:  original.prescription_type,
      optometrist_id:     original.optometrist_id,
      external_dr_name:   original.external_dr_name,
      parent_claim_id:    original.id,
      resubmission_count: (original.resubmission_count || 0) + 1,
      status:             'pending',
    });

    // Copy documents from original
    const docs = await Claims.getDocs(originalClaimId);
    if (docs.length) {
      await db.from('claim_documents').insert(
        docs.map(d => ({
          claim_id:    newClaim.id,
          doc_type:    d.doc_type,
          file_url:    d.file_url,
          file_name:   d.file_name,
          file_size:   d.file_size,
          uploaded_by: APP.user.id,
        }))
      );
    }

    // Log history
    await db.from('claim_history').insert([{
      claim_id:   newClaim.id,
      new_status: 'pending',
      changed_by: APP.user.id,
      notes:      `Resubmission of ${original.claim_number}`,
    }]);

    toast(`Resubmitted as ${newClaim.claim_number} · Queue: #${newClaim.queue_position}`, 'success');
    return newClaim;
  } catch(e) {
    toast('Resubmit failed: ' + e.message, 'error');
    throw e;
  }
}

// ============================================================
// BULK APPROVE (RCM/Manager only - select multiple and approve)
// ============================================================
let _bulkSelected = new Set();

function toggleBulkSelect(claimId) {
  if (_bulkSelected.has(claimId)) {
    _bulkSelected.delete(claimId);
  } else {
    _bulkSelected.add(claimId);
  }
  updateBulkActionBar();
}

function updateBulkActionBar() {
  let bar = document.getElementById('bulk-action-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bulk-action-bar';
    bar.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: var(--ink); color: #fff;
      padding: 12px 20px; border-radius: 999px;
      display: flex; align-items: center; gap: 12px;
      box-shadow: var(--shadow-lg); z-index: 500;
      font-size: 13px; font-weight: 500;
    `;
    document.body.appendChild(bar);
  }

  if (_bulkSelected.size === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = `
    <span>${_bulkSelected.size} claim${_bulkSelected.size > 1 ? 's' : ''} selected</span>
    <button class="btn btn-success btn-sm" onclick="bulkGenerateInvoices()">🧾 Generate Invoices</button>
    <button class="btn btn-secondary btn-sm" style="color:var(--ink);background:#fff" onclick="clearBulkSelect()">Clear</button>
  `;
}

function clearBulkSelect() {
  _bulkSelected.clear();
  updateBulkActionBar();
  document.querySelectorAll('.bulk-cb').forEach(cb => { cb.checked = false; });
}

async function bulkGenerateInvoices() {
  if (!_bulkSelected.size) return;
  const ids = [..._bulkSelected];
  let done = 0;
  for (const id of ids) {
    try {
      await Invoices.create(id);
      done++;
    } catch(e) {
      console.warn('Invoice gen failed for', id, e.message);
    }
  }
  toast(`Generated ${done} of ${ids.length} invoices`, 'success');
  clearBulkSelect();
  if (typeof loadClaims === 'function') await loadClaims();
}

// ============================================================
// EXPORT CLAIMS TO CSV
// ============================================================
async function exportClaimsCSV() {
  try {
    const claims = await Claims.list({});
    if (!claims.length) { toast('No claims to export', 'warning'); return; }

    const headers = [
      'Claim Number', 'Patient Name', 'Emirates ID', 'Member ID',
      'Insurance Company', 'Facility', 'Emirate', 'Status',
      'Submitted At', 'Approved Amount', 'Copay', 'Claim Amount',
      'Approval Code', 'Approval Date'
    ];

    const rows = claims.map(c => [
      c.claim_number,
      c.patient_name,
      c.emirates_id,
      c.member_id || '',
      c.insurance_companies?.name || '',
      c.facilities?.name || '',
      c.facilities?.emirate || '',
      c.status,
      new Date(c.submitted_at).toLocaleDateString('en-GB'),
      c.approved_amount || '',
      c.copay_amount || '',
      c.approved_amount ? (c.approved_amount - (c.copay_amount || 0)) : '',
      c.approval_code || '',
      c.approval_date ? new Date(c.approval_date).toLocaleDateString('en-GB') : '',
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `claims_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Export downloaded', 'success');
  } catch(e) {
    toast('Export failed: ' + e.message, 'error');
  }
}

// ============================================================
// CLAIM SEARCH (quick search across all fields)
// ============================================================
async function quickSearchClaims(query) {
  if (!query || query.length < 3) return [];
  try {
    const { data } = await db.from('claims')
      .select('id, claim_number, patient_name, emirates_id, status, facilities(name)')
      .or(`patient_name.ilike.%${query}%,claim_number.ilike.%${query}%,emirates_id.ilike.%${query}%`)
      .limit(8);
    return data || [];
  } catch(e) {
    console.error(e);
    return [];
  }
}

// ============================================================
// POLICY EXPIRY CHECKER
// ============================================================
function checkPolicyExpiry(expiryDate) {
  if (!expiryDate) return null;
  const today    = new Date();
  const expiry   = new Date(expiryDate);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)   return { type: 'error',   msg: `Policy expired ${Math.abs(diffDays)} days ago` };
  if (diffDays < 30)  return { type: 'warning',  msg: `Policy expires in ${diffDays} days` };
  return { type: 'success', msg: `Policy valid for ${diffDays} more days` };
}

// ============================================================
// PENDING CLAIMS COUNTER (for sidebar badge)
// ============================================================
async function updatePendingBadge() {
  try {
    let q = db.from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (isFrontDesk()) q = q.eq('facility_id', APP.profile.facility_id);
    if (isCoordinator() && APP.profile.emirate) {
      const { data: facs } = await db.from('facilities').select('id').eq('emirate', APP.profile.emirate);
      const ids = facs?.map(f => f.id) || [];
      if (ids.length) q = q.in('facility_id', ids);
    }

    const { count } = await q;
    const badge = document.getElementById('nav-claims')?.querySelector('.nav-badge');
    if (count && count > 0) {
      if (!badge) {
        const navItem = document.getElementById('nav-claims');
        if (navItem) {
          const b = document.createElement('span');
          b.className = 'nav-badge';
          b.textContent = count > 99 ? '99+' : count;
          navItem.appendChild(b);
        }
      } else {
        badge.textContent = count > 99 ? '99+' : count;
      }
    } else if (badge) {
      badge.remove();
    }
  } catch(e) {
    console.error('Badge update error:', e);
  }
}

// Run badge update after page loads
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(updatePendingBadge, 2000);
  setInterval(updatePendingBadge, 60000); // every minute
});
