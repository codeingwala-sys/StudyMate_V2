import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Silent — don't log to console in production
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          minHeight:'100dvh', background:'#000', padding:'32px 24px', textAlign:'center',
          fontFamily:'Inter, sans-serif'
        }}>
          {/* Background Glow */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', width:300, height:300, background:'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)', pointerEvents:'none' }} />
          
          <div style={{ position:'relative', zIndex:1 }}>
            <div style={{ width:80, height:80, borderRadius:28, background:'linear-gradient(135deg, rgba(248,113,113,0.1), rgba(239,68,68,0.05))', border:'1px solid rgba(248,113,113,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 24px' }}>
              ⚠️
            </div>
            
            <h2 style={{ fontSize:24, fontWeight:800, color:'#fff', marginBottom:12, letterSpacing:'-0.5px' }}>
              Something went wrong
            </h2>
            
            <p style={{ fontSize:15, color:'rgba(255,255,255,0.45)', maxWidth:300, margin:'0 auto 32px', lineHeight:1.6 }}>
              {this.state.error?.message?.includes('API key')
                ? 'Your AI configuration is missing or invalid. Please check your settings.'
                : 'An unexpected error occurred in the application layer.'}
            </p>
            
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <button
                onClick={() => { this.setState({ hasError:false, error:null }); window.location.reload() }}
                style={{ padding:'14px 32px', borderRadius:16, background:'#fff', border:'none', color:'#000', fontSize:14, fontWeight:800, cursor:'pointer' }}
              >
                Reload Application
              </button>
              
              <button
                onClick={() => { this.setState({ hasError:false, error:null }); window.location.href = '/' }}
                style={{ padding:'12px 24px', borderRadius:16, background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:600, cursor:'pointer' }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}