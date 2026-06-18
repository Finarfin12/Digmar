import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

function generateJobCode(): string {
  const dateStr = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
  const randomStr = crypto.randomUUID().substring(0, 4);
  return `JOB_${dateStr}_${randomStr}`;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'CSV file required' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV kosong atau format salah' }, { status: 400 })
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maksimal 500 baris per file' }, { status: 400 })
    }

interface BulkRow {
  user_id: string;
  job_code: string;
  target_account_ids: string[];
  scheduled_at: string;
  caption: string;
  first_comment: string | null;
  media_urls: string[];
  post_type: string;
  cover_url: string | null;
  status: string;
  log_messages: never[];
}

    const errors: { row: number; error: string }[] = []
    const validRows: BulkRow[] = []

    const { data: userAccounts } = await supabase
      .from('social_accounts')
      .select('id, business_unit_id')
      .eq('business_units.user_id', user.id)

    const validAccountIds = new Set((userAccounts || []).map(a => a.id))

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      if (!row.target_account_ids) {
        errors.push({ row: rowNum, error: 'target_account_ids wajib diisi' })
        continue
      }

      const ids = row.target_account_ids.split(',').map(s => s.trim()).filter(Boolean)
      const invalidIds = ids.filter(id => !validAccountIds.has(id))

      if (invalidIds.length > 0) {
        errors.push({ row: rowNum, error: `Akun tidak valid atau bukan milik Anda: ${invalidIds.join(', ')}` })
        continue
      }

      if (!row.scheduled_at) {
        errors.push({ row: rowNum, error: 'scheduled_at wajib diisi' })
        continue
      }

      const scheduledAt = new Date(row.scheduled_at)
      if (isNaN(scheduledAt.getTime())) {
        errors.push({ row: rowNum, error: 'Format scheduled_at tidak valid (gunakan ISO 8601)' })
        continue
      }

      if (!row.caption || row.caption.length < 1) {
        errors.push({ row: rowNum, error: 'caption wajib diisi' })
        continue
      }

      if (row.caption.length > 2200) {
        errors.push({ row: rowNum, error: 'caption terlalu panjang (maks 2200 karakter)' })
        continue
      }

      const validTypes = ['single_image', 'carousel', 'reels']
      if (row.post_type && !validTypes.includes(row.post_type)) {
        errors.push({ row: rowNum, error: `post_type tidak valid: ${row.post_type}` })
        continue
      }

      let mediaUrls: string[] = []
      if (row.media_urls) {
        mediaUrls = row.media_urls.split(',').map(s => s.trim()).filter(Boolean)
      }

      let firstComment = row.first_comment || null
      if (firstComment && row.tone_voice && row.content_idea) {
        firstComment = null // akan di-generate AI nanti
      }

      validRows.push({
        user_id: user.id,
        job_code: generateJobCode(),
        target_account_ids: ids,
        scheduled_at: scheduledAt.toISOString(),
        caption: row.caption,
        first_comment: firstComment,
        media_urls: mediaUrls,
        post_type: row.post_type || 'single_image',
        cover_url: row.cover_url || null,
        status: 'waiting',
        log_messages: [],
      })
    }

    const total = rows.length
    const failed = errors.length
    let success = 0

    if (validRows.length > 0) {
      const chunkSize = 10
      for (let i = 0; i < validRows.length; i += chunkSize) {
        const chunk = validRows.slice(i, i + chunkSize)
        const { error: insertErr } = await supabase.from('post_queue').insert(chunk)
        if (insertErr) {
          errors.push({ row: 0, error: `Insert batch error: ${insertErr.message}` })
        } else {
          success += chunk.length
        }
      }
    }

    return NextResponse.json({ total, success, failed, errors })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
