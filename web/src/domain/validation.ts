import { z } from 'zod'

const sourceSchema = z.enum(['linkedin', 'indeed', 'glassdoor', 'other'])

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(32),
  preferredRoles: z.array(z.string().trim().min(2)).max(5),
  dailyApplyGoal: z.number().int().min(1).max(20),
})

export const applicationInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
  company: z.string().trim().min(2).max(80),
  source: sourceSchema,
  qualityScore: z.number().int().min(1).max(5),
})

export type ApplicationInput = z.infer<typeof applicationInputSchema>
