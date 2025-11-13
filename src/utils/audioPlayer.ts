// Audio player utility for TTS audio playback
import { voiceDebugger } from './debug';

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (common in browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      voiceDebugger.logInfo('Audio context initialized');
    } catch (error) {
      voiceDebugger.logError('AudioPlayer', `Failed to initialize audio context: ${String(error)}`);
      throw new Error('Web Audio API not supported');
    }
  }

  async playBase64Audio(base64Audio: string, _format: string = 'wav'): Promise<void> {
    if (!this.audioContext) {
      await this.initializeAudioContext();
    }

    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    try {
      // Stop any currently playing audio
      this.stop();

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);

      // Create and configure audio source
      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);

      // Set up event handlers
      this.currentSource.onended = () => {
        this.isPlaying = false;
        this.currentSource = null;
        voiceDebugger.logInfo('Audio playback completed');
      };

      // Start playback
      this.currentSource.start();
      this.isPlaying = true;

      voiceDebugger.logInfo(`Audio playback started - duration: ${audioBuffer.duration}s, sample rate: ${audioBuffer.sampleRate}Hz, channels: ${audioBuffer.numberOfChannels}`);

    } catch (error) {
      voiceDebugger.logError('AudioPlayer', `Audio playback failed: ${String(error)}`);
      this.isPlaying = false;
      throw error;
    }
  }

  stop(): void {
    if (this.currentSource && this.isPlaying) {
      try {
        this.currentSource.stop();
        this.currentSource = null;
        this.isPlaying = false;
        voiceDebugger.logInfo('Audio playback stopped');
      } catch (error) {
        voiceDebugger.logError('AudioPlayer', `Error stopping audio: ${String(error)}`);
      }
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  // Cleanup method
  cleanup(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close().catch(error => {
        voiceDebugger.logError('AudioPlayer', `Error closing audio context: ${String(error)}`);
      });
      this.audioContext = null;
    }
  }
}