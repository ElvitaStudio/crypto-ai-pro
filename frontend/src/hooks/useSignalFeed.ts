import { useEffect, useRef, useState } from 'react'
import type { Signal } from '../types'
import { fetchSignals } from '../api'

const MAX_FEED = 100

export function useSignalFeed() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Load initial signals via REST (WebSocket may not be available in preview)
    fetchSignals({ limit: 50 }).then(setSignals).catch(() => {})

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/signals`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as
        | { type: 'init' | 'new'; data: Signal[] }
        | { type: 'update'; data: Signal }

      if (msg.type === 'init') {
        setSignals(msg.data)
      } else if (msg.type === 'new') {
        setSignals((prev) => {
          const existingIds = new Set(prev.map(s => s.id))
          const newOnes = (msg.data as Signal[]).filter(s => !existingIds.has(s.id))
          return [...newOnes, ...prev].slice(0, MAX_FEED)
        })
      } else if (msg.type === 'update') {
        // Replace the signal with updated status (TP/SL hit)
        const updated = msg.data as Signal
        setSignals((prev) =>
          prev.map(s => s.id === updated.id ? updated : s)
        )
      }
    }

    return () => ws.close()
  }, [])

  return { signals, connected }
}
