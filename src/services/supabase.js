import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

export const supabaseConfigured = !!SUPABASE_URL && (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_URL.includes('supabase.co'))

// ── Helpers ──────────────────────────────────────────────────────────────────
const getUserId = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id || null
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

export async function signUp(email, password, name, metadata = {}) {
  if (!supabaseConfigured) return { user: null, error: 'Supabase not configured' }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, ...metadata }
    }
  })
  if (error) return { user: null, error: error.message }
  if (data?.session) {
    return { user: data.user, error: null }
  }
  return { user: data?.user || null, error: null, needsConfirmation: true }
}

export async function signIn(email, password) {
  if (!supabaseConfigured) return { user: null, error: 'Supabase not configured' }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) return { user: null, error: error.message }
  return { user: data.user, error: null }
}

export async function signOut() {
  await supabase.auth.signOut()
  localStorage.removeItem('studymate_user')
}

export async function hardResetSession() {
  await supabase.auth.signOut()
  localStorage.clear()
  window.location.reload()
}

export async function refreshSession() {
  const { data: { session }, error } = await supabase.auth.refreshSession()
  if (error || !session) return null
  return session.user
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function isLoggedIn() {
  // Synchronous check of the session in storage
  // Note: The key used by supabase-js is 'sb-<project-id>-auth-token'
  const projectRef = SUPABASE_URL.split('//')[1]?.split('.')[0]
  if (!projectRef) return false
  const storageKey = `sb-${projectRef}-auth-token`
  const session = JSON.parse(localStorage.getItem(storageKey) || 'null')
  if (!session?.access_token) return false
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]))
    return payload.exp * 1000 > Date.now()
  } catch { return false }
}

// ── DATA SYNC ─────────────────────────────────────────────────────────────────

export async function fetchNotes() {
  const uid = await getUserId(); if (!uid) return null
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', uid)
    .order('updated_at', { ascending: false })
  
  if (error) {
    console.error('Fetch notes error:', error)
    return null
  }

  return data ? data.map(n => ({
    ...n,
    tags:       typeof n.tags === 'string' ? JSON.parse(n.tags) : (n.tags || []),
    checklists: typeof n.checklists === 'string' ? JSON.parse(n.checklists) : (n.checklists || []),
    createdAt:  n.created_at,
  })) : null
}

export async function upsertNote(note) {
  const uid = await getUserId(); if (!uid) return null
  const { error } = await supabase
    .from('notes')
    .upsert({
      id:         String(note.id),
      user_id:    uid,
      title:      note.title || '',
      content:    note.content || '',
      html:       note.html || '',
      tags:       note.tags || [],
      checklists: note.checklists || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  
  if (error) console.error('Upsert note error:', error)
  return { error }
}

export async function deleteNoteRemote(id) {
  const uid = await getUserId(); if (!uid) return null
  return await supabase
    .from('notes')
    .delete()
    .eq('id', String(id))
    .eq('user_id', uid)
}

export async function fetchTasks() {
  const uid = await getUserId(); if (!uid) return null
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
  
  if (error) console.error('Fetch tasks error:', error)
  return data
}

export async function upsertTask(task) {
  const uid = await getUserId(); if (!uid) return null
  const { error } = await supabase
    .from('tasks')
    .upsert({
      id:      String(task.id),
      user_id: uid,
      title:   task.title || '',
      date:    task.date || null,
      time:    task.time || null,
      done:    task.done || false,
    }, { onConflict: 'id' })
  
  if (error) console.error('Upsert task error:', error)
  return { error }
}

export async function deleteTaskRemote(id) {
  const uid = await getUserId(); if (!uid) return null
  return await supabase
    .from('tasks')
    .delete()
    .eq('id', String(id))
    .eq('user_id', uid)
}

export async function fetchSessions() {
  const uid = await getUserId(); if (!uid) return null
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(500)
  
  if (error) console.error('Fetch sessions error:', error)
  return data
}

export async function upsertSession(session) {
  const uid = await getUserId(); if (!uid) return null
  const { error } = await supabase
    .from('sessions')
    .upsert({
      id:       String(session.id || Date.now()),
      user_id:  uid,
      duration: session.duration || 0,
      type:     session.type || 'focus',
      date:     session.date || new Date().toISOString().slice(0, 10),
    }, { onConflict: 'id' })
  
  if (error) console.error('Upsert session error:', error)
  return { error }
}

// ── Full sync ─────────────────────────────────────────────────────────────────
export async function pullFromCloud() {
  if (!supabaseConfigured) return null
  const uid = await getUserId(); if (!uid) return null
  
  try {
    const [notesRes, tasksRes, sessionsRes] = await Promise.all([
      fetchNotes(), 
      fetchTasks(), 
      fetchSessions()
    ])
    return { notes: notesRes, tasks: tasksRes, sessions: sessionsRes }
  } catch (e) {
    console.error('Pull from cloud error:', e)
    return null
  }
}

export async function pushAllToCloud(storeData) {
  if (!supabaseConfigured) return
  const uid = await getUserId(); if (!uid) return
  
  const { notes = [], tasks = [], timerSessions = [] } = storeData
  
  await Promise.allSettled([
    ...notes.map(n => upsertNote(n)),
    ...tasks.map(t => upsertTask(t)),
    ...timerSessions.slice(0, 500).map(s => upsertSession({ ...s, id: String(s.id || Date.now()) })),
  ])
}