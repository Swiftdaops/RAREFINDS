#!/usr/bin/env node
/**
 * Owner Flow Test Script
 * ----------------------
 * Performs end-to-end steps for an approved owner:
 *  1. Login owner (requires already approved status)
 *  2. Create an ebook via /api/owner/ebooks (using coverImageUrl)
 *  3. Verify ebook appears in owner scoped list (/api/owner/ebooks)
 *  4. Verify ebook appears in unified list (/api/ebooks)
 *  5. Verify ebook appears in public search (/api/public/ebooks?search=title)
 *  6. Delete ebook via /api/owner/ebooks/:id
 *  7. Confirm removal from owner/unified/public listings
 *  8. Logout owner
 *
 * Env Vars:
 *   BASE_URL (default http://localhost:5000)
 *   OWNER_EMAIL
 *   OWNER_PASSWORD
 *   SEARCH_DELAY_MS (optional wait before public search propagate)
 *
 * Usage:
 *   OWNER_EMAIL=invitationlite@gmail.com OWNER_PASSWORD=tobefavour \
 *   BASE_URL=https://johnbooksbackend.onrender.com node scripts/ownerFlowTest.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
const SEARCH_DELAY_MS = parseInt(process.env.SEARCH_DELAY_MS || '400', 10);

if (!OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Missing OWNER_EMAIL or OWNER_PASSWORD env variables.');
  process.exit(1);
}

let cookieJar = [];
function mergeCookies(setCookies = []) {
  setCookies.forEach((raw) => {
    const cookiePair = raw.split(';')[0];
    const name = cookiePair.split('=')[0];
    cookieJar = cookieJar.filter(c => !c.startsWith(name + '='));
    cookieJar.push(cookiePair);
  });
}
function cookieHeader() { return cookieJar.join('; '); }

async function req(method, path, { body, expectJson = true } = {}) {
  const url = BASE_URL.replace(/\/$/, '') + path;
  const headers = {
    'Accept': 'application/json',
    'Cookie': cookieJar.length ? cookieHeader() : undefined,
  };
  let payload = undefined;
  if (body) {
    if (body instanceof FormData) {
      // Let fetch set content-type
    } else if (typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    } else {
      payload = body;
    }
  }
  const start = Date.now();
  let status, data, text;
  try {
    const res = await fetch(url, { method, headers, body: payload });
    status = res.status;
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) mergeCookies(setCookie.split(/,(?=[^ ]*?=)/));
    if (expectJson) {
      try { data = await res.json(); } catch { text = await res.text(); }
    } else { text = await res.text(); }
    return { method, path, status, ms: Date.now() - start, data, text };
  } catch (e) {
    return { method, path, status: 0, ms: Date.now() - start, error: e };
  }
}

function logStep(label, resp) {
  const base = `[${label}] ${resp.method} ${resp.path} -> ${resp.status} (${resp.ms}ms)`;
  if (resp.error) {
    console.log(base + ' ERROR ' + resp.error.message);
  } else if (resp.data) {
    const msg = resp.data.message || (Array.isArray(resp.data) ? `Array[len=${resp.data.length}]` : 'OK');
    console.log(base + ' ' + msg);
  } else {
    console.log(base + ' no-body');
  }
}

(async () => {
  console.log('OWNER FLOW TEST start base=' + BASE_URL);
  console.log('Credentials email=' + OWNER_EMAIL);

  // 1. Login
  const loginResp = await req('POST', '/api/owners/login', { body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } });
  logStep('login', loginResp);
  if (loginResp.status !== 200) {
    console.error('Login failed, aborting flow.');
    process.exit(2);
  }
  console.log('Cookies after login:', cookieHeader() || '(none)');

  // 2. Create ebook
  const uniqueTitle = 'FlowTest ' + Date.now();
  const createResp = await req('POST', '/api/owner/ebooks', {
    body: {
      title: uniqueTitle,
      author: 'Flow Author',
      description: 'Automated flow test book',
      price: 1500,
      currency: 'NGN',
      isPublished: true,
      coverImageUrl: 'https://placehold.co/300x400?text=Test',
    }
  });
  logStep('create', createResp);
  if (createResp.status !== 201) {
    console.error('Create failed, aborting.');
    process.exit(3);
  }
  const createdId = createResp.data.id;
  console.log('Created ebook id=' + createdId);

  // Optional wait for indexing / propagation
  if (SEARCH_DELAY_MS > 0) {
    await new Promise(r => setTimeout(r, SEARCH_DELAY_MS));
  }

  // 3. Owner scoped list
  const ownerListResp = await req('GET', '/api/owner/ebooks');
  logStep('owner-list', ownerListResp);
  const inOwnerList = Array.isArray(ownerListResp.data) && ownerListResp.data.some(e => (e._id === createdId || e.id === createdId));
  console.log('Owner list contains created ebook:', inOwnerList);

  // 4. Unified list (/api/ebooks)
  const unifiedResp = await req('GET', '/api/ebooks');
  logStep('unified-list', unifiedResp);
  const inUnified = Array.isArray(unifiedResp.data) && unifiedResp.data.some(e => (e._id === createdId || e.id === createdId));
  console.log('Unified list contains created ebook:', inUnified);

  // 5. Public search
  const publicSearchResp = await req('GET', '/api/public/ebooks?search=' + encodeURIComponent(uniqueTitle));
  logStep('public-search', publicSearchResp);
  const inPublic = Array.isArray(publicSearchResp.data) && publicSearchResp.data.some(e => e.title === uniqueTitle);
  console.log('Public search contains created ebook:', inPublic);

  // 6. Delete ebook
  const deleteResp = await req('DELETE', '/api/owner/ebooks/' + createdId);
  logStep('delete', deleteResp);
  if (deleteResp.status !== 200) console.warn('Delete may have failed.');

  // 7. Confirm removal (owner-list again, unified, public)
  const ownerList2 = await req('GET', '/api/owner/ebooks');
  const stillOwner = Array.isArray(ownerList2.data) && ownerList2.data.some(e => (e._id === createdId || e.id === createdId));
  console.log('Post-delete owner presence:', stillOwner);

  const unified2 = await req('GET', '/api/ebooks');
  const stillUnified = Array.isArray(unified2.data) && unified2.data.some(e => (e._id === createdId || e.id === createdId));
  console.log('Post-delete unified presence:', stillUnified);

  const public2 = await req('GET', '/api/public/ebooks?search=' + encodeURIComponent(uniqueTitle));
  const stillPublic = Array.isArray(public2.data) && public2.data.some(e => e.title === uniqueTitle);
  console.log('Post-delete public presence:', stillPublic);

  // 8. Logout
  const logoutResp = await req('POST', '/api/owners/logout', { body: {} });
  logStep('logout', logoutResp);

  console.log('\nFlow Summary:');
  console.log({ createdId, inOwnerList, inUnified, inPublic, deleted: deleteResp.status === 200, removedFromOwner: !stillOwner, removedFromUnified: !stillUnified, removedFromPublic: !stillPublic });

  // Exit code semantics
  if (!inOwnerList || !inUnified || !inPublic || stillOwner || stillUnified || stillPublic) {
    console.error('Flow encountered verification issues.');
    process.exit(4);
  }
  console.log('Owner flow test completed successfully.');
  process.exit(0);
})();
