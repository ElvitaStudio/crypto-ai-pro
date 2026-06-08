import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
} from 'lightweight-charts'
import type { ChartData, Zone } from '../types'
import { fetchChartData } from '../api'
import { HeatmapChart } from './HeatmapChart'

const TIMEFRAMES = ['5m', '15m', '1h', '4h'] as const
type TF = typeof TIMEFRAMES[number]

const LEVEL_COLORS: Record<string, string> = {
  POC:        '#f0b429',
  VAH:        '#4ade80',
  VAL:        '#4ade80',
  SUPPORT:    '#4ade80',
  RESISTANCE: '#f87171',
  HIGH_24H:   '#a78bfa',
  LOW_24H:    '#a78bfa',
}

const LEVEL_STYLES: Record<string, 0 | 1 | 2 | 3 | 4> = {
  POC: 0, VAH: 2, VAL: 2, SUPPORT: 2, RESISTANCE: 2, HIGH_24H: 1, LOW_24H: 1,
}

interface Props {
  symbol: string
  signalEntry?: number
  signalSl?: number
  signalTp?: number
  signalDirection?: 'LONG' | 'SHORT'
  onClose: () => void
}

export function LiveChart({ symbol, signalEntry, signalSl, signalTp, signalDirection, onClose }: Props) {
  const wrapRef      = useRef<HTMLDivElement>(null)   // outer container
  const chartRef     = useRef<HTMLDivElement>(null)   // candle chart mount
  const deltaRef     = useRef<HTMLDivElement>(null)   // delta chart mount
  const zoneCanvasRef = useRef<HTMLCanvasElement>(null) // zone overlay
  const profileRef   = useRef<HTMLCanvasElement>(null)  // volume profile

  const chartApi   = useRef<IChartApi | null>(null)
  const deltaApi   = useRef<IChartApi | null>(null)
  const candleSer  = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volSer     = useRef<ISeriesApi<'Histogram'> | null>(null)
  const deltaSer   = useRef<ISeriesApi<'Histogram'> | null>(null)
  const cumDeltaSer = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const priceLines = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>[]>([])

  const [tf, setTf]           = useState<TF>('15m')
  const [data, setData]       = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [livePrice, setLivePrice]     = useState<number | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async (timeframe: TF) => {
    setLoading(true)
    setError(null)
    try {
      const d = await fetchChartData(symbol, timeframe, 200) as ChartData
      setData(d)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => { load(tf) }, [tf, load])

  // ── Live price polling ──────────────────────────────────────────────────────
  useEffect(() => {
    const sym = symbol.replace('/', '')   // BTC/USDT → BTCUSDT
    const fetchPrice = async () => {
      try {
        const r = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`)
        if (!r.ok) return
        const j = await r.json() as { price: string }
        setLivePrice(parseFloat(j.price))
      } catch { /* ignore network errors */ }
    }
    fetchPrice()
    const id = setInterval(fetchPrice, 5000)
    return () => clearInterval(id)
  }, [symbol])

  // ── Init charts (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || !deltaRef.current) return

    const PROFILE_W = 64

    const sharedOpts = {
      layout: { background: { color: '#0d1117' }, textColor: '#6b7280' },
      grid: { vertLines: { color: '#1a2030' }, horzLines: { color: '#1a2030' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1f2937', minimumWidth: 68 },
      timeScale: { borderColor: '#1f2937', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    }

    // Main chart — fills available height, leave room for VP on right
    const initW = chartRef.current.clientWidth || 300
    // PROFILE_W kept for ResizeObserver delta — chart takes full width now
    const initH = chartRef.current.clientHeight || 420
    const main = createChart(chartRef.current, {
      ...sharedOpts,
      width: initW,
      height: initH,
    })

    const candles = main.addSeries(CandlestickSeries, {
      upColor: '#26a17b', downColor: '#e74c3c',
      borderVisible: false,
      wickUpColor: '#26a17b80', wickDownColor: '#e74c3c80',
    })

    const volume = main.addSeries(HistogramSeries, {
      color: '#26a17b33',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0.12 } })

    // CVD candles in bottom 12% — same style as main but purple/red
    const cumDelta = main.addSeries(CandlestickSeries, {
      upColor: '#a78bfa',
      downColor: '#f87171',
      borderVisible: false,
      wickUpColor: '#a78bfa99',
      wickDownColor: '#f8717199',
      priceScaleId: 'cumdelta',
      lastValueVisible: true,
      priceLineVisible: false,
    })
    main.priceScale('cumdelta').applyOptions({
      scaleMargins: { top: 0.88, bottom: 0 },
      visible: false,
    })

    // Delta per candle — tiny histogram in the same bottom zone (behind line)
    const deltaS = main.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'cumdelta',
    })

    // Redraw zone canvas on pan/zoom
    const redrawZones = () => {
      const canvas = zoneCanvasRef.current
      const ser = candleSer.current
      if (!canvas || !ser) return
      const ctx2 = canvas.getContext('2d')
      if (!ctx2) return
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width  || canvas.clientWidth
      canvas.height = rect.height || canvas.clientHeight
      ctx2.clearRect(0, 0, canvas.width, canvas.height)
      // zones stored in closure via ref — access via DOM dataset trick
      const zonesJson = canvas.dataset.zones
      if (!zonesJson) return
      const zones: Zone[] = JSON.parse(zonesJson)
      zones.forEach((zone: Zone) => {
        const yTop = ser.priceToCoordinate(zone.price_top)
        const yBot = ser.priceToCoordinate(zone.price_bot)
        if (yTop === null || yBot === null) return
        const top = Math.min(yTop, yBot)
        const h   = Math.abs(yBot - yTop)
        if (h < 2) return
        const isDemand = zone.zone_type === 'DEMAND'
        ctx2.fillStyle = isDemand ? 'rgba(38,161,123,0.10)' : 'rgba(231,76,60,0.10)'
        ctx2.fillRect(0, top, canvas.width, h)
        ctx2.strokeStyle = isDemand ? 'rgba(38,161,123,0.35)' : 'rgba(231,76,60,0.35)'
        ctx2.lineWidth = 1; ctx2.setLineDash([4, 4])
        ctx2.beginPath(); ctx2.moveTo(0, top); ctx2.lineTo(canvas.width, top); ctx2.stroke()
        ctx2.beginPath(); ctx2.moveTo(0, top + h); ctx2.lineTo(canvas.width, top + h); ctx2.stroke()
        ctx2.setLineDash([])
        ctx2.fillStyle = isDemand ? 'rgba(38,161,123,0.75)' : 'rgba(231,76,60,0.75)'
        ctx2.font = 'bold 9px monospace'; ctx2.textAlign = 'left'
        ctx2.fillText(isDemand ? '▲ D' : '▼ S', 4, top + 11)
      })
    }

    main.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(redrawZones)
    })

    chartApi.current = main
    deltaApi.current = null
    candleSer.current = candles
    volSer.current = volume
    deltaSer.current = deltaS
    cumDeltaSer.current = cumDelta

    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      const w = entry?.contentRect.width ?? 300
      const h = entry?.contentRect.height ?? 420
      main.applyOptions({ width: w, height: h })
    })
    if (chartRef.current) ro.observe(chartRef.current)

    return () => {
      ro.disconnect()
      main.remove()
      chartApi.current = null
      deltaApi.current = null
    }
  }, [])

  // ── Update data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !candleSer.current || !volSer.current || !deltaSer.current || !chartApi.current || !cumDeltaSer.current) return

    // Candles
    const candleData: CandlestickData[] = data.candles.map(c => ({
      time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
    }))
    candleSer.current.setData(candleData)

    // Volume (colored by delta)
    const volData: HistogramData[] = data.candles.map(c => ({
      time: c.time as Time,
      value: c.volume,
      color: c.delta >= 0 ? '#26a17b44' : '#e74c3c44',
    }))
    volSer.current.setData(volData)

    // Delta histogram per candle — thin bars behind the cumulative line
    const deltaData: HistogramData[] = data.candles.map(c => ({
      time: c.time as Time,
      value: c.delta,
      color: c.delta >= 0 ? '#26a17b44' : '#e74c3c44',
    }))
    deltaSer.current.setData(deltaData)

    // CVD candles — each candle's O/H/L/C derived from cumulative delta
    // open  = cum delta before this candle
    // close = cum delta after this candle
    // wick  = ±fraction of the candle's |delta| to hint intra-bar swings
    let cumSum = 0
    const cvdCandles: CandlestickData[] = data.candles.map(c => {
      const open  = cumSum
      cumSum += c.delta
      const close = cumSum
      const wick  = Math.abs(c.delta) * 0.15
      return {
        time:  c.time as Time,
        open,
        close,
        high:  Math.max(open, close) + wick,
        low:   Math.min(open, close) - wick,
      }
    })
    cumDeltaSer.current.setData(cvdCandles)

    // Clear previous price lines before re-drawing
    priceLines.current.forEach(pl => { try { candleSer.current!.removePriceLine(pl) } catch {} })
    priceLines.current = []

    // Key levels with axis labels: POC / VAH / VAL / 24H
    const KEY_TYPES = new Set(['POC', 'VAH', 'VAL', 'HIGH_24H', 'LOW_24H'])
    data.levels
      .filter(lvl => KEY_TYPES.has(lvl.type))
      .forEach(lvl => {
        const pl = candleSer.current!.createPriceLine({
          price: lvl.price,
          color: LEVEL_COLORS[lvl.type] ?? '#ffffff33',
          lineWidth: lvl.type === 'POC' ? 2 : 1,
          lineStyle: LEVEL_STYLES[lvl.type] ?? 2,
          axisLabelVisible: true,
          title: lvl.type === 'POC' ? 'POC'
               : lvl.type === 'VAH' ? 'VAH'
               : lvl.type === 'VAL' ? 'VAL'
               : lvl.type === 'HIGH_24H' ? '24H▲'
               : '24H▼',
        })
        priceLines.current.push(pl)
      })

    // S/R fractals — max 2 each, thin, no axis label
    const supports    = data.levels.filter(l => l.type === 'SUPPORT').slice(0, 2)
    const resistances = data.levels.filter(l => l.type === 'RESISTANCE').slice(0, 2)
    ;[...supports, ...resistances].forEach(lvl => {
      const pl = candleSer.current!.createPriceLine({
        price: lvl.price,
        color: lvl.type === 'SUPPORT' ? '#4ade8033' : '#f8717133',
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: false,
        title: '',
      })
      priceLines.current.push(pl)
    })

    // Entry / SL / TP price lines
    if (signalEntry) {
      const entryColor = signalDirection === 'LONG' ? '#26a17bcc' : '#e74c3ccc'
      const pl = candleSer.current.createPriceLine({ price: signalEntry, color: entryColor, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: signalDirection === 'LONG' ? '▲ Entry' : '▼ Entry' })
      priceLines.current.push(pl)
    }
    if (signalTp) { const pl = candleSer.current.createPriceLine({ price: signalTp, color: '#26a17bcc', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: '✓ TP' }); priceLines.current.push(pl) }
    if (signalSl) { const pl = candleSer.current.createPriceLine({ price: signalSl, color: '#e74c3ccc', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: '✗ SL' }); priceLines.current.push(pl) }

    chartApi.current.timeScale().fitContent()
  }, [data, signalEntry, signalSl, signalTp, signalDirection])

  // ── Zone overlay ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !zoneCanvasRef.current || !chartApi.current || !candleSer.current) return

    const canvas = zoneCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Store zones in canvas dataset so pan/zoom handler can redraw
    canvas.dataset.zones = JSON.stringify(data.zones)

    // Wait for fitContent() + 2 frames to settle, then draw
    let raf1: number, raf2: number
    raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width  || canvas.clientWidth
      canvas.height = rect.height || canvas.clientHeight
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      if (!data.zones.length) return

      data.zones.forEach((zone: Zone) => {
        const yTop = candleSer.current!.priceToCoordinate(zone.price_top)
        const yBot = candleSer.current!.priceToCoordinate(zone.price_bot)
        if (yTop === null || yBot === null) return
        const top = Math.min(yTop, yBot)
        const h   = Math.abs(yBot - yTop)
        if (h < 2) return
        const isDemand = zone.zone_type === 'DEMAND'
        ctx.fillStyle = isDemand ? 'rgba(38,161,123,0.12)' : 'rgba(231,76,60,0.12)'
        ctx.fillRect(0, top, W, h)
        ctx.strokeStyle = isDemand ? 'rgba(38,161,123,0.4)' : 'rgba(231,76,60,0.4)'
        ctx.lineWidth = 1; ctx.setLineDash([4, 4])
        ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, top + h); ctx.lineTo(W, top + h); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = isDemand ? 'rgba(38,161,123,0.8)' : 'rgba(231,76,60,0.8)'
        ctx.font = 'bold 9px monospace'; ctx.textAlign = 'left'
        ctx.fillText(isDemand ? '▲ D' : '▼ S', 4, top + 11)
      })
    }) // raf2
    }) // raf1
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [data])

  // ── Volume Profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!data || !profileRef.current) return
    const canvas = profileRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const profile = data.volume_profile
    const maxVol = Math.max(...profile.map(b => b.volume), 1)
    const barH = H / profile.length

    profile.forEach((bar, i) => {
      const y = H - (i + 1) * barH
      const totalW = (bar.volume / maxVol) * (W - 4)
      const sellW  = totalW * (bar.sell_vol / (bar.volume || 1))
      const buyW   = totalW * (bar.buy_vol  / (bar.volume || 1))

      if (bar.is_poc) {
        ctx.fillStyle = '#f0b42933'
        ctx.fillRect(0, y - 1, W, barH + 2)
      }

      ctx.fillStyle = bar.is_hvn ? '#e74c3c55' : '#e74c3c1a'
      ctx.fillRect(2, y + 1, sellW, barH - 2)

      ctx.fillStyle = bar.is_hvn ? '#26a17b66' : '#26a17b22'
      ctx.fillRect(2 + sellW, y + 1, buyW, barH - 2)

      if (bar.is_poc) {
        ctx.strokeStyle = '#f0b429'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(0, y + barH / 2); ctx.lineTo(W, y + barH / 2); ctx.stroke()
      }
    })

    // Legend
    ctx.fillStyle = '#6b7280'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('VP', W / 2, 8)
  }, [data])

  const chartW = (wrapRef.current?.clientWidth ?? 340) - 64  // minus profile width

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />

        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
            <span style={s.title}>{symbol}</span>
            {livePrice !== null && (
              <span style={{ fontSize: 17, fontWeight: 700, color: '#f9fafb', letterSpacing: '-0.5px' }}>
                {(() => {
                  const dec = livePrice < 1 ? 5 : 2
                  const s = livePrice.toLocaleString('en-US', {
                    minimumFractionDigits: dec,
                    maximumFractionDigits: dec,
                    useGrouping: true,
                  })
                  return s.replace(/,/g, ' ')
                })()}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div style={s.tfRow}>
            {TIMEFRAMES.map(t => (
              <button key={t} style={{ ...s.tfBtn, ...(tf === t ? s.tfActive : {}) }} onClick={() => setTf(t)}>{t}</button>
            ))}
            <button
              style={{ ...s.tfBtn, ...(showHeatmap ? s.tfActive : {}), marginLeft: 4 }}
              onClick={() => setShowHeatmap(v => !v)}
              title="Тепловая карта объёмов"
            >🔥</button>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Signal badge */}
        {signalDirection && (
          <div style={{ ...s.badge, background: signalDirection === 'LONG' ? '#26a17b15' : '#e74c3c15', borderColor: signalDirection === 'LONG' ? '#26a17b40' : '#e74c3c40' }}>
            <span style={{ color: signalDirection === 'LONG' ? '#26a17b' : '#e74c3c', fontWeight: 700, fontSize: 12 }}>{signalDirection}</span>
            {signalEntry && <span style={s.badgeVal}>Вход <b>{signalEntry}</b></span>}
            {signalSl    && <span style={{ ...s.badgeVal, color: '#e74c3c' }}>SL: {signalSl}</span>}
            {signalTp    && <span style={{ ...s.badgeVal, color: '#26a17b' }}>TP: {signalTp}</span>}
          </div>
        )}

        {/* Chart area */}
        <div ref={wrapRef} style={s.chartWrap}>
          {loading && <div style={s.loading}>Загрузка данных с Binance...</div>}
          {error   && <div style={s.errMsg}>⚠️ {error.replace('Error: ', '')}</div>}

          {/* Heatmap — always mounted, hidden when inactive */}
          {data && (
            <div style={{ display: showHeatmap ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <div style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: '4px 0', letterSpacing: 0.5, textTransform: 'uppercase', flexShrink: 0 }}>
                Тепловая карта объёмов · {tf}
              </div>
              <HeatmapChart candles={data.candles} poc={data.poc} vah={data.vah} val={data.val} />
            </div>
          )}

          {/* Candle + Delta charts — always mounted, hidden when heatmap active */}
          <div style={{ display: showHeatmap ? 'none' : 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Main candle chart + zone canvas overlay */}
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              {/* LWC fills entire container */}
              <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
              {/* Zone overlay — covers chart area */}
              <canvas
                ref={zoneCanvasRef}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
              />
              {/* Volume Profile — left edge overlay, semi-transparent */}
              <canvas ref={profileRef} width={56} style={{ ...s.profileCanvas, position: 'absolute', top: 0, left: 0, bottom: 0, height: '100%', zIndex: 3, opacity: 0.75, borderLeft: 'none', borderRight: '1px solid #1f2937' }} title="Volume Profile" />
            </div>

            {/* Delta overlay is embedded in main chart — no separate panel */}
            <div ref={deltaRef} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Compact legend */}
        {data && (
          <div style={s.legend}>
            <LI color="#f0b429" label={`POC ${data.poc.toFixed(1)}`} line />
            <LI color="#4ade80" label={`VAH ${data.vah.toFixed(1)}`} line />
            <LI color="#4ade80" label={`VAL ${data.val.toFixed(1)}`} line />
            <LI color="#a78bfa" label="CVD" line />
            <LI color="#26a17b" label="Спрос" />
            <LI color="#e74c3c" label="Предл." />
          </div>
        )}
      </div>
    </div>
  )
}

function LI({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: line ? 16 : 10, height: line ? 2 : 10, background: color, borderRadius: line ? 0 : 2, opacity: 0.85 }} />
      <span style={{ fontSize: 10, color: '#6b7280' }}>{label}</span>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 200 },
  sheet:   { background: '#0d1117', width: '100%', borderRadius: '14px 14px 0 0', height: '94vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)', overflow: 'hidden' },
  handle:  { width: 36, height: 4, background: '#1f2937', borderRadius: 2, margin: '10px auto 0' },
  header:  { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 6px', flexWrap: 'wrap' },
  title:   { fontWeight: 700, fontSize: 15, flex: 1, minWidth: 80 },
  tfRow:   { display: 'flex', gap: 3, flexShrink: 0 },
  tfBtn:   { padding: '4px 7px', borderRadius: 6, border: '1px solid #1f2937', background: 'transparent', color: '#4b5563', fontSize: 11, cursor: 'pointer' },
  tfActive:{ background: '#1f2937', color: '#e5e7eb', borderColor: '#374151' },
  closeBtn:{ background: 'none', border: 'none', color: '#4b5563', fontSize: 15, cursor: 'pointer', padding: '0 2px' },
  badge:   { display: 'flex', gap: 10, alignItems: 'center', margin: '0 12px 8px', padding: '6px 12px', borderRadius: 8, border: '1px solid', fontSize: 12 },
  badgeVal:{ fontSize: 12, color: '#9ca3af' },
  chartWrap:{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' },
  loading: { padding: '40px 14px', color: '#4b5563', fontSize: 13, textAlign: 'center' },
  errMsg:  { padding: '16px 14px', color: '#e74c3c', fontSize: 12 },
  profileCanvas: { width: 64, background: '#0d1117', borderLeft: '1px solid #1f2937' },
  legend:  { display: 'flex', flexWrap: 'wrap', gap: 10, padding: '8px 12px', borderTop: '1px solid #1a2030' },
}
