export interface UnifiedMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface UnifiedRequest {
  model: string;
  messages: UnifiedMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: 'text' | 'json';
}

export interface StandardizedRateLimits {
  requestsLimit?: number;
  requestsRemaining?: number;
  requestsReset?: number;      // Seconds until reset
  tokensLimit?: number;
  tokensRemaining?: number;
  tokensReset?: number;         // Seconds until reset
}

export interface ProviderConfig {
  baseUrl: string;
  endpoint: (model: string, stream: boolean) => string;
  headers: (apiKey: string) => Record<string, string>;
  mapRequest: (req: UnifiedRequest, modelSupportsJson: boolean) => any;
  parseResponseText: (data: any) => string;
  parseUsage: (data: any) => { promptTokens: number; outputTokens: number } | null;
  parseRateLimitHeaders: (headers: Record<string, string>) => StandardizedRateLimits | null;
}

// Spacing parser for resets like "1.5s", "150ms", "86400s", etc.
function parseResetTime(resetStr?: string): number | undefined {
  if (!resetStr) return undefined;
  if (/^\d+(\.\d+)?$/.test(resetStr)) {
    return parseFloat(resetStr);
  }
  const match = resetStr.match(/^(\d+(\.\d+)?)(ms|s|m|h)?$/);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[3];
    if (unit === 'ms') return val / 1000;
    if (unit === 'm') return val * 60;
    if (unit === 'h') return val * 3600;
    return val;
  }
  return undefined;
}

