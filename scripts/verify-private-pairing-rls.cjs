#!/usr/bin/env node
// Synthetic PostgreSQL-only verification. Never connects to a production project.
// Run after npm ci: node scripts/verify-private-pairing-rls.cjs
// PGLITE_MODULE optionally selects an isolated @electric-sql/pglite installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root = path.join(__dirname, '..');
const migration = fs.readdirSync(path.join(root, 'supabase/migrations')).find(name => name.endsWith('_private_pairing_checkpoints.sql'));
assert.ok(migration, 'private pairing migration must exist');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations', migration), 'utf8');
const table = 'public.little_evidence_pairing_checkpoints';
const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const childA = '20000000-0000-4000-8000-000000000001';
const childB = '20000000-0000-4000-8000-000000000002';
const cpA = '30000000-0000-4000-8000-000000000001';
const cpB = '30000000-0000-4000-8000-000000000002';
const pair = n => '40000000-0000-4000-8000-' + String(n).padStart(12, '0');
let passed = 0;
const pass = name => { passed++; console.log('PASS ' + name); };
async function main() {
  const db = new PGlite();
  // Minimum synthetic replicas of the live FK targets and their verified policies.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    grant usage on schema auth, public to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users(id uuid primary key);
    create table public.little_evidence_children(id uuid primary key, owner_id uuid not null references auth.users on delete cascade);
    create table public.little_evidence_checkpoints(id uuid primary key, owner_id uuid not null references auth.users on delete cascade, child_id uuid not null references public.little_evidence_children on delete cascade);
    create table public.little_evidence_activity_sessions(id uuid primary key, expires_at timestamptz not null);
    alter table public.little_evidence_children enable row level security;
    alter table public.little_evidence_checkpoints enable row level security;
    alter table public.little_evidence_activity_sessions enable row level security;
    grant select, insert, update, delete on public.little_evidence_children, public.little_evidence_checkpoints to authenticated;
    grant all on public.little_evidence_activity_sessions to service_role;
    create policy "teachers manage their children" on public.little_evidence_children for all to authenticated
      using(owner_id = (select auth.uid())) with check(owner_id = (select auth.uid()));
    create policy "teachers manage their checkpoints" on public.little_evidence_checkpoints for all to authenticated
      using(owner_id = (select auth.uid()) and exists(select 1 from public.little_evidence_children c where c.id=little_evidence_checkpoints.child_id and c.owner_id=(select auth.uid())))
      with check(owner_id = (select auth.uid()) and exists(select 1 from public.little_evidence_children c where c.id=little_evidence_checkpoints.child_id and c.owner_id=(select auth.uid())));
    insert into auth.users values ('${ownerA}'), ('${ownerB}');
    insert into public.little_evidence_children values ('${childA}','${ownerA}'), ('${childB}','${ownerB}');
    insert into public.little_evidence_checkpoints values ('${cpA}','${ownerA}','${childA}'), ('${cpB}','${ownerB}','${childB}');
    insert into public.little_evidence_activity_sessions select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now()+interval '2 hours' from generate_series(1,20) n;
    -- Reproduce older Supabase project defaults, then ensure the migration revokes them.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  const grantsQuery = `select grantee,table_name,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name <> 'little_evidence_pairing_checkpoints' order by 1,2,3`;
  const policiesQuery = `select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename <> 'little_evidence_pairing_checkpoints' order by 1,2`;
  const oldGrants = (await db.query(grantsQuery)).rows;
  const oldPolicies = (await db.query(policiesQuery)).rows;
  await db.exec(sql);
  assert.deepEqual((await db.query(grantsQuery)).rows, oldGrants);
  assert.deepEqual((await db.query(policiesQuery)).rows, oldPolicies);
  pass('existing table grants and RLS policies unchanged');
  async function as(role, owner, query) {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [owner || '']);
    await db.exec('set role ' + role);
    try { return await db.query(query); } finally { await db.exec('reset role'); }
  }
  const insert = (n, owner = ownerA, cp = cpA, expiry = "now()+interval '90 minutes'") => `insert into ${table}(pairing_id,owner_id,checkpoint_id,expires_at) values('${pair(n)}','${owner}','${cp}',${expiry})`;
  const count = `select count(*)::integer as count from ${table}`;
  async function rejected(name, role, owner, query, code = '42501') {
    await assert.rejects(() => as(role, owner, query), error => error.code === code);
    pass(name);
  }
  await as('authenticated', ownerA, insert(1));
  assert.equal((await as('authenticated', ownerA, count)).rows[0].count, 1);
  pass('owner inserts and reads exact private checkpoint');
  assert.equal((await as('authenticated', ownerB, count)).rows[0].count, 0);
  pass('other account cannot read mapping even without query filters');
  await rejected('other account cannot forge mapping owner', 'authenticated', ownerB, insert(2));
  await rejected('owner cannot assign another account checkpoint', 'authenticated', ownerA, insert(2, ownerA, cpB));
  await rejected('anonymous cannot read mappings', 'anon', null, count);
  await rejected('anonymous cannot insert mappings', 'anon', null, insert(2));
  assert.equal((await as('authenticated', null, count)).rows[0].count, 0);
  pass('authenticated role without user identity reads no mappings');
  await rejected('authenticated role without user identity cannot insert', 'authenticated', null, insert(2));
  await rejected('updates denied', 'authenticated', ownerA, `update ${table} set checkpoint_id='${cpB}'`);
  await rejected('deletes denied', 'authenticated', ownerA, `delete from ${table}`);
  await rejected('upsert cannot change a mapping', 'authenticated', ownerA, insert(1) + ' on conflict(pairing_id) do update set expires_at=excluded.expires_at');
  await rejected('duplicate pairing cannot replace its mapping', 'authenticated', ownerA, insert(1), '23505');
  await rejected('expired mapping insert denied', 'authenticated', ownerA, insert(2, ownerA, cpA, "now()-interval '1 second'"));
  await rejected('expiry equal to now denied', 'authenticated', ownerA, insert(2, ownerA, cpA, 'now()'));
  await rejected('overlong mapping insert denied', 'authenticated', ownerA, insert(2, ownerA, cpA, "now()+interval '2 hours 1 second'"));
  await rejected('infinite mapping expiry denied', 'authenticated', ownerA, insert(2, ownerA, cpA, "'infinity'::timestamptz"));
  await rejected('mapping requires an existing activity pairing', 'authenticated', ownerA, insert(99), '23503');
  await rejected('mapping requires an owned checkpoint', 'authenticated', ownerA, insert(2, ownerA, '30000000-0000-4000-8000-000000000099'));
  await rejected('mapping requires expiry', 'authenticated', ownerA, insert(2, ownerA, cpA, 'null'));
  await as('authenticated', ownerA, insert(2, ownerA, cpA, "now()+interval '2 hours'"));
  pass('exact two-hour expiry maximum accepted');
  await rejected('service role has no mapping SELECT grant', 'service_role', null, count);
  await rejected('service role has no mapping INSERT grant', 'service_role', null, insert(3));
  await db.exec(insert(3, ownerA, cpA, "now()-interval '1 second'"));
  assert.equal((await as('authenticated', ownerA, `select count(*)::integer as count from ${table} where pairing_id='${pair(3)}'`)).rows[0].count, 0);
  pass('expired mapping hidden from its owner');
  await db.exec(`update public.little_evidence_checkpoints set owner_id='${ownerB}',child_id='${childB}' where id='${cpA}'`);
  assert.equal((await as('authenticated', ownerA, count)).rows[0].count, 0);
  pass('mapping hidden when referenced checkpoint no longer belongs to owner');
  await db.exec(`update public.little_evidence_checkpoints set owner_id='${ownerA}',child_id='${childA}' where id='${cpA}'`);
  await as('service_role', null, `delete from public.little_evidence_activity_sessions where id='${pair(1)}'`);
  assert.equal((await db.query(`select count(*)::integer as count from ${table} where pairing_id='${pair(1)}'`)).rows[0].count, 0);
  pass('relay cleanup cascades to mapping without mapping grant');
  await db.exec(`delete from public.little_evidence_checkpoints where id='${cpA}'`);
  assert.equal((await db.query(count)).rows[0].count, 0);
  pass('checkpoint deletion cascades to mapping');
  await as('authenticated', ownerB, insert(4, ownerB, cpB));
  await db.exec(`delete from auth.users where id='${ownerB}'`);
  assert.equal((await db.query(count)).rows[0].count, 0);
  pass('owner deletion cascades to mapping');
  const privileges = (await db.query(`select grantee,privilege_type from information_schema.role_table_grants where table_name='little_evidence_pairing_checkpoints' and grantee in ('anon','authenticated','service_role','PUBLIC') order by 1,2`)).rows;
  assert.deepEqual(privileges, [{grantee:'authenticated',privilege_type:'INSERT'}, {grantee:'authenticated',privilege_type:'SELECT'}]);
  pass('only authenticated SELECT and INSERT granted');
  await db.close();
  console.log(`Verified ${passed} private pairing PostgreSQL cases with synthetic data only.`);
}
main().catch(error => { console.error(error); process.exitCode=1; });
