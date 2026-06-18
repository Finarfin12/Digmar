import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { generateAIImage } from '@/lib/ai/image-factory'
import { handleApiError } from '@/lib/utils/error-handler'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const {
      business_unit_id,
      prompt,
      negative_prompt,
      size = '1024x1024',
      quality,
      style,
    } = await request.json()

    if (!business_unit_id || !prompt) {
      return NextResponse.json({ error: 'business_unit_id dan prompt wajib diisi' }, { status: 400 })
    }

    if (prompt.length < 10) {
      return NextResponse.json({ error: 'Prompt terlalu pendek (minimal 10 karakter)' }, { status: 400 })
    }

    if (prompt.length > 4000) {
      return NextResponse.json({ error: 'Prompt terlalu panjang (maksimal 4000 karakter)' }, { status: 400 })
    }

    const { data: unit, error: unitError } = await supabase
      .from('business_units')
      .select('id, brand_name')
      .eq('id', business_unit_id)
      .eq('user_id', user.id)
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Business unit not found or unauthorized' }, { status: 403 })
    }

    const result = await generateAIImage(user.id, {
      prompt,
      negativePrompt: negative_prompt,
      size,
      quality,
      style,
    })

    const imageResponse = await fetch(result.url)
    if (!imageResponse.ok) {
      throw new Error('Gagal mendownload gambar dari AI provider')
    }

    const arrayBuffer = await imageResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const fileName = `${user.id}/ai-images/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('digimar-media')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error('Gagal mengupload gambar ke storage')
    }

    const { data: publicUrlData } = supabase.storage
      .from('digimar-media')
      .getPublicUrl(uploadData.path)

    const publicUrl = publicUrlData.publicUrl

    const { data: dbData, error: dbError } = await supabase
      .from('media_assets')
      .insert({
        user_id: user.id,
        business_unit_id,
        file_name: `AI_Image_${Date.now()}.png`,
        storage_path: uploadData.path,
        public_url: publicUrl,
        mime_type: 'image/png',
        size_bytes: buffer.length,
      })
      .select()
      .single()

    if (dbError) {
      throw dbError
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      id: dbData.id,
      provider: result.provider,
      model: result.model,
      revised_prompt: result.revisedPrompt,
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