export const ProviderDictionary: Record<string, ProviderConfig> = {
  // 1. Gemini AI Studio (Google)
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    endpoint: (model, stream) => stream 
      ? `/v1beta/models/${model}:streamGenerateContent` 
      : `/v1beta/models/${model}:generateContent`,
    headers: (key) => ({
      'x-goog-api-key': key,
      'Content-Type': 'application/json'
    }),
    mapRequest: (req, modelSupportsJson) => {
      const systemMessage = req.messages.find(m => m.role === 'system');
      const userMessages = req.messages.filter(m => m.role !== 'system');
      
      const contents = userMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const generationConfig: any = {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.max_tokens ?? 1000
      };

      if (req.response_format === 'json' && modelSupportsJson) {
        generationConfig.responseMimeType = 'application/json';
      }

      const payload: any = { contents, generationConfig };

      if (systemMessage) {
        payload.systemInstruction = {
          parts: [{ text: systemMessage.content }]
        };
      }

      return payload;
    },
    parseResponseText: (data) => {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
    parseUsage: (data) => {
      if (data.usageMetadata) {
        return {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          outputTokens: data.usageMetadata.candidatesTokenCount || 0
        };
      }
      return null;
    },
    parseRateLimitHeaders: () => null // Gemini does not return rate limit headers
  },

  // 2. OpenAI / Groq / SambaNova / OpenRouter (OpenAI-compatible)
  openai_compatible: {
    baseUrl: '', 
    endpoint: () => '/v1/chat/completions',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    mapRequest: (req, modelSupportsJson) => {
      const payload: any = {
        model: req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.max_tokens ?? 1000
      };

      if (req.response_format === 'json' && modelSupportsJson) {
        payload.response_format = { type: 'json_object' };
      }

      return payload;
    },
    parseResponseText: (data) => {
      return data.choices?.[0]?.message?.content || '';
    },
    parseUsage: (data) => {
      if (data.usage) {
        return {
          promptTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0
        };
      }
      return null;
    },
    parseRateLimitHeaders: (headers) => {
      return {
        requestsLimit: headers['x-ratelimit-limit-requests'] ? parseInt(headers['x-ratelimit-limit-requests']) : undefined,
        requestsRemaining: headers['x-ratelimit-remaining-requests'] ? parseInt(headers['x-ratelimit-remaining-requests']) : undefined,
        requestsReset: parseResetTime(headers['x-ratelimit-reset-requests']),
        tokensLimit: headers['x-ratelimit-limit-tokens'] ? parseInt(headers['x-ratelimit-limit-tokens']) : undefined,
        tokensRemaining: headers['x-ratelimit-remaining-tokens'] ? parseInt(headers['x-ratelimit-remaining-tokens']) : undefined,
        tokensReset: parseResetTime(headers['x-ratelimit-reset-tokens'])
      };
    }
  },

  // 3. Anthropic Claude
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    endpoint: () => '/v1/messages',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }),
    mapRequest: (req) => {
      const systemMessage = req.messages.find(m => m.role === 'system');
      const userMessages = req.messages.filter(m => m.role !== 'system');
      
      return {
        model: req.model,
        messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        system: systemMessage?.content,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.max_tokens ?? 1000
      };
    },
    parseResponseText: (data) => {
      return data.content?.[0]?.text || '';
    },
    parseUsage: (data) => {
      if (data.usage) {
        return {
          promptTokens: data.usage.input_tokens || 0,
          outputTokens: data.usage.output_tokens || 0
        };
      }
      return null;
    },
    parseRateLimitHeaders: (headers) => {
      return {
        requestsLimit: headers['anthropic-ratelimit-requests-limit'] ? parseInt(headers['anthropic-ratelimit-requests-limit']) : undefined,
        requestsRemaining: headers['anthropic-ratelimit-requests-remaining'] ? parseInt(headers['anthropic-ratelimit-requests-remaining']) : undefined,
        requestsReset: parseResetTime(headers['anthropic-ratelimit-requests-reset']),
        tokensLimit: headers['anthropic-ratelimit-tokens-limit'] ? parseInt(headers['anthropic-ratelimit-tokens-limit']) : undefined,
        tokensRemaining: headers['anthropic-ratelimit-tokens-remaining'] ? parseInt(headers['anthropic-ratelimit-tokens-remaining']) : undefined,
        tokensReset: parseResetTime(headers['anthropic-ratelimit-tokens-reset'])
      };
    }
  },

  // 4. Cohere API
  cohere: {
    baseUrl: 'https://api.cohere.ai',
    endpoint: () => '/v1/chat',
    headers: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }),
    mapRequest: (req) => {
      const systemMessage = req.messages.find(m => m.role === 'system');
      const userMessages = req.messages.filter(m => m.role !== 'system');
      const lastMessage = userMessages[userMessages.length - 1];
      const chatHistory = userMessages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
        message: m.content
      }));

      return {
        message: lastMessage ? lastMessage.content : '',
        chat_history: chatHistory,
        preamble: systemMessage?.content,
        temperature: req.temperature ?? 0.7
      };
    },
    parseResponseText: (data) => {
      return data.text || '';
    },
    parseUsage: (data) => {
      if (data.meta?.tokens) {
        return {
          promptTokens: data.meta.tokens.input_tokens || 0,
          outputTokens: data.meta.tokens.output_tokens || 0
        };
      }
      return null;
    },
    parseRateLimitHeaders: (headers) => {
      return {
        requestsLimit: headers['x-ratelimit-limit'] ? parseInt(headers['x-ratelimit-limit']) : undefined,
        requestsRemaining: headers['x-ratelimit-remaining'] ? parseInt(headers['x-ratelimit-remaining']) : undefined,
        requestsReset: headers['x-ratelimit-reset'] ? Math.max(0, (parseInt(headers['x-ratelimit-reset']) * 1000 - Date.now()) / 1000) : undefined
      };
    }
  }
};

// Helper function to resolve provider config
export function getProviderConfig(provider: string): ProviderConfig {
  if (provider === 'gemini') return ProviderDictionary.gemini;
  if (provider === 'anthropic') return ProviderDictionary.anthropic;
  if (provider === 'cohere') return ProviderDictionary.cohere;
  return ProviderDictionary.openai_compatible;
}
