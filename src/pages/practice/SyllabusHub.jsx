import { useState } from 'react'
import { useTheme } from '../../app/useTheme'
import Header from '../../components/layout/Header'
import SyllabusManager from '../../components/SyllabusManager'
import { generateRoadmap } from '../../services/ai.service'

export default function SyllabusHub() {
  const { t } = useTheme()
  const [syllabus, setSyllabus] = useState(null)
  const [roadmap, setRoadmap] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSyllabusAdded = async (data) => {
    setSyllabus(data)
    setLoading(true)
    try {
      const rm = await generateRoadmap(data)
      setRoadmap(rm)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-pad">
      <Header title="Syllabus Map" subtitle="University Exam Roadmap" back />
      
      {!syllabus ? (
        <SyllabusManager onSyllabusAdded={handleSyllabusAdded} />
      ) : (
        <div className="anim-up">
          <div style={{ background: t.card, padding: 20, borderRadius: 20, border: `1px solid ${t.border}`, marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: t.text, marginBottom: 4 }}>{syllabus.name}</h3>
            <p style={{ fontSize: 12, color: t.textMuted }}>{syllabus.topics?.length} Chapters Extracted</p>
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: t.textMuted, marginBottom: 12 }}>Study Roadmap</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {roadmap.map((week, i) => (
              <div key={i} style={{ background: t.card, padding: 16, borderRadius: 18, border: `1px solid ${t.border}`, borderLeft: `4px solid ${t.blue}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Week {week.week}</span>
                  <span style={{ fontSize: 11, color: t.blue, fontWeight: 700 }}>{week.goal}</span>
                </div>
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  {week.tasks?.map((task, j) => (
                    <li key={j} style={{ fontSize: 12, color: t.textSec, marginBottom: 4 }}>{task}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button onClick={() => setSyllabus(null)} style={{ width: '100%', marginTop: 20, padding: 12, borderRadius: 12, border: 'none', background: t.inputBg, color: t.textMuted, fontSize: 13 }}>
            Reset Syllabus
          </button>
        </div>
      )}
    </div>
  )
}
