/**
 * Comprehensive error handling and recovery system for Voice AI application
 * Implements best practices for handling common voice web app issues
 */

import { voiceDebugger } from './debug';

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  enableAutoRecovery: boolean;
  enableFallbacks: boolean;
}

export interface RecoveryStrategy {
  name: string;
  action: () => Promise<boolean>;
  fallback?: () => void;
}

export class VoiceAIErrorHandler {
  private config: ErrorHandlerConfig;
  private retryCount: Map<string, number> = new Map();
  private recoveryStrategies: Map<string, RecoveryStrategy[]> = new Map();

  constructor(config: ErrorHandlerConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    enableAutoRecovery: true,
    enableFallbacks: true
  }) {
    this.config = config;
    this.setupDefaultRecoveryStrategies();
  }

  /**
   * Setup default recovery strategies for common errors
   */
  private setupDefaultRecoveryStrategies(): void {
    // Microphone errors
    this.recoveryStrategies.set('microphone', [
      {
        name: 'requestPermission',
        action: async () => {
          try {
            const result = await voiceDebugger.testMicrophoneAccess();
            return result.success;
          } catch {
            return false;
          }
        },
        fallback: () => {
          voiceDebugger.logWarning('Microphone access denied, using fallback mode');
          // Could implement text-only mode here
        }
      },
      {
        name: 'restartAudioContext',
        action: async () => {
          try {
            // Close existing audio context if any
            if ((window as any).audioContext) {
              await (window as any).audioContext.close();
            }
            // Create new audio context
            (window as any).audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            return true;
          } catch {
            return false;
          }
        }
      }
    ]);

    // Speech recognition errors
    this.recoveryStrategies.set('speechRecognition', [
      {
        name: 'restartRecognition',
        action: async () => {
          try {
            const result = await voiceDebugger.testSpeechRecognition();
            return result.success;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'switchRecognitionEngine',
        action: async () => {
          // Try to switch between SpeechRecognition and webkitSpeechRecognition
          try {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
              return true;
            }
          } catch {
            // Fall through to fallback
          }
          return false;
        },
        fallback: () => {
          voiceDebugger.logWarning('Speech recognition unavailable, using text input fallback');
          // Could implement text input mode here
        }
      }
    ]);

    // Network/API errors
    this.recoveryStrategies.set('network', [
      {
        name: 'retryRequest',
        action: async () => {
          // Basic network connectivity test
          try {
            const response = await fetch('/api/health', { 
              method: 'GET',
              timeout: 5000 
            } as any);
            return response.ok;
          } catch {
            return false;
          }
        }
      },
      {
        name: 'checkCORS',
        action: async () => {
          // Test CORS by making a simple request
          try {
            await fetch('https://api.groq.com/openai/v1/models', { 
              method: 'HEAD',
              mode: 'no-cors'
            });
            return true;
          } catch {
            return false;
          }
        },
        fallback: () => {
          voiceDebugger.logWarning('Network issues detected. Check CORS configuration and API endpoints.');
        }
      }
    ]);

    // Audio playback errors
    this.recoveryStrategies.set('audioPlayback', [
      {
        name: 'resumeAudioContext',
        action: async () => {
          try {
            const audioContext = (window as any).audioContext;
            if (audioContext && audioContext.state === 'suspended') {
              await audioContext.resume();
              return true;
            }
          } catch {
            return false;
          }
          return false;
        }
      },
      {
        name: 'testAudioElement',
        action: async () => {
          try {
            const audio = new Audio();
            audio.volume = 0;
            await audio.play();
            return true;
          } catch {
            return false;
          }
        }
      }
    ]);
  }

  /**
   * Handle errors with automatic recovery
   */
  async handleError(error: Error | string, context?: string, metadata?: Record<string, any>): Promise<boolean> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorType = this.categorizeError(errorMessage);
    
    voiceDebugger.logError(errorType, errorMessage, { context, ...metadata });

    if (!this.config.enableAutoRecovery) {
      return false;
    }

    const retryKey = `${errorType}-${context || 'general'}`;
    const currentRetries = this.retryCount.get(retryKey) || 0;

    if (currentRetries >= this.config.maxRetries) {
      voiceDebugger.logWarning(`Max retries reached for ${errorType}, giving up`);
      this.retryCount.delete(retryKey);
      return false;
    }

    this.retryCount.set(retryKey, currentRetries + 1);
    
    voiceDebugger.logInfo(`Attempting recovery for ${errorType} (attempt ${currentRetries + 1}/${this.config.maxRetries})`);

    const strategies = this.recoveryStrategies.get(errorType);
    if (strategies) {
      for (const strategy of strategies) {
        try {
          const success = await this.executeWithTimeout(strategy.action, 10000);
          if (success) {
            voiceDebugger.logInfo(`Recovery successful using strategy: ${strategy.name}`);
            this.retryCount.delete(retryKey);
            return true;
          }
        } catch (strategyError) {
          voiceDebugger.logWarning(`Recovery strategy ${strategy.name} failed`, { error: strategyError });
          
          if (strategy.fallback && this.config.enableFallbacks) {
            try {
              strategy.fallback();
            } catch (fallbackError) {
              voiceDebugger.logWarning(`Fallback for ${strategy.name} also failed`, { error: fallbackError });
            }
          }
        }
      }
    }

    // Wait before retrying
    if (currentRetries < this.config.maxRetries - 1) {
      await this.delay(this.config.retryDelay * (currentRetries + 1));
    }

    return false;
  }

  /**
   * Categorize errors into types for targeted recovery
   */
  private categorizeError(errorMessage: string): string {
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('microphone') || 
        lowerMessage.includes('getusermedia') ||
        lowerMessage.includes('permission denied') ||
        lowerMessage.includes('notallowederror')) {
      return 'microphone';
    }
    
    if (lowerMessage.includes('speechrecognition') ||
        lowerMessage.includes('webkitspeechrecognition') ||
        lowerMessage.includes('recognition') ||
        lowerMessage.includes('speech')) {
      return 'speechRecognition';
    }
    
    if (lowerMessage.includes('network') ||
        lowerMessage.includes('cors') ||
        lowerMessage.includes('fetch') ||
        lowerMessage.includes('api') ||
        lowerMessage.includes('connection')) {
      return 'network';
    }
    
    if (lowerMessage.includes('audio') ||
        lowerMessage.includes('playback') ||
        lowerMessage.includes('sound') ||
        lowerMessage.includes('volume')) {
      return 'audioPlayback';
    }
    
    if (lowerMessage.includes('timeout') ||
        lowerMessage.includes('timed out')) {
      return 'timeout';
    }
    
    return 'general';
  }

  /**
   * Execute function with timeout
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ]);
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset retry counters
   */
  resetRetries(): void {
    this.retryCount.clear();
    voiceDebugger.logInfo('Retry counters reset');
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(errorType: string, strategy: RecoveryStrategy): void {
    if (!this.recoveryStrategies.has(errorType)) {
      this.recoveryStrategies.set(errorType, []);
    }
    this.recoveryStrategies.get(errorType)!.push(strategy);
  }

  /**
   * Get current retry counts
   */
  getRetryCounts(): Record<string, number> {
    return Object.fromEntries(this.retryCount);
  }

  /**
   * Validate API configuration
   */
  async validateAPIConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check for required environment variables
    const requiredEnvVars = ['VITE_GROQ_API_KEY', 'VITE_MINIMAX_API_KEY', 'VITE_MINIMAX_GROUP_ID'];
    
    for (const envVar of requiredEnvVars) {
      if (!import.meta.env[envVar]) {
        errors.push(`Missing environment variable: ${envVar}`);
      }
    }
    
    // Test API endpoints
    try {
      // Test Groq API
      const groqResponse = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!groqResponse.ok) {
        errors.push(`Groq API test failed: ${groqResponse.status} ${groqResponse.statusText}`);
      }
    } catch (error: any) {
      errors.push(`Groq API connection failed: ${error.message}`);
    }
    
    // Test MiniMax API (simplified test)
    try {
      const minimaxResponse = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'abab5.5-chat',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        })
      });
      
      if (!minimaxResponse.ok) {
        errors.push(`MiniMax API test failed: ${minimaxResponse.status} ${minimaxResponse.statusText}`);
      }
    } catch (error: any) {
      errors.push(`MiniMax API connection failed: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const errorHandler = new VoiceAIErrorHandler();

// Convenience functions
export const handleError = (error: Error | string, context?: string, metadata?: Record<string, any>) => 
  errorHandler.handleError(error, context, metadata);

export const validateAPIConfiguration = () => errorHandler.validateAPIConfiguration();
export const resetRetries = () => errorHandler.resetRetries();