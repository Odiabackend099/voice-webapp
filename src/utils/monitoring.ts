/**
 * Comprehensive monitoring and health check system for Voice AI application
 * Implements best practices for monitoring voice web app performance and health
 */

import { voiceDebugger } from './debug';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: number;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  audioLatency: number;
  recognitionAccuracy: number;
  responseTime: number;
}

export class VoiceAIMonitor {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private monitoringInterval: number | null = null;
  private alertThresholds: Map<string, { warning: number; critical: number }> = new Map();
  private alertCallbacks: Map<string, (metric: string, value: number, threshold: number) => void> = new Map();

  constructor() {
    this.setupDefaultThresholds();
    this.startMonitoring();
  }

  /**
   * Setup default alert thresholds
   */
  private setupDefaultThresholds(): void {
    this.alertThresholds.set('responseTime', { warning: 2000, critical: 5000 });
    this.alertThresholds.set('audioLatency', { warning: 100, critical: 300 });
    this.alertThresholds.set('recognitionAccuracy', { warning: 0.7, critical: 0.5 });
    this.alertThresholds.set('networkLatency', { warning: 1000, critical: 3000 });
    this.alertThresholds.set('memoryUsage', { warning: 0.8, critical: 0.95 });
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = window.setInterval(async () => {
      await this.performHealthChecks();
      this.checkAlertThresholds();
    }, 30000); // Check every 30 seconds

    voiceDebugger.logInfo('Voice AI monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      voiceDebugger.logInfo('Voice AI monitoring stopped');
    }
  }

