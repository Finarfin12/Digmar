import { format } from 'date-fns'

export function generateJobCode(): string {
  const now = new Date()
  const dateStr = format(now, 'yyyyMMddHHmmss')
  const randomStr = Math.random().toString(36).substring(2, 6).toLowerCase()
  return `JOB_${dateStr}_${randomStr}`
}
