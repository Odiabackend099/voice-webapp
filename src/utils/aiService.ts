// Secure API service with input validation and sanitization
import { voiceDebugger } from './debug';

export interface AIServiceConfig {
  groqApiKey?: string;
  openaiApiKey?: string;
  minimaxApiKey?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface AIRequest {
  message: string;
  context: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  audio?: string; // Base64 encoded audio data
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

export class AIService {
  private config: AIServiceConfig;
  private requestQueue: Map<string, AbortController> = new Map();
  private ttsService?: any; // Will be set if TTS is enabled

  setTTSService(ttsService: any): void {
    this.ttsService = ttsService;
  }

  constructor(config: AIServiceConfig) {
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      ...config
    };
  }

  // Input validation and sanitization
  private validateInput(input: string): { isValid: boolean; error?: string } {
    if (!input || typeof input !== 'string') {
      return { isValid: false, error: 'Input must be a non-empty string' };
    }

    if (input.length > 1000) {
      return { isValid: false, error: 'Input too long (max 1000 characters)' };
    }

    // Check for potential injection patterns
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        return { isValid: false, error: 'Potentially dangerous input detected' };
      }
    }

    return { isValid: true };
  }

  // Sanitize input to prevent XSS and injection attacks
  private sanitizeInput(input: string): string {
    // Remove any HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Escape special characters
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    sanitized = sanitized.replace(/[&<>"'\/]/g, (char) => escapeMap[char] || char);
    
    // Trim and normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, ' ');
    
    return sanitized;
  }

  // Rate limiting with exponential backoff
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries = this.config.maxRetries!
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        voiceDebugger.logError('AIService', `Attempt ${attempt + 1} failed: ${lastError.message}`);
        
        if (attempt === retries - 1) {
          throw lastError;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Secure API call with validation and timeout
  async sendMessage(request: AIRequest): Promise<AIResponse> {
    // Validate input
    const validation = this.validateInput(request.message);
    if (!validation.isValid) {
      throw new Error(`Input validation failed: ${validation.error}`);
    }

    // Sanitize input
    const sanitizedMessage = this.sanitizeInput(request.message);
    
    // Validate API key
    if (!this.config.groqApiKey) {
      throw new Error('API key not configured');
    }

    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.config.timeout);
    
    try {
      const response = await this.executeWithRetry(async () => {
        const apiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { 
                role: 'system', 
                content: `You are ODIADEV's voice AI assistant. Keep responses brief (2-3 sentences max), natural, and conversational for voice interaction. Focus on African markets, accent-aware speech, and 3G optimization.` 
              },
              ...request.context,
              { role: 'user', content: sanitizedMessage }
            ],
            max_tokens: Math.min(request.maxTokens || 100, 150), // Cap at 150 tokens
            temperature: Math.max(0, Math.min(request.temperature || 0.7, 1)), // Clamp between 0-1
            stream: false
          }),
          signal: abortController.signal
        });

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`AI response failed: ${errorData.error?.message || apiResponse.statusText}`);
        }

        return apiResponse.json();
      });

      // Validate response
      if (!response.choices?.[0]?.message?.content) {
        throw new Error('Invalid response format from AI service');
      }

      // Sanitize response content
      const sanitizedContent = this.sanitizeInput(response.choices[0].message.content);

      // Generate TTS audio if service is available
      let audioData: string | undefined;
      if (this.ttsService) {
        try {
          voiceDebugger.logInfo('Generating TTS audio for response');
          audioData = await this.ttsService.synthesizeSpeech(sanitizedContent);
          voiceDebugger.logInfo('TTS audio generated successfully');
        } catch (ttsError) {
          voiceDebugger.logError('AIService', `TTS synthesis failed: ${String(ttsError)}`);
          // Continue without audio - don't fail the entire response
        }
      }

      return {
        content: sanitizedContent,
        audio: audioData || '',
        usage: response.usage,
        model: response.model
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Cleanup method
  cleanup(): void {
    // Cancel all pending requests
    this.requestQueue.forEach(controller => controller.abort());
    this.requestQueue.clear();
  }
}

// Factory function to create secure AI service
export const createAIService = (config: AIServiceConfig): AIService => {
  return new AIService(config);
};