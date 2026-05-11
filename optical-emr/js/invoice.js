/* ============================================================
   js/invoice.js — Invoice rendering, batch, vault logic
   ============================================================ */

// ============================================================
// INVOICE HTML GENERATOR (matches Al Amin Opticals format)
// ============================================================
function renderInvoiceHTML(inv, facility, insurance) {
  const lines = inv.line_items || [];
  const vatPct = inv.vat_percent || 5;

  const linesHTML = lines.map((l, i) => `
    <tr>
      <td style="text-align:left;padding-left:4px">${sanitize(l.code||'')}</td>
      <td style="text-align:left">${sanitize(l.description||'')}</td>
      <td>${l.pks||1}</td>
      <td>${l.qty||1}</td>
      <td>${l.loose||0}</td>
      <td>${fmtNum(l.unit_price)}</td>
      <td>${fmtNum(l.gross||l.unit_price)}</td>
      <td>${fmtNum(l.discount||0)}</td>
      <td>${fmtNum((l.gross||l.unit_price)+(l.vat_amount||0))}</td>
      <td>${vatPct}%</td>
      <td>${fmtNum(l.vat_amount||0)}</td>
      <td>${fmtNum(l.co_ins||0)}</td>
      <td style="font-weight:700">${fmtNum(l.claim_amount||0)}</td>
    </tr>
  `).join('');

  return `
    <div class="invoice-preview" id="print-area">
      <div class="inv-header">
        <div class="inv-title">TAX INVOICE</div>
        <div class="inv-company">
          <div class="ic-name">${sanitize(facility?.name || 'Al Amin Opticals LLC')}</div>
          <div class="ic-addr">${sanitize(facility?.address || '')}</div>
        </div>
      </div>

      <div class="inv-meta">
        <div class="im-row"><span class="im-label">COMPANY</span><span class="im-val">: ${sanitize(insurance?.name||'')}</span></div>
        <div class="im-row"><span class="im-label">TRN NO.</span><span class="im-val">: ${sanitize(facility?.trn_no||'')}</span></div>
        <div class="im-row"><span class="im-label">ADDRESS</span><span class="im-val">: ${sanitize(insurance?.address||'UAE')}</span></div>
        <div class="im-row"><span class="im-label">FACILITY LICENSE NO</span><span class="im-val">: ${sanitize(facility?.license_no||'')}</span></div>
        <div class="im-row"><span class="im-label">PATIENT</span><span class="im-val">: ${sanitize(inv.patient_name||'')}</span></div>
        <div class="im-row"><span class="im-label">TAX INVOICE NO</span><span class="im-val">: ${sanitize(inv.invoice_number||'')}</span></div>
        <div class="im-row"><span class="im-label">MEMBER ID</span><span class="im-val">: ${sanitize(inv.member_id||'')}</span></div>
        <div class="im-row"><span class="im-label">DATE</span><span class="im-val">: ${fmtDate(inv.invoice_date)}</span></div>
        <div class="im-row"><span class="im-label">DOCTOR</span><span class="im-val">: ${sanitize(inv.doctor_name||'')}${inv.doctor_license ? ' - '+inv.doctor_license : ''}</span></div>
        <div class="im-row"></div>
        <div class="im-row"><span class="im-label">APPROVAL CODE</span><span class="im-val">: ${sanitize(inv.approval_code||'')}</span></div>
      </div>

      <table class="inv-table">
        <thead>
          <tr>
            <th>Drug Code</th>
            <th>Description</th>
            <th>PKs</th>
            <th>Qty</th>
            <th>Loose</th>
            <th>Unit Price</th>
            <th>Gross Unit</th>
            <th>Discount</th>
            <th>Net Amt Inclusive VAT</th>
            <th>VAT %</th>
            <th>VAT Amt</th>
            <th>Co Ins</th>
            <th>Claim Amt</th>
          </tr>
        </thead>
        <tbody>
          ${linesHTML}
          <tr style="background:#f0f6f6;font-weight:700">
            <td colspan="6"></td>
            <td>${fmtNum(inv.gross_amount)}</td>
            <td>${fmtNum(inv.discount||0)}</td>
            <td>${fmtNum(inv.net_amount)}</td>
            <td></td>
            <td>${fmtNum(inv.vat_amount)}</td>
            <td>${fmtNum(inv.patient_share)}</td>
            <td>${fmtNum(inv.claim_amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="inv-totals">
        <div class="inv-total-box">
          <div class="itb-l">Gross Amount : AED:</div>
          <div class="itb-v">${fmtNum(inv.gross_amount)}</div>
        </div>
        <div class="inv-total-box">
          <div class="itb-l">Amount Inclusive of VAT</div>
          <div class="itb-v">${fmtNum(inv.net_amount)}</div>
        </div>
        <div class="inv-total-box" style="background:var(--teal-light);border-color:var(--teal-mid)">
          <div class="itb-l">Patient Share</div>
          <div class="itb-v" style="color:var(--teal2)">${fmtNum(inv.patient_share)}</div>
        </div>
        <div class="inv-total-box">
          <div class="itb-l">Discount</div>
          <div class="itb-v">${fmtNum(inv.discount||0)}</div>
        </div>
        <div class="inv-total-box">
          <div class="itb-l">VAT:</div>
          <div class="itb-v">${fmtNum(inv.vat_amount)}</div>
        </div>
        <div class="inv-total-box" style="background:var(--green2);border-color:#a7f3d0">
          <div class="itb-l">Claim Amount:</div>
          <div class="itb-v" style="color:var(--green)">${fmtNum(inv.claim_amount)}</div>
        </div>
      </div>

      <div class="inv-footer">
        <div class="inv-notes">
          <div>*Returned and exchanges are valid on presentation of original invoice</div>
          <div>*Product can be exchanged or returned within 14 days from the time of purchase</div>
        </div>
        ${facility?.seal_url
          ? `<img class="inv-seal" src="${facility.seal_url}" alt="Seal" />`
          : `<div class="inv-seal" style="display:flex;align-items:center;justify-content:center;
              border:2px solid var(--teal-mid);border-radius:50%;color:var(--teal2);font-size:10px;
              text-align:center;padding:6px;line-height:1.3">${sanitize(facility?.name||'')}</div>`
        }
      </div>
    </div>
  `;
}

// ============================================================
// PRINT INVOICE
// ============================================================
function printInvoice() {
  window.print();
}
