// MiniMax TTS Service for real voice synthesis
import { voiceDebugger } from './debug';

export interface TTSServiceConfig {
  apiKey: string;
  groupId?: string;
  model?: string;
  baseUrl?: string;
  voiceId?: string;
}

export interface TTSRequest {
  text: string;
  voiceId: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  format?: 'wav' | 'mp3';
  sampleRate?: number;
}

export interface TTSResponse {
  audioData: string; // Base64 encoded audio
  format: string;
  sampleRate: number;
  duration?: number;
}

export class TTSService {
  private config: Required<TTSServiceConfig>;

  constructor(config: TTSServiceConfig) {
    this.config = {
      model: 'speech-02-hd',
      baseUrl: 'https://api.minimax.io/v1/t2a_v2',
      groupId: 'default',
      voiceId: 'male-qn-qingse',
      ...config
    };
  }

  async synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
    if (!this.config.apiKey || !this.config.groupId) {
      throw new Error('MiniMax API key and group ID are required');
    }

    const postData = JSON.stringify({
      model: this.config.model,
      text: request.text,
      voice_id: request.voiceId,
      group_id: this.config.groupId,
      audio_format: request.format || 'wav',
      sample_rate: request.sampleRate || 16000,
      speed: request.speed || 1.0,
      pitch: request.pitch || 1.0,
      volume: request.volume || 0.8,
      stream: false
    });

    voiceDebugger.logInfo(`Synthesizing speech - text length: ${request.text.length}, voice: ${request.voiceId}`);

    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: postData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`TTS synthesis failed: ${errorData.base_resp?.status_msg || response.statusText}`);
      }

      const result = await response.json();

      if (!result.audio_data) {
        throw new Error('No audio data in response');
      }

      voiceDebugger.logInfo(`Speech synthesis successful - audio length: ${result.audio_data.length}, format: ${result.format || request.format || 'wav'}, sample rate: ${result.sample_rate || request.sampleRate || 16000}`);

      return {
        audioData: result.audio_data,
        format: result.format || request.format || 'wav',
        sampleRate: result.sample_rate || request.sampleRate || 16000,
        duration: result.duration
      };

    } catch (error) {
      voiceDebugger.logError('TTSService', `Synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  // Get available voice IDs (production voice IDs)
  getAvailableVoices(): Record<string, string> {
    return {
      odiaAfricanMale: 'moss_audio_4e6eb029-ab89-11f0-a74c-2a7a0b4baedc',
      marcusAmericanMale: 'moss_audio_a59cd561-ab87-11f0-a74c-2a7a0b4baedc',
      marcyAmericanFemale: 'moss_audio_fdad4786-ab84-11f0-a816-023f15327f7a',
      joslynAfricanFemale: 'moss_audio_141d8c4c-a6f8-11f0-84c1-0ec6fa858d82'
    };
  }

  // Map voice selection to voice ID
  getVoiceId(voiceId: string): string {
    const voices = this.getAvailableVoices();
    const mapping: Record<string, string> = {
      'odia': voices.odiaAfricanMale || 'male-qn-qingse',
      'marcus': voices.marcusAmericanMale || 'male-qn-qingse',
      'marcy': voices.marcyAmericanFemale || 'female-qn-qingse',
      'joslyn': voices.joslynAfricanFemale || 'female-qn-qingse'
    };
    return mapping[voiceId] || voices.odiaAfricanMale || 'male-qn-qingse';
  }
}