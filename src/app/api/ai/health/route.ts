import { createClient } from '@/lib/supabase/server'
import { decryptValue, encryptValue } from '@/lib/crypto/server'
import { NextResponse, type NextRequest } from 'next/server'
import { handleApiError } from '@/lib/utils/error-handler'

interface HealthCheckResult {
  step: string;
  status: 'pass' | 'fail' | 'skip';
  detail: string;
  duration_ms: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: HealthCheckResult[] = []
  const mark = () => Date.now()
  const done = (started: number) => Date.now() - started

  try {
    const { provider_type = 'text', base_url, model, api_key } = await request.json()

    // 1. Decrypt test (pastikan ENCRYPTION_KEY valid)
    let t0 = mark()
    try {
      const testEncrypted = encryptValue('health-check-test')
      const testDecrypted = decryptValue(testEncrypted)
      if (testDecrypted === 'health-check-test') {
        results.push({ step: 'encryption', status: 'pass', detail: 'ENCRYPTION_KEY valid, encrypt/decrypt OK', duration_ms: done(t0) })
      } else {
        results.push({ step: 'encryption', status: 'fail', detail: 'Decrypt gagal: nilai tidak cocok', duration_ms: done(t0) })
      }
    } catch (e: unknown) {
      results.push({ step: 'encryption', status: 'fail', detail: `Error: ${(e as Error).message}`, duration_ms: done(t0) })
    }

    // 2. Provider di DB
    t0 = mark()
    let dbKey: string | null = null
    let dbModel: string | null = null

    if (provider_type === 'image') {
      const { data: imgProv } = await supabase.from('image_ai_providers').select('*').eq('user_id', user.id).eq('is_active', true).limit(1)
      if (!imgProv || imgProv.length === 0) {
        if (api_key) {
          results.push({ step: 'db_provider', status: 'skip', detail: 'Menggunakan API key dari form', duration_ms: done(t0) })
        } else {
          results.push({ step: 'db_provider', status: 'fail', detail: 'Image AI provider tidak ditemukan di database.', duration_ms: done(t0) })
        }
      } else {
        dbKey = imgProv[0].api_key_encrypted
        dbModel = imgProv[0].model || 'dall-e-3'
        results.push({ step: 'db_provider', status: 'pass', detail: `Provider: ${imgProv[0].provider_type}, model: ${dbModel}`, duration_ms: done(t0) })
      }
    } else if (provider_type === 'vision') {
      const { data: visProv } = await supabase.from('ai_providers').select('*').eq('user_id', user.id).eq('is_active', true).not('vision_base_url', 'is', null).limit(1)
      if (!visProv || visProv.length === 0) {
        if (api_key) {
          results.push({ step: 'db_provider', status: 'skip', detail: 'Menggunakan API key dari form', duration_ms: done(t0) })
        } else {
          results.push({ step: 'db_provider', status: 'fail', detail: 'Vision AI provider tidak ditemukan.', duration_ms: done(t0) })
        }
      } else {
        dbKey = visProv[0].vision_api_key_encrypted
        dbModel = visProv[0].vision_model
        results.push({ step: 'db_provider', status: 'pass', detail: `Vision provider ditemukan, base_url: ${visProv[0].vision_base_url}`, duration_ms: done(t0) })
      }
    } else {
      const { data: prov } = await supabase.from('ai_providers').select('*').eq('user_id', user.id).eq('is_active', true).order('priority').limit(1)
      if (!prov || prov.length === 0) {
        if (api_key) {
          results.push({ step: 'db_provider', status: 'skip', detail: 'Menggunakan API key dari form', duration_ms: done(t0) })
        } else {
          results.push({ step: 'db_provider', status: 'fail', detail: 'AI text provider tidak ditemukan.', duration_ms: done(t0) })
        }
      } else {
        dbKey = prov[0].api_key_encrypted
        dbModel = prov[0].model || 'llama-3.3-70b-versatile'
        results.push({ step: 'db_provider', status: 'pass', detail: `Provider: ${prov[0].provider_name}, model: ${dbModel}`, duration_ms: done(t0) })
      }
    }

    // 3. Decrypt API key
    t0 = mark()
    let decryptedKey: string | null = null
    if (dbKey) {
      try {
        decryptedKey = decryptValue(dbKey)
        results.push({ step: 'decrypt_key', status: 'pass', detail: 'API key berhasil didekripsi', duration_ms: done(t0) })
      } catch (e: unknown) {
        results.push({ step: 'decrypt_key', status: 'fail', detail: `Gagal dekripsi: ${(e as Error).message}. Simpan ulang API key.`, duration_ms: done(t0) })
      }
    } else if (api_key) {
      decryptedKey = api_key
      results.push({ step: 'decrypt_key', status: 'skip', detail: 'Menggunakan API key dari form (tidak ada di DB)', duration_ms: 0 })
    } else {
      results.push({ step: 'decrypt_key', status: 'fail', detail: 'Tidak ada API key (DB maupun form)', duration_ms: 0 })
    }

    // 4. Test network + model
    t0 = mark()
    const testUrl = base_url || 'https://api.groq.com/openai/v1'
    const testModel = model || dbModel || 'llama-3.3-70b-versatile'
    const testKey = decryptedKey || api_key || ''

    if (!testKey) {
      results.push({ step: 'network_test', status: 'skip', detail: 'Tidak ada API key untuk test', duration_ms: 0 })
    } else {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        let modelsUrl = `${testUrl.replace(/\/$/, '')}/models`
        if (!modelsUrl.includes('/v1')) {
          modelsUrl = `${testUrl.replace(/\/$/, '')}/v1/models`
        }

        const res = await fetch(modelsUrl, {
          headers: { 'Authorization': `Bearer ${testKey}` },
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (res.ok) {
          const modelData = await res.json()
          const modelIds = (modelData.data || []).map((m: { id: string }) => m.id)
          const modelFound = modelIds.includes(testModel)
          results.push({
            step: 'network_test',
            status: modelFound ? 'pass' : 'pass',
            detail: `Koneksi OK (${done(t0)}ms). ${modelIds.length} model tersedia. ${modelFound ? `Model "${testModel}" ditemukan ✅` : `Model "${testModel}" TIDAK ditemukan ⚠️. Tersedia: ${modelIds.slice(0, 5).join(', ')}...`}`,
            duration_ms: done(t0),
          })
        } else {
          const errText = await res.text().catch(() => '')
          results.push({ step: 'network_test', status: 'fail', detail: `HTTP ${res.status}: ${errText.substring(0, 200)}`, duration_ms: done(t0) })
        }
      } catch (e: unknown) {
        const msg = (e as Error).name === 'AbortError' ? 'Timeout (15 detik)' : (e as Error).message
        results.push({ step: 'network_test', status: 'fail', detail: msg, duration_ms: done(t0) })
      }
    }

    // 5. JSON response test
    if (decryptedKey || api_key) {
      t0 = mark()
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        const chatUrl = `${testUrl.replace(/\/$/, '')}/chat/completions`
        const res = await fetch(chatUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${decryptedKey || api_key}` },
          body: JSON.stringify({ model: testModel, messages: [{ role: 'user', content: 'Reply with just: {"ok":true}' }], max_tokens: 20, temperature: 0 }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (res.ok) {
          const data = await res.json()
          const content = data.choices?.[0]?.message?.content || ''
          try { JSON.parse(content); results.push({ step: 'json_test', status: 'pass', detail: `Model merespon valid JSON (${done(t0)}ms)`, duration_ms: done(t0) }) }
          catch { results.push({ step: 'json_test', status: 'pass', detail: `Model merespon (bukan JSON: "${content.substring(0, 60)}"). Tidak apa-apa. (${done(t0)}ms)`, duration_ms: done(t0) }) }
        } else {
          const errText = await res.text().catch(() => '')
          results.push({ step: 'json_test', status: 'fail', detail: `HTTP ${res.status}: ${errText.substring(0, 150)}`, duration_ms: done(t0) })
        }
      } catch (e: unknown) {
        results.push({ step: 'json_test', status: 'skip', detail: `Tidak bisa test chat: ${(e as Error).message}`, duration_ms: done(t0) })
      }
    }

    const passed = results.filter(r => r.status === 'pass').length
    const failed = results.filter(r => r.status === 'fail').length

    return NextResponse.json({
      summary: failed === 0 ? 'pass' : failed > 0 && passed > 0 ? 'partial' : 'fail',
      passed,
      failed,
      steps: results,
    })
  } catch (err: unknown) {
    return handleApiError(err)
  }
}
