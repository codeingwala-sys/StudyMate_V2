import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../app/useTheme'
import Header from '../../components/layout/Header'
import { generateSocraticResponse } from '../../services/ai.service'
import { useAppStore } from '../../app/store'
import { haptic } from '../../utils/haptics'

export default function SocraticViva() {
  const { t } = useTheme()
  const { notes } = useAppStore()
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  const handleStart = async () => {
    if (!topic.trim()) return
    setStarted(true)
    setLoading(true)
    try {
      const firstMsg = { role: 'assistant', content: `Welcome to your Socratic Viva on "${topic}". I'll be testing your depth of knowledge today. Let's begin: How would you describe the fundamental mechanism of "${topic}"?` }
      setMessages([firstMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    haptic.light()

    try {
      const resp = await generateSocraticResponse(newMessages, subject || 'General', topic, noteContent)
      setMessages([...newMessages, { role: 'assistant', content: resp }])
      haptic.medium()
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: "I'm sorry, I encountered an issue. Let's try that again." }])
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceSend = async (voiceText) => {
    if (!voiceText.trim() || loading) return
    const userMsg = { role:'user', content: voiceText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)
    haptic.light()
    try {
      const resp = await generateSocraticResponse(newMessages, subject || 'General', topic, noteContent)
      setMessages([...newMessages, { role: 'assistant', content: resp }])
      haptic.medium()
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: "Something went wrong. Could you say that once more?" }])
    } finally {
      setLoading(false)
    }
  }

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onstart = () => {
      setIsListening(true)
      haptic.light()
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      if (transcript) {
        handleVoiceSend(transcript)
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  if (!started) {
    return (
      <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
        <Header title="Socratic Viva" back />
        <div style={{ padding:20, flex:1, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', textAlign:'center' }}>
          <div style={{ width:80, height:80, borderRadius:24, background:t.blue + '20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40, marginBottom:20 }}>🤔</div>
          <h2 style={{ fontSize:22, fontWeight:800, color:t.text, marginBottom:10 }}>Deep Learning</h2>
          <p style={{ fontSize:14, color:t.textMuted, marginBottom:30, maxWidth:280, lineHeight:1.5 }}>
            Master any topic through interactive questioning. I won't give you answers—I'll help you find them.
          </p>
          
          <div style={{ width:'100%', maxWidth:320, display:'flex', flexDirection:'column', gap:12 }}>
            <button 
              onClick={() => setShowNotePicker(true)}
              style={{ padding:14, borderRadius:12, border:`1px solid ${t.border}`, background:t.card, color:t.text, fontSize:14, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:8, cursor:'pointer' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.blue} strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {topic ? `Note: ${topic}` : 'Select from Notes'}
            </button>

            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'10px 0' }}>
              <div style={{ flex:1, height:1, background:t.border }} />
              <span style={{ fontSize:11, color:t.textMuted, fontWeight:700, textTransform:'uppercase' }}>or manually enter</span>
              <div style={{ flex:1, height:1, background:t.border }} />
            </div>

            <input 
              value={subject} 
              onChange={e => { setSubject(e.target.value); setNoteContent(''); }} 
              placeholder="Subject (e.g. Biology)" 
              style={{ padding:14, borderRadius:12, border:`1px solid ${t.border}`, background:t.inputBg, color:t.text, outline:'none', fontSize:14 }} 
            />
            <input 
              value={topic} 
              onChange={e => { setTopic(e.target.value); setNoteContent(''); }} 
              placeholder="Topic to master..." 
              style={{ padding:14, borderRadius:12, border:`1px solid ${t.border}`, background:t.inputBg, color:t.text, outline:'none', fontSize:14 }} 
            />
            <button 
              onClick={handleStart}
              disabled={!topic.trim()}
              style={{ padding:14, borderRadius:12, background:t.text, color:t.bg, fontWeight:700, border:'none', marginTop:10, opacity:topic.trim()?1:0.5, cursor:topic.trim()?'pointer':'default' }}
            >
              Start Session
            </button>
          </div>
        </div>

        {showNotePicker && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(10px)', zIndex:1000, display:'flex', alignItems:'flex-end' }}>
            <div className="anim-up" style={{ width:'100%', maxHeight:'80vh', background:t.bg, borderRadius:'24px 24px 0 0', padding:24, overflow:'hidden', display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <h3 style={{ fontSize:18, fontWeight:800, color:t.text }}>Choose a Note</h3>
                <button onClick={() => setShowNotePicker(false)} style={{ background:'none', border:'none', color:t.textMuted, fontSize:24 }}>×</button>
              </div>
              <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12, paddingBottom:40 }}>
                {notes.length === 0 && <p style={{ textAlign:'center', color:t.textMuted, padding:40 }}>No notes found. Create some first!</p>}
                {notes.map(n => (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      setTopic(n.title)
                      setSubject(n.category || '')
                      setNoteContent(n.content || n.html || '')
                      setShowNotePicker(false)
                    }}
                    style={{ padding:16, borderRadius:16, border:`1px solid ${t.border}`, background:t.card, cursor:'pointer' }}
                  >
                    <p style={{ fontSize:14, fontWeight:700, color:t.text, marginBottom:4 }}>{n.title || 'Untitled'}</p>
                    <p style={{ fontSize:12, color:t.textMuted }}>{n.category || 'Uncategorized'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:t.bg, paddingBottom: `calc(80px + var(--safe-bottom, 0px))` }}>
      <Header title="Socratic Viva" back />
      
      <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ 
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            background: m.role === 'user' ? t.blue : t.card,
            padding: '12px 16px',
            borderRadius: m.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
            color: m.role === 'user' ? '#fff' : t.text,
            boxShadow: t.shadowSm,
            fontSize: 14,
            lineHeight: 1.5,
            border: m.role === 'user' ? 'none' : `1px solid ${t.border}`
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf:'flex-start', background:t.card, padding:'12px 16px', borderRadius:'18px 18px 18px 2px', border:`1px solid ${t.border}` }}>
            <div style={{ display:'flex', gap:4 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:t.textMuted, animation:'pulse 1s infinite' }} />
              <div style={{ width:6, height:6, borderRadius:'50%', background:t.textMuted, animation:'pulse 1s infinite 0.2s' }} />
              <div style={{ width:6, height:6, borderRadius:'50%', background:t.textMuted, animation:'pulse 1s infinite 0.4s' }} />
            </div>
          </div>
        )}
        {isListening && (
          <div style={{ alignSelf:'center', background:t.blue + '15', padding:'8px 16px', borderRadius:20, display:'flex', alignItems:'center', gap:12, border:`1px solid ${t.blue}40`, margin:'10px 0' }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:t.blue, animation:'pulse 1.2s infinite ease-in-out' }} />
            <span style={{ fontSize:12, fontWeight:700, color:t.blue, fontFamily:'Inter,sans-serif' }}>Hearing you...</span>
          </div>
        )}
      </div>

      <div style={{ padding: `12px 16px calc(12px + var(--safe-bottom, 0px))`, background:t.card, borderTop:`1px solid ${t.border}` }}>
        <div style={{ display:'flex', gap:10 }}>
          <button 
            onClick={toggleListening}
            style={{ 
              width:44, height:44, borderRadius:'50%', border:`1px solid ${isListening?t.blue:t.border}`,
              background:isListening?t.blue:t.inputBg, color:isListening?'#fff':t.text,
              display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.3s'
            }}
          >
            {isListening ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
            )}
          </button>

          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isListening ? "Listening..." : "Type your thought..."}
            style={{ flex:1, padding:'12px 16px', borderRadius:24, border:`1px solid ${t.border}`, background:t.inputBg, color:t.text, outline:'none' }}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{ width:44, height:44, borderRadius:'50%', background:t.text, border:'none', color:t.bg, display:'flex', alignItems:'center', justifyContent:'center', opacity:input.trim()?1:0.5 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}
