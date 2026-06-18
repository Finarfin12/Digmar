import { createClient } from '@/lib/supabase/server'
import { getAIProvider, getVisionAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { format, addDays } from 'date-fns'
import { generateJobCode } from '@/lib/utils/job-code'

import { handleApiError } from '@/lib/utils/error-handler'
import { logger } from '@/lib/utils/logger'
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { 
      business_unit_id, 
      target_account_ids, 
      media_urls, 
      post_type, 
      content_idea, 
      tone_voice = 'profesional',
      preferred_provider 
    } = await request.json()

    if (!business_unit_id || !content_idea || !target_account_ids || target_account_ids.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('*')
      .eq('id', business_unit_id)
      .eq('user_id', user.id) // H8 Fix: Verifikasi kepemilikan
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    const { client, config } = await getAIProvider(user.id, preferred_provider)
    
    // --- 0. Vision AI (Optional) ---
    let imageContext = '';
    if (unit.use_vision_ai && media_urls && media_urls.length > 0) {
      const firstMedia = media_urls[0];
      const isImage = firstMedia.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/) != null || firstMedia.includes('image');
      if (isImage) {
        try {
          const { client: visionClient } = await getVisionAIProvider(user.id);
          const visionPrompt = "Deskripsikan gambar ini secara detail: objek utama, mood/suasana, dan siapa target audiens yang cocok.";
          const visionResponse = await visionClient.generateText(
            "Anda adalah asisten AI penganalisa gambar yang sangat ahli dalam mendeskripsikan konteks visual untuk kebutuhan social media marketing.",
            visionPrompt,
            { imageUrl: firstMedia, maxTokens: 400, jsonMode: false }
          );
          imageContext = visionResponse.content;
          console.log("Vision Context Success:", imageContext);
        } catch (visionError) {
          logger.error("Vision AI failed, continuing without it:", visionError);
        }
      }
    }

    // --- 1. Generate Caption ---
    const captionPrompt = `
Konteks Postingan/Ide: ${content_idea}
${imageContext ? `Konteks Gambar (Hasil Bacaan AI dari gambar yang diupload): ${imageContext}` : ''}
Gaya Bahasa (Tone): ${tone_voice}

INSTRUKSI SANGAT PENTING:
Buatlah SATU caption yang SANGAT MENGHARGAI Gaya Bahasa (Tone) yang diminta.
Kembalikan HANYA dalam format JSON (tanpa awalan markdown apapun):
{
  "caption": "Tulis caption lengkap di sini, berikan jarak baris",
  "first_comment": "hashtag atau kalimat untuk komentar pertama (opsional, jika dirasa perlu)"
}
`;

    const capResponse = await client.generateText(unit.ai_system_prompt || '', captionPrompt, {
      temperature: config.config?.temperature || 0.85,
      maxTokens: 800
    })

    let generatedCaption = '';
    let generatedComment = '';
    try {
      const parsedCap = JSON.parse(capResponse.content.replace(/```json/g, '').replace(/```/g, '').trim())
      generatedCaption = parsedCap.caption;
      generatedComment = parsedCap.first_comment || '';
    } catch (e) {
      logger.error("Gagal parse caption dari AI:", capResponse.content);
      // Fallback
      generatedCaption = capResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    // --- 2. Generate Best Time ---
    const now = new Date()
    const tomorrow = addDays(now, 1)
    
    const btSystemPrompt = "Anda adalah Social Media Strategist jenius yang menguasai algoritma waktu tayang (best time to post)."
    const btUserPrompt = `
Klien: ${unit.brand_name}
Industri: ${unit.business_category || 'Umum'}
Hari ini: ${format(now, 'EEEE, yyyy-MM-dd HH:mm:ss')}

Tentukan SATU waktu tayang paling optimal untuk klien ini berdasarkan industri. 
KEMBALIKAN HANYA DALAM FORMAT JSON:
{
  "scheduled_at": "YYYY-MM-DDTHH:mm"
}
`;

    const btResponse = await client.generateText(btSystemPrompt, btUserPrompt, {
      temperature: 0.7,
      maxTokens: 200
    })

    let scheduledAt = format(addDays(now, 1), "yyyy-MM-dd'T'12:00");
    try {
      const parsedBt = JSON.parse(btResponse.content.replace(/```json/g, '').replace(/```/g, '').trim())
      if (parsedBt.scheduled_at && !isNaN(new Date(parsedBt.scheduled_at).getTime())) {
        scheduledAt = parsedBt.scheduled_at
      }
    } catch (e) {
      logger.error("Gagal parse best time dari AI:", btResponse.content);
    }

    // --- Fase 5: Variable Replace ---
    let finalCaption = generatedCaption;
    let finalComment = generatedComment;
    
    const vars = unit.custom_variables || {}
    const defaultVars: Record<string, string> = {
      brand: unit.brand_name,
      tanggal: new Date(scheduledAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    }
    const allVars = { ...vars, ...defaultVars }
    const replacer = (match: string, p1: string) => {
      const key = p1.trim()
      return allVars[key] !== undefined ? String(allVars[key]) : match
    }
    
    finalCaption = finalCaption.replace(/\{([^}]+)\}/g, replacer)
    finalComment = finalComment.replace(/\{([^}]+)\}/g, replacer)

    // --- 3. Insert to Queue ---
    const { data: insertedData, error: insertError } = await supabase
      .from('post_queue')
      .insert([
        {
          user_id: user.id,
          job_code: generateJobCode(),
          target_account_ids,
          scheduled_at: scheduledAt,
          media_urls,
          caption: finalCaption,
          first_comment: finalComment,
          post_type,
          cover_url: null,
          status: 'waiting',
          log_messages: []
        }
      ])
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ success: true, data: insertedData })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
