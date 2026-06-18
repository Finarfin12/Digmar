import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

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

    // M2, L7 Fix: Validasi MIME Type dan Ukuran
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

    const isImage = allowedImageTypes.includes(file.type);
    const isVideo = allowedVideoTypes.includes(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Unsupported file type. Only JPEG, PNG, WEBP, GIF, MP4, WEBM, and MOV are allowed.' }, { status: 400 })
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Image size exceeds 10MB limit.' }, { status: 400 })
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json({ error: 'Video size exceeds 50MB limit.' }, { status: 400 })
    }

    // H8 Fix: Verifikasi kepemilikan unit
    const { data: unitCheck, error: unitError } = await supabase
      .from('business_units')
      .select('id')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unitCheck) {
      return NextResponse.json({ error: 'Forbidden: You do not own this business unit' }, { status: 403 })
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
    return handleApiError(err)
  }
}
