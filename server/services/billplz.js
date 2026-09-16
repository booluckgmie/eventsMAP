// server/services/billplz.js
'use strict';

const nodeHttps = require('https');
const crypto = require('crypto');

// ── Environment Configuration ─────────────────────────────────
const BILLPLZ_API_KEY = process.env.BILLPLZ_API_KEY;
const COLLECTION_ID = process.env.BILLPLZ_COLLECTION_ID;
const X_SIGNATURE_KEY = process.env.BILLPLZ_X_SIGNATURE_KEY;

// Sandbox toggle: set BILLPLZ_SANDBOX=true (or 1) for sandbox mode
const isSandbox = process.env.BILLPLZ_SANDBOX === 'true' || process.env.BILLPLZ_SANDBOX === '1';

// Validate required environment variables
if (!BILLPLZ_API_KEY) {
  throw new Error('[BILLPLZ] Missing environment variable: BILLPLZ_API_KEY');
}
if (!COLLECTION_ID) {
  throw new Error('[BILLPLZ] Missing environment variable: BILLPLZ_COLLECTION_ID');
}
if (!X_SIGNATURE_KEY) {
  throw new Error('[BILLPLZ] Missing environment variable: BILLPLZ_X_SIGNATURE_KEY (required for webhook verification)');
}

function getApiBase() {
  if (isSandbox) {
    console.log('[BILLPLZ] Using SANDBOX mode');
    return 'https://www.billplz-sandbox.com/api/v3';
  }
  console.log('[BILLPLZ] Using PRODUCTION mode');
  return 'https://www.billplz.com/api/v3';
}

function getWebBase() {
  return isSandbox ? 'https://www.billplz-sandbox.com' : 'https://www.billplz.com';
}

// ── Low-level request helper ──────────────────────────────────
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${BILLPLZ_API_KEY}:`).toString('base64');
    const payload = body ? JSON.stringify(body) : null;
    const base = getApiBase();
    const url = new URL(base + path);

    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = nodeHttps.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        const isJson = contentType.includes('application/json');

        // Handle 503 Service Unavailable
        if (res.statusCode === 503) {
          reject(new Error('BillPlz service is temporarily unavailable. Please try again later.'));
          return;
        }

        if (res.statusCode >= 400) {
          let errorMsg = `HTTP ${res.statusCode}`;
          if (isJson) {
            try {
              const json = JSON.parse(data);
              errorMsg = json.error?.message || JSON.stringify(json.error) || errorMsg;
            } catch {
              errorMsg = data.slice(0, 200) || errorMsg;
            }
          } else {
            errorMsg = data.slice(0, 200) || errorMsg;
          }
          reject(new Error(`BillPlz ${errorMsg}`));
          return;
        }

        if (!isJson) {
          reject(new Error(`BillPlz expected JSON but got ${contentType}: ${data.slice(0, 200)}`));
          return;
        }

        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(new Error(`BillPlz invalid JSON response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Create a BillPlz bill ─────────────────────────────────────
async function createBill({ id, name, email, phone, fee, cat, notes, memberType }) {
  // Amount in sen (cents) — RM × 100
  const amountSen = Math.round(fee * 100);

  // Format phone number for Malaysia
  let mobile = phone.replace(/[^\d+]/g, '');
  if (mobile.startsWith('0') && !mobile.startsWith('+60')) {
    mobile = '+60' + mobile.substring(1);
  } else if (!mobile.startsWith('+')) {
    mobile = '+60' + mobile;
  }

  const workshopMatch = (notes || '').match(/Workshop:\s*([^|]+)/);
  const workshopPart  = workshopMatch ? workshopMatch[1].trim() : '';
  const desc = workshopPart
    ? `JSC 2026 - ${cat} | Workshop: ${workshopPart}`.slice(0, 200)
    : `JSC 2026 - ${cat}`;

  const body = {
    collection_id: COLLECTION_ID,
    email: email,
    mobile: mobile,
    name: name.slice(0, 100),
    amount: amountSen,
    callback_url: 'https://events.maad.com.my/api/billplz/webhook',
    redirect_url: 'https://events.maad.com.my/api/billplz/redirect',
    description: desc,
    reference_1_label: 'Registration ID',
    reference_1: id,
    reference_2_label: 'Category',
    reference_2: cat,
    due_at: dueDateStr(7),
  };

  console.log('[BILLPLZ] Creating bill:', {
    id,
    name,
    email,
    amount: `RM ${fee} (${amountSen} sen)`,
    cat,
    memberType,
    mode: isSandbox ? 'SANDBOX' : 'PRODUCTION'
  });

  try {
    const result = await apiRequest('POST', '/bills', body);
    console.log('[BILLPLZ] ✓ Bill created successfully:', {
      billId: result.id,
      url: result.url,
      amount: result.amount,
      state: result.state
    });

    return {
      success: true,
      billId: result.id,
      billUrl: result.url,
      amount: fee,
      dueDate: result.due_at
    };
  } catch (err) {
    console.error('[BILLPLZ] ✗ Failed to create bill:', err.message);
    return {
      success: false,
      billId: null,
      billUrl: null,
      error: err.message
    };
  }
}

// ── Get bill status ───────────────────────────────────────────
async function getBill(billId) {
  try {
    const result = await apiRequest('GET', `/bills/${billId}`, null);
    console.log('[BILLPLZ] Bill status:', {
      billId: result.id,
      state: result.state,
      amount: result.amount,
      paidAt: result.paid_at
    });
    return result;
  } catch (err) {
    console.error('[BILLPLZ] ✗ Failed to get bill:', billId, err.message);
    throw err;
  }
}

// ── Get bill payment status only ──────────────────────────────
async function getBillStatus(billId) {
  try {
    const bill = await getBill(billId);
    return {
      billId: bill.id,
      state: bill.state,
      paid: bill.state === 'paid',
      paidAt: bill.paid_at,
      amount: bill.amount / 100,
      dueAt: bill.due_at
    };
  } catch (err) {
    console.error('[BILLPLZ] ✗ Failed to get bill status:', err.message);
    return { billId, state: 'unknown', paid: false, error: err.message };
  }
}

// ── Void/Expire a bill ────────────────────────────────────────
async function expireBill(billId) {
  try {
    const result = await apiRequest('DELETE', `/bills/${billId}`, null);
    console.log('[BILLPLZ] Bill expired:', billId);
    return result;
  } catch (err) {
    console.error('[BILLPLZ] ✗ Failed to expire bill:', billId, err.message);
    throw err;
  }
}

// ── Verify webhook signature ──────────────────────────────────
function verifyWebhookSignature(signature, payload) {
  const expectedSignature = crypto
    .createHmac('sha256', X_SIGNATURE_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');

  const isValid = signature === expectedSignature;
  console.log('[BILLPLZ] Webhook signature verification:', isValid ? '✓ Valid' : '✗ Invalid');
  return isValid;
}

// ── Generate payment URL for frontend ─────────────────────────
function getPaymentUrl(billId) {
  return `${getWebBase()}/bills/${billId}`;
}

// ── YYYY-MM-DD N days from now ────────────────────────────────
function dueDateStr(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  createBill,
  getBill,
  getBillStatus,
  expireBill,
  verifyWebhookSignature,
  getPaymentUrl
};