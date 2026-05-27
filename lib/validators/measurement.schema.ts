import { z } from 'zod'

const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})

export const calibrationSchema = z.object({
  photo_id: z.string().uuid(),
  x1: z.number().min(0).max(1),
  y1: z.number().min(0).max(1),
  x2: z.number().min(0).max(1),
  y2: z.number().min(0).max(1),
  real_length: z.number().positive('La longueur doit être positive'),
  unit: z.enum(['m', 'cm', 'ft', 'in']),
  px_per_unit: z.number().positive(),
})

export type CalibrationInput = z.infer<typeof calibrationSchema>

export const measurementSchema = z.object({
  photo_id: z.string().uuid(),
  project_id: z.string().uuid(),
  label: z.string().max(100).optional(),
  measurement_type: z.enum(['line', 'area', 'angle', 'perimeter']),
  points: z.array(pointSchema).min(2),
  pixel_value: z.number().nonnegative().optional(),
  real_value: z.number().nonnegative().optional(),
  unit: z.enum(['m', 'cm', 'ft', 'in']).default('m'),
  facade_side: z.enum(['front', 'back', 'left', 'right', 'roof', 'other']).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#EF4444'),
  is_visible: z.boolean().default(true),
})

export type MeasurementInput = z.infer<typeof measurementSchema>
