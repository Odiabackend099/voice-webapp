/**
 * Comprehensive debugging and error handling utilities for Voice AI application
 * Implements best practices for troubleshooting voice web apps
 */

export interface DebugConfig {
  enabled: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  includeStackTrace: boolean;
  maxLogEntries: number;
}

export interface ErrorReport {
  timestamp: string;
  message: string;
  stack: string;
  context?: Record<string, any>;
  userAgent: string;
  url: string;
}

export class VoiceAIDebugger {
  private static instance: VoiceAIDebugger;
  private config: DebugConfig;
  private errorLog: ErrorReport[] = [];
  private performanceMetrics: Map<string, number[]> = new Map();
  
  private constructor(config: DebugConfig = {
    enabled: true,
    logLevel: 'info',
    includeStackTrace: true,
    maxLogEntries: 100
  }) {
    this.config = config;
    this.setupGlobalErrorHandlers();
    this.setupConsoleOverrides();
  }

  static getInstance(config?: DebugConfig): VoiceAIDebugger {
    if (!VoiceAIDebugger.instance) {
      VoiceAIDebugger.instance = new VoiceAIDebugger(config);
    }
    return VoiceAIDebugger.instance;
  }

  /**
   * Setup global error handlers for uncaught exceptions
   */
  private setupGlobalErrorHandlers(): void {
    if (!this.config.enabled) return;

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.logError('UncaughtError', event.error?.message || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('UnhandledRejection', event.reason?.message || event.reason, {
        reason: event.reason
      });
    });

