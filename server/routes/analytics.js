// server/routes/analytics.js
// GET /api/analytics — aggregated Vercel Web Analytics (page views, visitors,
// top pages, countries, devices, referrers, browsers) for the admin dashboard.
//
// Requires VERCEL_ANALYTICS_TOKEN (a Vercel access token that can read this
// project's analytics) as an env var. Without it, responds with
// { connected: false, reason } so the frontend can show setup instructions
// instead of numbers. Returns aggregates only — no visitor-level data.
'use strict';

const express = require('express');
const router = express.Router();

// ── Auth middleware (same pattern as other admin-only routes) ─────────────
function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

const API = 'https://api.vercel.com/v1/query/web-analytics/visits/aggregate';
const DIMS = [
  ['pages', 'requestPath'],
  ['countries', 'country'],
  ['devices', 'deviceType'],
  ['referrers', 'referrerHostname'],
  ['browsers', 'browserName'],
];

function readRows(json, dim) {
  const rows = Array.isArray(json) ? json : (json && (json.data || json.rows || json.results)) || [];
  return rows.map(r => ({
    key: String(r.key ?? r[dim] ?? r.name ?? r.label ?? ''),
    views: Number(r.total ?? r.count ?? r.pageviews ?? r.views ?? r.visits ?? 0) || 0,
    visitors: Number(r.devices ?? r.visitors ?? r.uniques ?? 0) || 0,
  })).filter(r => r.key !== '');
}

async function queryAnalytics(by, o) {
  const u = new URL(API);
  u.searchParams.set('projectId', o.projectId);
  if (o.teamId) u.searchParams.set('teamId', o.teamId);
  for (const b of by) u.searchParams.append('by', b);
  u.searchParams.set('since', new Date(o.since).toISOString());
  u.searchParams.set('until', new Date(o.until).toISOString());
  u.searchParams.set('limit', '10');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { authorization: `Bearer ${o.token}`, accept: 'application/json' } });
    if (!r.ok) throw new Error(`Vercel API ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/analytics (admin only)
router.get('/', adminAuth, async (req, res) => {
  const env = process.env;
  const token = env.VERCEL_ANALYTICS_TOKEN;
  const projectId = env.VERCEL_ANALYTICS_PROJECT_ID || env.VERCEL_PROJECT_ID;
  res.set('cache-control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=900');

  if (!token || !projectId) {
    return res.json({ connected: false, reason: !token ? 'no_token' : 'no_project' });
  }

  const days = Math.min(90, Math.max(7, parseInt(env.ANALYTICS_DAYS, 10) || 30));
  const now = Date.now();
  const o = {
    token,
    projectId,
    teamId: env.VERCEL_ANALYTICS_TEAM_ID || env.VERCEL_TEAM_ID,
    until: now,
    since: now - days * 864e5,
  };

  try {
    const [daily, ...rest] = await Promise.all([
      queryAnalytics(['day'], o),
      ...DIMS.map(([, d]) => queryAnalytics([d], o)),
    ]);
    const out = {
      connected: true,
      days,
      since: new Date(o.since).toISOString().slice(0, 10),
      until: new Date(o.until).toISOString().slice(0, 10),
      daily: readRows(daily, 'day'),
    };
    DIMS.forEach(([name, d], i) => { out[name] = readRows(rest[i], d); });
    out.totals = {
      views: out.daily.reduce((a, r) => a + r.views, 0),
      visitors: out.daily.reduce((a, r) => a + r.visitors, 0),
    };
    return res.json(out);
  } catch (e) {
    return res.json({ connected: false, reason: 'api_error', detail: String((e && e.message) || e).slice(0, 120) });
  }
});

module.exports = router;
