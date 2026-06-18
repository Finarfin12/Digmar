import { createClient } from '@/lib/supabase/server';
import { decryptValue } from '@/lib/crypto/server';
import { isValidExternalUrl } from '@/lib/utils/url';
import { OpenAICompatibleClient } from './providers/base';
import type { AIProviderClient, AIProviderConfig } from './providers/types';

type VisionProviderConfig = AIProviderConfig & {
  vision_base_url?: string;
  vision_api_key_encrypted?: string;
  vision_model?: string;
};

function decryptProviderSecret(encryptedValue: string | null | undefined, label: string): string {
  if (!encryptedValue) return '';

  try {
    return decryptValue(encryptedValue);
  } catch {
    throw new Error(`${label} tidak bisa didekripsi. Pastikan ENCRYPTION_KEY dan ENCRYPTION_SALT di Vercel sama dengan saat kredensial disimpan, atau simpan ulang API key provider di Settings.`);
  }
}

export async function getAIProvider(userId: string, preferredProvider?: string): Promise<{ client: AIProviderClient, config: AIProviderConfig }> {
  const supabase = await createClient();
  
  const query = supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  const { data: providers, error } = await query;

  if (error || !providers || providers.length === 0) {
    // H1 Fix: Hapus fallback plaintext GROQ_API_KEY
    throw new Error('No active AI provider configured. Please set up a provider in Settings.');
  }

  let selectedProvider = providers[0];

  if (preferredProvider) {
    const pref = providers.find(p => p.provider_name === preferredProvider);
    if (pref) selectedProvider = pref;
  }

  const apiKey = decryptProviderSecret(selectedProvider.api_key_encrypted, 'API key AI provider');

  let client: AIProviderClient;

  switch (selectedProvider.provider_name) {
    case 'groq':
      client = new OpenAICompatibleClient({
        apiKey,
        model: selectedProvider.model || process.env.DEFAULT_AI_MODEL || 'llama-3.3-70b-versatile',
        baseURL: 'https://api.groq.com/openai/v1',
        timeout: 30000 // M25 Fix: Timeout
      });
      break;
    case 'openai':
      client = new OpenAICompatibleClient({
        apiKey,
        model: selectedProvider.model || 'gpt-4o',
        timeout: 30000 // M25 Fix: Timeout
      });
      break;
    case 'openrouter':
      client = new OpenAICompatibleClient({
        apiKey,
        model: selectedProvider.model || '',
        baseURL: selectedProvider.base_url || 'https://openrouter.ai/api/v1',
        timeout: 30000 // M25 Fix: Timeout
      });
      break;
    case 'vps':
      if (!selectedProvider.base_url) throw new Error('VPS base_url is required');
      if (!isValidExternalUrl(selectedProvider.base_url)) throw new Error('Invalid or blocked base_url for VPS provider'); // H2 Fix: SSRF prevention
      client = new OpenAICompatibleClient({
        apiKey,
        model: selectedProvider.model || '',
        baseURL: selectedProvider.base_url,
        timeout: 30000
      });
      break;
    default:
      throw new Error(`Provider ${selectedProvider.provider_name} not supported yet`);
  }

  return { client, config: selectedProvider };
}

export async function getVisionAIProvider(userId: string): Promise<{ client: AIProviderClient, config: VisionProviderConfig }> {
  const supabase = await createClient();
  
  const { data: providers, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1);

  if (error || !providers || providers.length === 0) {
    throw new Error('Tidak ada AI provider aktif. Gagal memulai Vision AI.');
  }

  const primary = providers[0];

  if (!primary.vision_base_url || !primary.vision_model) {
    throw new Error('Kredensial Mata AI belum dikonfigurasi. Silakan ke Settings -> AI Provider-Vision.');
  }

  if (!isValidExternalUrl(primary.vision_base_url)) {
    throw new Error('Invalid or blocked vision_base_url'); // H2 Fix: SSRF prevention
  }

  const apiKey = decryptProviderSecret(primary.vision_api_key_encrypted, 'API key Vision AI');

  const client = new OpenAICompatibleClient({
    apiKey,
    model: primary.vision_model,
    baseURL: primary.vision_base_url,
    timeout: 30000 // M25 Fix: Timeout
  });

  return { client, config: primary as VisionProviderConfig };
}
