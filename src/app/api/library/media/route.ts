import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const business_unit_id = request.nextUrl.searchParams.get('business_unit_id')
  
  let query = supabase.from('media_assets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  
  if (business_unit_id) {
    query = query.eq('business_unit_id', business_unit_id)
  }

  const { data, error } = await query

  if (error) return handleApiError(error)
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Get the asset first to delete from storage
  const { data: asset, error: fetchError } = await supabase
    .from('media_assets')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  // Delete from storage
  await supabase.storage.from('digimar-media').remove([asset.storage_path])

  // Delete from db
  const { error } = await supabase.from('media_assets').delete().eq('id', id).eq('user_id', user.id)
  
  if (error) return handleApiError(error)
  return NextResponse.json({ success: true })
}
