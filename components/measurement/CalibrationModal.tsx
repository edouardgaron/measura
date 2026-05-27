// components/measurement/CalibrationModal.tsx
'use client'

import { useState } from 'react'
import type { MeasurementUnit } from '@/lib/supabase/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface CalibrationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (realLength: number, unit: MeasurementUnit) => void
}

const UNIT_OPTIONS: { value: MeasurementUnit; label: string }[] = [
  { value: 'm', label: 'Mètres (m)' },
  { value: 'cm', label: 'Centimètres (cm)' },
  { value: 'ft', label: 'Pieds (pi)' },
  { value: 'in', label: 'Pouces (po)' },
]

export function CalibrationModal({ isOpen, onClose, onConfirm }: CalibrationModalProps) {
  const [length, setLength] = useState<string>('')
  const [unit, setUnit] = useState<MeasurementUnit>('m')
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    const value = parseFloat(length)
    if (isNaN(value) || value <= 0) {
      setError('Veuillez entrer une longueur valide et positive.')
      return
    }
    setError(null)
    onConfirm(value, unit)
    setLength('')
    setUnit('m')
  }

  function handleClose() {
    setLength('')
    setUnit('m')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Calibrer la distance</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-gray-600">
          Entrez la longueur réelle de la ligne tracée.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longueur réelle
            </label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={length}
              onChange={(e) => {
                setLength(e.target.value)
                setError(null)
              }}
              placeholder="ex: 3.5"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm()
                if (e.key === 'Escape') handleClose()
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unité
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as MeasurementUnit)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Confirmer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
