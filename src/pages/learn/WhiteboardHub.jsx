import { Tldraw } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { useTheme } from '../../app/useTheme'
import { useAppStore } from '../../app/store'
import Header from '../../components/layout/Header'

export default function WhiteboardHub() {
  const { t, isDark } = useTheme()
  const { user } = useAppStore()
  const userId = user?.id || 'guest'

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: t.bg }}>
      <Header title="Collaborative Whiteboard" subtitle="Mind-Sync" back />
      
      <div style={{ flex: 1, position: 'relative' }}>
        <Tldraw 
          inferDarkMode={isDark}
          persistenceKey={`studymate-whiteboard-${userId}`}
        />
        
        <div style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '8px 16px', borderRadius: 20, background: t.card, border: `1px solid ${t.border}`, fontSize: 11, color: t.textSec, boxShadow: t.shadow }}>
            ● Local Save Active
          </div>
        </div>
      </div>
    </div>
  )
}
