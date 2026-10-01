import { initial, transition } from './state.mjs'
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

Deno.serve(async (req: Request) => {
  const origin=req.headers.get('origin')
  if(req.method==='OPTIONS')return new Response('ok',{headers:headersFor(origin)})
  if(req.method!=='POST')return reply({error:'Method not allowed'},405,origin)
  try{
    const body=await req.json(),action=String(body.action??'')
    if(action==='create'){
      const state=initial(body.config),id=crypto.randomUUID(),teacherToken=randomToken(),displayToken=randomToken()
      const expiresAt=new Date(Date.now()+2*60*60*1000).toISOString()
      const {error}=await admin.from('little_evidence_activity_sessions').insert({id,teacher_token_hash:await digest(teacherToken),display_token_hash:await digest(displayToken),state,revision:0,expires_at:expiresAt})
      if(error)throw error
      await admin.from('little_evidence_activity_sessions').delete().lt('expires_at',new Date().toISOString())
      return reply({id,teacher_token:teacherToken,display_token:displayToken,expires_at:expiresAt,state},200,origin)
    }
    const id=String(body.id??''),role=String(body.role??''),token=String(body.token??'')
    if(!/^[0-9a-f-]{36}$/i.test(id)||!['teacher','display'].includes(role)||! /^[A-Za-z0-9_-]{43}$/.test(token))return reply({error:'Invalid session'},400,origin)
    const {data:row,error}=await admin.from('little_evidence_activity_sessions').select('*').eq('id',id).maybeSingle()
    if(error)throw error
    if(!row||Date.parse(row.expires_at)<=Date.now()||row[role==='teacher'?'teacher_token_hash':'display_token_hash']!==await digest(token))return reply({error:'This pairing has expired. Pair the screens again.'},401,origin)
    if(action==='state')return reply({state:row.state,expires_at:row.expires_at},200,origin)
    let next
    try{next=transition(row.state,role,body)}catch(e){if(e.message==='STALE')return reply({state:row.state,conflict:true},200,origin);return reply({error:e.message},400,origin)}
    const {data:updated,error:updateError}=await admin.from('little_evidence_activity_sessions').update({state:next,revision:next.revision,updated_at:new Date().toISOString()}).eq('id',id).eq('revision',row.revision).select('state').maybeSingle()
    if(updateError)throw updateError
    if(!updated){const {data:current}=await admin.from('little_evidence_activity_sessions').select('state').eq('id',id).single();return reply({state:current.state,conflict:true},200,origin)}
    return reply({state:updated.state},200,origin)
  }catch(error){console.error('activity session request failed',error);return reply({error:'Could not update the paired activity. Check the connection and try again.'},500,origin)}
})
