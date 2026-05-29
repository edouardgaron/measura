import { z } from 'zod'

export const createProjectSchema = z.object({
  title: z.string().min(2, 'Le titre doit avoir au moins 2 caractères').max(100),
  building_type: z.enum(['residential', 'commercial', 'industrial']).default('residential'),
  unit_system: z.enum(['metric', 'imperial']).default('metric'),
  notes: z.string().max(2000).optional(),
  address_line1: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_province: z.string().max(100).optional(),
  address_postal: z.string().max(20).optional(),
  address_country: z.string().max(10).default('CA'),
  invite_email: z.string().email().optional().or(z.literal('')),
})

export type CreateProjectInput = z.input<typeof createProjectSchema>

export const updateProjectSchema = createProjectSchema.partial()

export const inviteClientSchema = z.object({
  email: z.string().email('Courriel invalide'),
  role: z.enum(['owner', 'editor', 'client']).default('client'),
})

export type InviteClientInput = z.infer<typeof inviteClientSchema>
