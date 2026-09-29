import { createClient } from 'npm:@supabase/supabase-js@2.117.1'

const url = Deno.env.get('SUPABASE_URL')!
const secrets = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
const serviceKey = secrets.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !serviceKey) throw new Error('Supabase server credentials are unavailable')

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
const allowedOrigins = new Set([
  'https://melinahargrove-droid.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])
const headersFor = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://melinahargrove-droid.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
})

function reply(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headersFor(origin), 'Content-Type': 'application/json' },
  })
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  bytes.forEach((byte) => binary += String.fromCharCode(byte))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function safeState(row: Record<string, unknown>) {
  return {
    prompt_index: row.prompt_index,
    status: row.status,
    display_done: row.display_done,
    expires_at: row.expires_at,
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headersFor(origin) })
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405, origin)

  try {
    const body = await req.json()
    const action = String(body.action ?? '')

    if (action === 'create') {
      const id = crypto.randomUUID()
      const teacherToken = randomToken()
      const displayToken = randomToken()
      const expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString()
      const { error } = await admin.from('little_evidence_movement_sessions').insert({
        id,
        teacher_token_hash: await digest(teacherToken),
        display_token_hash: await digest(displayToken),
        prompt_index: 0,
        status: 'waiting',
        display_done: false,
        expires_at: expiresAt,
      })
      if (error) throw error
      void admin.from('little_evidence_movement_sessions').delete().lt('expires_at', new Date().toISOString())
      return reply({ id, teacher_token: teacherToken, display_token: displayToken, expires_at: expiresAt }, 200, origin)
    }

    const id = String(body.id ?? '')
    const role = String(body.role ?? '')
    const token = String(body.token ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['teacher', 'display'].includes(role) || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return reply({ error: 'Invalid session' }, 400, origin)
    }

    const { data: row, error: readError } = await admin.from('little_evidence_movement_sessions')
      .select('id, teacher_token_hash, display_token_hash, prompt_index, status, display_done, expires_at')
      .eq('id', id).maybeSingle()
    if (readError) throw readError
    const expectedHash = row ? (role === 'teacher' ? row.teacher_token_hash : row.display_token_hash) : ''
    if (!row || Date.parse(row.expires_at) <= Date.now() || expectedHash !== await digest(token)) {
      return reply({ error: 'This pairing link is invalid or has expired.' }, 401, origin)
    }

    if (action === 'state') return reply({ state: safeState(row) }, 200, origin)

    let patch: Record<string, unknown> | null = null
    if (action === 'start' && role === 'teacher' && row.status === 'waiting') {
      patch = { status: 'active', prompt_index: 0, display_done: false }
    } else if (action === 'done' && role === 'display' && row.status === 'active') {
      patch = { status: 'done', display_done: true }
    } else if (action === 'advance' && role === 'teacher' && (row.status === 'active' || row.status === 'done') && row.prompt_index < 2) {
      patch = { status: 'active', prompt_index: row.prompt_index + 1, display_done: false }
    } else if (action === 'finish' && role === 'teacher' && (row.status === 'active' || row.status === 'done') && row.prompt_index === 2) {
      patch = { status: 'complete', display_done: false }
    }
    if (!patch) return reply({ error: 'That action is not available yet.' }, 409, origin)

    const { data: updated, error: updateError } = await admin.from('little_evidence_movement_sessions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('prompt_index, status, display_done, expires_at')
      .single()
    if (updateError) throw updateError
    return reply({ state: safeState(updated) }, 200, origin)
  } catch (error) {
    console.error('movement session request failed', error)
    return reply({ error: 'The paired session could not be updated. Try again.' }, 500, origin)
  }
})
