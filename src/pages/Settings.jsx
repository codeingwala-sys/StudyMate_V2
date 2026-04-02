import { useState, useEffect } from 'react'
import { requestNotificationPermission, getNotificationPermission, scheduleStreakReminder, cancelStreakReminder } from '../services/notifications.service'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../services/supabase'
import { useAppStore } from '../app/store'
import Header from '../components/layout/Header'

function getTheme() { return localStorage.getItem('studymate_theme') || 'dark' }
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
  localStorage.setItem('studymate_theme', theme)
}

const Row = ({ label, sub, right, noBorder, T }) => (
  <div style={{ display:'flex',alignItems:'center',padding:'14px 18px',borderBottom:noBorder?'none':`1px solid ${T.border2}` }}>
    <div style={{ flex:1 }}>
      <span style={{ fontSize:14,color:T.text,fontFamily:'Inter,sans-serif',display:'block' }}>{label}</span>
      {sub && <span style={{ fontSize:11,color:T.muted,fontFamily:'Inter,sans-serif',marginTop:2,display:'block' }}>{sub}</span>}
    </div>
    {right}
  </div>
)

const Toggle = ({ on, onToggle, color='#3b82f6' }) => (
  <div onClick={onToggle} style={{ width:44,height:26,borderRadius:13,background:on?color:'rgba(128,128,128,0.25)',cursor:'pointer',position:'relative',transition:'background 0.25s',flexShrink:0 }}>
    <div style={{ position:'absolute',top:3,left:on?21:3,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.25s',boxShadow:'0 1px 6px rgba(0,0,0,0.25)' }} />
  </div>
)

const Section = ({ title, children, T, isDark }) => (
  <div>
    <p style={{ fontSize:11,color:T.label,fontWeight:600,textTransform:'uppercase',letterSpacing:'1.2px',marginBottom:10,fontFamily:'Inter,sans-serif' }}>{title}</p>
    <div style={{ background:T.bg2,border:`1px solid ${T.border}`,borderRadius:18,overflow:'hidden',boxShadow:isDark?'none':'0 1px 8px rgba(0,0,0,0.06)' }}>{children}</div>
  </div>
)

export default function Settings() {
  const navigate = useNavigate()
  const { user, setUser, refreshStreak, notes, tasks, timerSessions, testResults, syncing } = useAppStore()
  const savedUser = JSON.parse(localStorage.getItem('studymate_user') || '{}')
  const [localName,    setLocalName]   = useState(user.name || savedUser.name || 'Student')
  const [theme,        setTheme]       = useState(getTheme)
  const [notifPerm,    setNotifPerm]   = useState(getNotificationPermission)
  const [showClear,    setShowClear]   = useState(false)
  const [exportDone,   setExportDone]  = useState(false)
  const [syncStatus,   setSyncStatus]  = useState('idle') // idle, loading, success, error
  const notifsOn = notifPerm === 'granted'
  const isDark = theme === 'dark'

  useEffect(() => { applyTheme(theme) }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const saveName = async () => {
    setUser({ ...user, name: localName })
    localStorage.setItem('studymate_user', JSON.stringify({ ...savedUser, name: localName }))
    // Also push to cloud immediately
    const { upsertPreferences } = await import('../services/supabase')
    upsertPreferences({ name: localName }).catch(() => {})
  }

  const handleSignOut = async () => {
    // Full clear of dynamic study data including tombstones to prevent account overlapping
    useAppStore.getState().clearStudyData(true)
    
    await signOut().catch(() => {
      localStorage.removeItem('studymate_user')
    })
    navigate('/signin')
  }

  const handleClearData = () => {
    useAppStore.getState().clearStudyData(false)
    refreshStreak()
    setShowClear(false)
  }

  // ── EXPORT DATA — downloads all user data as a JSON backup ───────────────
  // Useful before uninstalling the PWA, since uninstall clears localStorage.
  // ── PWA CONTROLS ────────────────────────────────────────────────────────
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const handleManualUpdate = async () => {
    if (!('serviceWorker' in navigator)) return
    setCheckingUpdate(true)
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.update()
      // If no update found after a second, show toast or just reset state
      setTimeout(() => setCheckingUpdate(false), 1500)
    } catch (e) {
      setCheckingUpdate(false)
    }
  }

  const handleHardReset = async () => {
    if (!window.confirm('CRITICAL: This will unregister the app, clear ALL cache, and reload. Your study notes/tasks are safe in local database. Continue?')) return
    
    try {
      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (let registration of registrations) {
          await registration.unregister()
        }
      }

      // 2. Clear all named caches
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }

      // 3. Clear session storage (temp data)
      sessionStorage.clear()

      // 4. Force reload from server
      window.location.href = window.location.origin + '?force_reload=' + Date.now()
    } catch (e) {
      console.error('Hard reset failed:', e)
      window.location.reload()
    }
  }

  const handleExportData = () => {
    try {
      const allData = {
        exportedAt: new Date().toISOString(),
        version:    '1.3.0',
        user:       savedUser,
        notes,
        tasks,
        timerSessions,
        testResults,
        settings:   useAppStore.getState().settings,
        goals:      useAppStore.getState().goals,
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `studymate-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } catch (err) {
      console.error('Export failed', err)
    }
  }

  const T = {
    bg:       isDark ? '#0e0e0e' : '#ffffff',
    bg2:      isDark ? '#111'    : '#f7f7f7',
    border:   isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    border2:  isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    text:     isDark ? '#fff'    : '#0a0a0a',
    muted:    isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
    label:    isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.3)',
    inputBg:  isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    inputBrd: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    btnBg:    isDark ? '#fff'    : '#0a0a0a',
    btnText:  isDark ? '#000'    : '#fff',
    danger:   isDark ? 'rgba(248,113,113,0.07)' : 'rgba(220,38,38,0.07)',
    dangerBrd:isDark ? 'rgba(248,113,113,0.15)' : 'rgba(220,38,38,0.15)',
    dangerTxt:isDark ? '#f87171' : '#dc2626',
    green:    isDark ? '#4ade80' : '#16a34a',
    greenBg:  isDark ? 'rgba(74,222,128,0.08)' : 'rgba(22,163,74,0.08)',
    greenBrd: isDark ? 'rgba(74,222,128,0.2)'  : 'rgba(22,163,74,0.2)',
    amber:    isDark ? '#fbbf24' : '#d97706',
    amberBg:  isDark ? 'rgba(251,191,36,0.08)' : 'rgba(217,119,6,0.08)',
    amberBrd: isDark ? 'rgba(251,191,36,0.2)'  : 'rgba(217,119,6,0.2)',
  }

  const inp = { background:T.inputBg, border:`1px solid ${T.inputBrd}`, borderRadius:10, padding:'9px 12px', color:T.text, fontSize:13, fontFamily:'Inter,sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }

  return (
    <div style={{ minHeight:'100vh', background:isDark?'#000':'#f0f0f0', transition:'background 0.3s' }}>
      <Header title="Settings" back />
      <div style={{ padding:'8px 16px 120px', display:'flex', flexDirection:'column', gap:22 }}>

        {/* ── PROFILE ── */}
        <Section T={T} isDark={isDark} title="Profile">
          <div style={{ padding:18 }}>
            <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:16 }}>
              <div style={{ width:54,height:54,borderRadius:17,background:isDark?'rgba(96,165,250,0.12)':'rgba(37,99,235,0.1)',border:`1px solid ${isDark?'rgba(96,165,250,0.2)':'rgba(37,99,235,0.18)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,color:isDark?'#60a5fa':'#2563eb',fontFamily:'Inter,sans-serif' }}>
                {savedUser.picture
                  ? <img src={savedUser.picture} style={{ width:54,height:54,borderRadius:17,objectFit:'cover' }} alt="" />
                  : localName.charAt(0).toUpperCase()
                }
              </div>
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:T.text,fontFamily:'Inter,sans-serif' }}>{localName}</p>
                <p style={{ fontSize:12,color:T.muted,fontFamily:'Inter,sans-serif',marginTop:2 }}>
                  {savedUser.googleId ? '✓ Signed in with Google' : savedUser.email || 'Guest user'}
                </p>
              </div>
            </div>
            <div style={{ display:'flex',gap:8 }}>
              <input value={localName} onChange={e=>setLocalName(e.target.value)} placeholder="Display name" style={{...inp, flex:1, width:'auto'}} />
              <button onClick={saveName} style={{ padding:'9px 18px',borderRadius:10,background:T.btnBg,border:'none',color:T.btnText,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif',flexShrink:0 }}>Save</button>
            </div>
            
            <div style={{ marginTop:20, padding:16, background:T.inputBg, borderRadius:16, border:`1px solid ${T.border}` }}>
              <h4 style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:4 }}>Cloud Troubleshooting</h4>
              <p style={{ fontSize:11, color:T.muted, marginBottom:12 }}>If your notes aren't syncing or you see "403" errors, try repairing your connection. This will refresh your session safely.</p>
              <button 
                onClick={handleHardReset} 
                style={{ width:'100%', padding:'10px', borderRadius:10, background:T.bg2, border:`1px solid ${T.border}`, color:T.text, fontSize:11, fontWeight:700, cursor:'pointer' }}
              >
                Repair Cloud Sync
              </button>
            </div>
          </div>
        </Section>

        {/* ── APPEARANCE ── */}
        <Section T={T} isDark={isDark} title="Appearance">
          <div style={{ padding:'16px 18px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
              <span style={{ fontSize:14,color:T.text,fontFamily:'Inter,sans-serif' }}>Theme</span>
              <div onClick={toggleTheme} style={{ display:'flex',alignItems:'center',gap:8,background:isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)',border:`1px solid ${T.border}`,borderRadius:24,padding:'6px 8px',cursor:'pointer' }}>
                <div style={{ width:28,height:28,borderRadius:'50%',background:!isDark?'#fbbf24':'transparent',border:`1px solid ${!isDark?'#fbbf24':T.border}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.25s' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={!isDark?'#000':'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                </div>
                <div style={{ width:28,height:28,borderRadius:'50%',background:isDark?'rgba(96,165,250,0.15)':'transparent',border:`1px solid ${isDark?'rgba(96,165,250,0.3)':T.border}`,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.25s' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isDark?'#60a5fa':'rgba(0,0,0,0.25)'} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                </div>
              </div>
            </div>
            {/* Live preview */}
            <div style={{ borderRadius:14,overflow:'hidden',border:`1px solid ${T.border}` }}>
              <div style={{ background:isDark?'#111':'#fff',padding:'12px 14px',display:'flex',gap:10,alignItems:'center' }}>
                <div style={{ width:32,height:32,borderRadius:10,background:isDark?'rgba(96,165,250,0.12)':'rgba(37,99,235,0.1)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark?'#60a5fa':'#2563eb'} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                </div>
                <div>
                  <div style={{ width:80,height:8,borderRadius:4,background:isDark?'rgba(255,255,255,0.15)':'rgba(0,0,0,0.15)',marginBottom:5 }} />
                  <div style={{ width:56,height:6,borderRadius:3,background:isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)' }} />
                </div>
              </div>
              <div style={{ background:isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)',padding:'8px 14px',borderTop:`1px solid ${T.border}` }}>
                <p style={{ fontSize:10,color:T.muted,fontFamily:'Inter,sans-serif' }}>{isDark?'Dark mode active':'Light mode active'}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── TIMER & GOALS ── */}
        <Section T={T} isDark={isDark} title="Timer & Goals">
          <div style={{ padding:'16px 18px' }}>
            <div style={{ marginBottom:20 }}>
              <p style={{ fontSize:12, color:T.muted, marginBottom:10 }}>Custom study durations and daily target (in minutes)</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:T.label, marginBottom:6, textTransform:'uppercase' }}>Study Session</p>
                  <input 
                    type="number" 
                    value={useAppStore.getState().settings.pomoDuration} 
                    onChange={e => useAppStore.getState().updateSettings({ pomoDuration: parseInt(e.target.value) || 25 })}
                    style={{ ...inp, width: '100%' }} 
                  />
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:T.label, marginBottom:6, textTransform:'uppercase' }}>Daily Goal</p>
                  <input 
                    type="number" 
                    value={useAppStore.getState().goals.dailyMins} 
                    onChange={e => useAppStore.getState().updateGoals({ dailyMins: parseInt(e.target.value) || 60 })}
                    style={{ ...inp, width: '100%' }} 
                  />
                </div>
              </div>
            </div>
            
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:10 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:10, fontWeight:700, color:T.label, marginBottom:6, textTransform:'uppercase' }}>Short Break</p>
                <input 
                  type="number" 
                  value={useAppStore.getState().settings.shortBreak} 
                  onChange={e => useAppStore.getState().updateSettings({ shortBreak: parseInt(e.target.value) || 5 })}
                  style={{ ...inp, width: '100%' }} 
                />
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:10, fontWeight:700, color:T.label, marginBottom:6, textTransform:'uppercase' }}>Long Break</p>
                <input 
                  type="number" 
                  value={useAppStore.getState().settings.longBreak} 
                  onChange={e => useAppStore.getState().updateSettings({ longBreak: parseInt(e.target.value) || 15 })}
                  style={{ ...inp, width: '100%' }} 
                />
              </div>
            </div>
            
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>Streak Repair</h4>
              <p style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>
                Lost your streak? You can restore it up to 2 times per month.
                <br/>
                <span style={{ color: T.amber }}>Restores used this month: {(useAppStore.getState().streakRestores || []).filter(d => d.startsWith(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)).length} / 2</span>
              </p>
              <button 
                onClick={() => {
                  const success = useAppStore.getState().restoreStreak()
                  if (success) alert("Streak restored successfully!")
                  else alert("You have reached the maximum streak restores for this month.")
                }} 
                style={{ width:'100%', padding:'10px', borderRadius:10, background:T.amberBg, border:`1px solid ${T.amberBrd}`, color:T.amber, fontSize:12, fontWeight:700, cursor:'pointer' }}
              >
                Restore Streak
              </button>
            </div>
          </div>
        </Section>

        {/* ── NOTIFICATIONS ── */}
        <Section T={T} isDark={isDark} title="Notifications">
          <Row T={T} label="Study Reminders" sub="Daily 8pm streak reminder"
            noBorder
            right={
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                {notifPerm==='unsupported' && <span style={{ fontSize:11,color:T.muted,fontFamily:'Inter,sans-serif' }}>Not supported</span>}
                {notifPerm==='denied' && <span style={{ fontSize:11,color:T.dangerTxt,fontFamily:'Inter,sans-serif' }}>Blocked in browser</span>}
                <Toggle on={notifsOn} color="#3b82f6" onToggle={async()=>{
                  if(notifsOn){ cancelStreakReminder(); setNotifPerm('default') }
                  else {
                    const p = await requestNotificationPermission()
                    setNotifPerm(p)
                    if(p==='granted') scheduleStreakReminder(useAppStore.getState().streak)
                  }
                }} />
              </div>
            }
          />
        </Section>

        {/* ── DATA & BACKUP ── */}
        <Section T={T} isDark={isDark} title="Data & Backup">
          {/* Updates info */}
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.border2}` }}>
            <div style={{ display:'flex',alignItems:'flex-start',gap:12 }}>
              <div style={{ width:36,height:36,borderRadius:10,background:T.amberBg,border:`1px solid ${T.amberBrd}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <p style={{ fontSize:13,fontWeight:600,color:T.text,fontFamily:'Inter,sans-serif',marginBottom:4 }}>App updates are automatic</p>
                <p style={{ fontSize:11,color:T.muted,fontFamily:'Inter,sans-serif',lineHeight:1.5 }}>
                  You never need to uninstall and reinstall to get updates. When a new version is available, a banner will appear at the bottom of the screen. Tap it to update instantly — your data is always safe.
                </p>
              </div>
            </div>
          </div>

          {/* Uninstall warning */}
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${T.border2}` }}>
            <div style={{ display:'flex',alignItems:'flex-start',gap:12 }}>
              <div style={{ width:36,height:36,borderRadius:10,background:T.danger,border:`1px solid ${T.dangerBrd}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.dangerTxt} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <p style={{ fontSize:13,fontWeight:600,color:T.dangerTxt,fontFamily:'Inter,sans-serif',marginBottom:4 }}>⚠️ Uninstalling deletes your data</p>
                <p style={{ fontSize:11,color:T.muted,fontFamily:'Inter,sans-serif',lineHeight:1.5 }}>
                  If you uninstall the app from your home screen, all notes, tasks, sessions and progress will be permanently deleted. Export a backup first.
                </p>
              </div>
            </div>
          </div>

          {/* Export button */}
          <div style={{ padding:'14px 18px' }}>
            <p style={{ fontSize:12,color:T.muted,fontFamily:'Inter,sans-serif',marginBottom:12,lineHeight:1.5 }}>
              Download all your data as a JSON file. Keep this as a backup before uninstalling or clearing your browser data.
            </p>
            <button
              onClick={handleExportData}
              style={{
                width:'100%', padding:'12px', borderRadius:12,
                background: exportDone ? T.greenBg : T.inputBg,
                border: `1px solid ${exportDone ? T.greenBrd : T.border}`,
                color: exportDone ? T.green : T.text,
                fontSize:13, fontWeight:700, cursor:'pointer',
                fontFamily:'Inter,sans-serif',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'all 0.2s',
              }}
            >
              {exportDone ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Backup saved!
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export Backup (.json)
                </>
              )}
            </button>
          </div>

          {/* Manual Update button */}
          <div style={{ padding:'0 18px 14px' }}>
            <button
              onClick={handleManualUpdate}
              disabled={checkingUpdate}
              style={{
                width:'100%', padding:'12px', borderRadius:12,
                background: T.inputBg,
                border: `1px solid ${T.border}`,
                color: T.text,
                fontSize:13, fontWeight:700, cursor:checkingUpdate?'default':'pointer',
                fontFamily:'Inter,sans-serif',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                opacity:checkingUpdate?0.6:1
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: checkingUpdate ? 'spin 1.2s linear infinite' : 'none' }}><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              {checkingUpdate ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>

          {/* Sync button */}
          <div style={{ padding:'0 18px 14px' }}>
            <button
              disabled={syncing || syncStatus === 'success'}
              onClick={async () => {
                setSyncStatus('loading')
                try {
                  const { syncFromCloud } = useAppStore.getState()
                  await syncFromCloud()
                  setSyncStatus('success')
                  setTimeout(() => setSyncStatus('idle'), 3000)
                } catch (e) {
                  setSyncStatus('error')
                  setTimeout(() => setSyncStatus('idle'), 3000)
                }
              }}
              style={{
                width:'100%', padding:'12px', borderRadius:12,
                background: syncStatus === 'success' ? T.greenBg : (syncStatus === 'error' ? T.danger : T.greenBg),
                border: `1px solid ${syncStatus === 'success' ? T.greenBrd : (syncStatus === 'error' ? T.dangerBrd : T.greenBrd)}`,
                color: syncStatus === 'error' ? T.dangerTxt : T.green,
                fontSize:13, fontWeight:700, cursor:(syncing || syncStatus === 'success') ? 'default' : 'pointer',
                fontFamily:'Inter,sans-serif',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition: 'all 0.2s'
              }}
            >
              {syncStatus === 'loading' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1.2s linear infinite' }}><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              ) : syncStatus === 'success' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              )}
              {syncStatus === 'loading' ? 'Syncing...' : syncStatus === 'success' ? 'All Data Synced!' : syncStatus === 'error' ? 'Sync Failed' : 'Sync Data Now'}
            </button>
          </div>
        </Section>

        {/* ── ABOUT ── */}
        <Section T={T} isDark={isDark} title="About">
          <div style={{ padding:'16px 18px' }}>
            <div style={{ display:'flex',alignItems:'center',gap:14,marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${T.border2}` }}>
              <div style={{ width:46,height:46,borderRadius:14,background:isDark?'rgba(96,165,250,0.1)':'rgba(37,99,235,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,color:isDark?'#60a5fa':'#2563eb' }}>✦</div>
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:T.text,fontFamily:'Inter,sans-serif' }}>StudyMate</p>
                <p style={{ fontSize:12,color:T.muted,fontFamily:'Inter,sans-serif',marginTop:2 }}>Version 1.3.0 · AI-powered</p>
              </div>
            </div>
            <p style={{ fontSize:13,color:T.muted,fontFamily:'Inter,sans-serif',lineHeight:1.6 }}>
              Notes, adaptive tests, focus timer, and progress tracking — all in one place.
            </p>
          </div>
        </Section>

        {/* ── DANGER ZONE ── */}
        <Section T={T} isDark={isDark} title="Danger Zone">
          {!showClear ? (
            <Row T={T} noBorder label="Clear All Study Data" sub="Resets sessions, tests and streak"
              right={
                <button onClick={()=>setShowClear(true)} style={{ padding:'7px 14px',borderRadius:10,background:T.danger,border:`1px solid ${T.dangerBrd}`,color:T.dangerTxt,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Clear</button>
              }
            />
          ) : (
            <div style={{ padding:'16px 18px' }}>
              <p style={{ fontSize:13,color:T.dangerTxt,fontFamily:'Inter,sans-serif',marginBottom:12,fontWeight:600 }}>This will delete all sessions, test results and reset your streak. Notes are kept.</p>
              <div style={{ display:'flex',gap:8 }}>
                <button onClick={()=>setShowClear(false)} style={{ flex:1,padding:'10px',borderRadius:10,background:T.inputBg,border:`1px solid ${T.border}`,color:T.text,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Cancel</button>
                <button onClick={handleClearData} style={{ flex:1,padding:'10px',borderRadius:10,background:T.danger,border:`1px solid ${T.dangerBrd}`,color:T.dangerTxt,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'Inter,sans-serif' }}>Yes, Clear</button>
              </div>
            </div>
          )}

          <div style={{ padding:'14px 18px', background:T.danger, marginTop:10 }}>
            <p style={{ fontSize:11, color:T.dangerTxt, marginBottom:10, opacity:0.8 }}>App stuck or updates not showing? Use hard reset to clear all caches. No notes will be lost.</p>
            <button
              onClick={handleHardReset}
              style={{
                width:'100%', padding:'10px', borderRadius:10,
                background: 'transparent',
                border: `1px solid ${T.dangerBrd}`,
                color: T.dangerTxt,
                fontSize:12, fontWeight:700, cursor:'pointer',
                fontFamily:'Inter,sans-serif'
              }}
            >
              Hard Reset App Cache
            </button>
          </div>
        </Section>

        {savedUser.email && (
          <button onClick={handleSignOut} style={{ padding:'15px',borderRadius:16,fontFamily:'Inter,sans-serif',background:T.danger,border:`1px solid ${T.dangerBrd}`,color:T.dangerTxt,fontSize:14,fontWeight:600,cursor:'pointer' }}>
            Sign Out
          </button>
        )}
      </div>
      <style>{`
        @keyframes spin { from {transform:rotate(0deg)} to {transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}