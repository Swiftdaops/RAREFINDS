#!/usr/bin/env node
/**
 * API Endpoint Test & Debug Script
 * --------------------------------
 * Safely pings backend endpoints (admin + owner + public + settings + ebooks) and logs:
 * - Status code
 * - Duration (ms)
 * - Short body summary / error message
 * - Whether auth was required / present
 *
 * Features:
 * - Manual cookie jar (stores Set-Cookie and sends cookies on subsequent requests)
 * - DRY_RUN mode to skip write/destructive operations (POST/PUT/PATCH/DELETE)
 * - Optional targeted endpoint filtering via CLI args
 *
 * Usage:
 *   node scripts/testEndpoints.js               # run all (read + write unless DRY_RUN=true)
 *   DRY_RUN=true node scripts/testEndpoints.js  # skip create/update/delete
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret \
 *   OWNER_EMAIL=owner@example.com OWNER_PASSWORD=secret \
 *   BASE_URL=https://johnbooksbackend.onrender.com node scripts/testEndpoints.js
 *
 * Filter endpoints by method or name:
 *   node scripts/testEndpoints.js GET           # only GETs
 *   node scripts/testEndpoints.js owners/login  # only endpoints whose path includes owners/login
 *
 * NOTE: For ebook create/update endpoints requiring file upload, this script will skip them
 * unless SAMPLE_COVER_PATH is provided AND DRY_RUN is not true.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''; // provide to test admin login
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || ''; // provide to test owner login
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
const DRY_RUN = /^true$/i.test(process.env.DRY_RUN || '');
const SAMPLE_COVER_PATH = process.env.SAMPLE_COVER_PATH || '';

// Simple cookie jar
let cookieJar = [];

function mergeCookies(setCookies = []) {
  setCookies.forEach((raw) => {
    const cookiePair = raw.split(';')[0];
    const [name] = cookiePair.split('=');
    // Replace existing cookie with same name
    cookieJar = cookieJar.filter((c) => !c.startsWith(name + '='));
    cookieJar.push(cookiePair);
  });
}

function cookieHeader() {
  return cookieJar.join('; ');
}

async function request(method, path, { body, headers = {}, expectJson = true } = {}) {
  const url = BASE_URL.replace(/\/$/, '') + path;
  const start = Date.now();
  let status, data, ok, text; // for logging
  let error = null;

  const finalHeaders = {
    'Content-Type': body && !(body instanceof FormData) ? 'application/json' : undefined,
    'Accept': 'application/json, text/plain, */*',
    'Cookie': cookieJar.length ? cookieHeader() : undefined,
    ...headers,
  };
  Object.keys(finalHeaders).forEach((k) => finalHeaders[k] === undefined && delete finalHeaders[k]);

  let fetchBody = body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    fetchBody = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, { method, headers: finalHeaders, body: fetchBody });
    status = res.status;
    ok = res.ok;
    const setCookies = res.headers.get('set-cookie');
    if (setCookies) mergeCookies(setCookies.split(/,(?=[^ ]*?=)/)); // naive split

    if (expectJson) {
      try {
        data = await res.json();
      } catch (e) {
        text = await res.text();
      }
    } else {
      text = await res.text();
    }
  } catch (e) {
    error = e;
  }
  const ms = Date.now() - start;
  return { method, path, url, status, ok, ms, data, text, error };
}

function summarize(resp) {
  if (resp.error) return `ERROR: ${resp.error.message}`;
  if (resp.data) {
    const keys = Object.keys(resp.data);
    if (Array.isArray(resp.data)) return `Array[len=${resp.data.length}]`;
    if (resp.data.message && keys.length <= 3) return `msg: ${resp.data.message}`;
    return `json keys: ${keys.slice(0, 6).join(',')}${keys.length > 6 ? '…' : ''}`;
  }
  if (resp.text) return `text(${resp.text.length})`; // fallback
  return 'no body';
}

