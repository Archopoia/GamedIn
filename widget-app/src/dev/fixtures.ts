import type { ApplicationSource } from '../domain/types'

const ROLES = [
  'Frontend Engineer',
  'Backend Developer',
  'Full Stack Engineer',
  'DevOps Engineer',
  'Product Manager',
  'UX Designer',
  'Data Scientist',
  'ML Engineer',
  'QA Engineer',
  'Tech Lead',
]

const COMPANIES = [
  'Acme Corp',
  'TechStart Inc',
  'CloudNine',
  'DataFlow',
  'SecureNet',
  'GreenLeaf',
  'Nexus Labs',
  'Pixel Forge',
  'ByteWorks',
  'Quantum Systems',
]

const SOURCES: ApplicationSource[] = ['linkedin', 'indeed', 'glassdoor', 'other']

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function randomQualityScore(): 1 | 2 | 3 | 4 | 5 {
  return (Math.floor(Math.random() * 5) + 1) as 1 | 2 | 3 | 4 | 5
}

export interface TestApplicationInput {
  title: string
  company: string
  source: ApplicationSource
  qualityScore: 1 | 2 | 3 | 4 | 5
}

export function generateTestApplication(): TestApplicationInput {
  return {
    title: randomPick(ROLES),
    company: randomPick(COMPANIES),
    source: randomPick(SOURCES),
    qualityScore: randomQualityScore(),
  }
}

export function generateTestApplications(count: number): TestApplicationInput[] {
  const result: TestApplicationInput[] = []
  for (let i = 0; i < count; i++) {
    result.push(generateTestApplication())
  }
  return result
}
