import { createClient } from '@/lib/supabase/server';
import { decryptValue } from '@/lib/crypto/server';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  size?: string;
  quality?: string;
  style?: string;
  steps?: number;
  seed?: number;
}

export interface ImageGenerationResult {
  url: string;
  revisedPrompt?: string;
  provider: string;
  model: string;
}

export async function getUserImageProvider(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('image_ai_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateAIImage(
  userId: string,
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const provider = await getUserImageProvider(userId);

  if (!provider) {
    throw new Error('Belum ada image AI provider yang dikonfigurasi. Tambahkan di Settings > AI Provider.');
  }

  let apiKey: string;
  try {
    apiKey = decryptValue(provider.api_key_encrypted);
  } catch {
    throw new Error('Gagal mendekripsi image API key. Simpan ulang kredensial di Settings.');
  }

  const model = provider.model || getDefaultModel(provider.provider_type);

  switch (provider.provider_type) {
    case 'dalle':
      return generateDalleImage(apiKey, model, request);
    case 'stability':
      return generateStabilityImage(apiKey, request);
    case 'leonardo':
      return generateLeonardoImage(apiKey, model, request);
    default:
      throw new Error(`Provider image tidak didukung: ${provider.provider_type}`);
  }
}

function getDefaultModel(providerType: string): string {
  switch (providerType) {
    case 'dalle': return 'dall-e-3';
    case 'stability': return 'stable-diffusion-xl';
    case 'leonardo': return '1e60896f-3c26-4296-8ecc-53e2afecc132';
    default: return '';
  }
}

async function generateDalleImage(
  apiKey: string,
  model: string,
  req: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: req.prompt,
      n: 1,
      size: req.size || '1024x1024',
      quality: req.quality || 'standard',
      style: req.style || 'vivid',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `DALL-E API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    url: data.data[0].url,
    revisedPrompt: data.data[0].revised_prompt,
    provider: 'dalle',
    model,
  };
}

async function generateStabilityImage(
  apiKey: string,
  req: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const formData = new FormData();
  formData.append('prompt', req.prompt);
  if (req.negativePrompt) formData.append('negative_prompt', req.negativePrompt);
  formData.append('output_format', 'png');

  const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Stability API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    url: data.image,
    provider: 'stability',
    model: 'stable-diffusion-xl',
  };
}

async function generateLeonardoImage(
  apiKey: string,
  model: string,
  req: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const genRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: req.prompt,
      modelId: model,
      width: parseInt(req.size?.split('x')[0] || '1024'),
      height: parseInt(req.size?.split('x')[1] || '1024'),
      num_images: 1,
    }),
  });

  if (!genRes.ok) {
    const err = await genRes.json().catch(() => ({}));
    throw new Error(err.error || `Leonardo API error: ${genRes.status}`);
  }

  const { sdGenerationJob } = await genRes.json();
  const generationId = sdGenerationJob.generationId;

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const pollData = await pollRes.json();

    if (pollData.generations_by_pk?.generated_images?.length > 0) {
      return {
        url: pollData.generations_by_pk.generated_images[0].url,
        provider: 'leonardo',
        model,
      };
    }
  }

  throw new Error('Leonardo generation timed out after 30 seconds');
}
