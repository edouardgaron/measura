// components/measurement/MeasurementCanvas.tsx
'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Stage, Layer, Line, Circle, Text, Group } from 'react-konva'
import { Ruler, Square, Crosshair, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import type { Calibration, Measurement, MeasurementPoint, MeasurementUnit, Photo } from '@/lib/supabase/types'
import {
  computeLineLength,
  computePolygonArea,
  computePxPerUnit,
  pixelToReal,
} from '@/lib/measurement/calibration'
import { formatLength, formatArea } from '@/lib/utils/format'
import { CalibrationModal } from './CalibrationModal'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tool = 'calibrate' | 'line' | 'area'

interface MeasurementCanvasProps {
  photo: Photo
  calibration: Calibration | null
  measurements: Measurement[]
  onSaveMeasurement: (m: Omit<Measurement, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onDeleteMeasurement: (id: string) => Promise<void>
  onSaveCalibration: (c: Omit<Calibration, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  projectId: string
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MEASUREMENT_COLORS = [
  '#EF4444', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
]

function nextColor(index: number): string {
  return MEASUREMENT_COLORS[index % MEASUREMENT_COLORS.length]
}

/** Convert normalized (0-1) point to canvas pixel coordinates */
function toCanvas(p: MeasurementPoint, w: number, h: number) {
  return { x: p.x * w, y: p.y * h }
}

/** Convert canvas pixel coordinates to normalized (0-1) */
function toNorm(x: number, y: number, w: number, h: number): MeasurementPoint {
  return { x: x / w, y: y / h }
}

/** Flatten normalized points to flat canvas pixel array [x0,y0,x1,y1,...] */
function flattenPoints(points: MeasurementPoint[], w: number, h: number): number[] {
  return points.flatMap((p) => [p.x * w, p.y * h])
}

/** Compute centroid of a list of normalized points */
function centroid(points: MeasurementPoint[]): MeasurementPoint {
  const x = points.reduce((s, p) => s + p.x, 0) / points.length
  const y = points.reduce((s, p) => s + p.y, 0) / points.length
  return { x, y }
}

function getMeasurementLabel(
  m: Measurement,
  calibration: Calibration | null,
  imgW: number,
  imgH: number
): string {
  if (m.measurement_type === 'area') {
    const pixelArea = computePolygonArea(m.points, 1, 1)
    if (calibration) {
      const realArea = pixelArea / (calibration.px_per_unit * calibration.px_per_unit)
      const areaM2 = toSquareMeters(realArea, calibration.unit)
      return formatArea(areaM2, 'metric')
    }
    return `${pixelArea.toFixed(0)} px²`
  } else {
    const pixelLen = computeLineLength(m.points, 1, 1)
    if (calibration) {
      const realLen = pixelToReal(pixelLen, calibration.px_per_unit)
      const realM = toMeters(realLen, calibration.unit)
      return formatLength(realM, 'metric')
    }
    return `${pixelLen.toFixed(0)} px`
  }
}

function toMeters(value: number, unit: string): number {
  switch (unit) {
    case 'cm': return value / 100
    case 'ft': return value * 0.3048
    case 'in': return value * 0.0254
    default: return value
  }
}

function toSquareMeters(value: number, unit: string): number {
  switch (unit) {
    case 'cm': return value / 10000
    case 'ft': return value * 0.092903
    case 'in': return value * 0.00064516
    default: return value
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MeasurementCanvas({
  photo,
  calibration,
  measurements,
  onSaveMeasurement,
  onDeleteMeasurement,
  onSaveCalibration,
  projectId,
  readOnly = false,
}: MeasurementCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Canvas dimensions (match displayed image size)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Active tool
  const [activeTool, setActiveTool] = useState<Tool>('line')

  // Points being drawn in current session
  const [draftPoints, setDraftPoints] = useState<MeasurementPoint[]>([])

  // Mouse position for rubber-band preview (normalized)
  const [cursorNorm, setCursorNorm] = useState<MeasurementPoint | null>(null)

  // Selected measurement id
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Calibration modal
  const [showCalibModal, setShowCalibModal] = useState(false)
  const pendingCalibPoints = useRef<[MeasurementPoint, MeasurementPoint] | null>(null)

  // Double-click detection
  const lastClickTime = useRef<number>(0)
  const lastClickPoint = useRef<{ x: number; y: number } | null>(null)

  // ---------------------------------------------------------------------------
  // Resize observer — keep canvas size in sync with displayed image
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(() => {
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect()
        setCanvasSize({ width: rect.width, height: rect.height })
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect()
      setCanvasSize({ width: rect.width, height: rect.height })
    }
  }, [])

  const { width: W, height: H } = canvasSize

  // ---------------------------------------------------------------------------
  // Canvas event helpers
  // ---------------------------------------------------------------------------

  function getStagePos(e: import('konva/lib/Node').KonvaEventObject<MouseEvent>): { x: number; y: number } {
    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    return pos ?? { x: 0, y: 0 }
  }

  function isDoubleClick(x: number, y: number): boolean {
    const now = Date.now()
    const last = lastClickTime.current
    const lastPos = lastClickPoint.current
    const dist = lastPos
      ? Math.sqrt((x - lastPos.x) ** 2 + (y - lastPos.y) ** 2)
      : Infinity
    lastClickTime.current = now
    lastClickPoint.current = { x, y }
    return now - last < 350 && dist < 10
  }

  // ---------------------------------------------------------------------------
  // Finish drawing — save measurement
  // ---------------------------------------------------------------------------

  const finishDrawing = useCallback(
    async (points: MeasurementPoint[]) => {
      if (points.length < 2) {
        setDraftPoints([])
        setCursorNorm(null)
        return
      }

      const isArea = activeTool === 'area'
      const color = nextColor(measurements.length)

      // Compute pixel values using normalized coords
      let pixelValue: number
      if (isArea) {
        pixelValue = computePolygonArea(points, 1, 1)
      } else {
        pixelValue = computeLineLength(points, 1, 1)
      }

      let realValue: number | null = null
      let unit: MeasurementUnit = 'm'

      if (calibration) {
        unit = calibration.unit
        if (isArea) {
          const rawReal = pixelValue / (calibration.px_per_unit * calibration.px_per_unit)
          realValue = rawReal
        } else {
          realValue = pixelToReal(pixelValue, calibration.px_per_unit)
        }
      }

      await onSaveMeasurement({
        photo_id: photo.id,
        project_id: projectId,
        label: null,
        measurement_type: isArea ? 'area' : 'line',
        points,
        pixel_value: pixelValue,
        real_value: realValue,
        unit,
        facade_side: photo.facade_label,
        color,
        is_visible: true,
        created_by: null,
      })

      setDraftPoints([])
      setCursorNorm(null)
    },
    [activeTool, measurements.length, calibration, photo, projectId, onSaveMeasurement]
  )

  // ---------------------------------------------------------------------------
  // Stage click handler
  // ---------------------------------------------------------------------------

  const handleStageClick = useCallback(
    (e: import('konva/lib/Node').KonvaEventObject<MouseEvent>) => {
      if (readOnly) return
      // Only handle clicks on background (stage or image rect), not on measurements
      const targetName = e.target.name()
      if (targetName && targetName !== 'background') {
        // Clicking a measurement shape — let measurement click handler deal with it
        return
      }

      const { x, y } = getStagePos(e)
      const dbl = isDoubleClick(x, y)

      if (activeTool === 'calibrate') {
        const norm = toNorm(x, y, W, H)
        const next = [...draftPoints, norm]
        if (next.length === 2) {
          pendingCalibPoints.current = [next[0], next[1]]
          setDraftPoints([])
          setCursorNorm(null)
          setShowCalibModal(true)
        } else {
          setDraftPoints(next)
        }
        return
      }

      if (activeTool === 'line' || activeTool === 'area') {
        if (dbl && draftPoints.length >= 2) {
          // Finish drawing (remove the duplicate point added by the double click)
          finishDrawing(draftPoints.slice(0, -1))
          return
        }
        const norm = toNorm(x, y, W, H)
        setDraftPoints((prev) => [...prev, norm])
        return
      }
    },
    [readOnly, activeTool, draftPoints, W, H, finishDrawing]
  )

  const handleStageMouseMove = useCallback(
    (e: import('konva/lib/Node').KonvaEventObject<MouseEvent>) => {
      if (readOnly) return
      if (activeTool !== 'line' && activeTool !== 'area') return
      const { x, y } = getStagePos(e)
      setCursorNorm(toNorm(x, y, W, H))
    },
    [readOnly, activeTool, W, H]
  )

  // ---------------------------------------------------------------------------
  // Calibration confirm
  // ---------------------------------------------------------------------------

  const handleCalibrationConfirm = useCallback(
    async (realLength: number, unit: MeasurementUnit) => {
      setShowCalibModal(false)
      const pts = pendingCalibPoints.current
      if (!pts) return
      const [p1, p2] = pts
      pendingCalibPoints.current = null

      const pxPerUnit = computePxPerUnit(p1, p2, realLength, 1, 1)

      await onSaveCalibration({
        photo_id: photo.id,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        real_length: realLength,
        unit,
        px_per_unit: pxPerUnit,
        created_by: null,
      })
    },
    [photo.id, onSaveCalibration]
  )

  // ---------------------------------------------------------------------------
  // Delete selected
  // ---------------------------------------------------------------------------

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedId) return
    await onDeleteMeasurement(selectedId)
    setSelectedId(null)
  }, [selectedId, onDeleteMeasurement])

  // ---------------------------------------------------------------------------
  // Tool reset on switch
  // ---------------------------------------------------------------------------

  function setTool(tool: Tool) {
    setActiveTool(tool)
    setDraftPoints([])
    setCursorNorm(null)
    setSelectedId(null)
  }

  // ---------------------------------------------------------------------------
  // Cursor style
  // ---------------------------------------------------------------------------

  const cursorStyle =
    activeTool === 'calibrate' || activeTool === 'line' || activeTool === 'area'
      ? 'crosshair'
      : 'default'

  // ---------------------------------------------------------------------------
  // Preview line points (rubber band)
  // ---------------------------------------------------------------------------

  const previewPoints: number[] = (() => {
    if (draftPoints.length === 0 || !cursorNorm) return []
    const last = draftPoints[draftPoints.length - 1]
    return [last.x * W, last.y * H, cursorNorm.x * W, cursorNorm.y * H]
  })()

  // Draft flat points
  const draftFlat = flattenPoints(draftPoints, W, H)

  // ---------------------------------------------------------------------------
  // Calibration line display
  // ---------------------------------------------------------------------------

  const calibLine = calibration
    ? flattenPoints(
        [
          { x: calibration.x1, y: calibration.y1 },
          { x: calibration.x2, y: calibration.y2 },
        ],
        W,
        H
      )
    : null

  // ---------------------------------------------------------------------------
  // Keyboard: Escape cancels draft, Delete removes selected
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDraftPoints([])
        setCursorNorm(null)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !readOnly) {
        handleDeleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, readOnly, handleDeleteSelected])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const toolButtonClass = (tool: Tool) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      activeTool === tool && !readOnly
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
    } ${readOnly ? 'opacity-40 cursor-not-allowed' : ''}`

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={toolButtonClass('calibrate')}
            onClick={() => setTool('calibrate')}
            title="Tracer la ligne de référence pour la calibration"
          >
            <Crosshair className="h-4 w-4" />
            Calibrer
          </button>
          <button
            className={toolButtonClass('line')}
            onClick={() => setTool('line')}
            title="Mesurer une distance"
          >
            <Ruler className="h-4 w-4" />
            Ligne
          </button>
          <button
            className={toolButtonClass('area')}
            onClick={() => setTool('area')}
            title="Mesurer une surface"
          >
            <Square className="h-4 w-4" />
            Surface
          </button>

          {selectedId && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer sélection
            </button>
          )}

          {/* Calibration status badge */}
          {calibration ? (
            <span className="ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Calibré · {calibration.real_length} {calibration.unit}
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Non calibré
            </span>
          )}
        </div>
      )}

      {/* Tool hint */}
      {!readOnly && (
        <p className="text-xs text-gray-400">
          {activeTool === 'calibrate' &&
            'Cliquez deux points pour définir une distance connue.'}
          {activeTool === 'line' &&
            'Cliquez pour ajouter des points. Double-cliquez pour terminer.'}
          {activeTool === 'area' &&
            'Cliquez pour dessiner un polygone. Double-cliquez pour fermer.'}
        </p>
      )}

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-xl border border-gray-200 bg-black"
        style={{ cursor: readOnly ? 'default' : cursorStyle }}
      >
        {/* Photo */}
        <img
          ref={imgRef}
          src={photo.url}
          alt={photo.original_name ?? 'Photo'}
          className="block w-full object-contain"
          onLoad={handleImageLoad}
          draggable={false}
        />

        {/* Konva overlay */}
        {W > 0 && H > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-start"
            style={{ pointerEvents: readOnly ? 'none' : 'auto' }}>
            <Stage
              width={W}
              height={H}
              onClick={handleStageClick}
              onMouseMove={handleStageMouseMove}
              style={{ pointerEvents: readOnly ? 'none' : 'auto' }}
            >
              <Layer>
                {/* Invisible background hit area */}
                <Line
                  name="background"
                  points={[0, 0, W, 0, W, H, 0, H, 0, 0]}
                  closed
                  fill="transparent"
                  stroke="transparent"
                />

                {/* Existing calibration line */}
                {calibLine && (
                  <Line
                    points={calibLine}
                    stroke="#FBBF24"
                    strokeWidth={2}
                    dash={[6, 4]}
                  />
                )}

                {/* Saved measurements */}
                {measurements.map((m) => {
                  if (!m.is_visible) return null
                  const flat = flattenPoints(m.points, W, H)
                  const isSelected = m.id === selectedId
                  const strokeWidth = isSelected ? 3 : 2
                  const center = centroid(m.points)
                  const valueLabel = getMeasurementLabel(m, calibration, W, H)
                  const displayLabel = m.label
                    ? `${m.label}: ${valueLabel}`
                    : valueLabel

                  return (
                    <Group
                      key={m.id}
                      onClick={(e) => {
                        e.cancelBubble = true
                        setSelectedId(m.id === selectedId ? null : m.id)
                      }}
                    >
                      <Line
                        points={flat}
                        stroke={m.color}
                        strokeWidth={strokeWidth}
                        closed={m.measurement_type === 'area'}
                        fill={
                          m.measurement_type === 'area'
                            ? m.color + '33'
                            : undefined
                        }
                        lineCap="round"
                        lineJoin="round"
                        shadowColor={isSelected ? m.color : undefined}
                        shadowBlur={isSelected ? 8 : 0}
                        hitStrokeWidth={12}
                      />

                      {/* Vertex dots */}
                      {m.points.map((p, i) => (
                        <Circle
                          key={i}
                          x={p.x * W}
                          y={p.y * H}
                          radius={isSelected ? 5 : 4}
                          fill={m.color}
                          stroke="white"
                          strokeWidth={1.5}
                        />
                      ))}

                      {/* Label */}
                      <Text
                        x={center.x * W + 6}
                        y={center.y * H - 10}
                        text={displayLabel}
                        fontSize={12}
                        fontFamily="system-ui, sans-serif"
                        fill="white"
                        shadowColor="black"
                        shadowBlur={3}
                        shadowOffsetX={0}
                        shadowOffsetY={1}
                      />
                    </Group>
                  )
                })}

                {/* Draft in-progress line */}
                {draftPoints.length >= 2 && (
                  <Line
                    points={draftFlat}
                    stroke={activeTool === 'calibrate' ? '#FBBF24' : '#60A5FA'}
                    strokeWidth={2}
                    dash={activeTool === 'calibrate' ? [6, 4] : undefined}
                    lineCap="round"
                    closed={false}
                  />
                )}

                {/* Draft vertex dots */}
                {draftPoints.map((p, i) => (
                  <Circle
                    key={i}
                    x={p.x * W}
                    y={p.y * H}
                    radius={4}
                    fill={activeTool === 'calibrate' ? '#FBBF24' : '#60A5FA'}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                ))}

                {/* Rubber-band preview */}
                {previewPoints.length === 4 && (
                  <Line
                    points={previewPoints}
                    stroke={activeTool === 'calibrate' ? '#FBBF2480' : '#60A5FA80'}
                    strokeWidth={1.5}
                    dash={[4, 3]}
                    lineCap="round"
                  />
                )}
              </Layer>
            </Stage>
          </div>
        )}
      </div>

      {/* Calibration modal */}
      <CalibrationModal
        isOpen={showCalibModal}
        onClose={() => {
          setShowCalibModal(false)
          pendingCalibPoints.current = null
        }}
        onConfirm={handleCalibrationConfirm}
      />
    </div>
  )
}
