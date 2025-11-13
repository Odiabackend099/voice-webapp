import React, { useState, useEffect, useRef, useCallback } from 'react';
import { voiceDebugger } from './utils/debug';
import { AIService } from './utils/aiService';
import { SpeechInputValidator } from './utils/validation';
import { ResourceCleanup } from './utils/resourceCleanup';
import { TTSService } from './utils/ttsService';
import { AudioPlayer } from './utils/audioPlayer';
import { Voice, Message, SessionMetrics, AudioConstraints } from './types';

// Components
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import ErrorDisplay from './components/ErrorDisplay';
import VoiceSettings from './components/VoiceSettings';
import Conversation from './components/Conversation';
import TranscriptDisplay from './components/TranscriptDisplay';
import AudioVisualizer from './components/AudioVisualizer';
import ControlButtons from './components/ControlButtons';
import SessionMetricsDisplay from './components/SessionMetrics';
import FeatureHighlights from './components/FeatureHighlights';

// Advanced VAD and Audio Buffer Manager classes (kept in main file for now)
class AdvancedVAD {
  private onSpeechStart: () => void;
  private onSpeechEnd: () => void;
  private onVolumeChange: (volume: number) => void;
  private onConfidence: (confidence: number) => void;
  private isSpeaking: boolean = false;
  private speechFrames: number = 0;
  private silenceFrames: number = 0;
  private energyThreshold: number = 0.015;
  private zcrThreshold: number = 0.3;
  private speechConfidence: number = 0;
  private backgroundNoise: number = 0;
  private calibrationSamples: number[] = [];
  private isCalibrated: boolean = false;
  private energyHistory: number[] = [];
  private zcrHistory: number[] = [];
  private readonly historySize: number = 5;
  private readonly calibrationTarget: number = 30;
  private readonly speechStartThreshold: number = 2;
  private readonly speechEndThreshold: number = 8;

  constructor(
    onSpeechStart: () => void,
    onSpeechEnd: () => void,
    onVolumeChange: (volume: number) => void,
    onConfidence: (confidence: number) => void
  ) {
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.onVolumeChange = onVolumeChange;
    this.onConfidence = onConfidence;
  }

  calibrate(volume: number): boolean {
    if (this.calibrationSamples.length < this.calibrationTarget) {
      this.calibrationSamples.push(volume);
      return false;
    }
    
    if (!this.isCalibrated) {
      const sum = this.calibrationSamples.reduce((a, b) => a + b, 0);
      this.backgroundNoise = sum / this.calibrationSamples.length;
      this.energyThreshold = this.backgroundNoise * 3;
      this.isCalibrated = true;
    }
    return true;
  }

  private calculateZCR(samples: Float32Array): number {
    if (!samples || samples.length === 0) return 0.5;
    let zcr = 0;
    for (let i = 1; i < samples.length; i++) {
      const current = samples[i];
      const previous = samples[i - 1];
      if (current !== undefined && previous !== undefined && current * previous < 0) zcr++;
    }
    return zcr / samples.length;
  }

  process(volume: number, samples: Float32Array): void {
    if (!this.isCalibrated) {
      this.calibrate(volume);
      return;
    }

    const energy = volume;
    const zcr = samples.length > 0 ? this.calculateZCR(samples) : 0.5;
    
    // Use circular buffer for better performance
    this.energyHistory.push(energy);
    this.zcrHistory.push(zcr);
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
      this.zcrHistory.shift();
    }
    
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const avgZCR = this.zcrHistory.reduce((a, b) => a + b, 0) / this.zcrHistory.length;
    
    const energySpeech = avgEnergy > this.energyThreshold;
    const zcrSpeech = avgZCR > this.zcrThreshold;
    
    const energyConf = Math.min(avgEnergy / (this.energyThreshold * 3), 1);
    const zcrConf = Math.min(avgZCR / this.zcrThreshold, 1);
    this.speechConfidence = (energyConf + zcrConf) / 2;
    
    if (this.onVolumeChange) this.onVolumeChange(volume);
    if (this.onConfidence) this.onConfidence(this.speechConfidence);
    
    if (energySpeech && zcrSpeech) {
      this.speechFrames++;
      this.silenceFrames = 0;
      
      if (!this.isSpeaking && this.speechFrames > this.speechStartThreshold) {
        this.isSpeaking = true;
        if (this.onSpeechStart) this.onSpeechStart();
      }
    } else {
      this.silenceFrames++;
      this.speechFrames = 0;
      
      if (this.isSpeaking && this.silenceFrames > this.speechEndThreshold) {
        this.isSpeaking = false;
        if (this.onSpeechEnd) this.onSpeechEnd();
      }
    }
  }

  reset(): void {
    this.isSpeaking = false;
    this.speechFrames = 0;
    this.silenceFrames = 0;
    this.speechConfidence = 0;
    this.energyHistory = [];
    this.zcrHistory = [];
  }
}

