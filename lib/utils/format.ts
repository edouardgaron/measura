import type { MeasurementUnit, UnitSystem } from '@/lib/supabase/types'

export function formatDate(date: string | Date, locale = 'fr-CA'): string {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date, locale = 'fr-CA'): string {
  return new Date(date).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatArea(
  valueM2: number,
  unitSystem: UnitSystem = 'metric'
): string {
  if (unitSystem === 'imperial') {
    const sqft = valueM2 * 10.7639
    return `${sqft.toFixed(1)} pi²`
  }
  return `${valueM2.toFixed(2)} m²`
}

export function formatLength(
  valueM: number,
  unitSystem: UnitSystem = 'metric'
): string {
  if (unitSystem === 'imperial') {
    const totalInches = valueM * 39.3701
    const feet = Math.floor(totalInches / 12)
    const inches = Math.round(totalInches % 12)
    if (inches === 0) return `${feet} pi`
    return `${feet}' ${inches}"`
  }
  if (valueM >= 1) return `${valueM.toFixed(2)} m`
  return `${(valueM * 100).toFixed(1)} cm`
}

export function convertUnit(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  // Convert to meters first
  let meters: number
  switch (from) {
    case 'm': meters = value; break
    case 'cm': meters = value / 100; break
    case 'ft': meters = value * 0.3048; break
    case 'in': meters = value * 0.0254; break
  }
  // Convert from meters
  switch (to) {
    case 'm': return meters
    case 'cm': return meters * 100
    case 'ft': return meters / 0.3048
    case 'in': return meters / 0.0254
  }
}

export function formatMeasurement(value: number, unit: MeasurementUnit): string {
  const symbols: Record<MeasurementUnit, string> = {
    m: 'm',
    cm: 'cm',
    ft: 'pi',
    in: 'po',
  }
  return `${value.toFixed(2)} ${symbols[unit]}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}
