import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { formatTime, formatDateTime, generateSegmentsFromTempData } from '@/utils/parsers'
import type { TemperaturePoint, StopPoint, TemperatureSegment, Verdict } from '@/types'
import { LOCATION_TYPE_LABELS, VERDICT_LABELS } from '@/types'
import type { LocationType } from '@/types'
import {
  Thermometer,
  Truck,
  Route,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  ChevronDown,
  MapPin,
  Clock,
  ZoomIn,
  ZoomOut,
  Move,
} from 'lucide-react'

const PADDING_LEFT = 70
const PADDING_RIGHT = 20
const PADDING_TOP = 20
const PADDING_BOTTOM = 40

const VERDICT_STYLES: Record<Verdict, { bg: string; border: string; text: string }> = {
  acceptable: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
  },
  needs_explanation: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
  },
  unqualified: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    text: 'text-red-400',
  },
}

interface CanvasViewport {
  offsetX: number
  offsetY: number
  scale: number
}

function TemperatureCurveCanvas({
  tempData,
  stopPointsList,
  tempMin,
  tempMax,
  jumpRange,
}: {
  tempData: TemperaturePoint[]
  stopPointsList: StopPoint[]
  tempMin: number
  tempMax: number
  jumpRange: { startTime: string; endTime: string } | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 400 })
  const [viewport, setViewport] = useState<CanvasViewport>({ offsetX: 0, offsetY: 0, scale: 1 })
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    name: string
    locationType: LocationType
  } | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const hoverStopIdx = useRef<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect
        setSize({ width, height: 400 })
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!jumpRange || tempData.length === 0) return
    const startTs = new Date(jumpRange.startTime).getTime()
    const endTs = new Date(jumpRange.endTime).getTime()
    const firstTs = new Date(tempData[0].timestamp).getTime()
    const lastTs = new Date(tempData[tempData.length - 1].timestamp).getTime()
    const totalRange = lastTs - firstTs || 1
    const drawW = (size.width - PADDING_LEFT - PADDING_RIGHT) * viewport.scale
    const startPx = ((startTs - firstTs) / totalRange) * drawW + PADDING_LEFT
    const endPx = ((endTs - firstTs) / totalRange) * drawW + PADDING_LEFT
    const centerPx = (startPx + endPx) / 2
    const canvasCenter = size.width / 2
    setViewport((v) => ({ ...v, offsetX: -(centerPx - canvasCenter) / v.scale }))
  }, [jumpRange, tempData, size.width, viewport.scale])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || tempData.length === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size.width * dpr
    canvas.height = size.height * dpr
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)'
    ctx.fillRect(0, 0, size.width, size.height)

    ctx.save()
    ctx.translate(viewport.offsetX, viewport.offsetY)
    ctx.scale(viewport.scale, viewport.scale)

    const drawW = size.width - PADDING_LEFT - PADDING_RIGHT
    const drawH = size.height - PADDING_TOP - PADDING_BOTTOM

    const firstTs = new Date(tempData[0].timestamp).getTime()
    const lastTs = new Date(tempData[tempData.length - 1].timestamp).getTime()
    const totalRange = lastTs - firstTs || 1

    const allTemps = tempData.map((p) => p.temperature)
    const dataMin = Math.min(...allTemps, tempMin)
    const dataMax = Math.max(...allTemps, tempMax)
    const tempPad = (dataMax - dataMin) * 0.15 || 1
    const yMin = dataMin - tempPad
    const yMax = dataMax + tempPad
    const yRange = yMax - yMin || 1

    const toX = (ts: number) => PADDING_LEFT + ((ts - firstTs) / totalRange) * drawW
    const toY = (t: number) => PADDING_TOP + drawH - ((t - yMin) / yRange) * drawH

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)'
    ctx.lineWidth = 1
    const gridCount = 6
    for (let i = 0; i <= gridCount; i++) {
      const y = PADDING_TOP + (drawH / gridCount) * i
      ctx.beginPath()
      ctx.moveTo(PADDING_LEFT, y)
      ctx.lineTo(PADDING_LEFT + drawW, y)
      ctx.stroke()
      const tempVal = yMax - (yRange / gridCount) * i
      ctx.fillStyle = '#94a3b8'
      ctx.font = '11px DM Sans, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${tempVal.toFixed(1)}°`, PADDING_LEFT - 8, y)
    }

    const timeLabelCount = Math.min(8, tempData.length)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (let i = 0; i <= timeLabelCount; i++) {
      const idx = Math.floor((tempData.length - 1) * (i / timeLabelCount))
      const ts = new Date(tempData[idx].timestamp).getTime()
      const x = toX(ts)
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(formatTime(tempData[idx].timestamp), x, PADDING_TOP + drawH + 8)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)'
      ctx.beginPath()
      ctx.moveTo(x, PADDING_TOP)
      ctx.lineTo(x, PADDING_TOP + drawH)
      ctx.stroke()
    }

    const drawDashedLine = (temp: number, color: string, label: string) => {
      const y = toY(temp)
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.setLineDash([8, 4])
      ctx.beginPath()
      ctx.moveTo(PADDING_LEFT, y)
      ctx.lineTo(PADDING_LEFT + drawW, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.font = 'bold 11px DM Sans, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(label, PADDING_LEFT + 4, y - 4)
    }

    drawDashedLine(tempMax, 'rgba(239, 68, 68, 0.7)', `上限 ${tempMax}°C`)
    drawDashedLine(tempMin, 'rgba(59, 130, 246, 0.7)', `下限 ${tempMin}°C`)

    const fillBetween = (
      points: { x: number; y: number; inRange: boolean }[],
      inRange: boolean
    ) => {
      if (points.length < 2) return
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.lineTo(points[points.length - 1].x, toY(yMin))
      ctx.lineTo(points[0].x, toY(yMin))
      ctx.closePath()
      ctx.fillStyle = inRange
        ? 'rgba(14, 165, 233, 0.08)'
        : 'rgba(239, 68, 68, 0.1)'
      ctx.fill()
    }

    const mappedPoints = tempData.map((p) => {
      const ts = new Date(p.timestamp).getTime()
      const inRange = p.temperature >= tempMin && p.temperature <= tempMax
      return { x: toX(ts), y: toY(p.temperature), inRange, temp: p.temperature }
    })

    let currentRange = mappedPoints[0].inRange
    let rangePoints: { x: number; y: number; inRange: boolean }[] = [mappedPoints[0]]
    for (let i = 1; i < mappedPoints.length; i++) {
      if (mappedPoints[i].inRange !== currentRange) {
        rangePoints.push(mappedPoints[i])
        fillBetween(rangePoints, currentRange)
        rangePoints = [mappedPoints[i - 1], mappedPoints[i]]
        currentRange = mappedPoints[i].inRange
      } else {
        rangePoints.push(mappedPoints[i])
      }
    }
    fillBetween(rangePoints, currentRange)

    let segInRange = mappedPoints[0].inRange
    let segStart = 0
    const drawSegment = (end: number) => {
      const points = mappedPoints.slice(segStart, end + 1)
      if (points.length < 2) return
      ctx.strokeStyle = segInRange ? '#0ea5e9' : '#ef4444'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()
    }
    for (let i = 1; i < mappedPoints.length; i++) {
      if (mappedPoints[i].inRange !== segInRange) {
        drawSegment(i)
        segStart = i - 1
        segInRange = mappedPoints[i].inRange
      }
    }
    drawSegment(mappedPoints.length - 1)

    const stopPointColor = (lt: LocationType): { fill: string; stroke: string; label: string } => {
      switch (lt) {
        case 'loading_area':
          return { fill: 'rgba(168, 85, 247, 0.3)', stroke: '#a855f7', label: '装卸区' }
        case 'service_area':
          return { fill: 'rgba(251, 146, 60, 0.3)', stroke: '#fb923c', label: '服务区' }
        case 'vaccination_point':
          return { fill: 'rgba(52, 211, 153, 0.3)', stroke: '#34d399', label: '接种点' }
        default:
          return { fill: 'rgba(148, 163, 184, 0.3)', stroke: '#94a3b8', label: '其他' }
      }
    }

    stopPointsList.forEach((sp, idx) => {
      const midTs =
        (new Date(sp.startTime).getTime() + new Date(sp.endTime).getTime()) / 2
      const x = toX(midTs)
      const y = PADDING_TOP + drawH
      const colors = stopPointColor(sp.locationType)

      ctx.fillStyle = colors.fill
      ctx.beginPath()
      ctx.arc(x, y + 14, 7, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = colors.stroke
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y + 14, 7, 0, Math.PI * 2)
      ctx.stroke()

      if (idx === hoverStopIdx.current) {
        ctx.fillStyle = colors.stroke
        ctx.font = 'bold 11px DM Sans, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${sp.locationName} (${LOCATION_TYPE_LABELS[sp.locationType]})`, x, y - 2)
      }
    })

    ctx.restore()
  }, [tempData, stopPointsList, tempMin, tempMax, size, viewport])

  useEffect(() => {
    draw()
  }, [draw])

  const toDataCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      const dataX = (x - viewport.offsetX - PADDING_LEFT) / viewport.scale
      const dataY = (y - viewport.offsetY - PADDING_TOP) / viewport.scale
      return { dataX, dataY, canvasX: x, canvasY: y }
    },
    [viewport]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newScale = Math.max(1, Math.min(20, viewport.scale * factor))
      const ratio = newScale / viewport.scale
      setViewport((v) => ({
        scale: newScale,
        offsetX: mouseX - (mouseX - v.offsetX) * ratio,
        offsetY: mouseY - (mouseY - v.offsetY) * ratio,
      }))
    },
    [viewport]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        ox: viewport.offsetX,
        oy: viewport.offsetY,
      }
    },
    [viewport]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) {
        setViewport((v) => ({
          ...v,
          offsetX: dragStart.current.ox + (e.clientX - dragStart.current.x),
          offsetY: dragStart.current.oy + (e.clientY - dragStart.current.y),
        }))
        return
      }

      const coords = toDataCoords(e.clientX, e.clientY)
      if (!coords || tempData.length === 0 || stopPointsList.length === 0) {
        setTooltip(null)
        hoverStopIdx.current = null
        return
      }

      const firstTs = new Date(tempData[0].timestamp).getTime()
      const lastTs = new Date(tempData[tempData.length - 1].timestamp).getTime()
      const totalRange = lastTs - firstTs || 1
      const drawW = size.width - PADDING_LEFT - PADDING_RIGHT
      const tsAtMouse = firstTs + (coords.dataX / drawW) * totalRange

      let found = -1
      let minDist = Infinity
      stopPointsList.forEach((sp, idx) => {
        const midTs =
          (new Date(sp.startTime).getTime() + new Date(sp.endTime).getTime()) / 2
        const dist = Math.abs(midTs - tsAtMouse)
        if (dist < minDist && dist < totalRange * 0.03) {
          minDist = dist
          found = idx
        }
      })

      if (found >= 0) {
        hoverStopIdx.current = found
        setTooltip({
          x: coords.canvasX,
          y: size.height - PADDING_BOTTOM - 10,
          name: stopPointsList[found].locationName,
          locationType: stopPointsList[found].locationType,
        })
      } else {
        hoverStopIdx.current = null
        setTooltip(null)
      }
    },
    [toDataCoords, tempData, stopPointsList, size]
  )

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
    setTooltip(null)
    hoverStopIdx.current = null
  }, [])

  const resetView = useCallback(() => {
    setViewport({ offsetX: 0, offsetY: 0, scale: 1 })
  }, [])

  const zoomIn = useCallback(() => {
    setViewport((v) => {
      const newScale = Math.min(20, v.scale * 1.3)
      const cx = size.width / 2
      const cy = size.height / 2
      const ratio = newScale / v.scale
      return {
        scale: newScale,
        offsetX: cx - (cx - v.offsetX) * ratio,
        offsetY: cy - (cy - v.offsetY) * ratio,
      }
    })
  }, [size])

  const zoomOut = useCallback(() => {
    setViewport((v) => {
      const newScale = Math.max(1, v.scale / 1.3)
      const cx = size.width / 2
      const cy = size.height / 2
      const ratio = newScale / v.scale
      return {
        scale: newScale,
        offsetX: cx - (cx - v.offsetX) * ratio,
        offsetY: cy - (cy - v.offsetY) * ratio,
      }
    })
  }, [size])

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-frost-900/30">
        <div className="flex items-center gap-2 text-sm text-frost-300">
          <Thermometer size={16} />
          <span>温度曲线</span>
          {viewport.scale > 1 && (
            <span className="text-xs text-frost-500 ml-2">
              {viewport.scale.toFixed(1)}x
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-frost-300 transition-colors"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-frost-300 transition-colors"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-frost-300 transition-colors"
            title="重置视图"
          >
            <Move size={14} />
          </button>
        </div>
      </div>
      <div ref={containerRef} className="relative" style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}>
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        {tooltip && (
          <div
            className="absolute pointer-events-none px-2 py-1 rounded bg-slate-800/90 border border-frost-700/30 text-xs text-frost-200 whitespace-nowrap z-10"
            style={{ left: tooltip.x, top: tooltip.y - 28, transform: 'translateX(-50%)' }}
          >
            {tooltip.name} ({LOCATION_TYPE_LABELS[tooltip.locationType]})
          </div>
        )}
      </div>
      <div className="flex items-center gap-5 px-4 py-2 border-t border-frost-900/30 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-frost-500 rounded" />
          正常温度
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-red-500 rounded" />
          超温
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full border-2 border-purple-400 bg-purple-400/30" />
          装卸区
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full border-2 border-orange-400 bg-orange-400/30" />
          服务区
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full border-2 border-emerald-400 bg-emerald-400/30" />
          接种点
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0 border-t-2 border-dashed border-red-500/70" />
          上限
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0 border-t-2 border-dashed border-blue-500/70" />
          下限
        </span>
      </div>
    </div>
  )
}

