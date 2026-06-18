import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'
import React from 'react'

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
      logo_url,
      template_id = 'centered', // centered, split, minimal
      resolution = '1080x1080'
    } = await request.json()

    if (!business_unit_id || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let element;

    if (template_id === 'split') {
      element = React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          fontFamily: 'sans-serif',
        }
      }, [
        // Kiri: Brand Color Panel
        React.createElement('div', {
          key: 'left',
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '40%',
            height: '100%',
            backgroundColor: brand_color,
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }
        }, [
          React.createElement('div', {
            key: 'bg-left',
            style: {
              position: 'absolute',
              inset: 0,
              opacity: 0.15,
              backgroundImage: 'radial-gradient(circle at 50% 50%, white 2px, transparent 2px)',
              backgroundSize: '30px 30px'
            }
          }),
          logo_url ? React.createElement('img', {
            key: 'logo',
            src: logo_url,
            alt: 'Logo',
            style: { width: '200px', objectFit: 'contain', zIndex: 10 }
          }) : null
        ]),
        // Kanan: Text Panel
        React.createElement('div', {
          key: 'right',
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '60%',
            height: '100%',
            padding: '80px',
            justifyContent: 'center',
          }
        }, [
          React.createElement('h1', {
            key: 'title',
            style: {
              fontSize: '80px',
              fontWeight: 900,
              color: '#1e293b',
              lineHeight: 1.1,
              marginBottom: '30px',
              letterSpacing: '-2px',
            }
          }, title),
          subtitle ? React.createElement('p', {
            key: 'subtitle',
            style: {
              fontSize: '35px',
              fontWeight: 500,
              color: '#64748b',
              lineHeight: 1.4,
              borderLeft: `8px solid ${brand_color}`,
              paddingLeft: '20px'
            }
          }, subtitle) : null
        ])
      ]);

    } else if (template_id === 'minimal') {
      element = React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#fafafa',
          padding: '80px',
          fontFamily: 'sans-serif',
          justifyContent: 'space-between',
          border: `20px solid ${brand_color}`
        }
      }, [
        logo_url ? React.createElement('img', {
          key: 'logo',
          src: logo_url,
          alt: 'Logo',
          style: { height: '80px', objectFit: 'contain' }
        }) : React.createElement('div', { key: 'empty-logo' }),
        
        React.createElement('div', {
          key: 'content',
          style: { display: 'flex', flexDirection: 'column' }
        }, [
          React.createElement('h1', {
            key: 'title',
            style: {
              fontSize: '100px',
              fontWeight: 900,
              color: brand_color,
              lineHeight: 1,
              marginBottom: '40px',
              letterSpacing: '-3px',
              textTransform: 'uppercase'
            }
          }, title),
          subtitle ? React.createElement('p', {
            key: 'subtitle',
            style: {
              fontSize: '40px',
              fontWeight: 600,
              color: '#334155',
              lineHeight: 1.4,
              maxWidth: '800px'
            }
          }, subtitle) : null
        ])
      ]);

    } else {
      // Default: Centered
      element = React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: brand_color,
          padding: '60px',
          fontFamily: 'sans-serif',
          justifyContent: 'center',
          position: 'relative',
        }
      }, [
        React.createElement('div', {
          key: 'bg',
          style: {
            position: 'absolute',
            inset: 0,
            opacity: 0.1,
            backgroundImage: 'radial-gradient(circle at 50% 50%, white 2px, transparent 2px)',
            backgroundSize: '40px 40px'
          }
        }),
        logo_url ? React.createElement('div', {
          key: 'logo-container',
          style: { position: 'absolute', top: '40px', left: '60px', display: 'flex' }
        }, React.createElement('img', {
          src: logo_url,
          alt: 'Logo',
          style: { height: '60px', objectFit: 'contain' }
        })) : null,
        React.createElement('div', {
          key: 'decor',
          style: {
            position: 'absolute',
            bottom: '-10%',
            right: '-10%',
            width: '500px',
            height: '500px',
            borderRadius: '250px',
            backgroundColor: 'white',
            opacity: 0.1,
            display: 'flex'
          }
        }),
        React.createElement('div', {
          key: 'content',
          style: {
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
            zIndex: 10,
            maxWidth: '900px'
          }
        }, [
          React.createElement('h1', {
            key: 'title',
            style: {
              fontSize: '85px',
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: '30px',
              letterSpacing: '-2px',
              textShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }
          }, title),
          subtitle ? React.createElement('p', {
            key: 'subtitle',
            style: {
              fontSize: '40px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.4
            }
          }, subtitle) : null
        ])
      ]);
    }

    const [widthStr, heightStr] = resolution.split('x');
    const width = parseInt(widthStr) || 1080;
    const height = parseInt(heightStr) || 1080;

    const imageResponse = new ImageResponse(element, {
      width,
      height,
    })

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
