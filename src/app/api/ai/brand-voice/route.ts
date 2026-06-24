import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';
import { handleApiError } from '@/lib/utils/error-handler';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get('business_unit_id');

    if (!unitId) {
      return NextResponse.json({ error: 'business_unit_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ai_brand_voices')
      .select('*')
      .eq('business_unit_id', unitId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is not found
      throw error;
    }

    return NextResponse.json(data || {});
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { business_unit_id, tone_guidelines, dos, donts, example_posts } = body;

    if (!business_unit_id) {
      return NextResponse.json({ error: 'business_unit_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ai_brand_voices')
      .upsert({
        business_unit_id,
        tone_guidelines,
        dos: dos || [],
        donts: donts || [],
        example_posts: example_posts || [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'business_unit_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
