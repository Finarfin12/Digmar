export interface AIProviderConfig {
  provider_name: 'groq' | 'openai' | 'anthropic' | 'gemini' | 'vps';
  api_key_encrypted?: string;
  base_url?: string;
  model?: string;
  is_active: boolean;
  priority: number;
  config: {
    temperature?: number;
    max_tokens?: number;
    system_prompt_override?: string;
  };
}

export interface AIProviderResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProviderClient {
  generateText(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<AIProviderResponse>;
}
