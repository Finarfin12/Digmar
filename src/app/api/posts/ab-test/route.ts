import { createClient } from '@/lib/supabase/server'
import { getAIProvider, getVisionAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { format, addDays } from 'date-fns'
import { generateJobCode } from '@/lib/utils/job-code'

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
      tone_a = 'Formal/Profesional',
      tone_b = 'Humor/Santai',
      preferred_provider 
    } = await request.json()

    if (!business_unit_id || !content_idea || !target_account_ids || target_account_ids.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('*')
      .eq('id', business_unit_id)
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
        } catch (visionError) {
          console.error("Vision AI failed, continuing without it:", visionError);
        }
      }
    }

    // --- 1. Generate Caption untuk A/B Testing ---
    const captionPrompt = `
Konteks Postingan/Ide: ${content_idea}
${imageContext ? `Konteks Gambar (Hasil Bacaan AI dari gambar yang diupload): ${imageContext}` : ''}

Anda sedang melakukan A/B Testing. Buatlah 2 Varian Caption untuk ide di atas.
- VARIAN A harus menggunakan Gaya Bahasa (Tone): ${tone_a}
- VARIAN B harus menggunakan Gaya Bahasa (Tone): ${tone_b}

KEMBALIKAN HANYA DALAM FORMAT JSON BERIKUT (tanpa awalan markdown):
{
  "varian_a": {
    "caption": "Tulis caption A lengkap di sini",
    "first_comment": "hashtag atau kalimat untuk komentar A"
  },
  "varian_b": {
    "caption": "Tulis caption B lengkap di sini",
    "first_comment": "hashtag atau kalimat untuk komentar B"
  }
}
`;

    const capResponse = await client.generateText(unit.ai_system_prompt || '', captionPrompt, {
      temperature: config.config?.temperature || 0.85,
      maxTokens: 1500
    })

    let capA = { caption: '', first_comment: '' };
    let capB = { caption: '', first_comment: '' };
    try {
      const parsedCap = JSON.parse(capResponse.content.replace(/```json/g, '').replace(/```/g, '').trim())
      capA = parsedCap.varian_a || parsedCap.variant_a || { caption: 'Error A', first_comment: '' };
      capB = parsedCap.varian_b || parsedCap.variant_b || { caption: 'Error B', first_comment: '' };
    } catch (e) {
      throw new Error("Gagal parse caption dari AI untuk A/B test.");
    }

    // --- Fase 5: Variable Replace (Sama seperti autopilot) ---
    const vars = unit.custom_variables || {}
    const replacer = (match: string, p1: string) => {
      const key = p1.trim()
      return vars[key] !== undefined ? String(vars[key]) : match
    }
    
    capA.caption = capA.caption.replace(/\{([^}]+)\}/g, replacer)
    capA.first_comment = (capA.first_comment || '').replace(/\{([^}]+)\}/g, replacer)
    capB.caption = capB.caption.replace(/\{([^}]+)\}/g, replacer)
    capB.first_comment = (capB.first_comment || '').replace(/\{([^}]+)\}/g, replacer)

    // --- 2. Tentukan Best Time A & B ---
    // A/B test biasanya diadu di jam yang sama tapi hari berbeda, atau hari sama tapi pagi vs malam.
    // Kita buat default: Varian A = Hari Ini + 1 jam, Varian B = Besok di jam yang sama.
    const now = new Date();
    // Varian A = 2 jam dari sekarang
    const timeA = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    // Varian B = 26 jam dari sekarang (besok di jam yang sama)
    const timeB = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const abTestId = crypto.randomUUID();

    // --- 3. Insert 2 Posts to Queue ---
    const postsToInsert = [
      {
        user_id: user.id,
        job_code: generateJobCode(),
        target_account_ids,
        scheduled_at: timeA.toISOString(),
        media_urls,
        caption: `[VARIAN A: ${tone_a}]\n\n${capA.caption}`,
        first_comment: capA.first_comment,
        post_type,
        cover_url: null,
        status: 'waiting',
        log_messages: [],
        ab_test_id: abTestId
      },
      {
        user_id: user.id,
        job_code: generateJobCode(),
        target_account_ids,
        scheduled_at: timeB.toISOString(),
        media_urls,
        caption: `[VARIAN B: ${tone_b}]\n\n${capB.caption}`,
        first_comment: capB.first_comment,
        post_type,
        cover_url: null,
        status: 'waiting',
        log_messages: [],
        ab_test_id: abTestId
      }
    ];

    const { data: insertedData, error: insertError } = await supabase
      .from('post_queue')
      .insert(postsToInsert)
      .select()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ success: true, data: insertedData, ab_test_id: abTestId })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
