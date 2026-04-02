import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import { haptic } from '../../utils/haptics'
import Header from '../../components/layout/Header'
import { useBattleRoom } from '../../services/multiplayer'

export default function BattleSession() {
  const { id: battleId } = useParams()
  const { state } = useLocation()
  const nav = useNavigate()
  const { t } = useTheme()
  const { user } = useAppStore()

  const isHost = state?.isHost || false

  // ── Supabase Realtime Integration ───────────────────────────────────────
  const { battle, startBattle: triggerStart, updateScore, nextQuestion } = useBattleRoom(
    battleId, 
    user, 
    isHost, 
    state?.topic, 
    state?.questions
  )

  const [answered, setAnswered] = useState(false)
  const [selectedOpt, setSelectedOpt] = useState(null)
  const [timeLeft, setTimeLeft] = useState(15)
  
  const timerRef = useRef(null)

  const currentIdx = battle?.currentQuestion || 0
  const gameStatus = battle?.status || 'waiting'
  const questions = battle?.questions || []
  const topic = battle?.topic || 'Knowledge Battle'
  const sortedPlayers = [...(battle?.players || [])].sort((a, b) => b.score - a.score)
  const currentQ = (questions && questions.length > 0 && currentIdx < questions.length) 
    ? questions[currentIdx] 
    : { q: 'Loading...', options: ['...', '...', '...', '...'], answer: 0 }

  // ── Timer Logic ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameStatus === 'active' && !answered) {
      if (timerRef.current) clearInterval(timerRef.current)
      setTimeLeft(15)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            if (!answered) handleAnswer(-1)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus, currentIdx, answered])

  // Reset answered state when question changes
  useEffect(() => {
    setAnswered(false)
    setSelectedOpt(null)
  }, [currentIdx])

  const handleAnswer = (optIdx) => {
    if (answered || gameStatus !== 'active') return
    setAnswered(true)
    setSelectedOpt(optIdx)
    haptic.light()

    const correct = optIdx === currentQ.answer
    const points = correct ? Math.max(10, timeLeft * 10) : 0

    updateScore(points)

    if (correct) haptic.success(); else haptic.notification('error')

    // If Host, wait a bit then go to next
    if (isHost) {
      setTimeout(() => {
        nextQuestion()
      }, 3000)
    }
  }

  const startBattle = () => {
    if (!isHost) return
    triggerStart()
  }

  if (!battle) return <div style={{ padding:40, textAlign:'center', color:t.text }}>Loading Battle...</div>

  return (
    <div style={{ padding:'0 0 80px', minHeight:'100vh', display:'flex', flexDirection:'column', background:t.bg }}>
      <Header title={topic} subtitle={gameStatus === 'active' ? `Question ${currentIdx + 1}/${questions.length}` : 'Multiplayer Battle'} back />

      <main style={{ flex:1, padding:'16px', display:'flex', flexDirection:'column', gap:20 }}>
        
        {/* Waiting Room */}
        {gameStatus === 'waiting' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:24 }}>
            <motion.div animate={{ scale:[1, 1.1, 1] }} transition={{ repeat:Infinity, duration:2 }} style={{ fontSize:64 }}>⚔️</motion.div>
            <div>
              <h2 style={{ fontSize:26, fontWeight:900, color:t.text, marginBottom:10, letterSpacing:'-0.5px' }}>Waiting for players...</h2>
              <p style={{ fontSize:14, color:t.textMuted }}>Battle Topic: <b>{topic}</b></p>
            </div>
            
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center' }}>
              {battle.players.map(p => (
                <div key={p.id} style={{ background:t.card, padding:'12px 20px', borderRadius:20, border:`1px solid ${t.border}`, fontSize:14, fontWeight:750, color:t.text, boxShadow:t.shadow }}>
                   {p.isHost ? '👑 ' : ''}{p.name}
                </div>
              ))}
            </div>

            {isHost ? (
              <button 
                onClick={startBattle}
                style={{ padding:'18px 56px', borderRadius:20, background:t.text, color:t.bg, border:'none', fontSize:18, fontWeight:900, cursor:'pointer', boxShadow:'0 10px 40px rgba(0,0,0,0.3)', marginTop:20 }}
              >
                Start Game
              </button>
            ) : (
              <p style={{ fontSize:14, color:t.textMuted, fontStyle:'italic', marginTop:20 }}>The host will start the battle shortly.</p>
            )}
          </div>
        )}

        {/* Playing State */}
        {gameStatus === 'active' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
            {/* Timer & Progress */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ flex:1, height:6, background:t.border, borderRadius:3, overflow:'hidden' }}>
                <motion.div 
                  initial={{ width:'100%' }}
                  animate={{ width:`${(timeLeft / 15) * 100}%` }}
                  transition={{ duration:1, ease:'linear' }}
                  style={{ height:'100%', background: timeLeft > 5 ? t.blue : '#f87171' }}
                />
              </div>
              <span style={{ fontSize:14, fontWeight:800, color: timeLeft > 5 ? t.text : '#f87171', minWidth:30, textAlign:'right', fontFamily:'DM Mono,monospace' }}>{timeLeft}s</span>
            </div>

            {/* Question Card */}
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentIdx}
                initial={{ opacity:0, y:20 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-20 }}
                style={{ background:t.card, padding:'32px 24px', borderRadius:24, border:`1px solid ${t.border}`, boxShadow:t.shadow, position:'relative', minHeight:160, display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center' }}
              >
                <h2 style={{ fontSize:22, fontWeight:800, color:t.text, lineHeight:1.3 }}>{currentQ.q}</h2>
              </motion.div>
            </AnimatePresence>

            {/* Options */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {currentQ.options.map((opt, optIdx) => {
                const isSelected = selectedOpt === optIdx
                const isCorrect = optIdx === currentQ.answer
                let bg = t.card, border = t.border, color = t.text, opacity = 1
                
                if (answered) {
                  if (isCorrect) { bg = 'rgba(74,222,128,0.15)'; border = '#4ade80'; color = '#4ade80' }
                  else if (isSelected) { bg = 'rgba(248,113,113,0.15)'; border = '#f87171'; color = '#f87171' }
                  else { opacity = 0.5 }
                } else if (isSelected) {
                  bg = t.blue + '15'; border = t.blue;
                }

                return (
                  <motion.button
                    disabled={answered}
                    key={optIdx}
                    whileTap={{ scale:0.98 }}
                    onClick={() => handleAnswer(optIdx)}
                    style={{ 
                      padding:'18px 20px', borderRadius:18, background:bg, border:`2px solid ${border}`, 
                      color:color, fontSize:15, fontWeight:700, cursor:answered ? 'default' : 'pointer',
                      display:'flex', alignItems:'center', gap:14, transition:'all 0.2s', textAlign:'left', opacity
                    }}
                  >
                    <span style={{ width:28, height:28, borderRadius:8, background:t.inputBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800 }}>{String.fromCharCode(65+optIdx)}</span>
                    <span style={{ flex:1 }}>{opt}</span>
                    {answered && isCorrect && <span style={{ fontSize:18 }}>✓</span>}
                  </motion.button>
                )
              })}
            </div>

            {/* Mini Leaderboard */}
            <div style={{ marginTop:'auto', padding:'16px', background:t.inputBg, borderRadius:20, border:`1px solid ${t.border}` }}>
              <p style={{ fontSize:11, fontWeight:700, color:t.textMuted, textTransform:'uppercase', letterSpacing:'1px', marginBottom:12 }}>Live Standings</p>
              <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4 }}>
                {sortedPlayers.map((p, i) => (
                  <div key={p.id} style={{ flexShrink:0, background:t.card, padding:'8px 14px', borderRadius:12, border:`1px solid ${t.border}`, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:t.textMuted }}>#{i+1}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:t.text }}>{p.name}</span>
                    <span style={{ fontSize:13, fontWeight:800, color:t.blue }}>{p.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Finished State */}
        {gameStatus === 'finished' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', gap:32 }}>
            <div style={{ position:'relative' }}>
              <motion.div initial={{ scale:0 }} animate={{ scale:1 }} style={{ fontSize:80 }}>🏆</motion.div>
              <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:10, ease:'linear' }} style={{ position:'absolute', top:-10, left:-10, right:-10, bottom:-10, border:`2px dashed ${t.blue}`, borderRadius:'50%', opacity:0.3 }} />
            </div>

            <div>
              <h2 style={{ fontSize:32, fontWeight:900, color:t.text, marginBottom:8 }}>Battle Finished!</h2>
              <p style={{ fontSize:15, color:t.textMuted }}>Great job on <b>{topic}</b></p>
            </div>

            <div style={{ width:'100%', maxWidth:340, display:'flex', flexDirection:'column', gap:12 }}>
              {sortedPlayers.map((p, i) => (
                <motion.div 
                  initial={{ opacity:0, x:-20 }}
                  animate={{ opacity:1, x:0 }}
                  transition={{ delay: i * 0.1 }}
                  key={p.id} 
                  style={{ 
                    background: i === 0 ? t.blue + '10' : t.card, 
                    padding:'16px 20px', borderRadius:20, 
                    border:`1px solid ${i === 0 ? t.blue : t.border}`, 
                    display:'flex', alignItems:'center', gap:16, boxShadow:t.shadow
                  }}
                >
                  <span style={{ fontSize:18, fontWeight:900, color: i === 0 ? t.blue : t.textMuted, width:24 }}>{i+1}</span>
                  <div style={{ flex:1, textAlign:'left' }}>
                    <p style={{ fontSize:15, fontWeight:850, color:t.text }}>{p.name}</p>
                    <p style={{ fontSize:12, color:t.textMuted }}>{p.score} Total Points</p>
                  </div>
                  {i === 0 && <span style={{ fontSize:20 }}>👑</span>}
                </motion.div>
              ))}
            </div>

            <button 
              onClick={() => nav('/practice')}
              style={{ width:'100%', padding:'18px', borderRadius:20, background:t.text, color:t.bg, border:'none', fontSize:16, fontWeight:800, cursor:'pointer', marginTop:10 }}
            >
              Back to Practice Hub
            </button>
          </div>
        )}

      </main>

      <style>{`
        ::-webkit-scrollbar { display: none; }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}



