// api/index.js — Vercel serverless entry point.
// Vercel's Node.js runtime invokes an exported Express app directly
// per-request; app.js's own require chain still drives everything.
require('dotenv').config();
module.exports = require('../server/index.js');
