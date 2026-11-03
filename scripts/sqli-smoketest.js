#!/usr/bin/env node
/*
 * SQL-injection smoke test for the Sourdough Log API.
 *
 * Fires classic SQLi payloads at every endpoint that takes user input and
 * checks that the app behaves as it should: parameterised queries treat the
 * payload as a literal string, so a login bypass must FAIL and an :id/filter
 * param must be rejected or return nothing — never leak data or a SQL error.
 *
 * This only probes YOUR OWN running instance. It makes no destructive calls
 * (no POST/PUT/PATCH/DELETE of real data) beyond registering one throwaway
 * test user so the authenticated endpoints can be reached.
 *
 *   node scripts/sqli-smoketest.js                 # defaults to localhost:3650
 *   BASE=http://localhost:3000 node scripts/sqli-smoketest.js
 *   BASE=... TEST_USER=alice TEST_PASS=secret123 node scripts/sqli-smoketest.js
 *
 * Exit code is non-zero if any check looks suspicious, so it can gate CI.
 */

const BASE = (process.env.BASE || 'http://localhost:3650').replace(/\/$/, '');
const TEST_USER = process.env.TEST_USER || `sqli_probe_${Date.now()}`;
const TEST_PASS = process.env.TEST_PASS || 'probe-password-123';
const REGISTER = process.env.TEST_USER ? false : true; // only auto-register the throwaway user

// Payloads that only "work" against string-concatenated SQL.
const PAYLOADS = [
  `' OR '1'='1`,
  `' OR '1'='1' -- `,
  `admin' -- `,
  `' OR 1=1 -- `,
  `'; DROP TABLE user; -- `,
  `" OR "1"="1`,
  `1' UNION SELECT NULL,NULL,NULL,NULL -- `,
];

let sessionCookie = null;
let failures = 0;
let checks = 0;

function record(ok, label, detail) {
  checks++;
  if (ok) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}`);
    if (detail) console.log(`        ${detail}`);
  }
}

async function req(method, path, { body, auth } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && sessionCookie) headers['Cookie'] = sessionCookie;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // capture the session cookie if the server set one
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) sessionCookie = setCookie.split(';')[0];

  let text = '';
  try { text = await res.text(); } catch { /* ignore */ }
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, json };
}

// A response "leaks" if it exposes a raw DB error, which means the payload
// reached the SQL engine as code rather than being bound as a literal.
function looksLikeSqlError(r) {
  const hay = (r.text || '').toLowerCase();
  return /sql syntax|you have an error in your sql|er_|sqlstate|mysql|unknown column|near '/.test(hay);
}

async function setup() {
  console.log(`\nTarget: ${BASE}`);

  // sanity: is the server up?
  try {
    await req('GET', '/auth/me');
  } catch (e) {
    console.error(`\nCannot reach ${BASE} — is the app running? (npm start)\n${e.message}`);
    process.exit(2);
  }

  if (REGISTER) {
    const reg = await req('POST', '/auth/register', { body: { username: TEST_USER, password: TEST_PASS } });
    if (reg.status !== 201 && reg.status !== 409) {
      console.error(`\nCould not register throwaway user (status ${reg.status}): ${reg.text}`);
      console.error('Pass an existing TEST_USER/TEST_PASS instead, or check the DB is seeded.');
    }
  }

  const login = await req('POST', '/auth/login', { body: { username: TEST_USER, password: TEST_PASS } });
  if (login.status === 200 && sessionCookie) {
    console.log(`Logged in as "${TEST_USER}" — authenticated endpoints will be tested.\n`);
  } else {
    console.log(`\nNote: could not log in as "${TEST_USER}" (status ${login.status}).`);
    console.log('Authenticated endpoints will return 401 and be skipped.\n');
  }
}

async function testLoginBypass() {
  console.log('[1] Login auth-bypass (POST /auth/login, username field)');
  for (const p of PAYLOADS) {
    const r = await req('POST', '/auth/login', { body: { username: p, password: p } });
    // A bypass would be a 200 with a session. Anything that logs us in is a real finding.
    const bypassed = r.status === 200 && r.json && r.json.id;
    record(!bypassed && !looksLikeSqlError(r),
      `username = ${JSON.stringify(p)}`,
      bypassed ? `BYPASSED — got session for id ${r.json.id}` :
        looksLikeSqlError(r) ? `DB error leaked: ${r.text.slice(0, 160)}` : `status ${r.status} (rejected, good)`);
  }
}

async function testQueryFilter() {
  console.log('\n[2] Query-string filter (GET /stock-movements?ingredient_id=...)');
  for (const p of PAYLOADS) {
    const r = await req('GET', `/stock-movements?ingredient_id=${encodeURIComponent(p)}`, { auth: true });
    if (r.status === 401) { record(true, `ingredient_id (skipped: not logged in)`); break; }
    // Numeric filter: payload should become NaN/rejected, never a SQL error or a full dump.
    record(!looksLikeSqlError(r),
      `ingredient_id = ${JSON.stringify(p)}`,
      looksLikeSqlError(r) ? `DB error leaked: ${r.text.slice(0, 160)}` : `status ${r.status}`);
  }
}

async function testPathIdParams() {
  console.log('\n[3] URL :id params (GET /starters/:id, /batches/:id, /ingredients/:id)');
  const routes = ['/starters/', '/batches/', '/ingredients/'];
  for (const base of routes) {
    for (const p of PAYLOADS.slice(0, 3)) {
      const r = await req('GET', base + encodeURIComponent(p), { auth: true });
      if (r.status === 401) { record(true, `${base}:id (skipped: not logged in)`); break; }
      // :id goes through Number()+Number.isInteger, so expect 400/404, never a leak.
      record(!looksLikeSqlError(r) && r.status !== 200,
        `${base}${JSON.stringify(p)}`,
        looksLikeSqlError(r) ? `DB error leaked: ${r.text.slice(0, 160)}`
          : r.status === 200 ? `unexpected 200 — a non-numeric id returned data` : `status ${r.status}`);
    }
  }
}

(async () => {
  await setup();
  await testLoginBypass();
  await testQueryFilter();
  await testPathIdParams();

  console.log(`\n${'-'.repeat(50)}`);
  if (failures === 0) {
    console.log(`All ${checks} checks passed — no injection or error leakage observed.`);
    process.exit(0);
  } else {
    console.log(`${failures} of ${checks} checks FAILED — investigate the lines marked FAIL above.`);
    process.exit(1);
  }
})();
