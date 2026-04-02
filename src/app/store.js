import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertNote, deleteNoteRemote, upsertTask, deleteTaskRemote, upsertSession, pullFromCloud, pushAllToCloud, upsertPreferences, supabase } from '../services/supabase'
import * as backupService from '../services/backup.service'

const today     = () => new Date().toISOString().slice(0, 10)
const yesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) }

let globalChannel = null

function calcStreakAndToday(sessions = []) {
  const todayStr     = today()
  const todayStudied = sessions.filter(s => s.date?.slice(0,10) === todayStr).reduce((sum,s) => sum+(s.duration||0), 0)
  const studyDays    = new Set(sessions.filter(s => (s.duration||0)>=1).map(s => s.date?.slice(0,10)).filter(Boolean))
  let streak = 0
  const startDay = studyDays.has(todayStr) ? todayStr : yesterday()
  if (!studyDays.has(startDay)) return { streak: 0, todayStudied }
  let cursor = new Date(startDay)
  while (true) {
    const dayStr = cursor.toISOString().slice(0,10)
    if (!studyDays.has(dayStr)) break
    streak++
    cursor.setDate(cursor.getDate()-1)
    if (streak > 3650) break
  }
  return { streak, todayStudied }
}

function calcPersonalBests(sessions, testResults) {
  const byDay = {}
  sessions.forEach(s => {
    const d = s.date?.slice(0,10)
    if (d) byDay[d] = (byDay[d]||0) + (s.duration||0)
  })
  const bestDayMins = Math.max(0, ...Object.values(byDay))
  const bestScore   = testResults.length ? Math.max(...testResults.map(r => r.score||0)) : 0
  return { bestDayMins, bestScore }
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      streak:        0,
      todayStudied:  0,
      lastStreakDate:null,
      streakRestores:[],
      syncing:       false,
      lastSyncedAt:  null,

      goals: { dailyMins: 60, weeklyTests: 3, streakTarget: 30 },
      updateGoals: (data) => {
        set(s => ({ goals: { ...s.goals, ...data } }))
        upsertPreferences({ goals: get().goals }).catch(() => {})
      },
      personalBests: { bestDayMins: 0, bestScore: 0 },

      user: { name: 'Student' },
      setUser: (user) => set({ user }),

      // ── NOTES ──────────────────────────────────────────────────────────────
      syncStatus: 'idle',
      isBackupActive: false,
      backupHandle: null,

      triggerLocalBackup: () => {
        const s = get()
        if (!s.isBackupActive) return
        backupService.syncToFolder(s).catch(() => {})
      },

      initBackup: async () => {
        const h = await backupService.getExistingHandle()
        if (h) {
          const ok = await backupService.verifyPermission(h)
          set({ isBackupActive: ok, backupHandle: ok ? h : null })
          if (ok) get().triggerLocalBackup()
        }
      },

      enableBackup: async () => {
        const h = await backupService.requestFolderAccess()
        if (h) {
          set({ isBackupActive: true, backupHandle: h })
          get().triggerLocalBackup()
          return true
        }
        return false
      },
      notes: [],
      deletedNotes: [],

      addNote: (note) => {
        const n = { ...note, id: String(note.id || Date.now()), createdAt: new Date().toISOString(), updated_at: new Date().toISOString() }
        set(s => ({ notes: [n, ...s.notes.filter(x => String(x.id) !== String(n.id))] }))
        set({ syncing: true })
        upsertNote(n).then(() => set({ syncing: false })).catch(() => set({ syncing: false }))
        get().triggerLocalBackup()
      },

      updateNote: (id, data) => {
        const sId = String(id)
        set(s => ({
          notes: s.notes.map(n => {
            if (String(n.id) !== sId) return n
            const safe = { ...data }
            
            // 🛑 COMPREHENSIVE PROTECTIVE MERGE
            // 1. Content: Refuse to overwrite content with empty/whitespace if local has content
            if (!safe.content?.trim() && n.content?.trim()) delete safe.content
            if (!safe.html?.trim()    && n.html?.trim())    delete safe.html
            
            // 2. Title: Never overwrite a real title with "Untitled Note" or empty string
            if (n.title && n.title !== 'Untitled Note') {
              if (safe.title === 'Untitled Note' || !safe.title?.trim()) {
                delete safe.title
              }
            }
            
            // 3. Category/Tags: Refuse empty categories if note already has a category
            const hasExistingTags = n.tags && n.tags.length > 0 && n.tags[0] !== 'Uncategorized'
            const incomingTagsEmpty = !safe.tags || safe.tags.length === 0 || (safe.tags.length === 1 && !safe.tags[0])
            if (hasExistingTags && incomingTagsEmpty) {
              delete safe.tags
            }
            
            // 4. Checklists: Protect existing lists from being wiped by an un-indexed editor
            if (n.checklists?.length > 0 && (!safe.checklists || safe.checklists.length === 0)) {
              delete safe.checklists
            }
            
            return { ...n, ...safe }
          })
        }))
        
        const updated = get().notes.find(n => String(n.id) === sId)
        if (!updated) return;

        set(s => {
          const withTime = { ...updated, updated_at: new Date().toISOString() }
          const next = { notes: s.notes.map(n => String(n.id) === sId ? withTime : n) }
          set({ syncing: true })
          upsertNote(withTime).then(() => set({ syncing: false })).catch(() => set({ syncing: false }))
          return next
        })
        get().triggerLocalBackup()
      },

      deleteNote: (id) => {
        const sId = String(id)
        set(s => ({ 
          notes: s.notes.filter(n => String(n.id) !== sId),
          deletedNotes: [...(s.deletedNotes || []), { id: sId, timestamp: Date.now() }]
        }))
        set({ syncing: true })
        deleteNoteRemote(sId).then(() => set({ syncing: false })).catch(() => set({ syncing: false }))
        get().triggerLocalBackup()
      },

      // ── TASKS ───────────────────────────────────────────────────────────────
      tasks: [],
      deletedTasks: [],

      addTask: (task) => {
        const t = { ...task, id: String(task.id || Date.now()), done: false, updated_at: new Date().toISOString() }
        set(s => ({ tasks: [...s.tasks, t] }))
        set({ syncing: true })
        upsertTask(t).then(() => set({ syncing: false })).catch(() => set({ syncing: false }))
        get().triggerLocalBackup()
      },

      toggleTask: (id) => {
        const sId = String(id)
        const now = new Date().toISOString()
        set(s => ({ tasks: s.tasks.map(t => String(t.id) === sId ? { ...t, done: !t.done, updated_at: now } : t) }))
        const t = get().tasks.find(t => String(t.id) === sId)
        if (t) {
          set({ syncing: true })
          upsertTask(t).then(() => set({ syncing: false })).catch(() => set({ syncing: false }))
        }
        get().triggerLocalBackup()
      },

      deleteTask: (id) => {
        const sId = String(id)
        set(s => ({ 
          tasks: s.tasks.filter(t => String(t.id) !== sId),
          deletedTasks: [...(s.deletedTasks || []), { id: sId, timestamp: Date.now() }]
        }))
        set({ syncing: true })
        deleteTaskRemote(sId).then(() => set({ syncing: false })).catch(() => set({ syncing: false }))
        get().triggerLocalBackup()
      },

      // ── SESSIONS ────────────────────────────────────────────────────────────
      timerSessions: [],

      addSession: (session) => {
        const withId = { ...session, id: String(session.id || Date.now()), updated_at: new Date().toISOString() }
        set(s => {
          const newSessions = [withId, ...s.timerSessions]
          const { streak, todayStudied } = calcStreakAndToday(newSessions)
          const personalBests = calcPersonalBests(newSessions, s.testResults)
          return { timerSessions: newSessions, streak, todayStudied, lastStreakDate: today(), personalBests }
        })
        set({ syncing: true })
        upsertSession(withId).then(() => set({ syncing: false })).catch(() => set({ syncing: false }))
        get().triggerLocalBackup()
      },

      refreshStreak: () => set(s => {
        const { streak, todayStudied } = calcStreakAndToday(s.timerSessions)
        const personalBests = calcPersonalBests(s.timerSessions, s.testResults)
        return { streak, todayStudied, lastStreakDate: today(), personalBests }
      }),

      restoreStreak: () => {
        const s = get()
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const thisMonthRestores = (s.streakRestores || []).filter(d => d.startsWith(currentMonth))
        if (thisMonthRestores.length >= 2) return false // Max 2 per month allowed
        
        const todayStr = today()
        const studyDays = new Set(s.timerSessions.filter(x => (x.duration || 0) >= 1).map(x => x.date?.slice(0, 10)).filter(Boolean))
        const startDay = studyDays.has(todayStr) ? todayStr : yesterday()
        
        let cursor = new Date(startDay)
        let brokenDayStr = startDay
        while (true) {
          const dayStr = cursor.toISOString().slice(0, 10)
          if (!studyDays.has(dayStr)) { brokenDayStr = dayStr; break }
          cursor.setDate(cursor.getDate() - 1)
        }
        
        const dummySession = {
          id: `restore-${Date.now()}`,
          date: new Date(brokenDayStr + 'T12:00:00Z').toISOString(),
          duration: 1,
          type: 'restore',
          updated_at: new Date().toISOString()
        }
        
        set(state => {
          const newSessions = [dummySession, ...state.timerSessions]
          const { streak, todayStudied } = calcStreakAndToday(newSessions)
          const newRestores = [...(state.streakRestores || []), new Date().toISOString()]
          return { timerSessions: newSessions, streak, todayStudied, streakRestores: newRestores }
        })
        set({ syncing: true })
        upsertSession(dummySession).then(() => set({ syncing: false })).catch(() => set({ syncing: false }))
        return true
      },

      // ── CLOUD SYNC ──────────────────────────────────────────────────────────
      syncFromCloud: async () => {
        if (get().syncing) return
        set({ syncing: true })
        try {
          const cloud = await pullFromCloud()
          if (!cloud) { set({ syncing: false }); return }

          set(s => {
            // Intelligent Merge: Newer updated_at wins. Checks tombstones for ghosts.
            const merge = (cloudArr, localArr, tombstoneArr, key = 'id') => {
              const map = {}
              const tombMap = new Set((tombstoneArr || []).map(x => String(x.id)))

              ;(localArr || []).forEach(x => { map[String(x[key])] = x })
              ;(cloudArr || []).forEach(cloudItem => {
                // If it was deleted offline uniquely, skip pulling it back
                if (tombMap.has(String(cloudItem[key]))) return

                const localItem = map[String(cloudItem[key])]
                // Overwrite if:
                // 1. No local item exists
                // 2. Cloud item has a newer timestamp
                // 3. Local item doesn't have a timestamp (assume cloud is truth)
                const cloudTime = cloudItem.updated_at ? new Date(cloudItem.updated_at).getTime() : 0
                const localTime = localItem?.updated_at ? new Date(localItem.updated_at).getTime() : 0
                
                if (!localItem || cloudTime > localTime || !localItem.updated_at) {
                  map[String(cloudItem[key])] = cloudItem
                }
              })
              return Object.values(map)
            }

            const mergedNotes = merge(cloud.notes, s.notes, s.deletedNotes)
            const mergedTasks = merge(cloud.tasks, s.tasks, s.deletedTasks)
            const mergedSess  = merge(cloud.sessions, s.timerSessions, [])
            
            const { streak, todayStudied } = calcStreakAndToday(mergedSess)
            const personalBests = calcPersonalBests(mergedSess, s.testResults)

            // Retry offline deletions
            ;(s.deletedNotes || []).forEach(d => deleteNoteRemote(d.id).catch(() => {}))
            ;(s.deletedTasks || []).forEach(d => deleteTaskRemote(d.id).catch(() => {}))

            // Keep tombstones manageable (clear older than 14 days)
            const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
            const clnNotes = (s.deletedNotes || []).filter(d => d.timestamp > cutoff)
            const clnTasks = (s.deletedTasks || []).filter(d => d.timestamp > cutoff)

            const newState = {
              notes:         mergedNotes,
              tasks:         mergedTasks,
              timerSessions: mergedSess,
              deletedNotes:  clnNotes,
              deletedTasks:  clnTasks,
              streak, todayStudied, personalBests,
              lastSyncedAt:  new Date().toISOString(),
              syncing:       false,
            }

            if (cloud.preferences?.settings) newState.settings = cloud.preferences.settings
            if (cloud.preferences?.goals)    newState.goals    = cloud.preferences.goals
            if (cloud.preferences?.name)     newState.user     = { ...s.user, name: cloud.preferences.name }

            return newState
          })

          // After pulling and merging, push back the merged state to ensure cloud is up to date
          // with any local-only items that were merged in.
          await pushAllToCloud(get()).catch(err => console.warn('Sync push error:', err))
          set({ syncing: false })
        } catch (e) {
          console.error('Sync error:', e)
          set({ syncing: false })
        }
      },

      // ── REALTIME SUBSCRIPTION ───────────────────────────────────────────────
      subscribeToRealtime: () => {
        if (!supabase) return;

        const sub = supabase
          .channel('any')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const cloudItem = payload.new
              const cloudTime = new Date(cloudItem.updated_at).getTime()
              const localItem = get().notes.find(n => String(n.id) === String(cloudItem.id))
              const localTime = localItem?.updated_at ? new Date(localItem.updated_at).getTime() : 0
              if (!localItem || cloudTime > localTime) {
                set(s => ({ notes: [cloudItem, ...s.notes.filter(n => String(n.id) !== String(cloudItem.id))] }))
              }
            } else if (payload.eventType === 'DELETE') {
              set(s => ({ notes: s.notes.filter(n => String(n.id) !== String(payload.old.id)) }))
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const cloudItem = payload.new
              const cloudTime = new Date(cloudItem.updated_at).getTime()
              const localItem = get().tasks.find(t => String(t.id) === String(cloudItem.id))
              const localTime = localItem?.updated_at ? new Date(localItem.updated_at).getTime() : 0
              if (!localItem || cloudTime > localTime) {
                set(s => ({ tasks: [cloudItem, ...s.tasks.filter(t => String(t.id) !== String(cloudItem.id))] }))
              }
            } else if (payload.eventType === 'DELETE') {
              set(s => ({ tasks: s.tasks.filter(t => String(t.id) !== String(payload.old.id)) }))
            }
          })
          .subscribe()

        return () => supabase.removeChannel(sub)
      },

      // ── MISC ────────────────────────────────────────────────────────────────
      learningData: {},
      updateLearning: (subject, topic, score) => set(s => ({
        learningData: {
          ...s.learningData,
          [subject]: { ...(s.learningData[subject]||{}), [topic]: { score, updatedAt: new Date().toISOString() } }
        }
      })),

      testResults: [],
      addTestResult: (result) => set(s => {
        const newResults = [result, ...s.testResults]
        const personalBests = calcPersonalBests(s.timerSessions, newResults)
        return { testResults: newResults, personalBests }
      }),

      settings: { pomoDuration: 25, shortBreak: 5, longBreak: 15 },
      updateSettings: (data) => {
        set(s => ({ settings: { ...s.settings, ...data } }))
        upsertPreferences({ settings: get().settings }).catch(() => {})
      },

      clearStudyData: (isSignOut = false) => set(s => {
        if (isSignOut) {
          return {
            timerSessions: [], testResults: [], notes: [], tasks: [], 
            deletedNotes: [], deletedTasks: [], learningData: {},
            streak: 0, todayStudied: 0, lastSyncedAt: null,
            settings: { pomoDuration: 25, shortBreak: 5, longBreak: 15 },
            goals: { dailyMins: 60, weeklyTests: 3, streakTarget: 30 },
            user: { name: 'Student' }
          }
        }
        return { timerSessions: [], testResults: [], streak: 0, todayStudied: 0 }
      }),
    }),
    { name: 'studymate-store' }
  )
)