// Lightweight schema validators
const validators = {
  ownersList: (data) => {
    if (!Array.isArray(data)) return 'ownersList:not-array';
    const sample = data[0];
    if (sample) {
      const required = ['_id','name','storeName','email','status'];
      const missing = required.filter(k => !(k in sample));
      if (missing.length) return 'ownersList:missing:' + missing.join(',');
    }
    return 'ok';
  },
  ownerObj: (data) => {
    if (!data || typeof data !== 'object') return 'ownerObj:not-object';
    const required = ['_id','name','storeName','email','status'];
    const missing = required.filter(k => !(k in data));
    return missing.length ? 'ownerObj:missing:' + missing.join(',') : 'ok';
  },
  themeObj: (data) => {
    if (!data || typeof data !== 'object') return 'theme:not-object';
    if (!('themeMode' in data)) return 'theme:missing-themeMode';
    return 'ok';
  }
};

// Define endpoint set (static portion)
const endpoints = [
  // Health / public
  { method: 'GET', path: '/health', auth: 'none' },
  { method: 'GET', path: '/api/public/ebooks', auth: 'none' },
  { method: 'GET', path: '/api/app-settings/theme', auth: 'none' },

  // Admin auth
  { method: 'POST', path: '/api/admin/login', auth: 'admin', body: () => ({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }), requiresCreds: ['ADMIN_EMAIL','ADMIN_PASSWORD'] },
  { method: 'GET', path: '/api/admin/me', auth: 'admin' },
  { method: 'GET', path: '/api/admin/owners', auth: 'admin' },
  // Owner auth
  { method: 'POST', path: '/api/owners/login', auth: 'owner', body: () => ({ email: OWNER_EMAIL, password: OWNER_PASSWORD }), requiresCreds: ['OWNER_EMAIL','OWNER_PASSWORD'] },
  { method: 'GET', path: '/api/owners/me', auth: 'owner' },
  { method: 'GET', path: '/api/admin/owners', auth: 'admin' }, // duplicated intentionally for ordering before approve tests

  // Theme update (admin)
  { method: 'PUT', path: '/api/admin/app-settings/theme', auth: 'admin', body: () => ({ themeMode: 'dark' }), write: true },

  // Unified ebooks (adminOrOwner)
  { method: 'GET', path: '/api/ebooks', auth: 'either' },
  { method: 'POST', path: '/api/ebooks', auth: 'either', write: true, multipart: true },
  // Owner scoped ebooks (require owner login)
  { method: 'GET', path: '/api/owner/ebooks', auth: 'owner' },
  { method: 'POST', path: '/api/owner/ebooks', auth: 'owner', write: true, multipart: true },
  // Admin owner moderation endpoints (approve/reject). We will decide IDs dynamically after listing owners.
  // Placeholder markers (dynamic tests added later).
];

// Utility to build multipart (only if SAMPLE_COVER_PATH provided)
async function buildMultipart() {
  if (!SAMPLE_COVER_PATH) return null;
  try {
    const fs = await import('fs');
    const form = new FormData();
    form.append('title', 'Test Book ' + Date.now());
    form.append('price', '999');
    if (fs.existsSync(SAMPLE_COVER_PATH)) {
      const file = fs.readFileSync(SAMPLE_COVER_PATH);
      const blob = new Blob([file]);
      form.append('coverImage', blob, 'cover.jpg');
    }
    return form;
  } catch (e) {
    console.warn('Failed building multipart form:', e.message);
    return null;
  }
}

