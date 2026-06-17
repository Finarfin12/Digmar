import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
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
      campaign_idea, 
      duration_days, 
      start_date, 
      tone_voice 
    } = await request.json()

    if (!business_unit_id || !campaign_idea || !target_account_ids || target_account_ids.length === 0 || !start_date) {
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

    const { client, config } = await getAIProvider(user.id)
    
    const systemPrompt = `
Anda adalah Chief Marketing Officer dan Social Media Strategist jenius untuk brand: ${unit.brand_name}
Industri: ${unit.business_category || 'Umum'}

TUGAS ANDA:
Membuat sebuah Social Media Campaign berseri yang sangat strategis dan saling berkaitan.
Durasi Kampanye: ${duration_days} hari berturut-turut.
Topik/Ide Kampanye: ${campaign_idea}
Tone & Gaya Bahasa: ${tone_voice}

Anda harus mengembalikan response HANYA berupa array JSON murni (tanpa markdown, tanpa teks lain).
Array harus berisi tepat ${duration_days} objek dengan format berikut:
[
  {
    "day_offset": 0,
    "post_type": "single_image", // Pilih antara: single_image, carousel, reels
    "caption": "Tulis caption panjang yang memikat, rapi, dan sesuai tone. Jangan lupa CTA.",
    "first_comment": "#hashtag1 #hashtag2" // Hashtag relevan
  },
  ... (dst sampai day_offset: ${duration_days - 1})
]

STRATEGI KONTEN:
- Hari pertama (day_offset: 0) biasanya berupa Teaser atau Pengumuman Awal.
- Hari pertengahan berisi Edukasi, Testimoni, atau Fitur.
- Hari terakhir biasanya Hard Selling, Last Call, atau FOMO (Fear Of Missing Out).
`;

    const userPrompt = "Buatkan strategi kampanye sekarang. Kembalikan HANYA array JSON.";

    const aiResponse = await client.generateText(systemPrompt, userPrompt, {
      temperature: config.config?.temperature || 0.8,
      maxTokens: 2500
    })

    let generatedCampaign: any[] = [];
    try {
      const rawJson = aiResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
      generatedCampaign = JSON.parse(rawJson);
      
      if (!Array.isArray(generatedCampaign) || generatedCampaign.length !== duration_days) {
         throw new Error("AI tidak menghasilkan jumlah hari yang tepat.");
      }
    } catch (e) {
      console.error("Gagal parse JSON dari AI:", aiResponse.content);
      return NextResponse.json({ error: 'Gagal memproses respons dari AI. Silakan coba lagi.' }, { status: 500 })
    }

    const baseDate = new Date(start_date);
    const postsToInsert = [];

    const vars = unit.custom_variables || {}
    const defaultVars: Record<string, string> = {
      brand: unit.brand_name
    }

    for (let i = 0; i < generatedCampaign.length; i++) {
      const post = generatedCampaign[i];
      const postDate = addDays(baseDate, post.day_offset);
      
      // Parse custom variables
      const allVars = { ...vars, ...defaultVars, tanggal: format(postDate, 'dd MMMM yyyy') };
      const replacer = (match: string, p1: string) => {
        const key = p1.trim()
        return allVars[key] !== undefined ? String(allVars[key]) : match
      }

      const finalCaption = post.caption.replace(/\{([^}]+)\}/g, replacer);
      const finalComment = (post.first_comment || '').replace(/\{([^}]+)\}/g, replacer);

      postsToInsert.push({
        user_id: user.id,
        job_code: generateJobCode(),
        target_account_ids,
        scheduled_at: format(postDate, "yyyy-MM-dd'T'HH:mm:ss"),
        media_urls: [], // Kosongkan agar diisi oleh user
        caption: finalCaption,
        first_comment: finalComment,
        post_type: post.post_type || 'single_image',
        status: 'waiting',
        log_messages: []
      });
    }

    const { data: insertedData, error: insertError } = await supabase
      .from('post_queue')
      .insert(postsToInsert)
      .select()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ success: true, count: insertedData.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
