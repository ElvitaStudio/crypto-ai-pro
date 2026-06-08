import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AdminApp } from './admin/AdminApp'

// Initialize Telegram Mini App
const tg = (window as Window & { Telegram?: { WebApp?: { expand: () => void; ready: () => void } } }).Telegram?.WebApp
tg?.expand()
tg?.ready()

// Route /admin → Admin Panel, everything else → Mini App
const isAdmin = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <AdminApp /> : <App />}
  </StrictMode>
)
