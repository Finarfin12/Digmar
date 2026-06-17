import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const business_unit_id = formData.get('business_unit_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!business_unit_id) {
      return NextResponse.json({ error: 'Business unit ID is required' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('digimar-media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('digimar-media')
      .getPublicUrl(data.path)

    // Save metadata to database
    const { data: dbData, error: dbError } = await supabase
      .from('media_assets')
      .insert({
        user_id: user.id,
        business_unit_id,
        file_name: file.name,
        storage_path: data.path,
        public_url: publicUrlData.publicUrl,
        mime_type: file.type,
        size_bytes: file.size
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      url: dbData.public_url,
      path: dbData.storage_path,
      size: dbData.size_bytes,
      mime_type: dbData.mime_type,
      id: dbData.id
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
