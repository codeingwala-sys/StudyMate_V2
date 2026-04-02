import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { Analytics } from '@vercel/analytics/react'
import './styles/globals.css'
// Apply saved theme before first render — prevents flash
const savedTheme = localStorage.getItem('studymate_theme') || 'dark'
document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : '')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
)