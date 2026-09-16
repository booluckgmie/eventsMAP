// server/index.js
'use strict';
const express   = require('express');
const path      = require('path');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const db        = require('./services/db');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────
// Method override — translate POST + X-HTTP-Method-Override header
// into PATCH/DELETE. Required because Plesk's Apache proxy blocks
// PATCH/DELETE methods at the reverse-proxy layer.
// ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const override = req.headers['x-http-method-override'];
  if (req.method === 'POST' && override) {
    const m = String(override).toUpperCase();
    if (['PATCH', 'DELETE', 'PUT'].includes(m)) {
      console.log(`[METHOD-OVERRIDE] ${req.method} → ${m} ${req.path}`);
      req.method = m;
    }
  }
  next();
});

// Rate-limit registration: 10 per IP per 15 min
app.use('/api/register', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// The static root below is the repo root (no dedicated "public" folder),
// so explicitly block backend source/config from being served directly.
const BLOCKED_STATIC = /^\/(server|sql|node_modules|tests?)(\/|$)|^\/(package(-lock)?\.json|\.env.*|README\.md|DEPLOY-PLESK\.md)$/i;
app.use((req, res, next) => {
  if (BLOCKED_STATIC.test(req.path)) return res.status(404).end();
  next();
});

app.use(express.static(path.join(__dirname, '../')));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/register',     require('./routes/registration'));
app.use('/api/event',        require('./routes/event'));
app.use('/api/participants', require('./routes/participants'));
app.use('/api/billplz',      require('./routes/billplz'));

// ... rest of file unchanged ...

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../registration.html'));
});

app.get('/payment-success', (req, res) => {
  res.sendFile(path.join(__dirname, '../payment-success.html'));
});

app.get('/checkin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/checkin.html'));
});

app.get('/checkin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/checkin.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin.html'));
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  if (err.name === 'MulterError' || /receipts? are allowed/i.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`[BOOT] Server on port ${PORT}`);
  await db.testConnection();
});

module.exports = app;