async function main() {
  const filter = process.argv[2];
  console.log(`\nAPI TEST START  base=${BASE_URL}  dry_run=${DRY_RUN}  filter=${filter || 'NONE'}\n`);
  console.log('Cookies initially:', cookieJar.length ? cookieHeader() : '(none)');

  const formDataCache = await buildMultipart();

  let ownerScopedCreatedId = null;
  let pendingOwnerId = null;

  for (const ep of endpoints) {
    if (filter) {
      const methodFilter = filter.toUpperCase();
      if (['GET','POST','PUT','PATCH','DELETE'].includes(methodFilter) && ep.method !== methodFilter) continue;
      if (!['GET','POST','PUT','PATCH','DELETE'].includes(methodFilter) && !ep.path.includes(filter)) continue;
    }

    // Skip write ops in DRY_RUN
    if (DRY_RUN && ep.write) {
      console.log(`[SKIP/DRY_RUN] ${ep.method} ${ep.path}`);
      continue;
    }

    // Credential check
    if (ep.requiresCreds && ep.requiresCreds.some((v) => !process.env[v])) {
      console.log(`[SKIP/MISSING_CREDS] ${ep.method} ${ep.path} missing ${ep.requiresCreds.filter(c => !process.env[c]).join(', ')}`);
      continue;
    }

    let body = undefined;
    if (typeof ep.body === 'function') body = ep.body();
    if (ep.multipart) {
      if (!formDataCache) {
        console.log(`[SKIP/NO_FORMDATA] ${ep.method} ${ep.path} (provide SAMPLE_COVER_PATH to test upload)`);
        continue;
      }
      body = formDataCache;
    }

    const resp = await request(ep.method, ep.path, { body });
    // Dynamic capture: owners list for approve/reject tests
    if (ep.method === 'GET' && ep.path === '/api/admin/owners' && Array.isArray(resp.data)) {
      const pending = resp.data.find(o => o.status === 'pending');
      if (pending) {
        pendingOwnerId = pending._id || pending.id;
        console.log(`  Found pending owner id for moderation tests: ${pendingOwnerId}`);
      } else {
        console.log('  No pending owner found; approve/reject tests will be skipped.');
      }
      // Schema validation
      console.log('  ownersList schema:', validators.ownersList(resp.data));
    }
    if (ep.method === 'GET' && ep.path === '/api/owners/me' && resp.data && resp.data.owner) {
      console.log('  ownerObj schema:', validators.ownerObj(resp.data.owner));
    }
    if (ep.method === 'GET' && ep.path === '/api/app-settings/theme' && resp.data) {
      console.log('  themeObj schema:', validators.themeObj(resp.data));
    }
    const summary = summarize(resp);
    console.log(`${resp.ok ? '✔' : '✖'} ${ep.method.padEnd(6)} ${ep.path.padEnd(35)} ${String(resp.status).padEnd(3)} ${String(resp.ms)+'ms'.padEnd(8)} ${summary}`);

    // On login endpoints, give cookie snapshot
    if (/login$/.test(ep.path)) {
      console.log('  Cookies after login:', cookieJar.length ? cookieHeader() : '(none)');
    }

    // Capture newly created owner ebook ID for follow-up update/delete tests
    if (!DRY_RUN && ep.method === 'POST' && ep.path === '/api/owner/ebooks' && resp.ok && resp.data && resp.data.id) {
      ownerScopedCreatedId = resp.data.id;
      console.log(`  Captured owner ebook id: ${ownerScopedCreatedId}`);
    }
  }

  // Follow-up tests: update & delete owner ebook if created
  if (!DRY_RUN && ownerScopedCreatedId) {
    console.log('\n--- Owner Ebook Follow-up Tests ---');
    const updateBody = { title: 'Updated Title ' + Date.now(), description: 'Updated by test script.' };
    const updateResp = await request('PUT', `/api/owner/ebooks/${ownerScopedCreatedId}`, { body: updateBody });
    console.log(`${updateResp.ok ? '✔' : '✖'} PUT    /api/owner/ebooks/:id          ${updateResp.status} ${updateResp.ms+'ms'} ${summarize(updateResp)}`);
    const deleteResp = await request('DELETE', `/api/owner/ebooks/${ownerScopedCreatedId}`);
    console.log(`${deleteResp.ok ? '✔' : '✖'} DELETE /api/owner/ebooks/:id          ${deleteResp.status} ${deleteResp.ms+'ms'} ${summarize(deleteResp)}`);
  }

  // Follow-up moderation tests: approve & reject pending owner
  if (!DRY_RUN && pendingOwnerId) {
    console.log('\n--- Owner Moderation Follow-up Tests ---');
    const approveResp = await request('PATCH', `/api/admin/owners/${pendingOwnerId}/approve`);
    console.log(`${approveResp.ok ? '✔' : '✖'} PATCH  /api/admin/owners/:id/approve  ${approveResp.status} ${approveResp.ms+'ms'} ${summarize(approveResp)}`);
    const rejectResp = await request('PATCH', `/api/admin/owners/${pendingOwnerId}/reject`);
    console.log(`${rejectResp.ok ? '✔' : '✖'} PATCH  /api/admin/owners/:id/reject   ${rejectResp.status} ${rejectResp.ms+'ms'} ${summarize(rejectResp)}`);
  }

  console.log('\nFinal Cookies:', cookieJar.length ? cookieHeader() : '(none)');
  console.log('\nAPI TEST COMPLETE');
}

main().catch((e) => {
  console.error('Fatal error in test runner:', e);
  process.exit(1);
});
