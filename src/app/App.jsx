import { useEffect, useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import Splash from '../pages/Splash'
import { BrowserRouter } from 'react-router-dom'
import Router from './Router'
import { useAppStore } from './store'
import { isLoggedIn, refreshSession } from '../services/supabase'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Analytics } from '@vercel/analytics/react'
import PWAInstallPrompt from '../components/PWAInstallPrompt'

export default function App() {
  const [splashDone,   setSplashDone]   = useState(false)
  const refreshStreak   = useAppStore(s => s.refreshStreak)
  const syncFromCloud   = useAppStore(s => s.syncFromCloud)
  const syncing         = useAppStore(s => s.syncing)
  const lastSyncedAt    = useAppStore(s => s.lastSyncedAt)

  // Recalculate streak every time the app loads / becomes visible
  useEffect(() => {
    refreshStreak()
    // Sync from cloud on app start if user is logged in
    // Refresh session token if needed, then sync
    const doSync = async () => {
      try {
        if (isLoggedIn()) {
          syncFromCloud().catch(() => {})
        } else {
          const u = await refreshSession()
          if (u) syncFromCloud().catch(() => {})
        }
      } catch(e) {}
    }
    doSync()

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshStreak()
        // Re-sync when app comes back to foreground
        if (isLoggedIn()) syncFromCloud().catch(() => {})
        
        // AUTO-CHECK for PWA updates whenever app is opened/resumed
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => reg.update()).catch(() => {})
        }
      }
    }

    // Periodic sync every 10 minutes
    const syncInterval = setInterval(() => {
      if (isLoggedIn()) syncFromCloud().catch(() => {})
    }, 10 * 60 * 1000)

    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(syncInterval)
    }
  }, [refreshStreak, syncFromCloud])

  // ── SERVICE WORKER AUTO-UPDATE ──────────────────────────────────────────
  // Using vite-plugin-pwa/react for robust update management
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh:  [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every hour
      r && setInterval(() => { r.update() }, 60 * 60 * 1000)
    },
    onRegisterError(error) {
      console.error('[StudyMate] SW Registration Error:', error)
    }
  })

  return (
    <ErrorBoundary>
      {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
      <BrowserRouter>
        <Router />
      </BrowserRouter>

      {/* Update Available Banner — sticky bottom */}
      {needRefresh && (
        <div style={{
          position:'fixed', bottom:64, left:'50%', transform:'translateX(-50%)',
          width:'90%', maxWidth:400, zIndex:9999,
          background:'#3b82f6', color:'#fff', padding:'12px 16px', borderRadius:16,
          boxShadow:'0 4px 20px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', gap:10,
          animation:'slideUpBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:14, fontWeight:700, margin:0 }}>New version available!</p>
            <p style={{ fontSize:12, opacity:0.9, margin:0 }}>Tap to update and refresh.</p>
          </div>
          <button
            onClick={() => updateServiceWorker(true)}
            style={{
              background:'#fff', border:'none', color:'#3b82f6',
              padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:800,
              cursor:'pointer'
            }}
          >
            Update
          </button>
        </div>
      )}

      {/* Offline Ready Toast — disappears after 3s */}
      {offlineReady && (
        <div 
          onClick={() => setOfflineReady(false)}
          style={{
            position:'fixed', bottom:64, left:'50%', transform:'translateX(-50%)',
            background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', color:'#fff',
            padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:600,
            zIndex:9999, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)'
          }}
        >
          App ready for offline use.
        </div>
      )}


      {/* Sync indicator — subtle, bottom right */}
      {syncing && (
        <div style={{ position:'fixed', bottom:16, right:16, zIndex:9998, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', borderRadius:20, padding:'7px 14px', display:'flex', alignItems:'center', gap:7, pointerEvents:'none' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:'#60a5fa', animation:'syncPulse 1s ease-in-out infinite' }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontFamily:'Inter,sans-serif' }}>Syncing...</span>
        </div>
      )}

      <style>{`
        @keyframes syncPulse { 0%,100%{opacity:0.4;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes slideUpBanner {
          from { opacity:0; transform:translateX(-50%) translateY(20px) }
          to   { opacity:1; transform:translateX(-50%) translateY(0) }
        }
      `}</style>
      <Analytics />
      <PWAInstallPrompt />
    </ErrorBoundary>
  )
}