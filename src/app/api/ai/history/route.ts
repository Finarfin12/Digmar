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
      .from('ai_generation_history')
      .select('*')
      .eq('business_unit_id', unitId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    return handleApiError(error);
  }
}
