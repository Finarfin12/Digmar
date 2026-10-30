import Anthropic from '@anthropic-ai/sdk';
import type { AIProviderClient, AIProviderResponse } from './types';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

// Model yang mendukung server-side refusal fallback (`fallbacks: "default"`)
const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

// Thinking selalu aktif di model Claude terbaru dan ikut memakai max_tokens,
// jadi beri ruang minimum agar teks jawaban tidak terpotong untuk request pendek (mis. balasan komentar 150 token)
const MIN_MAX_TOKENS = 4096;

export interface AnthropicClientConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  timeout?: number;
}

export class AnthropicClient implements AIProviderClient {
  private client: Anthropic;
  private model: string;

  constructor(config: AnthropicClientConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      // SDK menambahkan /v1 sendiri
      baseURL: config.baseURL ? config.baseURL.replace(/\/+$/, '').replace(/\/v1$/, '') : undefined,
      timeout: config.timeout,
    });
    this.model = config.model || DEFAULT_ANTHROPIC_MODEL;
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number; imageUrl?: string; jsonMode?: boolean }
  ): Promise<AIProviderResponse> {
    // temperature tidak dikirim: parameter sampling ditolak oleh Messages API saat ini
    const system = options?.jsonMode
      ? `${systemPrompt}\n\nRespond with only a single valid JSON object. Do not wrap it in markdown code fences.`
      : systemPrompt;

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (options?.imageUrl) {
      content.push({ type: 'image', source: { type: 'url', url: options.imageUrl } });
    }
    content.push({ type: 'text', text: userPrompt });

    const useFallbacks = FALLBACK_MODELS.has(this.model);

    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: Math.max(options?.maxTokens ?? 1600, MIN_MAX_TOKENS),
      // Tugas copywriting singkat: effort rendah cukup dan hemat token
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content }],
      ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });

    if (response.stop_reason === 'refusal') {
      const category = response.stop_details?.category ?? 'unknown';
      throw new Error(`Claude menolak permintaan ini (kategori: ${category}).`);
    }

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      content: text,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }
}
