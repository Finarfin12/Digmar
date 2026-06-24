import { createClient } from '@/lib/supabase/server';
import { getAIProvider } from '@/lib/ai/factory';
import { NextResponse, type NextRequest } from 'next/server';
import { handleApiError } from '@/lib/utils/error-handler';
import { z } from 'zod';

const AiInsightsSchema = z.object({
  business_unit_id: z.string().uuid(),
  report_type: z.string(),
  metrics_data: z.any()
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

    const { client, config } = await getAIProvider(user.id);

    const systemPrompt = `Anda adalah Data Analyst Spesialis Media Sosial yang ahli membuat kesimpulan laporan untuk klien eksekutif.`;
    const userPrompt = `Saya sedang membuat laporan tipe: "${report_type}".
Berikut adalah data ringkas mengenai performa akun-akun di unit bisnis ini:
${JSON.stringify(metrics_data, null, 2)}

Tugas Anda:
1. Berikan 1-2 paragraf kesimpulan (Executive Summary) yang menyoroti hal-hal paling positif atau perbaikan signifikan.
2. Berikan 3 poin "Rekomendasi Strategis" yang konkrit untuk bulan depan.
Gunakan bahasa Indonesia yang profesional, positif, dan meyakinkan (karena akan dicetak di PDF untuk klien). Jangan beri awalan/akhiran obrolan, langsung tuliskan laporannya.`;

    const response = await client.generateText(systemPrompt, userPrompt, {
      temperature: config.config?.temperature || 0.5,
      maxTokens: config.config?.max_tokens || 800,
      jsonMode: false
    });

    return NextResponse.json({ insights: response.content });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: (err as any).errors[0].message }, { status: 400 });
    }
    return handleApiError(err);
  }
}
