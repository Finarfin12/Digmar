import { createClient } from '@/lib/supabase/server'
import { getAIProvider } from '@/lib/ai/factory'
import { NextResponse, type NextRequest } from 'next/server'
import { format, addDays } from 'date-fns'
import { generateJobCode } from '@/lib/utils/job-code'
import { handleApiError } from '@/lib/utils/error-handler'
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/utils/rate-limit'
import { z } from 'zod'

const CampaignGenerateSchema = z.object({
  business_unit_id: z.string().uuid(),
  target_account_ids: z.array(z.string().uuid()).min(1, "Minimal satu akun target"),
  campaign_idea: z.string().min(5, "Ide kampanye terlalu pendek").max(1000),
  duration_days: z.number().int().min(1).max(30),
  start_date: z.string().datetime() /* ISO string */,
  tone_voice: z.string().optional()
})

type GeneratedCampaignPost = {
  day_offset: number;
  post_type?: 'single_image' | 'carousel' | 'reels';
  caption: string;
  first_comment?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate Limiting (L3 Fix): 3 request per menit (lebih berat)
  const rateLimitKey = getRateLimitIdentifier(request, user.id)
  if (!checkRateLimit(rateLimitKey, 'campaigns-generate', 10, 60000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const jsonBody = await request.json()
    const { 
      business_unit_id, 
      target_account_ids, 
      campaign_idea, 
      duration_days, 
      start_date, 
      tone_voice 
    } = CampaignGenerateSchema.parse(jsonBody)

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('*')
      .eq('id', business_unit_id)
      .eq('user_id', user.id) // H8 Fix: Verifikasi kepemilikan
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found' }, { status: 404 })
    }

    const uniqueTargetAccountIds = [...new Set(target_account_ids)]
    const { data: ownedAccounts, error: ownedAccountsError } = await supabase
      .from('social_accounts')
      .select('id, business_unit_id, business_units!inner(user_id)')
      .in('id', uniqueTargetAccountIds)
      .eq('business_unit_id', business_unit_id)
      .eq('business_units.user_id', user.id)

    if (ownedAccountsError) {
      return NextResponse.json({ error: ownedAccountsError.message }, { status: 500 })
    }

    if (!ownedAccounts || ownedAccounts.length !== uniqueTargetAccountIds.length) {
      return NextResponse.json({ error: 'One or more target accounts are not owned by this user' }, { status: 403 })
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

    let generatedCampaign: GeneratedCampaignPost[] = [];
    try {
      const rawJson = aiResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedCampaign = JSON.parse(rawJson) as unknown;
      
      if (!Array.isArray(parsedCampaign) || parsedCampaign.length !== duration_days) {
         throw new Error("AI tidak menghasilkan jumlah hari yang tepat.");
      }

      generatedCampaign = parsedCampaign.map(post => {
        if (
          typeof post !== 'object' ||
          post === null ||
          typeof (post as GeneratedCampaignPost).day_offset !== 'number' ||
          typeof (post as GeneratedCampaignPost).caption !== 'string'
        ) {
          throw new Error("Format item kampanye AI tidak valid.");
        }
        return post as GeneratedCampaignPost;
      });
    } catch {
      return handleApiError(new Error("Gagal parse JSON dari AI"))
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
        target_account_ids: uniqueTargetAccountIds,
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
    return handleApiError(err)
  }
}
