import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import { supabase } from '../../services/supabase'
import { haptic } from '../../utils/haptics'
import Header from '../../components/layout/Header'

export default function BattleSession() {
  const { id: battleId } = useParams()
  const { state } = useLocation()
  const nav = useNavigate()
  const { t } = useTheme()
  const { user } = useAppStore()

  // Room State
  const [topic] = useState(state?.topic || 'Knowledge Battle')
  const [questions] = useState(state?.questions || [])
  const [isHost] = useState(state?.isHost || false)
  const [hostName] = useState(state?.hostName || 'Host')
  
  const [currentIdx, setCurrentIdx] = useState(0)
  const [scores, setScores] = useState({}) // { userId: { name, score, lastAnswer } }
  const [answered, setAnswered] = useState(false)
  const [selectedOpt, setSelectedOpt] = useState(null)
  const [timeLeft, setTimeLeft] = useState(15)
  const [gameStatus, setGameStatus] = useState('waiting') // 'waiting', 'playing', 'finished'
  
  const channelRef = useRef(null)
  const timerRef = useRef(null)

  // ── Realtime Setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!battleId) return

    const channel = supabase.channel(`battle-${battleId}`, {
      config: { presence: { key: user?.id || 'anon' } }
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState()
        const newScores = {}
        Object.values(presenceState).forEach(presences => {
          presences.forEach(p => {
            newScores[p.id || p.user_id] = {
              name: p.name || 'Anonymous',
              score: p.score || 0,
              lastAnswer: p.lastAnswer || null,
              isHost: p.isHost || false
            }
          })
        })
        setScores(newScores)
      })
      .on('broadcast', { event: 'next-question' }, ({ payload }) => {
        setCurrentIdx(payload.index)
        setAnswered(false)
        setSelectedOpt(null)
        setTimeLeft(15)
        setGameStatus('playing')
        haptic.light()
      })
      .on('broadcast', { event: 'game-over' }, () => {
        setGameStatus('finished')
        haptic.success()
      })
      .on('broadcast', { event: 'start-game' }, () => {
         setGameStatus('playing')
         setTimeLeft(15)
         haptic.medium()
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track self in presence
          await channel.track({
            id: user?.id || 'anon',
            name: user?.name || 'Explorer',
            score: 0,
            isHost
          })

          // If I am the host, I tell the lobby I am hosting
          if (isHost) {
            const lobby = supabase.channel('studymate-lobby')
            lobby.subscribe(async (s) => {
              if (s === 'SUBSCRIBED') {
                await lobby.track({
                  isHosting: true,
                  battle: { id: battleId, topic, questions, hostName: user?.name || 'Host', playerCount: 1 }
                })
              }
            })
          }
        }
      })

    return () => { 
      channel.unsubscribe()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [battleId, user, isHost, topic, questions])

  // ── Timer Logic (Host only or local sync) ──────────────────────────────────
  useEffect(() => {
    if (gameStatus === 'playing' && !answered) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [gameStatus, currentIdx, answered])

  const handleAutoSubmit = () => {
    if (!answered) handleAnswer(-1)
  }

  const handleAnswer = async (optIdx) => {
    if (answered) return
    setAnswered(true)
    setSelectedOpt(optIdx)
    haptic.light()

    const correct = questions[currentIdx].answer === optIdx
    const points = correct ? Math.max(10, timeLeft * 10) : 0

    // Update Presence with new score
    const myPresence = scores[user?.id || 'anon'] || {}
    const newTotal = (myPresence.score || 0) + points

    await channelRef.current.track({
      id: user?.id || 'anon',
      name: user?.name || 'Explorer',
      score: newTotal,
      lastAnswer: optIdx,
      isHost
    })

    if (correct) haptic.success(); else haptic.notification('error')

    // If Host, wait a bit then go to next
    if (isHost) {
      setTimeout(() => {
        if (currentIdx < questions.length - 1) {
          const next = currentIdx + 1
          channelRef.current.send({
            type: 'broadcast',
            event: 'next-question',
            payload: { index: next }
          })
          // Local update for host
          setCurrentIdx(next)
          setAnswered(false)
          setSelectedOpt(null)
          setTimeLeft(15)
        } else {
          channelRef.current.send({ type: 'broadcast', event: 'game-over' })
          setGameStatus('finished')
        }
      }, 3000)
    }
  }

  const startBattle = async () => {
    if (!isHost) return
    channelRef.current.send({ type: 'broadcast', event: 'start-game' })
    setGameStatus('playing')
    setTimeLeft(15)
  }

  const sortedPlayers = Object.values(scores).sort((a, b) => b.score - a.score)
  const currentQ = questions[currentIdx]

  if (!questions.length) return <div style={{ padding:40, textAlign:'center', color:t.text }}>Loading Battle...</div>

  return (
    <div style={{ padding:'0 0 80px', minHeight:'100vh', display:'flex', flexDirection:'column', background:t.bg }}>
      <Header title={topic} subtitle={gameStatus === 'playing' ? `Question ${currentIdx + 1}/${questions.length}` : 'Multiplayer Battle'} back />

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
              {Object.values(scores).map(p => (
                <div key={p.name} style={{ background:t.card, padding:'12px 20px', borderRadius:20, border:`1px solid ${t.border}`, fontSize:14, fontWeight:750, color:t.text, boxShadow:t.shadow }}>
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
        {gameStatus === 'playing' && currentQ && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
            {/* Timer & Players */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
               <div style={{ display:'flex', gap:6 }}>
                  {sortedPlayers.slice(0, 3).map((p, i) => (
                    <div key={p.name} style={{ width:36, height:36, borderRadius:12, background: i===0 ? '#fbbf24' : i===1 ? '#94a3b8' : '#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#fff', border:`3px solid ${t.bg}`, boxShadow:t.shadow }}>
                      {p.name.charAt(0)}
                    </div>
                  ))}
               </div>
               <div style={{ textAlign:'right' }}>
                 <p style={{ fontSize:11, fontWeight:900, color:t.textMuted, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:4 }}>TIMER</p>
                 <h2 style={{ fontSize:42, fontWeight:900, color: timeLeft < 5 ? '#ef4444' : t.text, margin:0, fontFamily:'DM Mono, monospace', lineHeight:1 }}>{timeLeft}</h2>
               </div>
            </div>

            {/* Question Card */}
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentIdx}
                initial={{ opacity:0, scale:0.95 }} 
                animate={{ opacity:1, scale:1 }} 
                exit={{ opacity:0, scale:0.95 }}
                style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:28, padding:'32px 24px', boxShadow:t.shadow, position:'relative' }}
              >
                <div style={{ position:'absolute', top:-12, left:24, background:t.blue, color:'#fff', padding:'4px 12px', borderRadius:10, fontSize:11, fontWeight:800 }}>QUESTION {currentIdx + 1}</div>
                <p style={{ fontSize:19, fontWeight:800, color:t.text, lineHeight:1.5, marginBottom:28, fontFamily:'Inter, sans-serif' }}>{currentQ.q}</p>
                
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {currentQ.options.map((opt, i) => {
                    const isCorrect = currentQ.answer === i
                    const isSelected = selectedOpt === i
                    let bg = t.inputBg, border = t.border, color = t.text
                    
                    if (answered) {
                      if (isCorrect) { bg = '#22c55e20'; border = '#22c55e'; color = '#22c55e' }
                      else if (isSelected) { bg = '#ef444420'; border = '#ef4444'; color = '#ef4444' }
                    } else if (isSelected) {
                      bg = t.text; color = t.bg
                    }

                    return (
                      <button 
                        key={i}
                        onClick={() => handleAnswer(i)}
                        disabled={answered}
                        style={{ width:'100%', padding:'18px 24px', borderRadius:18, background:bg, border:`2.5px solid ${border}`, color, fontSize:15, fontWeight:800, textAlign:'left', transition:'all 0.2s', cursor:answered ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:14 }}
                      >
                        <div style={{ width:26, height:26, borderRadius:8, background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>{String.fromCharCode(65+i)}</div>
                        <span style={{ flex:1 }}>{opt}</span>
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Live Leaderboard Footer */}
            <div style={{ background:t.card + '90', borderRadius:24, padding:'16px 20px', display:'flex', alignItems:'center', gap:12, marginTop:'auto', border:`1px solid ${t.border}`, backdropFilter:'blur(12px)', boxShadow:t.shadow }}>
               <div style={{ display:'flex', alignItems:'center', gap:6, paddingRight:12, borderRight:`1px solid ${t.border}` }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', animation:'pulse 1.5s infinite' }} />
                  <span style={{ fontSize:11, fontWeight:900, color:t.textMuted, textTransform:'uppercase' }}>LIVE</span>
               </div>
               <div style={{ flex:1, display:'flex', gap:24, overflowX:'auto' }}>
                  {sortedPlayers.map((p, idx) => (
                    <div key={p.name} style={{ display:'flex', alignItems:'center', gap:8, whiteSpace:'nowrap' }}>
                      <span style={{ fontSize:14, fontWeight:800, color: idx===0 ? '#fbbf24' : t.text }}>{p.name}</span>
                      <span style={{ fontSize:14, fontWeight:900, color:t.blue, opacity:0.9 }}>{p.score}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* Result State */}
        {gameStatus === 'finished' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:28, paddingBottom:40 }}>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:64, marginBottom:16 }}>🏆</p>
              <h2 style={{ fontSize:32, fontWeight:900, color:t.text, letterSpacing:'-1px', marginBottom:8, lineHeight:1 }}>Battle Finished!</h2>
              <p style={{ fontSize:15, color:t.textMuted }}>Great competition on {topic}</p>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
               {sortedPlayers.map((p, i) => (
                 <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.1 }} key={p.name} style={{ background:t.card, border:`1px solid ${i===0?t.amber:t.border}`, borderRadius:24, padding:'20px 24px', display:'flex', alignItems:'center', gap:20, boxShadow:t.shadow }}>
                    <div style={{ width:44, height:44, borderRadius:14, background: i===0 ? '#fbbf24' : t.inputBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color: i===0 ? '#000' : t.textMuted }}>
                      {i + 1}
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:17, fontWeight:800, color:t.text, margin:0 }}>{p.name} {p.id === user?.id ? '(You)' : ''}</p>
                      <p style={{ fontSize:12, color:t.textMuted, margin:'2px 0 0' }}>{p.score} points earned</p>
                    </div>
                    <div style={{ textAlign:'right' }}>
                       <span style={{ fontSize:22, fontWeight:950, color: i===0 ? '#fbbf24' : t.blue }}>#{i+1}</span>
                    </div>
                 </motion.div>
               ))}
            </div>

            <button 
              onClick={() => nav('/practice/battle')}
              style={{ width:'100%', padding:'20px', borderRadius:20, background:t.text, color:t.bg, border:'none', fontSize:17, fontWeight:900, cursor:'pointer', marginTop:20, boxShadow:'0 10px 30px rgba(0,0,0,0.2)' }}
            >
              Finish Battle
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