function SegmentCard({
  segment,
  onVerdictChange,
  onNoteChange,
}: {
  segment: TemperatureSegment
  onVerdictChange: (verdict: Verdict) => void
  onNoteChange: (note: string) => void
}) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-red-400 font-medium">超温时段</span>
            <span className="text-slate-400">
              {formatDateTime(segment.startTime)} — {formatTime(segment.endTime)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              最低 <span className="text-frost-300 font-mono">{segment.minTemp}°C</span>
            </span>
            <span>
              最高 <span className="text-red-400 font-mono">{segment.maxTemp}°C</span>
            </span>
            <span>
              均温 <span className="text-frost-300 font-mono">{segment.avgTemp}°C</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <MapPin size={12} />
          <span>{segment.location}</span>
          <span className="px-1.5 py-0.5 rounded bg-frost-900/40 text-frost-400 border border-frost-800/30">
            {LOCATION_TYPE_LABELS[segment.locationType]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(['acceptable', 'needs_explanation', 'unqualified'] as Verdict[]).map((v) => {
          const style = VERDICT_STYLES[v]
          const isActive = segment.verdict === v
          return (
            <button
              key={v}
              onClick={() => onVerdictChange(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isActive
                  ? `${style.bg} ${style.border} ${style.text}`
                  : 'bg-slate-800/30 border-slate-700/30 text-slate-500 hover:border-slate-600'
              }`}
            >
              {VERDICT_LABELS[v]}
            </button>
          )
        })}
      </div>

      <input
        type="text"
        value={segment.note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="备注说明..."
        className="w-full bg-slate-800/40 border border-slate-700/30 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-frost-600/40 focus:ring-1 focus:ring-frost-600/20"
      />
    </div>
  )
}

export default function Verify() {
  const { waybillId } = useParams<{ waybillId: string }>()
  const navigate = useNavigate()

  const waybills = useStore((s) => s.waybills)
  const temperatureData = useStore((s) => s.temperatureData)
  const stopPoints = useStore((s) => s.stopPoints)
  const getWaybillSegments = useStore((s) => s.getWaybillSegments)
  const updateSegmentVerdict = useStore((s) => s.updateSegmentVerdict)
  const updateWaybillStatus = useStore((s) => s.updateWaybillStatus)
  const setSegments = useStore((s) => s.setSegments)

  const [jumpRange, setJumpRange] = useState<{
    startTime: string
    endTime: string
  } | null>(null)

  const segmentsRef = useRef<HTMLDivElement>(null)

  const waybill = waybills.find((w) => w.id === waybillId)
  const tempData = waybillId ? temperatureData[waybillId] || [] : []
  const stopPointsList = waybillId ? stopPoints[waybillId] || [] : []
  const allSegments = waybillId ? getWaybillSegments(waybillId) : []

  useEffect(() => {
    if (!waybillId || !waybill || tempData.length === 0) return
    if (allSegments.length > 0) return
    const segs = generateSegmentsFromTempData(
      waybillId,
      tempData,
      waybill.temperatureRangeMin,
      waybill.temperatureRangeMax,
      stopPointsList
    )
    if (segs.length > 0) {
      setSegments(waybillId, segs)
    }
  }, [waybillId, waybill, tempData, stopPointsList, allSegments.length, setSegments])
  const overTempSegments = allSegments.filter((s) => s.isOverTemp)
  const evaluatedCount = overTempSegments.filter((s) => s.verdict !== null).length
  const allEvaluated =
    allSegments.length > 0 &&
    (overTempSegments.length === 0 || evaluatedCount === overTempSegments.length)

  const handleVerdictChange = useCallback(
    (segmentId: string, verdict: Verdict, note?: string) => {
      updateSegmentVerdict(segmentId, verdict, note)
    },
    [updateSegmentVerdict]
  )

  const handleNoteChange = useCallback(
    (segmentId: string, note: string) => {
      const seg = allSegments.find((s) => s.id === segmentId)
      if (seg && seg.verdict) {
        updateSegmentVerdict(segmentId, seg.verdict, note)
      }
    },
    [allSegments, updateSegmentVerdict]
  )

  const handleComplete = useCallback(() => {
    if (!waybillId || !allEvaluated) return
    updateWaybillStatus(waybillId, 'verified')
    navigate(`/report/${waybillId}`)
  }, [waybillId, allEvaluated, updateWaybillStatus, navigate])

  const handleJumpToSegment = useCallback(
    (segment: TemperatureSegment) => {
      setJumpRange({ startTime: segment.startTime, endTime: segment.endTime })
      segmentsRef.current?.scrollIntoView({ behavior: 'smooth' })
    },
    []
  )

  if (!waybill || !waybillId) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p>未找到运单信息</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="glass-panel px-5 py-3 flex items-center justify-between border-b border-frost-900/30">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <FileCheck size={16} className="text-frost-400" />
            <span className="text-frost-200 font-semibold">{waybill.waybillNumber}</span>
          </div>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">
            批号: <span className="text-slate-300">{waybill.batchNumber}</span>
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <Route size={13} />
            {waybill.route}
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <Truck size={13} />
            {waybill.carrier}
          </span>
          <span className="text-slate-500">|</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <Thermometer size={13} />
            <span className="text-frost-300 font-medium">
              {waybill.temperatureRangeMin}°C ~ {waybill.temperatureRangeMax}°C
            </span>
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <TemperatureCurveCanvas
            tempData={tempData}
            stopPointsList={stopPointsList}
            tempMin={waybill.temperatureRangeMin}
            tempMax={waybill.temperatureRangeMax}
            jumpRange={jumpRange}
          />

          <div ref={segmentsRef}>
            <div className="flex items-center gap-2 mb-3 text-sm text-frost-300">
              <AlertTriangle size={16} />
              <span className="font-medium">超温时段评估</span>
              <span className="text-xs text-slate-500">
                ({evaluatedCount}/{overTempSegments.length} 已评估)
              </span>
            </div>
            {overTempSegments.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-center text-slate-500 text-sm">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                无超温时段，运输全程温控正常
              </div>
            ) : (
              <div className="space-y-3">
                {overTempSegments.map((seg) => (
                  <SegmentCard
                    key={seg.id}
                    segment={seg}
                    onVerdictChange={(v) => handleVerdictChange(seg.id, v)}
                    onNoteChange={(n) => handleNoteChange(seg.id, n)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-64 glass-panel border-l border-frost-900/30 p-4 space-y-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-frost-300 flex items-center gap-2">
            <FileCheck size={14} />
            核对概览
          </h3>

          <div className="space-y-2">
            <div className="glass-card rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">总时段数</span>
                <span className="text-slate-200 font-mono">{allSegments.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">超温时段</span>
                <span className="text-red-400 font-mono">{overTempSegments.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">已评估</span>
                <span className="text-frost-300 font-mono">{evaluatedCount}</span>
              </div>
              <div className="w-full bg-slate-800/60 rounded-full h-1.5 mt-1">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${overTempSegments.length ? (evaluatedCount / overTempSegments.length) * 100 : 0}%`,
                    background: allEvaluated
                      ? '#10b981'
                      : 'linear-gradient(90deg, #0ea5e9, #0284c7)',
                  }}
                />
              </div>
            </div>
          </div>

          {overTempSegments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-slate-500 flex items-center gap-1.5">
                <ChevronDown size={12} />
                超温时段快速跳转
              </h4>
              <div className="space-y-1.5">
                {overTempSegments.map((seg, idx) => (
                  <button
                    key={seg.id}
                    onClick={() => handleJumpToSegment(seg)}
                    className="w-full text-left glass-card rounded-lg p-2.5 hover:border-frost-600/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 group-hover:text-frost-300 transition-colors">
                        #{idx + 1}
                      </span>
                      {seg.verdict ? (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${VERDICT_STYLES[seg.verdict].bg} ${VERDICT_STYLES[seg.verdict].text}`}
                        >
                          {VERDICT_LABELS[seg.verdict]}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-600">
                          未评估
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock size={10} className="text-slate-600" />
                      <span className="text-[11px] text-slate-500 font-mono">
                        {formatTime(seg.startTime)} - {formatTime(seg.endTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin size={10} className="text-slate-600" />
                      <span className="text-[11px] text-slate-500 truncate">
                        {seg.location}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-frost-900/40 text-frost-400 border border-frost-800/30">
                        {LOCATION_TYPE_LABELS[seg.locationType]}
                      </span>
                    </div>
                    <div className="text-[11px] text-red-400/80 font-mono mt-0.5">
                      最高 {seg.maxTemp}°C
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel border-t border-frost-900/30 px-5 py-3 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {allEvaluated ? (
            <span className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              所有超温时段已评估完成
            </span>
          ) : (
            <span>
              还有 <span className="text-amber-400">{overTempSegments.length - evaluatedCount}</span>{' '}
              个超温时段待评估
            </span>
          )}
        </div>
        <button
          onClick={handleComplete}
          disabled={!allEvaluated}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            allEvaluated
              ? 'bg-frost-600 hover:bg-frost-500 text-white frost-glow'
              : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
          }`}
        >
          完成核对
        </button>
      </div>
    </div>
  )
}
