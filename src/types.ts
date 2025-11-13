export interface Voice {
  id: string;
  name: string;
  accent: string;
  lang: string;
  audioUrl: string;
}

export interface Message {
  type: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface SessionMetrics {
  sessionDuration: number;
  totalMessages: number;
  averageLatency: number;
  accuracy: number;
}

export interface AudioConstraints {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  sampleRate: number;
  channelCount: number;
}

export interface ResourceStats {
  audioContexts: number;
  mediaStreams: number;
  animationFrames: number;
  audioNodes: number;
}

export interface AIResponse {
  text: string;
  confidence: number;
  processingTime: number;
}