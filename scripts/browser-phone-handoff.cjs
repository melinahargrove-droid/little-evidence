/* Real-browser regression. Every request is fulfilled locally; no live auth or child data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const origin = 'https://little-evidence.synthetic.test';
const owner = { id: 'synthetic-teacher-owner', email: 'teacher@example.test' };
const other = { id: 'synthetic-teacher-other', email: 'other@example.test' };
const children = [
  { id: 'synthetic-child-a', owner_id: owner.id, display_name: 'Synthetic Child A', archived_at: null },
  { id: 'synthetic-child-b', owner_id: owner.id, display_name: 'Synthetic Child B', archived_at: null },
  { id: 'synthetic-child-z', owner_id: other.id, display_name: 'Other Account Child', archived_at: null },
];
const checkpoints = children.flatMap(child => ['fall', 'winter'].map(season => ({
  id: `${child.id}-${season}`, child_id: child.id, owner_id: child.owner_id,
  school_year: '2026-2027', season,
})));
const selected = checkpoints.find(row => row.id === 'synthetic-child-b-winter');
const mappingTable = 'little_evidence_pairing_checkpoints';
const privateStrings = [owner.id, owner.email, other.id, other.email,
  ...children.flatMap(child => [child.id, child.display_name]), ...checkpoints.map(row => row.id),
  'checkpoint_id', 'checkpointId', 'owner_id', 'ownerId', 'child_id', 'display_name'];
const clone = value => structuredClone(value);
const contexts = [];
const pageErrors = [];
const unexpectedRequests = [];
const dbCalls = [];
const relayCalls = [];
const mappings = [];
const sessions = new Map();
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };

function assertPublic(value) {
  const serialized = JSON.stringify(value);
  for (const text of privateStrings) assert.ok(!serialized.includes(text), `Private value leaked into pairing data: ${text}`);
}

function queryDatabase(client, query) {
  const { table, method, filters, single, values } = query;
  const ownerId = client.user?.id;
  const call = { client: client.name, ownerId, table, method, filters: clone(filters) };
  dbCalls.push(call);
  const tables = {
    little_evidence_children: children,
    little_evidence_checkpoints: checkpoints,
    little_evidence_objective_records: [],
    little_evidence_evidence: [],
    [mappingTable]: mappings,
  };
  assert.ok(table in tables, `Unexpected private table: ${table}`);
  if (method !== 'select') {
    // A handoff may only create its private owner-scoped mapping, never a child/checkpoint.
    assert.equal(table, mappingTable, `Unexpected ${method} to ${table}`);
    assert.equal(method, 'insert', 'Private handoff mappings are immutable; upsert/replace is forbidden');
    const incoming = Array.isArray(values) ? values : [values];
    for (const row of incoming) {
      assert.ok(ownerId && row.owner_id === ownerId, 'Mapping write must use the authenticated owner');
      assert.ok(checkpoints.some(c => c.id === row.checkpoint_id && c.owner_id === ownerId), 'Mapping must reference this owner’s existing checkpoint');
      const existing = mappings.find(m => m.pairing_id === row.pairing_id);
      assert.ok(!existing, 'Existing pairing mappings cannot be overwritten');
      const expires = Date.parse(row.expires_at);
      assert.ok(Number.isFinite(expires) && expires > Date.now() && expires <= Date.now() + 2 * 60 * 60_000, 'Mapping requires an explicit expiry within two hours');
      mappings.push({ created_at: new Date().toISOString(), ...clone(row) });
    }
  }
  let rows = ownerId ? tables[table].filter(row => row.owner_id === ownerId) : [];
  for (const [operation, key, value] of filters) rows = rows.filter(row => {
    if (operation === 'eq' || operation === 'is') return row[key] === value;
    if (operation === 'gt') return row[key] > value;
    if (operation === 'gte') return row[key] >= value;
    if (operation === 'lt') return row[key] < value;
    if (operation === 'in') return value.includes(row[key]);
    throw Error(`Unexpected filter: ${operation}`);
  });
  call.returned = clone(rows);
  return { data: clone(single ? rows[0] || null : rows), error: null };
}

// This replaces only the external auth/database SDK. Application JS is unmodified.
function installSyntheticSDK() {
  const listeners = [];
  const auth = {
    async getSession() { return window.__syntheticBackend({ type: 'session' }); },
    onAuthStateChange(callback) { listeners.push(callback); return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithOtp(options) { return window.__syntheticBackend({ type: 'otp', options }); },
    async signOut() { await window.__syntheticAuth(null); return { error: null }; },
  };
  window.__syntheticAuth = async user => {
    const result = await window.__syntheticBackend({ type: 'authenticate', user });
    for (const callback of listeners) callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', result.data.session);
  };
  window.__syntheticClient = {
    auth,
    from(table) {
      const query = { table, method: 'select', filters: [], single: false };
      let result;
      const execute = () => result ||= window.__syntheticBackend({ type: 'query', query });
      const builder = {
        select() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        insert(values) { query.method = 'insert'; query.values = values; return builder; },
        upsert(values) { query.method = 'upsert'; query.values = values; return builder; },
        maybeSingle() { query.single = true; return execute(); },
        single() { query.single = true; return execute(); },
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      for (const op of ['eq', 'is', 'gt', 'gte', 'lt', 'in']) builder[op] = (key, value) => { query.filters.push([op, key, value]); return builder; };
      return builder;
    },
  };
}

async function createClient(browser, name, user, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block',
  });
  contexts.push(context);
  const client = { name, context, user, otp: [] };
  await context.exposeBinding('__syntheticBackend', (_source, message) => {
    if (message.type === 'authenticate') client.user = message.user;
    if (message.type === 'session' || message.type === 'authenticate') return { data: { session: client.user ? { user: clone(client.user) } : null }, error: null };
    if (message.type === 'otp') { client.otp.push(message.options); return { error: null }; }
    if (message.type === 'query') return queryDatabase(client, message.query);
    throw Error(`Unexpected fixture request: ${message.type}`);
  });
  await context.addInitScript(installSyntheticSDK);
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) {
      // The route handler serves the actual checked-out page, scripts and illustrations.
      const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
      const file = path.resolve(root, relative);
      assert.ok(file.startsWith(root + path.sep), 'App resource must stay in the checkout');
      assert.ok(relative === 'index.html' || /^(?:assets\/|vendor\/|[^/]+\.js$|favicon\.ico$)/.test(relative), `Unexpected app resource: ${relative}`);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ status: 200, contentType: contentTypes[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
      if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
    }
    if (url.origin === 'https://esm.sh' && url.pathname.startsWith('/@supabase/supabase-js@')) return route.fulfill({
      contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' },
      body: 'export const createClient = () => window.__syntheticClient;',
    });
    if (url.pathname.endsWith('/functions/v1/little-evidence-activity-session')) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' });
      const body = request.postDataJSON();
      assertPublic(body);
      relayCalls.push({ client: name, body: clone(body) });
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
      if (body.action === 'create') {
        const id = randomUUID(), displayToken = randomBytes(32).toString('base64url'), teacherToken = randomBytes(32).toString('base64url');
        const state = { config: body.config, status: 'waiting', prompt_index: 0, responses: [], speech_seq: 0, revision: 0 };
        sessions.set(id, { state, displayToken, teacherToken });
        return route.fulfill({ contentType: 'application/json', headers, json: { id, display_token: displayToken, teacher_token: teacherToken, expires_at: new Date(Date.now() + 2 * 60 * 60_000).toISOString(), state } });
      }
      const session = sessions.get(body.id);
      assert.ok(session, 'Only a synthetic session can be used');
      assert.equal(body.token, body.role === 'teacher' ? session.teacherToken : session.displayToken, 'Role-specific pairing token required');
      if (body.action !== 'state') {
        assert.equal(body.role, 'teacher');
        assert.equal(body.revision, session.state.revision);
        if (body.action === 'start') {
          assert.equal(session.state.status, 'waiting', 'A paired activity must start only once');
          session.state.status = 'active';
        } else if (body.action === 'observe') {
          assert.equal(session.state.status, 'active');
          assert.equal(body.prompt_index, session.state.prompt_index);
          session.state.responses.push({ presented: true, observation: body.observation });
          if (session.state.prompt_index + 1 === session.state.config.tasks.length) session.state.status = 'complete';
          else session.state.prompt_index++;
        } else throw Error(`Unexpected relay mutation: ${body.action}`);
        session.state.revision++;
      }
      return route.fulfill({ contentType: 'application/json', headers, json: { state: clone(session.state) } });
    }
    // Fail closed: there is deliberately no route.continue() or real fetch fallback.
    unexpectedRequests.push(request.method() + ' ' + request.url());
    await route.abort('blockedbyclient');
  });
  context.on('page', page => page.on('pageerror', error => pageErrors.push(`${name}: ${error.message}`)));
  client.page = await context.newPage();
  client.page.setDefaultTimeout(10_000);
  return client;
}

async function visibleText(page, selector, expression) {
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.waitForFunction(({ selector, source, flags }) => new RegExp(source, flags).test(document.querySelector(selector)?.textContent || ''), { selector, source: expression.source, flags: expression.flags });
}

async function createPairing(browser, mode = 'movement') {
  const desktop = await createClient(browser, `desktop-${mode}-${sessions.size}`, owner);
  const page = desktop.page;
  await page.goto(origin);
  await page.locator('#openCheckpoints').click();
  await page.locator('#checkpointChildSelect option[value="synthetic-child-b"]').waitFor({ state: 'attached' });
  await page.locator('#checkpointChildSelect').selectOption(selected.child_id);
  await page.locator('#checkpointSchoolYear').fill(selected.school_year);
  await page.locator('#checkpointSeason').selectOption(selected.season);
  await page.locator('#openCheckpoint').click();
  await visibleText(page, '#activeCheckpointLabel', /Synthetic Child B.*Winter 2026-2027/);
  await page.locator('#checkpointActivities').click();
  if (mode === 'movement') {
    await page.locator('#libraryBackHome').click();
    await page.locator('#startCheck').click();
  } else {
    await page.locator('#objectiveLibraryGrid .library-card').filter({ has: page.getByRole('heading', { name: /^2b ·/ }) }).getByRole('button', { name: 'Open objective' }).click();
    await page.getByRole('button', { name: 'Use iPad remote', exact: true }).click();
  }
  await page.locator('#remotePairQr img').waitFor({ state: 'visible' });
  const qrSource = await page.locator('#remotePairQr img').getAttribute('src');
  assert.match(qrSource, /^data:image\//, 'Pairing QR must be rendered locally');
  const link = await page.locator('#remotePairLink').getAttribute('href');
  assertPublic(link);
  const hash = new URL(link).hash.match(/^#activityRemote=([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})\.private$/i);
  assert.ok(hash, 'QR link must contain only a random session ID and capability token');
  assert.equal(new URL(link).search, '', 'No child data may be added as a URL query');
  const id = hash[1], session = sessions.get(id);
  assert.equal(hash[2], session.teacherToken);
  assert.notEqual(hash[2], session.displayToken, 'Display and teacher tokens must be separate');
  const mapping = mappings.find(row => row.pairing_id === id);
  assert.ok(mapping, 'Desktop must persist its private handoff before displaying the QR');
  assert.equal(mapping.owner_id, owner.id);
  assert.equal(mapping.checkpoint_id, selected.id);
  return { desktop, link, id, session };
}

async function assertRecovered(client, pairing) {
  await visibleText(client.page, '#checkpointContext', /Assessing: Synthetic Child B/);
  await visibleText(client.page, '#checkpointContext', /Winter 2026-2027/);
  await client.page.locator('#remoteSpeak').waitFor({ state: 'visible' });
  assert.equal(pairing.session.state.status, 'active');
  assert.equal(await client.page.locator('#checkpointChildSelect').inputValue(), selected.child_id);
  const reads = dbCalls.filter(call => call.client === client.name && call.table === 'little_evidence_checkpoints' && call.returned?.length);
  assert.ok(reads.some(call => call.returned.some(row => row.id === selected.id)), 'Recovered checkpoint must match the desktop selection exactly');
  assert.ok(!await client.page.locator('#checkpointScreen').isVisible(), 'No second child-selection step is needed');
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    // These are genuinely separate browser contexts, with no copied auth or local storage.
    const pairing = await createPairing(browser);
    const phone = await createClient(browser, 'same-owner-phone', owner, true);
    assert.deepEqual((await phone.context.storageState()).origins, []);
    await phone.page.goto(pairing.link);
    await assertRecovered(phone, pairing);
    assert.equal(relayCalls.filter(call => call.body.id === pairing.id && call.body.action === 'start').length, 1);
    console.log('PASS Chromium desktop → independent phone: exact private child/checkpoint restored and activity auto-started');

    // Advance deliberately, discard only this tab’s cached binding, then refresh active.
    await phone.page.locator('#remoteObservation').selectOption({ label: 'With control' });
    await phone.page.locator('#remoteNext').click();
    await visibleText(phone.page, '#guidedObjectiveChild', /Prompt 2 of 3/);
    const beforeRefresh = clone(pairing.session.state);
    const readsBefore = dbCalls.filter(call => call.client === phone.name && call.table === mappingTable).length;
    await phone.page.evaluate(id => sessionStorage.removeItem('littleEvidence:remote:' + id), pairing.id);
    await phone.page.reload();
    await assertRecovered(phone, pairing);
    await visibleText(phone.page, '#guidedObjectiveChild', /Prompt 2 of 3/);
    assert.deepEqual(pairing.session.state, beforeRefresh, 'Refresh must neither restart nor advance an active activity');
    assert.ok(dbCalls.filter(call => call.client === phone.name && call.table === mappingTable).length > readsBefore, 'Active refresh must reconstruct the owner-protected mapping');
    console.log('PASS Chromium active refresh: server mapping reconstructs exact checkpoint without restarting or advancing');

    const loginPairing = await createPairing(browser, 'ipad');
    const signedOut = await createClient(browser, 'signed-out-phone', null, true);
    await signedOut.page.goto(loginPairing.link);
    await visibleText(signedOut.page, '#remoteStart', /Sign in/i);
    assert.equal(loginPairing.session.state.status, 'waiting');
    assert.equal(dbCalls.filter(call => call.client === signedOut.name && call.returned?.length).length, 0);
    await signedOut.page.locator('#remoteStart').click();
    await signedOut.page.locator('#checkpointEmail').fill(owner.email);
    await signedOut.page.locator('#sendCheckpointLink').click();
    await visibleText(signedOut.page, '#checkpointAuthMessage', /sign-in email|sign-in link/i);
    assert.equal(signedOut.otp.length, 1);
    assert.equal(signedOut.otp[0].email, owner.email);
    // The fake SDK emits the real auth callback; never call any app-internal handler.
    await signedOut.page.evaluate(user => window.__syntheticAuth(user), owner);
    await assertRecovered(signedOut, loginPairing);
    assert.equal(loginPairing.session.state.config.objective_id, '2b');
    console.log('PASS Chromium Use iPad remote + signed-out phone: same-owner auth callback resumes pairing and auto-starts');

    // A bearer pairing URL gives no access to the original owner’s checkpoint.
    const wrongPairing = await createPairing(browser);
    const wrong = await createClient(browser, 'wrong-owner-phone', other, true);
    await wrong.page.goto(wrongPairing.link);
    await visibleText(wrong.page, '#remoteSetup', /same.*account|original.*account|unavailable|could not|cannot|not.*available/i);
    assert.equal(wrongPairing.session.state.status, 'waiting');
    assert.ok(!(await wrong.page.locator('body').innerText()).includes('Synthetic Child B'));
    for (const call of dbCalls.filter(call => call.client === wrong.name)) {
      assert.ok((call.returned || []).every(row => row.owner_id === other.id), 'Wrong account must receive no other owner’s private rows');
    }
    assert.ok(!dbCalls.some(call => call.client === wrong.name && call.table === 'little_evidence_checkpoints' && call.returned?.some(row => row.id === selected.id)));
    const start = wrong.page.locator('#remoteStart');
    if (await start.isVisible() && await start.isEnabled()) await start.click();
    await wrong.page.locator('#checkpointWorkspace').waitFor({ state: 'visible' });
    assert.equal(wrongPairing.session.state.status, 'waiting', 'Wrong-account Start must not start the selected child’s activity');
    assert.equal(relayCalls.filter(call => call.client === wrong.name && call.body.action === 'start').length, 0);
    console.log('PASS Chromium wrong-account QR: no private child read, automatic start, or manual-start bypass');

    assert.deepEqual(unexpectedRequests, [], 'All browser traffic must be mocked; no external request is allowed');
    assert.deepEqual(pageErrors, [], 'No uncaught application errors');
    for (const call of relayCalls) assertPublic(call.body);
    assert.ok(dbCalls.filter(call => call.method !== 'select').every(call => call.table === mappingTable));
    console.log('PASS zero real network/auth/children: unchanged app resources, synthetic owner-enforced database, identity-free relay');
  } catch (error) {
    if (browser) {
      fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
      for (let i = 0; i < contexts.length; i++) {
        const page = contexts[i].pages()[0];
        if (page && !page.isClosed()) await page.screenshot({ path: path.join(root, 'test-results', `phone-handoff-${i}.png`), fullPage: true }).catch(() => {});
      }
    }
    throw error;
  } finally {
    await Promise.all(contexts.map(context => context.close().catch(() => {})));
    if (browser) await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
