import { createClient } from '@/lib/supabase/server';
import { decryptValue } from '@/lib/crypto/server';
import { OpenAICompatibleClient } from './providers/base';
import type { AIProviderClient, AIProviderConfig } from './providers/types';

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
    // Fallback to environment default if no custom provider is configured
    const defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'groq';
    const defaultModel = process.env.DEFAULT_AI_MODEL || 'llama-3.3-70b-versatile';
    
    // We assume there's a global API key in env if no DB provider exists for fallback
    // In a real app, you might want to enforce DB provider creation
    const apiKey = process.env.GROQ_API_KEY || ''; // Example fallback
    
    return {
      client: new OpenAICompatibleClient({
        apiKey,
        model: defaultModel,
        baseURL: 'https://api.groq.com/openai/v1'
      }),
      config: {
        provider_name: 'groq',
        is_active: true,
        priority: 1,
        model: defaultModel,
        config: {}
      }
    };
  }

  let selectedProvider = providers[0];

  if (preferredProvider) {
    const pref = providers.find(p => p.provider_name === preferredProvider);
    if (pref) selectedProvider = pref;
  }

  const apiKey = selectedProvider.api_key_encrypted ? decryptValue(selectedProvider.api_key_encrypted) : '';

  let client: AIProviderClient;

  switch (selectedProvider.provider_name) {
    case 'groq':
      client = new OpenAICompatibleClient({
        apiKey,
        model: selectedProvider.model || process.env.DEFAULT_AI_MODEL || 'llama-3.3-70b-versatile',
        baseURL: 'https://api.groq.com/openai/v1'
      });
      break;
    case 'openai':
      client = new OpenAICompatibleClient({
        apiKey,
        model: selectedProvider.model || 'gpt-4o'
      });
      break;
    case 'openrouter':
      client = new OpenAICompatibleClient({
        apiKey,
        model: selectedProvider.model || '',
        baseURL: selectedProvider.base_url || 'https://openrouter.ai/api/v1'
      });
      break;
    case 'vps':
      if (!selectedProvider.base_url) throw new Error('VPS base_url is required');
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

export async function getVisionAIProvider(userId: string): Promise<{ client: AIProviderClient, config: any }> {
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

  const apiKey = primary.vision_api_key_encrypted ? decryptValue(primary.vision_api_key_encrypted) : '';

  const client = new OpenAICompatibleClient({
    apiKey,
    model: primary.vision_model,
    baseURL: primary.vision_base_url
  });

  return { client, config: primary };
}
