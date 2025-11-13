import { voiceDebugger } from './debug';

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

// Speech input validator
export class SpeechInputValidator {
  private static readonly MAX_SPEECH_LENGTH = 500;
  private static readonly MIN_SPEECH_LENGTH = 2;
  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi
  ];

  static validateSpeechInput(text: string): ValidationResult {
    try {
      if (!text || typeof text !== 'string') {
        return { isValid: false, error: 'Input must be a non-empty string' };
      }

      const trimmedText = text.trim();

      // Length validation
      if (trimmedText.length < this.MIN_SPEECH_LENGTH) {
        return { isValid: false, error: `Input must be at least ${this.MIN_SPEECH_LENGTH} characters` };
      }

      if (trimmedText.length > this.MAX_SPEECH_LENGTH) {
        return { isValid: false, error: `Input must not exceed ${this.MAX_SPEECH_LENGTH} characters` };
      }

      // Check for dangerous patterns
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(trimmedText)) {
          return { isValid: false, error: 'Input contains potentially dangerous content' };
        }
      }

      // Sanitize the input
      const sanitized = this.sanitizeInput(trimmedText);

      return {
        isValid: true,
        sanitized
      };

    } catch (error) {
      voiceDebugger.logError('SpeechInputValidator', `Validation error: ${error}`);
      return { isValid: false, error: 'Validation failed' };
    }
  }

  static sanitizeInput(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let sanitized = text.trim();

    // Remove any HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

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

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized;
  }

  // Validate confidence score
  static validateConfidence(confidence: number): ValidationResult {
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      return { isValid: false, error: 'Confidence must be a valid number' };
    }

    if (confidence < 0 || confidence > 1) {
      return { isValid: false, error: 'Confidence must be between 0 and 1' };
    }

    return { isValid: true };
  }
}