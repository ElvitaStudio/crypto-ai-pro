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
      const msg = JSON.parse(e.data) as { type: 'init' | 'new'; data: Signal[] }
      if (msg.type === 'init') {
        // WS connected — replace REST data with authoritative WS init
        setSignals(msg.data)
      } else {
        setSignals((prev) => {
          const existingIds = new Set(prev.map(s => s.id))
          const newOnes = msg.data.filter(s => !existingIds.has(s.id))
          return [...newOnes, ...prev].slice(0, MAX_FEED)
        })
      }
    }

    return () => ws.close()
  }, [])

  return { signals, connected }
}
