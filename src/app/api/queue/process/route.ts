import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse, type NextRequest } from 'next/server'
import { generateJobCode } from '@/lib/utils/job-code'


import { handleApiError } from '@/lib/utils/error-handler'
export async function GET(request: NextRequest) {
  // Hanya proses jika diakses dengan token atau auth khusus, 
  // Untuk contoh cron job public, kita batasi dengan Auth header secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  
  try {
    // 1. Ambil semua jadwal rutin yang aktif
    const { data: schedules } = await supabase
      .from('posting_schedules')
      .select('*')
      .eq('is_active', true)

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ message: 'No active schedules' })
    }

    const processed = []

    for (const schedule of schedules) {
      // 2. Hitung timestamp untuk 7 hari ke depan
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const targetDates = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        if (d.getDay() === schedule.day_of_week) {
          const [hours, minutes] = schedule.time_of_day.split(':')
          d.setHours(parseInt(hours), parseInt(minutes), 0, 0)
          // Jika waktu target sudah lewat hari ini, lewati
          if (d > new Date()) {
            targetDates.push(d)
          }
        }
      }

      for (const targetDate of targetDates) {
        const targetDateIso = targetDate.toISOString()

        // 3. Cek apakah slot waktu ini sudah terisi di post_queue
        // Kita perlu mencari post_queue yg memiliki target_account_ids dari business_unit ini
        // Cara termudah: post_queue -> social_accounts -> business_units
        // Tapi target_account_ids berupa JSON array of IDs.
        // Mari kita ambil dulu akun-akun dari business unit ini
        const { data: accounts } = await supabase
          .from('social_accounts')
          .select('id')
          .eq('business_unit_id', schedule.business_unit_id)

        if (!accounts || accounts.length === 0) continue
        
        const accountIds = accounts.map(a => a.id)
        
        // Cek post_queue pada jam tersebut
        const { data: existingQueue } = await supabase
          .from('post_queue')
          .select('id')
          .eq('scheduled_at', targetDateIso)
          .contains('target_account_ids', [accountIds[0]]) // simplifikasi: cek salah satu
          .limit(1)

        if (existingQueue && existingQueue.length > 0) {
          continue // Slot sudah terisi
        }

        // 4. Jika slot kosong, ambil dari content_queue
        const { data: contentItem } = await supabase
          .from('content_queue')
          .select('*')
          .eq('business_unit_id', schedule.business_unit_id)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .single()

        if (contentItem) {
          // Fase 5: Apply Variables (simpel)
          const { data: unitInfo } = await supabase
            .from('business_units')
            .select('brand_name, custom_variables, user_id')
            .eq('id', schedule.business_unit_id)
            .single()

          let processedCaption = contentItem.caption || ''
          let processedFirstComment = contentItem.first_comment || ''

          if (unitInfo) {
            const vars = unitInfo.custom_variables || {}
            const defaultVars: Record<string, string> = {
              brand: unitInfo.brand_name,
              tanggal: targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            }
            const allVars = { ...vars, ...defaultVars }
            const replacer = (match: string, p1: string) => {
              const key = p1.trim()
              return allVars[key] !== undefined ? String(allVars[key]) : match
            }
            processedCaption = processedCaption.replace(/\{([^}]+)\}/g, replacer)
            processedFirstComment = processedFirstComment.replace(/\{([^}]+)\}/g, replacer)
          }

          // Masukkan ke post_queue
          const { error: insertError } = await supabase
            .from('post_queue')
            .insert([{
              user_id: unitInfo?.user_id,
              job_code: generateJobCode(),
              target_account_ids: accountIds,
              scheduled_at: targetDateIso,
              media_urls: contentItem.media_urls || [],
              caption: processedCaption,
              first_comment: processedFirstComment,
              post_type: contentItem.post_type || 'single_image',
              cover_url: contentItem.cover_url || null,
              status: 'waiting',
              log_messages: []
            }])

          if (!insertError) {
            // Hapus dari content_queue agar tidak dipost 2 kali
            await supabase
              .from('content_queue')
              .delete()
              .eq('id', contentItem.id)

            processed.push({
              scheduleId: schedule.id,
              scheduledAt: targetDateIso,
              contentId: contentItem.id
            })
          }
        }
      }
    }

    return NextResponse.json({ processed })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
