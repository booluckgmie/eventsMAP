// app.js — ROOT-LEVEL ENTRY POINT
// ─────────────────────────────────────────────────────────────
// This file sits at the REPO ROOT so Plesk can find it with:
//   Application Root: /maad-map-system   (or wherever repo is)
//   Startup file:     app.js
//
// It simply delegates to server/index.js — no logic here.
// Having it at root avoids Plesk path resolution issues.
// ─────────────────────────────────────────────────────────────
require('dotenv').config();
require('./server/index.js');
