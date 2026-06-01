// components/workorder/SignaturePad.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

interface Props {
  value: string | null            // base64 PNG existante
  onChange: (dataUrl: string | null) => void
  label?: string
}

/**
 * Pad de signature manuscrite (souris + tactile) basé sur <canvas>.
 * Émet un PNG base64 via onChange à chaque fin de trait.
 */
export default function SignaturePad({ value, onChange, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasStrokes = useRef(false)
  const [empty, setEmpty] = useState(!value)

  // Initialise le canvas (résolution physique) et restaure une signature existante
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1f2937'

    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
      img.src = value
      hasStrokes.current = true
      // `empty` est déjà initialisé à false quand `value` existe (useState(!value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasStrokes.current = true
    if (empty) setEmpty(false)
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    if (hasStrokes.current) {
      onChange(canvasRef.current!.toDataURL('image/png'))
    }
  }

  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasStrokes.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div>
      {label && <p className="mb-1 text-sm font-medium text-gray-700">{label}</p>}
      <div className="relative rounded-lg border border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          className="h-32 w-full touch-none rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-300">
            Signez ici
          </span>
        )}
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
        >
          <Eraser className="h-3 w-3" />
          Effacer
        </button>
      </div>
    </div>
  )
}
