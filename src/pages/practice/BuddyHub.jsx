import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'
import { haptic } from '../../utils/haptics'
import { shareContent } from '../../utils/share'
import { useLiveBuddies } from '../../services/multiplayer'

const PRESETS = [25, 45, 60, 90]
const EMOJIS = ['👏', '🔥', '❤️', '🚀', '💯']

export default function StudyBuddies() {
  const { isDark, t } = useTheme()
  const { user, settings } = useAppStore()
  const nav = useNavigate()
  
  const [timeLeft, setTimeLeft] = useState((settings?.pomoDuration || 25) * 60)
  const [isActive, setIsActive] = useState(false)
  const [showCopied, setShowCopied] = useState(false)
  
  // Floating emojis state
  const [floatingEmojis, setFloatingEmojis] = useState([])
  
  // useLiveBuddies callback for emojis
  const handleEmojiReceived = (data) => {
    const newEmoji = {
      id: Date.now() + Math.random(),
      emoji: data.emoji,
      from: data.from,
      x: Math.random() * 80 + 10,
      isSelf: data.isSelf
    }
    setFloatingEmojis(prev => [...prev, newEmoji])
    if (!data.isSelf) haptic.light()
    // Remove after animation (3.5s)
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== newEmoji.id))
    }, 3500)
  }

  const { buddies, sendEmoji } = useLiveBuddies(user, isActive, Math.round(timeLeft / 60), handleEmojiReceived)
  const activeBuddies = buddies || []

  // Sync with global settings on mount if not active
  useEffect(() => {
    if (!isActive) setTimeLeft((settings?.pomoDuration || 25) * 60)
  }, [settings?.pomoDuration, isActive])

  const handleInvite = async () => {
    const result = await shareContent({
      title: 'Study Buddies Together',
      text: "Hey! I'm using StudyBuddies on StudyMate AI to focus. Join me for a study session! 📚✨",
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
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false)
      haptic.success()
    }
    return () => { if (interval) clearInterval(interval) }
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

  const triggerEmoji = (emoji) => {
    haptic.selection()
    sendEmoji(emoji)
  }

  if (!user?.id && !settings) return <div style={{ padding:40, textAlign:'center', color:t.text }}>Connecting to StudyMate...</div>

  const formatTime = (s) => `${Math.floor(s/60)}:${((s%60) || 0).toString().padStart(2,'0')}`
  const currentMins = Math.round(timeLeft / 60)

  return (
    <div className="page-pad anim-up" style={{ minHeight: '100dvh', background: isActive ? '#050a14' : t.bg, transition: 'background 0.8s ease', overflow: 'hidden', position: 'relative' }}>
      
      {/* Interactive Background Canvas */}
      {isActive && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '10%', left: '20%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(96,165,250,0.1) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'floatBubble 15s ease-in-out infinite alternate' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%)', filter: 'blur(50px)', animation: 'floatBubble 20s ease-in-out infinite alternate-reverse' }} />
        </div>
      )}

      {/* Floating Emojis Layer */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
        {floatingEmojis.map(item => (
          <div key={item.id} style={{
            position: 'absolute',
            bottom: '10%',
            left: `${item.x}%`,
            fontSize: 32,
            animation: `floatUp 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
            filter: item.isSelf ? 'none' : 'drop-shadow(0 0 10px rgba(255,255,255,0.4))'
          }}>
            {item.emoji}
            {!item.isSelf && <div style={{ fontSize: 10, color: '#fff', textAlign: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 4px', marginTop: -5 }}>{item.from}</div>}
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        <Header title="Study Buddies" subtitle="Study together" back />
        
        {/* TIMER CARD */}
        <div style={{ 
          background: isActive ? 'rgba(255,255,255,0.03)' : t.card, 
          backdropFilter: isActive ? 'blur(20px)' : 'none',
          borderRadius: 28, padding: '30px 20px 40px', textAlign: 'center', 
          border: `1px solid ${isActive ? 'rgba(255,255,255,0.08)' : t.border}`, 
          boxShadow: isActive ? '0 16px 40px rgba(0,0,0,0.4)' : t.shadow, 
          marginBottom: 32, transition: 'all 0.5s ease', position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Glowing Timer Backing when active */}
          {isActive && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 250, height: 250, background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 60%)', filter: 'blur(20px)', zIndex: 0 }} />}
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.5)' : t.textMuted, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Focus Timer</p>
            
            <h1 style={{ 
              fontSize: 84, fontWeight: 900, 
              color: isActive ? '#fff' : t.text, 
              fontFamily: 'DM Mono, monospace', margin: '4px 0', letterSpacing: '-2px',
              textShadow: isActive ? '0 0 30px rgba(96,165,250,0.5)' : 'none'
            }}>{formatTime(timeLeft)}</h1>

            <p style={{ fontSize: 13, color: isActive ? '#4ade80' : t.textMuted, fontWeight: 600, marginBottom: 24, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              {isActive ? <><span style={{ width:8, height:8, borderRadius:'50%', background:'#4ade80', animation:'pulseFast 1s infinite', boxShadow: '0 0 10px #4ade80' }} /> Session Active</> : 'Ready to begin?'}
            </p>
            
            {/* Presets */}
            {!isActive && (
              <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:32 }}>
                {PRESETS.map(p => (
                  <button 
                    key={p} onClick={() => selectPreset(p)}
                    style={{
                      padding: '8px 16px', borderRadius: 14, fontSize: 13, fontWeight: 700,
                      background: currentMins === p ? t.text : t.inputBg,
                      color: currentMins === p ? t.bg : t.textMuted,
                      border: `1px solid ${currentMins === p ? t.text : 'transparent'}`,
                      cursor: 'pointer', transition: 'all 0.2s', boxShadow: currentMins === p ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {p}m
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={handleStart} style={{ 
                padding: '16px 44px', borderRadius: 40, 
                background: isActive ? 'rgba(255,255,255,0.1)' : t.text, 
                color: isActive ? '#fff' : t.bg, 
                border: isActive ? '1px solid rgba(255,255,255,0.2)' : 'none', 
                fontWeight: 800, fontSize:16, cursor: 'pointer', 
                boxShadow: isActive ? 'none' : '0 8px 24px rgba(0,0,0,0.25)',
                transition: 'all 0.3s ease'
              }}>
                {isActive ? 'Pause Session' : 'Start Focus'}
              </button>
            </div>
          </div>
        </div>

        {/* STATUS & BUDDIES AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Reaction Bar (Visible when active) */}
          {isActive  && (
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', padding: '12px 20px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)' }}>
              {EMOJIS.map(em => (
                <button key={em} onClick={() => triggerEmoji(em)} className="pressable" style={{ background:'none', border:'none', fontSize: 24, cursor: 'pointer', transform: 'scale(1)', transition: 'transform 0.1s' }}>
                  {em}
                </button>
              ))}
            </div>
          )}

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'rgba(255,255,255,0.4)' : t.textMuted, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12 }}>Personal Status</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: isActive ? 'rgba(255,255,255,0.04)' : t.card, backdropFilter: isActive ? 'blur(10px)' : 'none', padding: 16, borderRadius: 20, border: `1px solid ${isActive ? 'rgba(255,255,255,0.08)' : t.border}` }}>
              <div style={{ position: 'relative' }}>
                {isActive && <div style={{ position:'absolute', inset:-6, borderRadius:'50%', border:'2px solid rgba(59,130,246,0.3)', animation:'ripple 2s linear infinite' }} />}
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: t.blue, display: 'flex', alignItems: 'center', justifyContent:'center', color: '#fff', fontWeight: 800, fontSize:18, border: isActive ? '2px solid rgba(96,165,250,0.8)' : 'none', zIndex: 2, position: 'relative', boxShadow: isActive ? '0 0 15px rgba(59,130,246,0.5)' : 'none' }}>
                  {user?.name?.charAt(0) || 'S'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: isActive ? '#fff' : t.text }}>{user?.name || 'Student'}</p>
                <p style={{ fontSize: 12, color: isActive ? '#4ade80' : t.textMuted, fontWeight: 500 }}>{isActive ? 'Deep Work Session' : 'Ready to begin'}</p>
              </div>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'rgba(255,255,255,0.4)' : t.textMuted, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12 }}>Live Buddies ({activeBuddies.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeBuddies.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: isActive ? 'rgba(255,255,255,0.02)' : t.inputBg, borderRadius: 20, border: `1px dashed ${isActive ? 'rgba(255,255,255,0.1)' : t.border}` }}>
                  <p style={{ fontSize: 13, color: isActive ? 'rgba(255,255,255,0.5)' : t.textMuted }}>No focus buddies online yet.<br/>Invite a friend to stay accountable!</p>
                </div>
              ) : (
                activeBuddies.map(s => (
                  <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: isActive ? 'rgba(255,255,255,0.04)' : t.card, backdropFilter: isActive ? 'blur(10px)' : 'none', padding: '12px 16px', borderRadius: 16, border: `1px solid ${isActive ? 'rgba(255,255,255,0.08)' : t.border}` }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position:'absolute', inset:-4, borderRadius:'50%', border:'1.5px solid rgba(167,139,250,0.3)', animation:'ripple 2.5s linear infinite', animationDelay: '0.5s' }} />
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: t.purple, display: 'flex', alignItems: 'center', justifyContent:'center', color: '#fff', fontWeight: 800, fontSize:15, zIndex: 2, position: 'relative' }}>{s.userName.charAt(0)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: isActive ? '#fff' : t.text }}>{s.userName}</p>
                      <p style={{ fontSize: 11, color: isActive ? '#A78BFA' : t.purple, fontWeight: 600 }}>Focusing: {s.duration}m</p>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={handleInvite}
          className="pressable"
          style={{ 
            width: '100%', marginTop: 32, padding: 16, borderRadius: 20, 
            background: isActive ? 'rgba(255,255,255,0.05)' : t.inputBg, 
            color: isActive ? '#fff' : t.text, 
            border: `1px solid ${isActive ? 'rgba(255,255,255,0.1)' : t.border}`, 
            fontWeight: 700, fontSize:14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            backdropFilter: 'blur(10px)'
          }}
        >
          {showCopied ? 'Invite Link Copied! ✅' : <>Invite a Focus Friend 🔗</>}
        </button>
      </div>

      <style>{`
        @keyframes pulseFast { 0%, 100% { opacity: 0.6; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes floatBubble { 0% { transform: translateY(0) scale(1); } 100% { transform: translateY(-30px) scale(1.05); } }
        @keyframes floatUp { 
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; } 
          100% { transform: translateY(-300px) scale(1.5) rotate(20deg); opacity: 0; } 
        }
        @keyframes ripple { 
          0% { transform: scale(1); opacity: 0.8; } 
          100% { transform: scale(1.6); opacity: 0; } 
        }
      `}</style>
    </div>
  )
}