// AudioBufferManager removed – audio synthesis disabled
// class AudioBufferManager {
//   private queue: Blob[] = [];
//   private isPlaying: boolean = false;
//   private currentAudio: HTMLAudioElement | null = null;
//
//   add(audioBlob: Blob): void {
//     this.queue.push(audioBlob);
//     if (!this.isPlaying) {
//       this.playNext();
//     }
//   }
//
//   private async playNext(): Promise<void> {
//     if (this.queue.length === 0) {
//       this.isPlaying = false;
//       return;
//     }
//
//     this.isPlaying = true;
//     const audioBlob = this.queue.shift()!;
//     const audioUrl = URL.createObjectURL(audioBlob);
//     
//     this.currentAudio = new Audio(audioUrl);
//     
//     return new Promise((resolve) => {
//       if (!this.currentAudio) return;
//       
//       this.currentAudio.onended = () => {
//         URL.revokeObjectURL(audioUrl);
//         this.playNext();
//         resolve();
//       };
//       
//       this.currentAudio.onerror = (error) => {
//         voiceDebugger.logError('AudioPlayback', error instanceof Error ? error.message : String(error));
//         URL.revokeObjectURL(audioUrl);
//         this.playNext();
//         resolve();
//       };
//       
//       this.currentAudio.play().catch(err => {
//         voiceDebugger.logError('AudioPlayback', err instanceof Error ? err.message : String(err));
//         this.playNext();
//         resolve();
//       });
//     });
//   }
//
//   stop(): void {
//     if (this.currentAudio) {
//       // Remove event listeners to prevent memory leaks
//       this.currentAudio.onended = null;
//       this.currentAudio.onerror = null;
//       this.currentAudio.pause();
//       
//       // Revoke object URL if audio source is a blob URL
//       if (this.currentAudio.src && this.currentAudio.src.startsWith('blob:')) {
//         URL.revokeObjectURL(this.currentAudio.src);
//       }
//       
//       this.currentAudio = null;
//     }
//     this.queue = [];
//     this.isPlaying = false;
//   }
//
//   clear(): void {
//     this.stop();
//   }
// }

// Debounce utility
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Configuration
const CONFIG = {
  MINIMAX_API_KEY: import.meta.env.VITE_MINIMAX_API_KEY || '',
  GROQ_API_KEY: import.meta.env.VITE_GROQ_API_KEY || '',
  OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || '',
  USE_OPENAI_REALTIME: import.meta.env.VITE_USE_OPENAI_REALTIME === 'true',
  AUDIO_CONSTRAINTS: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: parseInt(import.meta.env.VITE_AUDIO_SAMPLE_RATE || '16000'),
    channelCount: parseInt(import.meta.env.VITE_AUDIO_CHANNEL_COUNT || '1')
  } as AudioConstraints
};

const VOICES: Voice[] = [
  { id: 'odia', name: 'Odia', accent: 'African Male', lang: 'en-NG', audioUrl: '/minimax_odia_african_male_default.wav' },
  { id: 'marcus', name: 'Marcus', accent: 'American Male', lang: 'en-US', audioUrl: '/minimax_marcus_american_male.wav' },
  { id: 'marcy', name: 'Marcy', accent: 'American Female', lang: 'en-US', audioUrl: '/minimax_marcy_american_female.wav' },
  { id: 'joslyn', name: 'Joslyn', accent: 'African Female', lang: 'en-NG', audioUrl: '/minimax_joslyn_african_female.wav' }
];

