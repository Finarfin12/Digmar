import { createClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/ai/factory';
import { NextResponse, type NextRequest } from 'next/server';
import { handleApiError } from '@/lib/utils/error-handler';
import { z } from 'zod';

const GeneratePayloadSchema = z.object({
  business_unit_id: z.string().uuid(),
  prompt: z.string().min(5, "Content brief terlalu pendek").max(2000),
  platforms: z.array(z.string()).min(1),
  tone: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsedBody = GeneratePayloadSchema.parse(body);

    const { client, config } = await getAIProvider(user.id);

    // Ambil Brand Voice settings
    const { data: brandVoice } = await supabase
      .from('ai_brand_voices')
      .select('*')
      .eq('business_unit_id', parsedBody.business_unit_id)
      .single();

    let brandVoiceContext = '';
    if (brandVoice) {
      brandVoiceContext = `\n[Brand Voice Guidelines]\n${brandVoice.tone_guidelines || 'Gunakan nada yang profesional.'}\n`;
      if (brandVoice.dos && brandVoice.dos.length > 0) {
        brandVoiceContext += `DOs:\n- ${brandVoice.dos.join('\n- ')}\n`;
      }
      if (brandVoice.donts && brandVoice.donts.length > 0) {
        brandVoiceContext += `DONTs:\n- ${brandVoice.donts.join('\n- ')}\n`;
      }
    }

    const systemPrompt = `Anda adalah Social Media Manager dan AI Content Creator profesional.`;
    const userPrompt = `Tugas Anda adalah membuat konten media sosial berkualitas tinggi berdasarkan instruksi (Content Brief) yang diberikan.
Konten ini ditujukan untuk platform: ${parsedBody.platforms.join(', ')}.
Gunakan tone: ${parsedBody.tone || 'Profesional & Menarik'}.
${brandVoiceContext}

Prompt: ${parsedBody.prompt}

Anda HARUS merespon MURNI dalam format JSON yang valid, tanpa awalan markdown \`\`\`json.
Struktur JSON yang diharapkan:
{
  "caption": "Teks caption lengkap dengan spasi/enter yang rapi, emoji, dan call to action. Tanpa hashtag di dalam teks ini.",
  "hashtags": "#hashtag1 #hashtag2 #contoh (pisahkan dengan spasi, berikan sekitar 10-15 hashtag relevan)",
  "thread": "Jika instruksi cocok untuk Threads, buatkan versi teks yang ringkas, punchy, atau format thread bernomor. Jika tidak, kosongkan saja."
}`;

    const response = await client.generateText(systemPrompt, userPrompt, {
      temperature: config.config?.temperature || 0.7,
      maxTokens: config.config?.max_tokens || 1500
    });

    let parsedData;
    try {
      parsedData = JSON.parse(response.content.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch {
      throw new Error("Gagal mem-parsing hasil AI. Silakan coba lagi.");
    }

    // Simpan ke History
    const { error: historyError } = await supabase
      .from('ai_generation_history')
      .insert({
        business_unit_id: parsedBody.business_unit_id,
        prompt: parsedBody.prompt,
        platform: parsedBody.platforms.join(', '),
        tone: parsedBody.tone,
        output_caption: parsedData.caption || '',
        output_hashtags: parsedData.hashtags || '',
        output_thread: parsedData.thread || ''
      });

    if (historyError) {
      console.error("Gagal menyimpan ke history:", historyError);
    }

    return NextResponse.json(parsedData);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Input tidak valid' }, { status: 400 });
    }
    return handleApiError(err);
  }
}
