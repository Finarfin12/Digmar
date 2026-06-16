import OpenAI from 'openai';
import type { AIProviderClient, AIProviderResponse } from './types';

export class VPSClient implements AIProviderClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 30000,
    });
    this.model = model;
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<AIProviderResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: options?.temperature ?? 0.85,
      max_tokens: options?.maxTokens ?? 1600,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" }
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
