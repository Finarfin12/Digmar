import type { createClient } from '@/lib/supabase/server'

export const IDEA_STATUSES = ['unassigned', 'todo', 'in_progress', 'done']
export const IDEA_PRIORITIES = ['low', 'medium', 'high']

// Kembalikan pesan error jika field tidak valid, null jika valid
export async function validateIdeaFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  fields: Record<string, unknown>,
): Promise<string | null> {
  if (fields.status !== undefined && !IDEA_STATUSES.includes(String(fields.status))) {
    return 'Invalid status'
  }
  if (fields.priority !== undefined && !IDEA_PRIORITIES.includes(String(fields.priority))) {
    return 'Invalid priority'
  }
  if (fields.tags !== undefined && (!Array.isArray(fields.tags) || fields.tags.some(t => typeof t !== 'string'))) {
    return 'Tags must be an array of strings'
  }
  if (fields.position !== undefined && !Number.isInteger(fields.position)) {
    return 'Position must be an integer'
  }
  if (fields.business_unit_id) {
    const { data: unit } = await supabase
      .from('business_units')
      .select('id')
      .eq('id', String(fields.business_unit_id))
      .eq('user_id', userId)
      .maybeSingle()
    if (!unit) return 'Business unit not found'
  }
  return null
}
