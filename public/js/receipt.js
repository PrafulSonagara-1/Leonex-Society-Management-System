/**
 * SocietyHub — Maintenance Receipt Generator (receipt.js)
 * ─────────────────────────────────────────────────
 * Opens a print-ready window with a professional invoice (.invoice-paper).
 * Includes society name, resident, flat, billing month, maintenance amount,
 * late fee (0 when paid on time), total, payment status/date, receipt no,
 * transaction id and method.
 *
 * Demo note: payments in SocietyHub are simulated — the receipt footer says so.
 */

/* global SystemDB, SHUI */

function __receiptEsc(value) {
  if (window.SHUI && typeof SHUI.escapeHtml === 'function') return SHUI.escapeHtml(value);
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function __receiptINR(n) {
  const num = Number(n) || 0;
  try {
    return '₹' + num.toLocaleString('en-IN');
  } catch (e) {
    return '₹' + num;
  }
}

/**
 * Late fee = lateFeePercentage% of the bill amount, applied only when the bill
 * was paid more than `graceDays` days after the due date. 0 when paid on time.
 */
function __receiptLateFee(bill, settings) {
  if (!bill || bill.status !== 'Paid' || !bill.paymentDate || !bill.dueDate) return 0;
  const pct = Number(settings.lateFeePercentage) || 0;
  const grace = Number(settings.graceDays) || 0;
  if (pct <= 0) return 0;

  const due = new Date(String(bill.dueDate).replace(/-/g, '/') + ' 23:59:59');
  const paid = new Date(String(bill.paymentDate).replace(/-/g, '/'));
  if (isNaN(due.getTime()) || isNaN(paid.getTime())) return 0;

  const daysLate = Math.floor((paid.getTime() - due.getTime()) / 86400000);
  if (daysLate <= grace) return 0;
  return Math.round((Number(bill.amount) || 0) * pct / 100);
}

function __receiptDateFmt(d) {
  if (window.SHUI && typeof SHUI.formatDate === 'function') return SHUI.formatDate(d);
  return d ? String(d) : '—';
}

function generateReceiptHTML(bill) {
  const esc = __receiptEsc;
  const settings = (SystemDB.data && SystemDB.data.societySettings) || {};
  const societyName = settings.name || 'SocietyHub Grand Residency';
  const societyMeta = [settings.city, settings.pincode].filter(Boolean).join(' · ');

  const amount = Number(bill.amount) || 0;
  const lateFee = __receiptLateFee(bill, settings);
  const total = amount + lateFee;
  const paid = bill.status === 'Paid';

  return `
    <div class="invoice-paper" id="printableReceipt">
      <!-- Header -->
      <div class="invoice-brand">
        <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#2563EB,#1E40AF);
                    display:flex;align-items:center;justify-content:center;color:#fff;font-size:19px;flex-shrink:0;">
          <i class="fa-solid fa-building-user"></i>
        </div>
        <div>
          <h4 class="fw-bold mb-0" style="letter-spacing:-0.02em;">${esc(societyName)}</h4>
          <div class="invoice-meta">${esc(societyMeta || 'Smart Housing Society Management')}</div>
        </div>
        <div style="margin-left:auto;text-align:right;">
          ${paid
            ? '<span class="invoice-stamp"><i class="fa-solid fa-circle-check"></i> Paid</span>'
            : '<span class="invoice-stamp" style="border-color:#F59E0B;color:#B45309;"><i class="fa-solid fa-clock"></i> Unpaid</span>'}
        </div>
      </div>

      <hr class="my-3">

      <!-- Meta grid -->
      <table style="margin-bottom:8px;">
        <tbody>
          <tr>
            <td style="border:none;padding:4px 8px 4px 0;">
              <div class="invoice-meta" style="text-transform:uppercase;letter-spacing:0.8px;font-size:11px;">Receipt No</div>
              <strong>${esc(bill.receiptNo || '—')}</strong>
            </td>
            <td style="border:none;padding:4px 8px;">
              <div class="invoice-meta" style="text-transform:uppercase;letter-spacing:0.8px;font-size:11px;">Invoice ID</div>
              <strong>${esc(bill.id)}</strong>
            </td>
            <td style="border:none;padding:4px 8px;">
              <div class="invoice-meta" style="text-transform:uppercase;letter-spacing:0.8px;font-size:11px;">Payment Date</div>
              <strong>${esc(__receiptDateFmt(bill.paymentDate))}</strong>
            </td>
            <td style="border:none;padding:4px 0 4px 8px;text-align:right;">
              <div class="invoice-meta" style="text-transform:uppercase;letter-spacing:0.8px;font-size:11px;">Payment Status</div>
              <strong style="color:${paid ? '#047857' : '#B45309'};">${esc(bill.status || 'Unknown')}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <hr class="my-3">

      <!-- Billed to / payment details -->
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:18px;">
        <div style="flex:1;min-width:220px;">
          <div class="invoice-meta" style="text-transform:uppercase;letter-spacing:0.8px;font-size:11px;margin-bottom:4px;">Billed To</div>
          <div style="font-size:16px;font-weight:700;">${esc(bill.residentName || 'Resident')}</div>
          <div class="invoice-meta">Flat: <strong style="color:#111827;">${esc(bill.flat || '—')}</strong></div>
        </div>
        <div style="flex:1;min-width:220px;text-align:right;">
          <div class="invoice-meta" style="text-transform:uppercase;letter-spacing:0.8px;font-size:11px;margin-bottom:4px;">Payment Details</div>
          <div class="invoice-meta">Transaction ID: <strong style="color:#111827;">${esc(bill.txnId || '—')}</strong></div>
          <div class="invoice-meta">Method: <strong style="color:#111827;">${esc(bill.paymentMethod || 'Online')}</strong></div>
        </div>
      </div>

      <!-- Line items -->
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Billing Period</th>
            <th style="text-align:right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight:700;">Monthly Society Maintenance Fee</div>
              <div class="invoice-meta">Security, housekeeping, common lighting, water charges &amp; lift maintenance</div>
            </td>
            <td>${esc(bill.month || '—')}</td>
            <td style="text-align:right;font-weight:600;">${__receiptINR(amount)}</td>
          </tr>
          <tr>
            <td>
              <div style="font-weight:700;">Late Fee${lateFee > 0 ? ' (' + esc(Number(settings.lateFeePercentage) || 0) + '%)' : ''}</div>
              <div class="invoice-meta">${lateFee > 0
                ? 'Applied as payment was received beyond the grace period after the due date'
                : 'Paid on time — no late fee charged'}</div>
            </td>
            <td>${esc(bill.month || '—')}</td>
            <td style="text-align:right;font-weight:600;">${__receiptINR(lateFee)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="text-align:right;border-bottom:none;padding-top:14px;">
              <span class="invoice-total">Total ${paid ? 'Paid' : 'Payable'}</span>
            </td>
            <td style="text-align:right;border-bottom:none;padding-top:14px;">
              <span class="invoice-total" style="color:#047857;">${__receiptINR(total)}</span>
            </td>
          </tr>
        </tfoot>
      </table>

      <hr class="my-3">

      <!-- Footer -->
      <div class="invoice-meta" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <span><i class="fa-solid fa-shield-halved me-1" style="color:#2563EB;"></i> Digitally verified payment record</span>
        <span>Computer generated · No stamp required</span>
      </div>
      <p class="invoice-meta" style="margin-top:10px;margin-bottom:0;font-style:italic;">
        This is a computer-generated receipt from a demo payment simulation.
      </p>
    </div>`;
}

function downloadPDFReceipt(billId) {
  if (typeof SystemDB === 'undefined' || !SystemDB.data) {
    if (window.SHUI) SHUI.toast('Billing data is not ready yet.', 'error');
    return;
  }
  const bill = SystemDB.getMaintenance().find((m) => m.id === billId);
  if (!bill) {
    if (window.SHUI) SHUI.toast('Bill not found.', 'error');
    return;
  }
  if (bill.status !== 'Paid') {
    if (window.SHUI) SHUI.toast('Receipts are available only for paid bills.', 'warning');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=880,height=980');
  if (!printWindow) {
    if (window.SHUI) SHUI.toast('Pop-up blocked — please allow pop-ups to view the receipt.', 'error');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Receipt_${bill.receiptNo || bill.id}</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" rel="stylesheet">
      <style>
        :root { color-scheme: light; }
        body {
          font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif;
          background: #F1F5F9;
          padding: 32px 16px;
          margin: 0;
        }
        .invoice-paper {
          background: #FFFFFF;
          color: #111827;
          max-width: 820px;
          margin: 0 auto;
          border-radius: 14px;
          padding: 44px 52px;
          box-shadow: 0 10px 34px rgba(15, 23, 42, 0.12);
        }
        .invoice-paper h1, .invoice-paper h2, .invoice-paper h3,
        .invoice-paper h4, .invoice-paper h5, .invoice-paper h6 { color: #111827; }
        .invoice-paper .invoice-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .invoice-paper .invoice-meta { font-size: 13px; color: #6B7280; }
        .invoice-paper hr { border-color: #E5E7EB; opacity: 1; }
        .invoice-paper table { width: 100%; border-collapse: collapse; }
        .invoice-paper table th {
          text-align: left; font-size: 11.5px; text-transform: uppercase;
          letter-spacing: 0.8px; color: #6B7280;
          border-bottom: 2px solid #E5E7EB; padding: 10px 8px;
        }
        .invoice-paper table td { padding: 12px 8px; border-bottom: 1px solid #F3F4F6; font-size: 14px; color: #111827; }
        .invoice-paper .invoice-total { font-size: 18px; font-weight: 800; color: #111827; }
        .invoice-paper .invoice-stamp {
          display: inline-flex; align-items: center; gap: 8px;
          border: 2px solid #10B981; color: #047857;
          border-radius: 10px; padding: 6px 16px;
          font-weight: 800; text-transform: uppercase;
          letter-spacing: 1.5px; font-size: 13px;
          transform: rotate(-4deg);
        }
        .print-bar { max-width: 820px; margin: 18px auto 0; text-align: center; }
        .print-bar .btn { min-width: 220px; }
        @media print {
          .no-print { display: none !important; }
          body { background: #FFFFFF !important; padding: 0 !important; }
          .invoice-paper { box-shadow: none; border-radius: 0; max-width: 100%; padding: 0; }
        }
      </style>
    </head>
    <body>
      ${generateReceiptHTML(bill)}
      <div class="print-bar no-print">
        <button onclick="window.print()" class="btn btn-primary btn-lg rounded-pill px-4">
          <i class="fa-solid fa-print me-2"></i> Print / Save as PDF
        </button>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();

  if (window.SHUI) {
    SHUI.toast('Receipt ' + (bill.receiptNo || bill.id) + ' opened in a new window.', 'success');
  }
}
