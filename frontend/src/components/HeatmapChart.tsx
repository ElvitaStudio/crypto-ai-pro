import { useEffect, useRef } from 'react'
import type { Candle } from '../types'

const PRICE_BUCKETS = 60   // vertical resolution
const GRADIENT_STOPS: [number, string][] = [
  [0.00, '#0d1117'],
  [0.15, '#0d2137'],
  [0.35, '#0a4a6e'],
  [0.55, '#0e7c5e'],
  [0.72, '#1ab87a'],
  [0.86, '#f0b429'],
  [1.00, '#ff4444'],
]

function colorFromIntensity(t: number): string {
  // find segment in gradient stops
  let lo = GRADIENT_STOPS[0], hi = GRADIENT_STOPS[GRADIENT_STOPS.length - 1]
  for (let i = 0; i < GRADIENT_STOPS.length - 1; i++) {
    if (t >= GRADIENT_STOPS[i][0] && t <= GRADIENT_STOPS[i + 1][0]) {
      lo = GRADIENT_STOPS[i]
      hi = GRADIENT_STOPS[i + 1]
      break
    }
  }
  const span = hi[0] - lo[0]
  const frac = span === 0 ? 0 : (t - lo[0]) / span

  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = parse(lo[1])
  const [r2, g2, b2] = parse(hi[1])
  const r = Math.round(r1 + (r2 - r1) * frac)
  const g = Math.round(g1 + (g2 - g1) * frac)
  const b = Math.round(b1 + (b2 - b1) * frac)
  return `rgb(${r},${g},${b})`
}

interface Props {
  candles: Candle[]
  poc: number
  vah: number
  val: number
}

export function HeatmapChart({ candles, poc, vah, val }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || candles.length === 0) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (W === 0 || H === 0) return   // still hidden — skip

      canvas.width  = W * window.devicePixelRatio
      canvas.height = H * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Price range
    const priceHigh = Math.max(...candles.map(c => c.high))
    const priceLow  = Math.min(...candles.map(c => c.low))
    const priceRange = priceHigh - priceLow
    if (priceRange === 0) return

    const bucketSize = priceRange / PRICE_BUCKETS

    // Build heatmap matrix [time][price_bucket] = volume
    const matrix: number[][] = candles.map(c => {
      const row = new Array<number>(PRICE_BUCKETS).fill(0)
      const totalBuckets = Math.max(1, Math.round((c.high - c.low) / bucketSize))
      const bodyTop    = Math.max(c.open, c.close)
      const bodyBot    = Math.min(c.open, c.close)
      const isGreen    = c.close >= c.open

      for (let b = 0; b < PRICE_BUCKETS; b++) {
        const bPrice = priceLow + b * bucketSize + bucketSize / 2
        if (bPrice < c.low || bPrice > c.high) continue

        // Weight: body area gets more volume than wicks
        const inBody   = bPrice >= bodyBot && bPrice <= bodyTop
        const bodyRatio = (bodyTop - bodyBot) / (c.high - c.low + 1e-9)

        let weight = inBody ? (0.5 + bodyRatio * 0.5) : 0.15

        // Buy/sell tilt: green candles concentrate buy vol near top, red near bottom
        const relPos = (bPrice - c.low) / (c.high - c.low + 1e-9)
        if (isGreen) weight *= (0.5 + relPos * 0.6)
        else         weight *= (0.5 + (1 - relPos) * 0.6)

        row[b] = (c.volume / totalBuckets) * weight
      }
      return row
    })

    // Normalize
    let maxVol = 0
    matrix.forEach(row => row.forEach(v => { if (v > maxVol) maxVol = v }))
    if (maxVol === 0) return

    // Draw cells
    const cellW = W / candles.length
    const cellH = H / PRICE_BUCKETS

    for (let t = 0; t < candles.length; t++) {
      for (let b = 0; b < PRICE_BUCKETS; b++) {
        const intensity = Math.pow(matrix[t][b] / maxVol, 0.45) // gamma correction
        if (intensity < 0.02) continue
        const x = t * cellW
        const y = H - (b + 1) * cellH    // flip Y: price increases upward
        ctx.fillStyle = colorFromIntensity(intensity)
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5)
      }
    }

    // Horizontal price lines: POC / VAH / VAL
    const drawHLine = (price: number, color: string, label: string) => {
      const y = H - ((price - priceLow) / priceRange) * H
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.setLineDash([5, 4])
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`${label} ${price.toFixed(1)}`, 6, y - 3)
    }

    drawHLine(poc, '#f0b429', 'POC')
    drawHLine(vah, '#4ade80', 'VAH')
    drawHLine(val, '#4ade8099', 'VAL')

    // Time axis — show every ~20 candles
    const step = Math.max(1, Math.floor(candles.length / 8))
    ctx.fillStyle = '#4b5563'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    for (let t = 0; t < candles.length; t += step) {
      const d = new Date(candles[t].time * 1000)
      const label = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
      ctx.fillText(label, t * cellW + cellW / 2, H - 2)
    }

    // Color scale legend (right side)
    const legendX = W - 14
    const legendH = H * 0.6
    const legendY = H * 0.2
    for (let i = 0; i < legendH; i++) {
      const t = i / legendH
      ctx.fillStyle = colorFromIntensity(1 - t)
      ctx.fillRect(legendX, legendY + i, 10, 1)
    }
    ctx.fillStyle = '#6b7280'
    ctx.font = '8px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('High', legendX - 2, legendY + 8)
    ctx.fillText('Low',  legendX - 2, legendY + legendH)
    } // end draw()

    // Draw immediately (if already visible) or wait via ResizeObserver
    draw()
    const ro = new ResizeObserver(() => { draw(); ro.disconnect() })
    ro.observe(canvas)
    return () => ro.disconnect()

  }, [candles, poc, vah, val])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', flex: 1, display: 'block', background: '#0d1117', minHeight: 200 }}
    />
  )
}
