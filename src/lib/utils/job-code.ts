import { format } from 'date-fns'

export function generateJobCode(): string {
  const now = new Date()
  const dateStr = format(now, 'yyyyMMddHHmmss')
  const randomStr = crypto.randomUUID().substring(0, 4)
  return `JOB_${dateStr}_${randomStr}`
}
