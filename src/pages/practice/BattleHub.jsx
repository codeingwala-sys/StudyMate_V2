import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import { supabase } from '../../services/supabase'
import Header from '../../components/layout/Header'
import { haptic } from '../../utils/haptics'
import { shareContent } from '../../utils/share'
import { generateQuestionsFromText } from '../../services/ai.service'

export default function BattleHub() {
  const { t } = useTheme()
  const nav = useNavigate()
  const { user } = useAppStore()
  const [activeTab, setActiveTab] = useState('find')
  const [topic, setTopic] = useState('')
  const [showCopied, setShowCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [onlineCount, setOnlineCount] = useState(1)
  const [liveBattles, setLiveBattles] = useState([])

  // ── Sync Presence ───────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel('studymate-lobby', {
      config: { presence: { key: user?.id || 'anon' } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const battles = []
        let count = 0
        Object.values(state).forEach(presences => {
          count += presences.length
          presences.forEach(p => {
            if (p.isHosting && p.battle) {
              battles.push(p.battle)
            }
          })
        })
        setLiveBattles(battles)
        setOnlineCount(count)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            name: user?.name || 'Explorer',
            isHosting: false
          })
        }
      })

    return () => { channel.unsubscribe() }
  }, [user])

  const handleShare = async () => {
    if (!topic.trim()) {
      alert('Enter a topic first! ⚔️')
      return
    }
    const result = await shareContent({
      title: `Study Battle: ${topic}`,
      text: `⚔️ I'm starting a study battle on "${topic}"! Join me on StudyMate AI.`,
      url: window.location.origin + '/practice/battle'
    })
    if (result.method === 'clipboard') {
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    }
  }

  const handleCreate = async () => {
    if (!topic.trim()) return
    setLoading(true)
    haptic.medium()
    try {
      // 1. Generate Questions
      const questions = await generateQuestionsFromText(`Topic: ${topic}. Focus on core concepts. Generate 10 high-quality MCQs.`)
      
      if (!questions || !Array.isArray(questions)) throw new Error('Failed to generate questions')

      // 2. Battle ID
      const battleId = Math.random().toString(36).substring(2, 9)
      
      // 3. Navigate with data
      nav(`/practice/battle/${battleId}`, { 
        state: { 
          topic, 
          questions, 
          isHost: true,
          hostName: user?.name || 'Host'
        } 
      })
    } catch (e) {
      alert('AI is busy! Try a different topic or try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = (battle) => {
    haptic.success()
    nav(`/practice/battle/${battle.id}`, { 
      state: { 
        topic: battle.topic,
        questions: battle.questions,
        isHost: false,
        hostName: battle.hostName
      } 
    })
  }

  return (
    <div style={{ padding:'0 0 80px', height:'100%', display:'flex', flexDirection:'column' }}>
      <Header title="Recall Battles" subtitle="Compete in real-time" back />

      <div style={{ padding:'16px', flex:1 }}>
        <div style={{ display:'flex', background:t.inputBg, borderRadius:12, padding:4, marginBottom:20 }}>
          {['find', 'create'].map(tab => (
            <button
              key={tab}
              onClick={() => { haptic.light(); setActiveTab(tab) }}
              style={{
                flex:1, padding:'8px', borderRadius:8, border:'none',
                background: activeTab===tab ? t.card : 'transparent',
                color: activeTab===tab ? t.text : t.textMuted,
                fontSize:13, fontWeight:700, cursor:'pointer', transition:'all 0.2s'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} Battle
            </button>
          ))}
        </div>

        {activeTab === 'find' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {liveBattles.length === 0 ? (
              <div style={{ marginTop:20, padding:40, borderRadius:24, background:t.card, border:`1px dashed ${t.border}`, textAlign:'center', opacity:0.8 }}>
                <p style={{ fontSize:42, marginBottom:16 }}>⚔️</p>
                <p style={{ fontSize:15, color:t.text, fontWeight:700, marginBottom:8 }}>No battles found</p>
                <p style={{ fontSize:13, color:t.textMuted }}>Be the first to start one!</p>
                <button 
                  onClick={() => setActiveTab('create')}
                  style={{ marginTop:20, padding:'10px 24px', borderRadius:12, background:t.blue, color:'#fff', border:'none', fontWeight:700, cursor:'pointer' }}
                >
                  Create Battle
                </button>
              </div>
            ) : liveBattles.map(b => (
              <div key={b.id} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:'16px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:t.shadow }}>
                <div>
                  <p style={{ fontSize:15, fontWeight:700, color:t.text, marginBottom:4 }}>{b.topic}</p>
                  <p style={{ fontSize:11, color:t.textMuted }}>Host: {b.hostName} • {b.playerCount || 1} online</p>
                </div>
                <button 
                  onClick={() => handleJoin(b)}
                  style={{ padding:'8px 20px', borderRadius:10, background:t.text, color:t.bg, border:'none', fontSize:12, fontWeight:800, cursor:'pointer' }}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:24, padding:32, textAlign:'center', boxShadow:t.shadow }}>
              <div style={{ width:64, height:64, borderRadius:20, background:t.purple + '15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 16px' }}>🏆</div>
              <h3 style={{ fontSize:20, fontWeight:900, color:t.text, marginBottom:8, letterSpacing:'-0.5px' }}>Start a New Battle</h3>
              <p style={{ fontSize:13, color:t.textMuted, marginBottom:24, lineHeight:1.6 }}>Invite friends or open it to the lobby. AI will generate questions instantly based on your topic.</p>
              
              <input 
                placeholder="Topic: e.g. Quantum Physics..." 
                value={topic}
                onChange={e => setTopic(e.target.value)}
                autoFocus
                style={{ width:'100%', padding:16, borderRadius:16, border:`2px solid ${t.border}`, background:t.inputBg, color:t.text, marginBottom:16, outline:'none', fontSize:15, fontWeight:600, boxSizing:'border-box' }}
              />
              <div style={{ display:'flex', gap:10 }}>
                <button 
                  onClick={handleCreate}
                  disabled={loading || !topic.trim()}
                  style={{ flex:2, padding:16, borderRadius:16, background:t.text, color:t.bg, border:'none', fontSize:15, fontWeight:800, cursor:'pointer', opacity:(loading || !topic.trim()) ? 0.6 : 1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                >
                  {loading ? 'Generating...' : 'Start Battle ⚔️'}
                </button>
                <button 
                  onClick={handleShare}
                  style={{ width:56, height:56, borderRadius:16, background:t.inputBg, color:t.text, border:`1px solid ${t.border}`, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                >
                  {showCopied ? '✅' : '🔗'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:20, textAlign:'center', marginTop:'auto' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:24, background:t.card, border:`1px solid ${t.border}`, boxShadow:t.shadow }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:t.green, animation:'pulse 2s infinite' }} />
          <span style={{ fontSize:12, color:t.text, fontWeight:700 }}>{onlineCount} {onlineCount === 1 ? 'student' : 'students'} online</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}