  /**
   * Perform comprehensive health checks
   */
  private async performHealthChecks(): Promise<void> {
    const checks = [
      this.checkBrowserCompatibility(),
      this.checkMicrophoneHealth(),
      this.checkSpeechRecognitionHealth(),
      this.checkNetworkHealth(),
      this.checkAudioHealth(),
      this.checkAPIHealth()
    ];

    const results = await Promise.allSettled(checks);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        this.healthChecks.set(result.value.name, result.value);
      } else {
        voiceDebugger.logError('HealthCheck', `Health check failed: ${result.reason}`);
      }
    });
  }

  /**
   * Check browser compatibility
   */
  private async checkBrowserCompatibility(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      const tests = {
        speechRecognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
        webAudioAPI: 'AudioContext' in window || 'webkitAudioContext' in window,
        getUserMedia: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
        speechSynthesis: 'speechSynthesis' in window,
        localStorage: 'localStorage' in window,
        fetchAPI: 'fetch' in window
      };

      const unsupported = Object.entries(tests).filter(([_, supported]) => !supported);
      const responseTime = performance.now() - startTime;

      if (unsupported.length === 0) {
        return {
          name: 'browserCompatibility',
          status: 'healthy',
          message: 'All required APIs are supported',
          timestamp: Date.now(),
          responseTime,
          details: tests
        };
      } else if (unsupported.length <= 2) {
        return {
          name: 'browserCompatibility',
          status: 'degraded',
          message: `Some APIs not supported: ${unsupported.map(([api]) => api).join(', ')}`,
          timestamp: Date.now(),
          responseTime,
          details: tests
        };
      } else {
        return {
          name: 'browserCompatibility',
          status: 'unhealthy',
          message: `Critical APIs missing: ${unsupported.map(([api]) => api).join(', ')}`,
          timestamp: Date.now(),
          responseTime,
          details: tests
        };
      }
    } catch (error: any) {
      return {
        name: 'browserCompatibility',
        status: 'unhealthy',
        message: `Browser compatibility check failed: ${error.message}`,
        timestamp: Date.now(),
        responseTime: performance.now() - startTime
      };
    }
  }

  /**
   * Check microphone health
   */
  private async checkMicrophoneHealth(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        } 
      });
      
      // Test audio levels
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      const averageLevel = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      
      // Clean up
      stream.getTracks().forEach(track => track.stop());
      await audioContext.close();
      
      const responseTime = performance.now() - startTime;
      voiceDebugger.recordMetric('microphoneResponseTime', responseTime);
      
      if (averageLevel > 0) {
        return {
          name: 'microphone',
          status: 'healthy',
          message: 'Microphone working normally',
          timestamp: Date.now(),
          responseTime,
          details: { averageLevel }
        };
      } else {
        return {
          name: 'microphone',
          status: 'degraded',
          message: 'Microphone detected but no audio input',
          timestamp: Date.now(),
          responseTime,
          details: { averageLevel }
        };
      }
    } catch (error: any) {
      return {
        name: 'microphone',
        status: 'unhealthy',
        message: `Microphone error: ${error.message}`,
        timestamp: Date.now(),
        responseTime: performance.now() - startTime
      };
    }
  }

  /**
   * Check speech recognition health
   */
  private async checkSpeechRecognitionHealth(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        return {
          name: 'speechRecognition',
          status: 'unhealthy',
          message: 'Speech recognition not supported',
          timestamp: Date.now(),
          responseTime: performance.now() - startTime
        };
      }

      const recognition = new SpeechRecognition();
      const responseTime = performance.now() - startTime;
      
      return {
        name: 'speechRecognition',
        status: 'healthy',
        message: 'Speech recognition available',
        timestamp: Date.now(),
        responseTime,
        details: {
          continuous: recognition.continuous,
          interimResults: recognition.interimResults,
          lang: recognition.lang
        }
      };
    } catch (error: any) {
      return {
        name: 'speechRecognition',
        status: 'unhealthy',
        message: `Speech recognition error: ${error.message}`,
        timestamp: Date.now(),
        responseTime: performance.now() - startTime
      };
    }
  }

  /**
   * Check network health
   */
  private async checkNetworkHealth(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      // Test basic connectivity
      const connectivityTest = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (!connectivityTest.ok) {
        throw new Error('Network connectivity test failed');
      }

      // Test API endpoints
      const apiTests = await Promise.allSettled([
        this.testGroqAPI(),
        this.testMiniMaxAPI()
      ]);

      const responseTime = performance.now() - startTime;
      voiceDebugger.recordMetric('networkLatency', responseTime);

      const failedTests = apiTests.filter(test => test.status === 'rejected');
      
      if (failedTests.length === 0) {
        return {
          name: 'network',
          status: 'healthy',
          message: 'All network tests passed',
          timestamp: Date.now(),
          responseTime,
          details: { apiTests: apiTests.length }
        };
      } else if (failedTests.length === 1) {
        return {
          name: 'network',
          status: 'degraded',
          message: `One API endpoint failed: ${failedTests[0]?.status === 'rejected' ? failedTests[0].reason : 'Unknown'}`,
          timestamp: Date.now(),
          responseTime,
          details: { failedTests: failedTests.length }
        };
      } else {
        return {
          name: 'network',
          status: 'unhealthy',
          message: 'Multiple API endpoints failed',
          timestamp: Date.now(),
          responseTime,
          details: { failedTests: failedTests.length }
        };
      }
    } catch (error: any) {
      return {
        name: 'network',
        status: 'unhealthy',
        message: `Network error: ${error.message}`,
        timestamp: Date.now(),
        responseTime: performance.now() - startTime
      };
    }
  }

  /**
   * Test Groq API
   */
  private async testGroqAPI(): Promise<boolean> {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-cache'
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Test MiniMax API
   */
  private async testMiniMaxAPI(): Promise<boolean> {
    try {
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'abab5.5-chat',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }),
        cache: 'no-cache'
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check audio health
   */
  private async checkAudioHealth(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      if (!('speechSynthesis' in window)) {
        return {
          name: 'audio',
          status: 'unhealthy',
          message: 'Text-to-speech not supported',
          timestamp: Date.now(),
          responseTime: performance.now() - startTime
        };
      }

      const voices = window.speechSynthesis.getVoices();
      const responseTime = performance.now() - startTime;
      
      if (voices.length > 0) {
        return {
          name: 'audio',
          status: 'healthy',
          message: `Audio system ready with ${voices.length} voices`,
          timestamp: Date.now(),
          responseTime,
          details: { voiceCount: voices.length }
        };
      } else {
        return {
          name: 'audio',
          status: 'degraded',
          message: 'Audio system available but no voices loaded',
          timestamp: Date.now(),
          responseTime,
          details: { voiceCount: 0 }
        };
      }
    } catch (error: any) {
      return {
        name: 'audio',
        status: 'unhealthy',
        message: `Audio error: ${error.message}`,
        timestamp: Date.now(),
        responseTime: performance.now() - startTime
      };
    }
  }

  /**
   * Check API health
   */
  private async checkAPIHealth(): Promise<HealthCheck> {
    const startTime = performance.now();
    
    try {
      const apiKeyChecks = {
        groq: !!import.meta.env.VITE_GROQ_API_KEY,
        minimax: !!import.meta.env.VITE_MINIMAX_API_KEY,
        minimaxGroup: !!import.meta.env.VITE_MINIMAX_GROUP_ID
      };

      const missingKeys = Object.entries(apiKeyChecks)
        .filter(([_, present]) => !present)
        .map(([key]) => key);

      const responseTime = performance.now() - startTime;
      
      if (missingKeys.length === 0) {
        return {
          name: 'apiConfiguration',
          status: 'healthy',
          message: 'All API keys configured',
          timestamp: Date.now(),
          responseTime,
          details: apiKeyChecks
        };
      } else {
        return {
          name: 'apiConfiguration',
          status: 'unhealthy',
          message: `Missing API keys: ${missingKeys.join(', ')}`,
          timestamp: Date.now(),
          responseTime,
          details: apiKeyChecks
        };
      }
    } catch (error: any) {
      return {
        name: 'apiConfiguration',
        status: 'unhealthy',
        message: `API configuration error: ${error.message}`,
        timestamp: Date.now(),
        responseTime: performance.now() - startTime
      };
    }
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(): void {
    this.alertThresholds.forEach((thresholds, metric) => {
      const stats = voiceDebugger.getMetricStats(metric);
      if (stats && stats.avg > 0) {
        if (stats.avg > thresholds.critical) {
          this.triggerAlert(metric, stats.avg, thresholds.critical, 'critical');
        } else if (stats.avg > thresholds.warning) {
          this.triggerAlert(metric, stats.avg, thresholds.warning, 'warning');
        }
      }
    });
  }

  /**
   * Trigger alert
   */
  private triggerAlert(metric: string, value: number, threshold: number, level: 'warning' | 'critical'): void {
    const callback = this.alertCallbacks.get(metric);
    if (callback) {
      callback(metric, value, threshold);
    } else {
      if (level === 'critical') {
        voiceDebugger.logError('Alert', `Critical alert: ${metric} = ${value.toFixed(2)} (threshold: ${threshold})`);
        voiceDebugger.logWarning(`Warning: ${metric} = ${value.toFixed(2)} (threshold: ${threshold})`);
      }
    }
  }

  /**
   * Set alert threshold
   */
  setAlertThreshold(metric: string, warning: number, critical: number): void {
    this.alertThresholds.set(metric, { warning, critical });
  }

  /**
   * Set alert callback
   */
  setAlertCallback(metric: string, callback: (metric: string, value: number, threshold: number) => void): void {
    this.alertCallbacks.set(metric, callback);
  }

  /**
   * Get current health status
   */
  getHealthStatus(): Record<string, HealthCheck> {
    return Object.fromEntries(this.healthChecks);
  }

  /**
   * Get overall system health
   */
  getOverallHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; details: Record<string, HealthCheck> } {
    const checks = Array.from(this.healthChecks.values());
    
    if (checks.length === 0) {
      return { status: 'unhealthy', details: {} };
    }

    const unhealthyCount = checks.filter(check => check.status === 'unhealthy').length;
    const degradedCount = checks.filter(check => check.status === 'degraded').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      details: Object.fromEntries(this.healthChecks)
    };
  }

  /**
   * Get health status for SystemMonitor
   */
  async getHealthStatusForMonitor(): Promise<{
    browser: { status: 'healthy' | 'warning' | 'error'; message: string };
    microphone: { status: 'healthy' | 'warning' | 'error'; message: string };
    speechRecognition: { status: 'healthy' | 'warning' | 'error'; message: string };
    network: { status: 'healthy' | 'warning' | 'error'; message: string };
    audio: { status: 'healthy' | 'warning' | 'error'; message: string };
    api: { status: 'healthy' | 'warning' | 'error'; message: string };
  }> {
    const checks = this.getHealthStatus();
    
    const getStatusForComponent = (name: string): { status: 'healthy' | 'warning' | 'error'; message: string } => {
      const check = checks[name];
      if (!check) return { status: 'error', message: 'Check not found' };
      
      return {
        status: check.status === 'unhealthy' ? 'error' : check.status === 'degraded' ? 'warning' : 'healthy',
        message: check.message
      };
    };

    return {
      browser: getStatusForComponent('browserCompatibility'),
      microphone: getStatusForComponent('microphone'),
      speechRecognition: getStatusForComponent('speechRecognition'),
      network: getStatusForComponent('network'),
      audio: getStatusForComponent('audio'),
      api: getStatusForComponent('apiConfiguration')
    };
  }

  /**
   * Get system metrics summary
   */
  getSystemMetrics(): SystemMetrics {
    return {
      cpuUsage: this.getCPUEstimate(),
      memoryUsage: this.getMemoryUsage(),
      networkLatency: voiceDebugger.getMetricStats('networkLatency')?.avg || 0,
      audioLatency: voiceDebugger.getMetricStats('audioLatency')?.avg || 0,
      recognitionAccuracy: voiceDebugger.getMetricStats('recognitionAccuracy')?.avg || 0,
      responseTime: voiceDebugger.getMetricStats('responseTime')?.avg || 0
    };
  }

  /**
   * Get CPU usage estimate (simplified)
   */
  private getCPUEstimate(): number {
    // This is a simplified CPU usage estimate
    // In a real implementation, you'd use more sophisticated methods
    if ('performance' in window && 'memory' in performance) {
      const memoryInfo = (performance as any).memory;
      if (memoryInfo) {
        return memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
      }
    }
    return 0;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if ('performance' in window && 'memory' in performance) {
      const memoryInfo = (performance as any).memory;
      if (memoryInfo) {
        return memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
      }
    }
    return 0;
  }

  /**
   * Generate health report
   */
  generateHealthReport(): string {
    const overall = this.getOverallHealth();
    const metrics = this.getSystemMetrics();
    
    const report = {
      timestamp: new Date().toISOString(),
      overallHealth: overall.status,
      healthChecks: overall.details,
      systemMetrics: metrics,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Export health report
   */
  exportHealthReport(): void {
    const report = this.generateHealthReport();
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `voiceai-health-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    voiceDebugger.logInfo('Health report exported');
  }
}

// Export singleton instance
export const monitor = new VoiceAIMonitor();

// Convenience functions
export const {
  getHealthStatus,
  getOverallHealth,
  getSystemMetrics,
  setAlertThreshold,
  setAlertCallback,
  generateHealthReport,
  exportHealthReport,
  stopMonitoring,
  getHealthStatusForMonitor
} = monitor;