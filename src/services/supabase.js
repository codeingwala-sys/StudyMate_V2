import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || ''

const safeUrl = SUPABASE_URL || 'https://dummy.supabase.co'
const safeAnon = SUPABASE_ANON || 'dummy-anon-key'

export const supabase = createClient(safeUrl, safeAnon, {
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
  try {
    const projectRef = SUPABASE_URL.split('//')[1]?.split('.')[0]
    if (!projectRef) return false
    const storageKey = `sb-${projectRef}-auth-token`
    const sessionStr = localStorage.getItem(storageKey)
    if (!sessionStr) return false
    
    const session = JSON.parse(sessionStr)
    const token = session?.access_token
    if (!token || typeof token !== 'string') return false

    const parts = token.split('.')
    if (parts.length !== 3) return false

    const payload = JSON.parse(atob(parts[1]))
    return payload.exp * 1000 > Date.now()
  } catch (e) {
    console.warn('[StudyMate] Auth check error:', e)
    return false
  }
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
      updated_at: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  
  if (error) console.error('Upsert session error:', error)
  return { error }
}

// ── Full sync ─────────────────────────────────────────────────────────────────
export async function fetchPreferences() {
  if (!supabaseConfigured) return null
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return {
    settings: user.user_metadata?.settings || null,
    goals:    user.user_metadata?.goals    || null,
    name:     user.user_metadata?.name     || 'Student',
  }
}

export async function upsertPreferences(data) {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const { data: updated, error } = await supabase.auth.updateUser({
    data: { ...data }
  })
  if (error) console.error('Upsert preferences error:', error)
  return { data: updated, error }
}

export async function pullFromCloud() {
  if (!supabaseConfigured) return null
  const uid = await getUserId(); if (!uid) return null
  
  try {
    const [notesRes, tasksRes, sessionsRes, prefsRes] = await Promise.all([
      fetchNotes(), 
      fetchTasks(), 
      fetchSessions(),
      fetchPreferences()
    ])
    return { 
      notes: notesRes, 
      tasks: tasksRes, 
      sessions: sessionsRes,
      preferences: prefsRes 
    }
  } catch (e) {
    console.error('Pull from cloud error:', e)
    return null
  }
}

export async function pushAllToCloud(storeData) {
  if (!supabaseConfigured) return
  const uid = await getUserId(); if (!uid) return
  
  const { notes = [], tasks = [], timerSessions = [], settings, goals, user } = storeData
  
  // ── Batch Upserts — High Performance & Reliability ──────────────────────────
  // Instead of individual requests, send data in just 4 optimized batch calls.
  try {
    await Promise.allSettled([
      // Notes
      notes.length > 0 && supabase.from('notes').upsert(notes.map(n => ({
        id: String(n.id),
        user_id: uid,
        title: n.title || '',
        content: n.content || '',
        html: n.html || '',
        tags: n.tags || [],
        checklists: n.checklists || [],
        updated_at: n.updated_at || new Date().toISOString()
      })), { onConflict: 'id' }),

      // Tasks
      tasks.length > 0 && supabase.from('tasks').upsert(tasks.map(t => ({
        id: String(t.id),
        user_id: uid,
        title: t.title || '',
        date: t.date || null,
        time: t.time || null,
        done: t.done || false,
        updated_at: t.updated_at || new Date().toISOString()
      })), { onConflict: 'id' }),

      // Timer Sessions
      timerSessions.length > 0 && supabase.from('sessions').upsert(timerSessions.slice(0, 500).map(s => ({
        id: String(s.id || Date.now()),
        user_id: uid,
        duration: s.duration || 0,
        type: s.type || 'focus',
        date: s.date || new Date().toISOString().slice(0, 10),
        updated_at: s.updated_at || new Date().toISOString()
      })), { onConflict: 'id' }),

      // Preferences (Auth Metadata)
      upsertPreferences({ settings, goals, name: user?.name })
    ].filter(Boolean))
  } catch (e) {
    console.warn('[StudyMate] Batch sync error:', e)
  }
}