    // Handle security errors
    document.addEventListener('securitypolicyviolation', (event) => {
      this.logError('SecurityPolicyViolation', event.violatedDirective, {
        blockedURI: event.blockedURI,
        originalPolicy: event.originalPolicy
      });
    });
  }

  /**
   * Override console methods for consistent logging
   */
  private setupConsoleOverrides(): void {
    if (!this.config.enabled) return;

    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    console.log = (...args) => {
      if (this.shouldLog('info')) {
        originalConsole.log('[VoiceAI]', ...args);
      }
    };

    console.warn = (...args) => {
      if (this.shouldLog('warn')) {
        originalConsole.warn('[VoiceAI:WARN]', ...args);
      }
    };

    console.error = (...args) => {
      if (this.shouldLog('error')) {
        originalConsole.error('[VoiceAI:ERROR]', ...args);
      }
    };

    console.info = (...args) => {
      if (this.shouldLog('info')) {
        originalConsole.info('[VoiceAI:INFO]', ...args);
      }
    };
  }

  /**
   * Check if message should be logged based on log level
   */
  private shouldLog(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel <= currentLevel;
  }

  /**
   * Log errors with context
   */
  logError(type: string, message: string, context?: Record<string, any>): void {
    const errorReport: ErrorReport = {
      timestamp: new Date().toISOString(),
      message: `${type}: ${message}`,
      stack: this.config.includeStackTrace ? new Error().stack || '' : '',
      context: context || {},
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errorLog.push(errorReport);
    
    // Keep only recent entries
    if (this.errorLog.length > this.config.maxLogEntries) {
      this.errorLog.shift();
    }

    if (this.shouldLog('error')) {
      console.error(`[VoiceAI:ERROR] ${type}: ${message}`, context || '');
    }
  }

  /**
   * Log warnings
   */
  logWarning(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      console.warn('[VoiceAI:WARN]', message, context || '');
    }
  }

  /**
   * Log info messages
   */
  logInfo(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      console.info('[VoiceAI:INFO]', message, context || '');
    }
  }

  /**
   * Log debug messages
   */
  logDebug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      console.debug('[VoiceAI:DEBUG]', message, context || '');
    }
  }

  /**
   * Record performance metrics
   */
  recordMetric(name: string, value: number): void {
    if (!this.performanceMetrics.has(name)) {
      this.performanceMetrics.set(name, []);
    }
    this.performanceMetrics.get(name)!.push(value);
  }

  /**
   * Get performance statistics
   */
  getMetricStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const metrics = this.performanceMetrics.get(name);
    if (!metrics || metrics.length === 0) return null;

    return {
      avg: metrics.reduce((a, b) => a + b, 0) / metrics.length,
      min: Math.min(...metrics),
      max: Math.max(...metrics),
      count: metrics.length
    };
  }

  /**
   * Get error log
   */
  getErrorLog(): ErrorReport[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Generate error report
   */
  generateErrorReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errors: this.errorLog,
      metrics: Object.fromEntries(
        Array.from(this.performanceMetrics.entries()).map(([key]) => [
          key,
          this.getMetricStats(key)
        ])
      ),
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        connection: (navigator as any).connection?.effectiveType || 'unknown'
      }
    };

    try {
      return JSON.stringify(report, null, 2);
    } catch (error) {
      this.logError('Debug Export', (error as Error).message, { error: error });
      return JSON.stringify({
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        errors: this.errorLog.slice(-100),
        metrics: {},
        browserInfo: {
          language: navigator.language,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          connection: (navigator as any).connection?.effectiveType || 'unknown'
        }
      }, null, 2);
    }
  }

  /**
   * Test browser compatibility
   */
  testBrowserCompatibility(): Record<string, boolean> {
    const tests = {
      speechRecognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
      webAudioAPI: 'AudioContext' in window || 'webkitAudioContext' in window,
      getUserMedia: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      webkitGetUserMedia: 'webkitGetUserMedia' in navigator,
      speechSynthesis: 'speechSynthesis' in window,
      localStorage: 'localStorage' in window,
      sessionStorage: 'sessionStorage' in window,
      webWorkers: 'Worker' in window,
      serviceWorker: 'serviceWorker' in navigator,
      fetchAPI: 'fetch' in window,
      promises: 'Promise' in window,
      websockets: 'WebSocket' in window
    };

    this.logInfo('Browser compatibility test', tests);
    return tests;
  }

  /**
   * Test microphone access
   */
  async testMicrophoneAccess(): Promise<{ success: boolean; error?: string; stream?: MediaStream }> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        } 
      });
      
      // Test if we can actually get audio data
      const audioContext = new AudioContext();
      audioContext.createMediaStreamSource(stream); // Create source but don't use it directly
      
      this.logInfo('Microphone access test successful');
      return { success: true, stream };
    } catch (error: any) {
      const errorMessage = this.getMicrophoneErrorMessage(error);
      this.logError('MicrophoneAccessTest', errorMessage, { error: error.name, message: error.message });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get user-friendly microphone error message
   */
  private getMicrophoneErrorMessage(error: any): string {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Microphone access denied. Please allow microphone access in your browser settings.';
      case 'NotFoundError':
        return 'No microphone found. Please connect a microphone.';
      case 'NotReadableError':
        return 'Microphone is already in use by another application.';
      case 'OverconstrainedError':
        return 'Microphone constraints not satisfied.';
      case 'AbortError':
        return 'Microphone request was aborted.';
      default:
        return `Microphone error: ${error.message}`;
    }
  }

  /**
   * Test speech recognition
   */
  testSpeechRecognition(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          resolve({ success: false, error: 'Speech recognition not supported in this browser' });
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        // Test if we can start recognition
        recognition.onstart = () => {
          recognition.stop();
          this.logInfo('Speech recognition test successful');
          resolve({ success: true });
        };

        recognition.onerror = (event: any) => {
          this.logError('SpeechRecognitionTest', event.error, { error: event.error });
          resolve({ success: false, error: `Speech recognition error: ${event.error}` });
        };

        // Try to start (will fail if no mic, but that's OK for testing)
        recognition.start();
        
        // Timeout after 2 seconds
        setTimeout(() => {
          recognition.stop();
          resolve({ success: true });
        }, 2000);

      } catch (error: any) {
        this.logError('SpeechRecognitionTest', error.message, { error: error.name });
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Test text-to-speech
   */
  testTextToSpeech(): { success: boolean; error?: string; voices?: SpeechSynthesisVoice[] } {
    try {
      if (!('speechSynthesis' in window)) {
        return { success: false, error: 'Text-to-speech not supported' };
      }

      const voices = window.speechSynthesis.getVoices();
      
      if (voices.length === 0) {
        return { success: false, error: 'No voices available' };
      }

      // Test speaking
      const utterance = new SpeechSynthesisUtterance('Test speech synthesis');
      utterance.volume = 0.1; // Low volume for testing
      utterance.rate = 1;
      utterance.pitch = 1;
      
      window.speechSynthesis.speak(utterance);
      
      this.logInfo('Text-to-speech test successful', { voiceCount: voices.length });
      return { success: true, voices };
    } catch (error: any) {
      this.logError('TextToSpeechTest', error.message, { error: error.name });
      return { success: false, error: error.message };
    }
  }

  /**
   * Run comprehensive system test
   */
  async runSystemTest(): Promise<{
    browser: Record<string, boolean>;
    microphone: { success: boolean; error?: string; stream?: MediaStream };
    speechRecognition: { success: boolean; error?: string };
    textToSpeech: { success: boolean; error?: string; voices?: SpeechSynthesisVoice[] };
  }> {
    this.logInfo('Starting comprehensive system test');

    const results = {
      browser: this.testBrowserCompatibility(),
      microphone: await this.testMicrophoneAccess(),
      speechRecognition: await this.testSpeechRecognition(),
      textToSpeech: this.testTextToSpeech()
    };

    this.logInfo('System test completed', results);
    return results;
  }

  /**
   * Export debug information
   */
  exportDebugInfo(): void {
    const report = this.generateErrorReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `voiceai-debug-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.logInfo('Debug information exported');
  }
}

// Export singleton instance
export const voiceDebugger = VoiceAIDebugger.getInstance();

// Convenience functions
export const {
  logError,
  logWarning,
  logInfo,
  logDebug,
  recordMetric,
  getMetricStats,
  getErrorLog,
  clearErrorLog,
  generateErrorReport,
  testBrowserCompatibility,
  testMicrophoneAccess,
  testSpeechRecognition,
  testTextToSpeech,
  runSystemTest,
  exportDebugInfo
} = voiceDebugger;