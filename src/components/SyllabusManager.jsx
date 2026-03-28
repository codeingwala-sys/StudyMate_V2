import { useState, useRef } from 'react'
import { useTheme } from '../app/useTheme'
import { parseSyllabus } from '../services/ai.service'
import { haptic } from '../utils/haptics'

export default function SyllabusManager({ onSyllabusAdded }) {
  const { t } = useTheme()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [text, setText] = useState('')
  const fileInputRef = useRef(null)

  const handleParse = async (manualText) => {
    const content = manualText || text
    if (!content.trim()) return
    setLoading(true)
    setStatus('Generating Roadmap...')
    haptic.medium()
    try {
      const parsed = await parseSyllabus(content)
      if (parsed) {
        onSyllabusAdded(parsed)
        setText('')
      }
    } catch (e) {
      console.error(e)
      alert('Could not parse syllabus. Try pasting the text manually.')
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    const isPDF = file.type === 'application/pdf'
    setStatus(isPDF ? 'Reading PDF...' : 'Scanning Image (OCR)...')

    try {
      let extractedText = ''
      if (isPDF) {
        extractedText = await extractTextFromPDF(file)
      } else {
        extractedText = await extractTextFromImage(file)
      }

      if (extractedText.trim()) {
        setText(extractedText)
        handleParse(extractedText)
      } else {
        alert('Could not extract text from this file.')
      }
    } catch (err) {
      console.error('Extraction failed:', err)
      alert('Detection failed. Please paste text manually.')
    } finally {
      setLoading(false)
      setStatus('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const extractTextFromPDF = async (file) => {
    // Load PDF.js from CDN
    const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/+esm')
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs'
    
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      fullText += textContent.items.map(item => item.str).join(' ') + '\n'
    }
    return fullText
  }

  const extractTextFromImage = async (file) => {
    // Dynamically load Tesseract.js
    if (!window.Tesseract) {
      await new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js'
        script.onload = resolve
        document.head.appendChild(script)
      })
    }
    
    const { data: { text } } = await window.Tesseract.recognize(file, 'eng', {
      logger: () => {}
    })
    return text
  }

  return (
    <div style={{ padding: 16, background: t.card, borderRadius: 20, border: `1px solid ${t.border}` }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 8 }}>Import Syllabus</h3>
      <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Paste text or upload a PDF/Screenshot of your syllabus.</p>
      
      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          style={{ flex:1, padding:12, borderRadius:12, background:t.inputBg, border:`1px solid ${t.border}`, color:t.text, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.blue} strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload File
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="application/pdf,image/*" 
          style={{ display:'none' }} 
        />
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Or paste syllabus content here..."
        style={{ width: '100%', height: 120, padding: 12, borderRadius: 12, background: t.inputBg, color: t.text, border: `1px solid ${t.border}`, outline: 'none', fontSize: 13, marginBottom: 12, resize: 'none' }}
      />
      
      <button
        onClick={() => handleParse()}
        disabled={loading || !text.trim()}
        style={{ width: '100%', padding: 14, borderRadius: 12, background: t.text, color: t.bg, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
      >
        {loading ? (status || 'Parsing...') : 'Generate Roadmap'}
      </button>

      {status && (
        <p style={{ fontSize:11, color:t.blue, textAlign:'center', marginTop:10, fontWeight:600, animation:'pulse 1.5s infinite' }}>
          {status}
        </p>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}
