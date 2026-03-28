import { useParams } from 'react-router-dom'
import { useAppStore } from '../../app/store'
import { useTheme } from '../../app/useTheme'

export default function PublicNoteView() {
  const { id } = useParams()
  const { isDark, t } = useTheme()
  const { notes } = useAppStore()
  const note = notes.find(n => n.id === Number(id))

  if (!note) return (
    <div style={{ padding: 40, textAlign: 'center', color: t.textMuted }}>
      <h2>Note not found</h2>
      <p>This cheat sheet might have been removed or set to private.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', background: t.bg, minHeight: '100vh', color: t.text }}>
      <header style={{ marginBottom: 40, borderBottom: `1px solid ${t.border}`, paddingBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ padding: '4px 12px', borderRadius: 20, background: t.blue + '20', color: t.blue, fontSize: 12, fontWeight: 700 }}>Cheat Sheet</span>
          <span style={{ color: t.textMuted, fontSize: 12 }}>•</span>
          <span style={{ color: t.textMuted, fontSize: 12 }}>Created with StudyMate</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.5px', marginBottom: 12 }}>{note.title}</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {note.tags?.map(tag => (
            <span key={tag} style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, background: t.inputBg, padding: '4px 10px', borderRadius: 8 }}>{tag}</span>
          ))}
        </div>
      </header>

      <article className="note-content" style={{ fontSize: 16, lineHeight: 1.7, color: t.textSec }}>
        <div dangerouslySetInnerHTML={{ __html: note.html || note.content?.replace(/\n/g, '<br>') }} />
      </article>

      <footer style={{ marginTop: 60, padding: '30px 20px', borderRadius: 20, background: t.card, border: `1px solid ${t.border}`, textAlign: 'center' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Want to master {note.title}?</h3>
        <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 20 }}>Use StudyMate to generate flashcards, AI quizzes, and mind maps from your own notes.</p>
        <button style={{ padding: '12px 24px', borderRadius: 12, background: t.text, color: t.bg, border: 'none', fontWeight: 700, cursor: 'pointer' }}>
          Get StudyMate Free
        </button>
      </footer>
    </div>
  )
}
