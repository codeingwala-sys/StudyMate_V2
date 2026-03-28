import { useState, useEffect } from 'react'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'
import { haptic } from '../../utils/haptics'
import { shareContent } from '../../utils/share'

const PRESETS = [25, 45, 60, 90]

export default function StudyBuddies() {
  const { t } = useTheme()
  const { user, settings } = useAppStore()
  
  const [timeLeft, setTimeLeft] = useState((settings?.pomoDuration || 25) * 60)
  const [isActive, setIsActive] = useState(false)
  const [showCopied, setShowCopied] = useState(false)

  // Sync with global settings on mount if not active
  useEffect(() => {
    if (!isActive) {
      setTimeLeft((settings?.pomoDuration || 25) * 60)
    }
  }, [settings?.pomoDuration])

  const handleInvite = async () => {
    const result = await shareContent({
      title: 'Study Buddies Together',
      text: `Hey! I'm using StudyBuddies on StudyMate AI to focus. Join me for a study session! 📚✨`,
      url: window.location.origin + '/practice/study-buddies'
    })
    
    if (result.method === 'clipboard') {
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    }
  }

  useEffect(() => {
    let interval = null
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000)
    } else if (timeLeft === 0) {
      setIsActive(false)
      haptic.success()
      // Notification would go here in full production
    }
    return () => clearInterval(interval)
  }, [isActive, timeLeft])

  const handleStart = () => {
    setIsActive(!isActive)
    haptic.medium()
  }

  const selectPreset = (mins) => {
    if (isActive) return
    haptic.light()
    setTimeLeft(mins * 60)
  }

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

  const currentMins = Math.round(timeLeft / 60)

  return (
    <div className="page-pad anim-up">
      <Header title="Study Buddies" subtitle="Study together" back />
      
      <div style={{ background: t.card, borderRadius: 24, padding: '30px 20px', textAlign: 'center', border: `1px solid ${t.border}`, boxShadow: t.shadow, marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Focus Timer</p>
        <h1 style={{ fontSize: 72, fontWeight: 900, color: t.text, fontFamily: 'DM Mono, monospace', margin: '4px 0', letterSpacing: '-2px' }}>{formatTime(timeLeft)}</h1>
        <p style={{ fontSize: 13, color: isActive ? t.green : t.textMuted, fontWeight: 600, marginBottom: 24, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
          {isActive ? <><span style={{ width:6, height:6, borderRadius:'50%', background:t.green, animation:'pulse 1.5s infinite' }} /> Session: Focus</> : 'Ready to study?'}
        </p>
        
        {/* Presets */}
        {!isActive && (
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:24 }}>
            {PRESETS.map(p => (
              <button 
                key={p} 
                onClick={() => selectPreset(p)}
                style={{
                  padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                  background: currentMins === p ? t.text : 'transparent',
                  color: currentMins === p ? t.bg : t.textMuted,
                  border: `1px solid ${currentMins === p ? t.text : t.border}`,
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {p}m
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={handleStart} style={{ padding: '14px 40px', borderRadius: 16, background: t.text, color: t.bg, border: 'none', fontWeight: 800, fontSize:15, cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            {isActive ? 'Pause' : 'Start Focus'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Session Info</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.card, padding: 14, borderRadius: 18, border: `1px solid ${t.border}` }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: t.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize:18 }}>{user?.name?.charAt(0) || 'S'}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{user?.name || 'Student'}</p>
            <p style={{ fontSize: 12, color: isActive ? t.green : t.textMuted, fontWeight: 500 }}>{isActive ? 'Deep Work Session' : 'Ready to begin'}</p>
          </div>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: isActive ? t.green : t.border }} />
        </div>
      </div>

      <button 
        onClick={handleInvite}
        className="pressable"
        style={{ 
          width: '100%', marginTop: 24, padding: 16, borderRadius: 18, 
          background: t.inputBg, color: t.text, border: `1px solid ${t.border}`, 
          fontWeight: 700, fontSize:14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 
        }}
      >
        {showCopied ? 'Invite Link Copied! ✅' : <>Invite a Focus Friend 🔗</>}
      </button>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
      `}</style>
    </div>
  )
}
