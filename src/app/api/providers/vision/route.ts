import { createClient } from '@/lib/supabase/server';
import { encryptValue } from '@/lib/crypto/server';
import { isValidExternalUrl } from '@/lib/utils/url';
import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError } from '@/lib/utils/error-handler'
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { base_url, api_key, model } = body;

    if (base_url && !isValidExternalUrl(base_url)) {
      return NextResponse.json({ error: 'Invalid or blocked vision base_url' }, { status: 400 });
    }

    let encryptedKey = null;
    if (api_key) {
      encryptedKey = encryptValue(api_key);
    }

    // Get the first active provider to attach the vision config to
    const { data: providers } = await supabase
      .from('ai_providers')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(1);

    if (!providers || providers.length === 0) {
      return NextResponse.json({ error: 'Belum ada AI Provider utama. Silakan setting AI Provider utama terlebih dahulu.' }, { status: 400 });
    }

    const primaryId = providers[0].id;

    // Update the row
    const { data, error } = await supabase
      .from('ai_providers')
      .update({
        vision_base_url: base_url,
        vision_api_key_encrypted: encryptedKey,
        vision_model: model
      })
      .eq('id', primaryId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, model: data.vision_model, base_url: data.vision_base_url }, { status: 200 });
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
