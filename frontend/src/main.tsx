import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// Initialize Telegram Mini App
const tg = (window as Window & { Telegram?: { WebApp?: { expand: () => void; ready: () => void } } }).Telegram?.WebApp
tg?.expand()
tg?.ready()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