const VoiceAIApp: React.FC = () => {
  // State management
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(() => VOICES[0] || { id: 'odia', name: 'Odia', accent: 'African Male', lang: 'en-NG', audioUrl: '/minimax_odia_african_male_default.wav' });
  const [volume, setVolume] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [connectionQuality] = useState<string>('excellent');
  const [latency, setLatency] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics>({
    sessionDuration: 0,
    totalMessages: 0,
    averageLatency: 0,
    accuracy: 0
  });

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<AdvancedVAD | null>(null);
  const recognitionRef = useRef<any>(null);
  // const audioBufferManager = useRef<AudioBufferManager>(new AudioBufferManager());
  const latencyMeasurements = useRef<number[]>([]);
  const conversationStartTime = useRef<number | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const isMounted = useRef<boolean>(true);
  const aiService = useRef<AIService>(new AIService(CONFIG.GROQ_API_KEY));
  const ttsService = useRef<TTSService | null>(null);
  const audioPlayer = useRef<AudioPlayer | null>(null);

  // Resource monitoring for debugging
  const [resourceStats, setResourceStats] = useState(ResourceCleanup.getResourceStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setResourceStats(ResourceCleanup.getResourceStats());
      ResourceCleanup.checkForLeaks();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Initialize audio context, TTS service, and audio player
  useEffect(() => {
    const initAudioContext = async () => {
      try {
        // Initialize audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext({
          sampleRate: CONFIG.AUDIO_CONSTRAINTS.sampleRate
        });
        ResourceCleanup.trackAudioContext(audioContextRef.current);

        // Initialize TTS service if API key is available
        if (CONFIG.MINIMAX_API_KEY) {
          ttsService.current = new TTSService({
            apiKey: CONFIG.MINIMAX_API_KEY,
            voiceId: 'male-qn-qingse' // Default voice
          });
          aiService.current.setTTSService(ttsService.current);
          voiceDebugger.logInfo('TTS service initialized');
        } else {
          voiceDebugger.logWarning('MiniMax API key not configured, TTS disabled');
        }

        // Initialize audio player
        audioPlayer.current = new AudioPlayer();
        voiceDebugger.logInfo('Audio player initialized');

      } catch (error) {
        voiceDebugger.logError('AudioContextInit', error instanceof Error ? error.message : String(error));
        setError('Failed to initialize audio system');
      }
    };
    
    initAudioContext();
    
    return () => {
      isMounted.current = false;
      // Cleanup audio player
      if (audioPlayer.current) {
        audioPlayer.current.cleanup();
      }
      ResourceCleanup.cleanupAll().catch(error => {
        voiceDebugger.logError('ResourceCleanup', `Cleanup error: ${error}`);
      });
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      return;
    }
    
    recognitionRef.current = new SpeechRecognition();
    if (recognitionRef.current) {
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = selectedVoice.lang;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onresult = (event: any) => {
        if (!isMounted.current) return;
        
        let finalText = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result && result[0]) {
            const text = result[0].transcript;
            if (result.isFinal) {
              finalText += text + ' ';
            } else {
              interimText += text;
            }
          }
        }

        if (finalText) {
          setTranscript(finalText);
          setInterimTranscript('');
          debouncedHandleSpeech(finalText.trim());
        } else {
          setInterimTranscript(interimText);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (!isMounted.current) return;
        
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(`Recognition error: ${event.error}`);
          updateMetrics('accuracy', 0);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [selectedVoice]);

  // Metrics update function
  const updateMetrics = useCallback((key: keyof SessionMetrics, value: number | ((prev: number) => number)) => {
    if (!isMounted.current) return;
    
    setSessionMetrics(prev => ({
      ...prev,
      [key]: typeof value === 'function' ? value(prev[key]) : prev[key] + value
    }));
  }, []);

  // Debounced speech handler
  const debouncedHandleSpeech = useCallback(
    debounce(async (text: string) => {
      if (!text.trim() || isProcessing) return;

      const validationResult = SpeechInputValidator.validateSpeechInput(text);
 
       if (!validationResult.isValid) {
        voiceDebugger.logInfo(`Input rejected: ${validationResult.error}`);
         return;
       }

      setIsProcessing(true);
      const startTime = Date.now();

      try {
        // Add user message to conversation
        const userMessage: Message = {
          type: 'user',
          text: text,
          timestamp: Date.now()
        };
        setConversation(prev => [...prev, userMessage]);

        // Prepare conversation context
        const conversationContext = conversation.slice(-5).map(msg => ({
          role: msg.type === 'ai' ? 'assistant' as const : 'user' as const,
          content: msg.text
        }));

        // Get AI response
        const aiResponse = await aiService.current.sendMessage({
          message: text,
          context: conversationContext,
          maxTokens: 100,
          temperature: 0.7
        });
        const processingTime = Date.now() - startTime;

        // Add AI message to conversation
         const aiMessage: Message = {
           type: 'ai',
           text: aiResponse.content,
           timestamp: Date.now()
         };
        setConversation(prev => [...prev, aiMessage]);

        // Update metrics
        updateMetrics('totalMessages', 1);
        setLatency(processingTime);
        latencyMeasurements.current.push(processingTime);
        if (latencyMeasurements.current.length > 10) {
          latencyMeasurements.current.shift();
        }
        const avgLatency = latencyMeasurements.current.reduce((a, b) => a + b, 0) / latencyMeasurements.current.length;
        setSessionMetrics(prev => ({ ...prev, averageLatency: avgLatency }));

        // Play TTS audio if available
        if (aiResponse.audio && audioPlayer.current) {
          try {
            voiceDebugger.logInfo('Playing AI response audio');
            await audioPlayer.current.playBase64Audio(aiResponse.audio);
          } catch (audioError) {
            voiceDebugger.logError('AudioPlayer', `Failed to play audio response: ${String(audioError)}`);
            // Continue without audio - don't fail the response
          }
        }

      } catch (error) {
        voiceDebugger.logError('AIService', error instanceof Error ? error.message : String(error));
        setError('Failed to process your message. Please try again.');
        updateMetrics('accuracy', 0);
      } finally {
        setIsProcessing(false);
      }
    }, 500),
    [isProcessing, conversation, updateMetrics]
  );

  // Start listening function
  const startListening = async () => {
    try {
      setError(null);
      
      if (!audioContextRef.current) {
        throw new Error('Audio context not initialized');
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: CONFIG.AUDIO_CONSTRAINTS
      });
      
      ResourceCleanup.trackMediaStream(stream);
      mediaStreamRef.current = stream;

      // Set up audio processing
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      
      ResourceCleanup.trackAudioNode(source);
      ResourceCleanup.trackAudioNode(analyser);
      
      source.connect(analyser);
      analyserRef.current = analyser;

      // Initialize VAD
      vadRef.current = new AdvancedVAD(
        () => voiceDebugger.logInfo('Speech started'),
        () => voiceDebugger.logInfo('Speech ended'),
        (vol) => setVolume(vol),
        (conf) => setConfidence(conf)
      );

      // Start audio analysis
      const analyzeAudio = () => {
        if (!analyserRef.current || !vadRef.current) return;

        const dataArray = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
           const value = dataArray[i] || 0;
           sum += value * value;
         }
        const volume = Math.sqrt(sum / dataArray.length);

        vadRef.current.process(volume, dataArray);
        
        if (isListening) {
          animationFrameId.current = requestAnimationFrame(analyzeAudio);
          ResourceCleanup.trackAnimationFrame(animationFrameId.current);
        }
      };

      analyzeAudio();

      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      setIsListening(true);
      if (!conversationStartTime.current) {
        conversationStartTime.current = Date.now();
      }

      voiceDebugger.logInfo('Started listening');

    } catch (error) {
      voiceDebugger.logError('VoiceAI', error instanceof Error ? error.message : String(error));
      setError('Failed to start listening. Please check microphone permissions.');
    }
  };

  // Stop listening function
  const stopListening = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }

      if (vadRef.current) {
        vadRef.current.reset();
      }

      setIsListening(false);
      setIsPaused(false);
      setVolume(0);
      setConfidence(0);

      voiceDebugger.logInfo('Stopped listening');

    } catch (error) {
      voiceDebugger.logError('VoiceAI', error instanceof Error ? error.message : String(error));
      setError('Error stopping listening');
    }
  };

  // Toggle pause function
  const togglePause = () => {
    if (isPaused) {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      setIsPaused(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsPaused(true);
    }
  };

  // Helper functions
  const getQualityColor = (): string => {
    if (confidence > 0.7) return 'text-green-500';
    if (confidence > 0.4) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <Header 
          onSettingsClick={() => setShowSettings(!showSettings)}
        />

        {/* Resource monitoring (debug info) */}
        {import.meta.env.DEV && (
          <div className="mb-4 bg-blue-900/20 border border-blue-500 rounded-lg p-3 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-blue-400 font-semibold">Resource Monitor</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-gray-300">
              <div>Audio Contexts: {resourceStats.audioContexts}</div>
              <div>Media Streams: {resourceStats.mediaStreams}</div>
              <div>Animation Frames: {resourceStats.animationFrames}</div>
              <div>Audio Nodes: {resourceStats.audioNodes}</div>
            </div>
          </div>
        )}

        <StatusBar 
          latency={latency}
          connectionQuality={connectionQuality}
          confidence={confidence}
          getQualityColor={getQualityColor}
        />

        <ErrorDisplay error={error} />

        {showSettings && (
          <VoiceSettings 
            voices={VOICES}
            selectedVoice={selectedVoice}
            onVoiceSelect={setSelectedVoice}
          />
        )}

        <Conversation 
          messages={conversation}
          isLoading={isProcessing}
        />

        {(transcript || interimTranscript) && (
          <TranscriptDisplay 
            transcript={transcript}
            interimTranscript={interimTranscript}
          />
        )}

        <AudioVisualizer 
          volume={volume}
          isListening={isListening}
        />

        <ControlButtons
          isListening={isListening}
          isPaused={isPaused}
          onStart={startListening}
          onStop={stopListening}
          onPause={togglePause}
          onResume={togglePause}
        />

        {conversation.length > 0 && (
          <SessionMetricsDisplay metrics={sessionMetrics} />
        )}

        <FeatureHighlights />
      </div>
    </div>
  );
};

export default VoiceAIApp;