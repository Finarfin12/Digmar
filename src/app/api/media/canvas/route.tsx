import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { 
      business_unit_id,
      title,
      subtitle,
      brand_color = '#4f46e5',
      logo_url
    } = await request.json()

    if (!business_unit_id || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Generate PNG using next/og (Satori)
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: brand_color,
            padding: '60px',
            fontFamily: 'sans-serif',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Subtle background pattern/overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.1,
            backgroundImage: 'radial-gradient(circle at 50% 50%, white 2px, transparent 2px)',
            backgroundSize: '40px 40px'
          }} />

          {/* Logo (if provided) */}
          {logo_url && (
            <div style={{ position: 'absolute', top: '40px', left: '60px', display: 'flex' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo_url} alt="Logo" style={{ height: '60px', objectFit: 'contain' }} />
            </div>
          )}

          {/* Decorative shapes */}
          <div style={{
            position: 'absolute',
            bottom: '-10%',
            right: '-10%',
            width: '500px',
            height: '500px',
            borderRadius: '250px',
            backgroundColor: 'white',
            opacity: 0.1,
            display: 'flex'
          }} />

          {/* Content */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
            zIndex: 10,
            maxWidth: '900px'
          }}>
            <h1 style={{
              fontSize: '85px',
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: '30px',
              letterSpacing: '-2px',
              textShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              {title}
            </h1>
            
            {subtitle && (
              <p style={{
                fontSize: '40px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 1.4
              }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080, // Square for Instagram
      }
    )

    // 2. Convert to Buffer
    const arrayBuffer = await imageResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 3. Upload to Supabase Storage
    const fileName = `${user.id}/canvas_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('digimar-media')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }

    const { data: publicUrlData } = supabase.storage
      .from('digimar-media')
      .getPublicUrl(uploadData.path)

    const publicUrl = publicUrlData.publicUrl

    // 4. Save metadata
    const { data: dbData, error: dbError } = await supabase
      .from('media_assets')
      .insert({
        user_id: user.id,
        business_unit_id,
        file_name: `AI_Canvas_${Date.now()}.png`,
        storage_path: uploadData.path,
        public_url: publicUrl,
        mime_type: 'image/png',
        size_bytes: buffer.length
      })
      .select()
      .single()

    if (dbError) {
      throw dbError
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      id: dbData.id
    })
  } catch (err: unknown) {
    console.error("Canvas Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
