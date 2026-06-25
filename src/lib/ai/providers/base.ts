import OpenAI from 'openai';
import type { AIProviderClient, AIProviderResponse } from './types';

export interface OpenAICompatibleConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  timeout?: number;
}

export class OpenAICompatibleClient implements AIProviderClient {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAICompatibleConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
    });
    this.model = config.model;
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number; imageUrl?: string; jsonMode?: boolean }
  ): Promise<AIProviderResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: options?.temperature ?? 0.85,
      max_tokens: options?.maxTokens ?? 1600,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: options?.imageUrl 
            ? [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: options.imageUrl } }
              ] as any
            : userPrompt 
        }
      ],
      response_format: options?.jsonMode === true ? { type: "json_object" } : undefined
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined
    };
  }
}
