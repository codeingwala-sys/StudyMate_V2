import { useState, useEffect } from 'react'
import { useTheme } from '../app/useTheme'
import { haptic } from '../utils/haptics'

export default function PWAInstallPrompt() {
  const { t } = useTheme()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Check if already installed
      if (window.matchMedia('(display-mode: standalone)').matches) return
      // Show prompt after 10 seconds of usage
      setTimeout(() => setShow(true), 10000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    haptic.medium()
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      // User accepted
    }
    setDeferredPrompt(null)
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{ 
      position:'fixed', bottom:90, left:16, right:16, zIndex:1000,
      background:t.card, border:`1px solid ${t.border}`, borderRadius:20,
      padding:'16px', boxShadow:t.shadow, display:'flex', alignItems:'center', gap:14,
      animation:'slideInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div style={{ width:48, height:48, borderRadius:14, background:t.blue + '15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>📱</div>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:14, fontWeight:700, color:t.text, marginBottom:2 }}>Install StudyMate</p>
        <p style={{ fontSize:11, color:t.textMuted, lineHeight:1.4 }}>Add to home screen for a better offline experience & quick access.</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        <button onClick={handleInstall} style={{ padding:'8px 16px', borderRadius:10, background:t.text, color:t.bg, border:'none', fontSize:12, fontWeight:700, cursor:'pointer' }}>Install</button>
        <button onClick={() => setShow(false)} style={{ padding:'4px', background:'none', border:'none', color:t.textFaint, fontSize:10, fontWeight:600, cursor:'pointer' }}>Maybe later</button>
      </div>

      <style>{`
        @keyframes slideInUp { from { transform: translateY(100px); opacity:0 } to { transform: translateY(0); opacity:1 } }
      `}</style>
    </div>
  )
}
