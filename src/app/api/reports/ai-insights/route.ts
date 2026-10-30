import { createClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/ai/factory';
import { NextResponse, type NextRequest } from 'next/server';
import { handleApiError } from '@/lib/utils/error-handler';
import { z } from 'zod';

const MetricsDataSchema = z.object({
  accounts: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().optional(),
    followers: z.number().optional(),
    engagement_rate: z.number().optional(),
    total_posts: z.number().optional(),
  })).optional(),
  date_range: z.object({
    start: z.string().optional(),
    end: z.string().optional()
  }).optional(),
  competitors: z.array(z.any()).optional()
}).passthrough();

const AiInsightsSchema = z.object({
  business_unit_id: z.string().uuid(),
  report_type: z.string(),
  metrics_data: MetricsDataSchema
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { business_unit_id, report_type, metrics_data } = AiInsightsSchema.parse(body);

    const { data: buData, error: buError } = await supabase
      .from('business_units')
      .select('brand_name, business_category, ai_system_prompt')
      .eq('id', business_unit_id)
      .single();
      
    if (buError || !buData) {
      throw new Error('Business unit not found');
    }

    const { client, config } = await getAIProvider(user.id);

    const systemPrompt = `Anda adalah Data Analyst Spesialis Media Sosial yang ahli membuat kesimpulan laporan untuk klien eksekutif. Anda menganalisis data untuk brand/unit bisnis: "${buData.brand_name}" (Kategori: ${buData.business_category || 'General'}).
Tujuan dan Pedoman Analisis Utama Anda (Business Goals):
"${buData.ai_system_prompt}"
Selalu kaitkan hasil analisis dan rekomendasi Anda secara mendalam dengan tujuan utama brand di atas.`;

    const userPrompt = `Saya sedang membuat laporan dengan fokus tipe: "${report_type}".
Berikut adalah data performa metrik dari akun-akun sosial yang dipilih untuk laporan ini:
${JSON.stringify(metrics_data, null, 2)}

Tugas Anda:
1. Berikan 1-2 paragraf kesimpulan (Executive Summary) yang secara ketat berfokus pada topik "${report_type}" dan menjawab tujuan utama unit bisnis.
2. Berikan 3 poin "Rekomendasi Strategis" yang sangat spesifik dan dapat ditindaklanjuti, berdasarkan metrik akun-akun di atas.

KEMBALIKAN OUTPUT SEBAGAI JSON MURNI DENGAN STRUKTUR BERIKUT:
{
  "summary": "Teks paragraf kesimpulan (Executive Summary) di sini...",
  "recommendations": [
    "Rekomendasi 1",
    "Rekomendasi 2",
    "Rekomendasi 3"
  ]
}
Jangan tambahkan teks apapun di luar JSON.`;

    const response = await client.generateText(systemPrompt, userPrompt, {
      temperature: config.config?.temperature || 0.5,
      maxTokens: config.config?.max_tokens || 800,
      jsonMode: true
    });

    let insightsData = { summary: 'Tidak ada analisis', recommendations: [] };
    try {
      insightsData = JSON.parse(response.content);
    } catch(e) {
      console.error("AI JSON parse error", e);
    }

    return NextResponse.json({ insights: insightsData });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Input tidak valid' }, { status: 400 });
    }
    return handleApiError(err);
  }
}
