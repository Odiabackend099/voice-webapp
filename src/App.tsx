import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, Radio, Zap, Wifi, WifiOff, Settings, User, Shield, AlertCircle, Activity, Pause, Play, RotateCcw, Signal } from 'lucide-react';

// TypeScript Interfaces
interface Voice {
  id: string;
  name: string;
  accent: string;
  lang: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  confidence?: number;
}

interface SessionMetrics {
  totalMessages: number;
  avgLatency: number;
  interruptions: number;
  errors: number;
}

interface AudioConstraints {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  sampleRate: number;
  channelCount: number;
}

// Configuration with environment variables
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
  { id: 'odia', name: 'Odia', accent: 'African Male', lang: 'en-NG' },
  { id: 'marcus', name: 'Marcus', accent: 'American Male', lang: 'en-US' },
  { id: 'marcy', name: 'Marcy', accent: 'American Female', lang: 'en-US' },
  { id: 'joslyn', name: 'Joslyn', accent: 'African Female', lang: 'en-NG' }
];

// Advanced VAD with performance optimizations
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
      if (samples[i] * samples[i - 1] < 0) zcr++;
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

// Optimized Audio Buffer Manager
class AudioBufferManager {
  private queue: Blob[] = [];
  private isPlaying: boolean = false;
  private currentAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;

  add(audioBlob: Blob): void {
    this.queue.push(audioBlob);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBlob = this.queue.shift()!;
    const audioUrl = URL.createObjectURL(audioBlob);
    
    this.currentAudio = new Audio(audioUrl);
    
    return new Promise((resolve) => {
      if (!this.currentAudio) return;
      
      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.playNext();
        resolve();
      };
      
      this.currentAudio.onerror = (error) => {
        console.error('Playback error:', error);
        URL.revokeObjectURL(audioUrl);
        this.playNext();
        resolve();
      };
      
      this.currentAudio.play().catch(err => {
        console.error('Playback error:', err);
        this.playNext();
        resolve();
      });
    });
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.queue = [];
    this.isPlaying = false;
  }

  clear(): void {
    this.stop();
  }
}

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

// Main Component
const VoiceAIApp: React.FC = () => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICES[0]);
  const [volume, setVolume] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<string>('excellent');
  const [latency, setLatency] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics>({
    totalMessages: 0,
    avgLatency: 0,
    interruptions: 0,
    errors: 0
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<AdvancedVAD | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioBufferManager = useRef<AudioBufferManager>(new AudioBufferManager());
  const latencyMeasurements = useRef<number[]>([]);
  const conversationStartTime = useRef<number | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const isMounted = useRef<boolean>(true);

  // Initialize audio context
  useEffect(() => {
    const initAudioContext = async () => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext({
          sampleRate: CONFIG.AUDIO_CONSTRAINTS.sampleRate
        });
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
        setError('Failed to initialize audio system');
      }
    };
    
    initAudioContext();
    
    return () => {
      isMounted.current = false;
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = selectedVoice.lang;

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      if (!isMounted.current) return;
      
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += text + ' ';
        } else {
          interimText += text;
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

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (!isMounted.current) return;
      
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Recognition error: ${event.error}`);
        updateMetrics('errors', 1);
      }
    };

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
    debounce((text: string) => {
      if (text && text.length >= 3) {
        handleUserSpeech(text);
      }
    }, 300),
    []
  );

  // Handle user speech with error handling
  const handleUserSpeech = async (text: string): Promise<void> => {
    if (!text || text.length < 3 || isProcessing) return;

    if (isSpeaking) {
      audioBufferManager.current.stop();
      setIsSpeaking(false);
      updateMetrics('interruptions', 1);
    }

    const userMessage: Message = { 
      role: 'user', 
      content: text, 
      timestamp: Date.now(),
      confidence: confidence || 0
    };
    
    setConversation(prev => [...prev, userMessage]);
    setIsProcessing(true);
    const startTime = performance.now();

    try {
      // Validate API key
      if (!CONFIG.GROQ_API_KEY) {
        throw new Error('Groq API key not configured');
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { 
              role: 'system', 
              content: `You are ODIADEV's voice AI assistant. Keep responses brief (2-3 sentences max), natural, and conversational for voice interaction. Focus on African markets, accent-aware speech, and 3G optimization.` 
            },
            ...conversation.slice(-6).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text }
          ],
          max_tokens: 100,
          temperature: 0.7,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`AI response failed: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid AI response format');
      }
      
      const aiText = data.choices[0].message.content;
      
      const aiMessage: Message = { 
        role: 'assistant', 
        content: aiText, 
        timestamp: Date.now() 
      };
      
      setConversation(prev => [...prev, aiMessage]);
      await synthesizeSpeech(aiText);
      
      const endTime = performance.now();
      const responseLatency = Math.round(endTime - startTime);
      
      setLatency(responseLatency);
      latencyMeasurements.current.push(responseLatency);
      
      // Keep only last 10 measurements for average calculation
      if (latencyMeasurements.current.length > 10) {
        latencyMeasurements.current.shift();
      }
      
      const avgLat = latencyMeasurements.current.length > 0 
        ? Math.round(latencyMeasurements.current.reduce((a, b) => a + b, 0) / latencyMeasurements.current.length)
        : 0;
      
      updateMetrics('avgLatency', () => avgLat);
      updateMetrics('totalMessages', 1);
      
    } catch (err) {
      console.error('Error processing speech:', err);
      setError(err instanceof Error ? err.message : 'Failed to process speech');
      updateMetrics('errors', 1);
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  };

  // Speech synthesis with error handling
  const synthesizeSpeech = async (text: string): Promise<void> => {
    try {
      if (!window.speechSynthesis) {
        throw new Error('Speech synthesis not supported');
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Wait for voices to be loaded
      if (speechSynthesis.getVoices().length === 0) {
        await new Promise<void>(resolve => {
          speechSynthesis.onvoiceschanged = () => resolve();
          setTimeout(() => resolve(), 1000); // Timeout fallback
        });
      }
      
      const voices = speechSynthesis.getVoices();
      const selectedVoiceObj = voices.find(v => 
        v.name.toLowerCase().includes(selectedVoice.name.toLowerCase()) ||
        v.lang === selectedVoice.lang
      ) || voices[0];
      
      if (selectedVoiceObj) {
        utterance.voice = selectedVoiceObj;
      }
      
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      
      utterance.onstart = () => {
        if (isMounted.current) setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        if (isMounted.current) setIsSpeaking(false);
      };
      
      utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
        console.error('Speech synthesis error:', e);
        if (isMounted.current) setIsSpeaking(false);
      };
      
      window.speechSynthesis.speak(utterance);
      
    } catch (err) {
      console.error('Speech synthesis error:', err);
      setError('Failed to synthesize speech');
      setIsSpeaking(false);
    }
  };

  // Start listening with proper error handling
  const startListening = async (): Promise<void> => {
    try {
      setError(null);
      
      // Check permissions first
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permission.state === 'denied') {
        throw new Error('Microphone permission denied');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: CONFIG.AUDIO_CONSTRAINTS
      });
      
      mediaStreamRef.current = stream;

      if (!audioContextRef.current) {
        throw new Error('Audio context not initialized');
      }

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);
      
      const highPassFilter = audioContext.createBiquadFilter();
      highPassFilter.type = 'highpass';
      highPassFilter.frequency.value = 80;
      
      const lowPassFilter = audioContext.createBiquadFilter();
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.value = 4000;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(highPassFilter);
      highPassFilter.connect(lowPassFilter);
      lowPassFilter.connect(analyser);
      
      analyserRef.current = analyser;

      vadRef.current = new AdvancedVAD(
        () => console.log('Speech started'),
        () => console.log('Speech ended'),
        (vol: number) => {
          if (isMounted.current) setVolume(vol);
        },
        (conf: number) => {
          if (isMounted.current) setConfidence(conf);
        }
      );

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const timeDataArray = new Float32Array(analyser.fftSize);
      
      const monitorAudio = (): void => {
        if (!isMounted.current || !isListening) return;
        
        analyser.getByteTimeDomainData(dataArray);
        analyser.getFloatTimeDomainData(timeDataArray);
        
        let sum = 0;
        // Use a more efficient calculation
        const len = Math.min(dataArray.length, 512); // Limit processing
        for (let i = 0; i < len; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / len);
        
        if (vadRef.current) {
          vadRef.current.process(rms, timeDataArray);
        }
        
        animationFrameId.current = requestAnimationFrame(monitorAudio);
      };
      
      monitorAudio();

      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      setIsListening(true);
      conversationStartTime.current = Date.now();
      updateConnectionQuality();
      
    } catch (err) {
      console.error('Error starting microphone:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  };

  const stopListening = (): void => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (vadRef.current) {
      vadRef.current.reset();
    }

    audioBufferManager.current.stop();

    setIsListening(false);
    setIsPaused(false);
    setVolume(0);
    setConfidence(0);
    setTranscript('');
    setInterimTranscript('');
  };

  const togglePause = (): void => {
    if (recognitionRef.current) {
      if (isPaused) {
        recognitionRef.current.start();
      } else {
        recognitionRef.current.stop();
      }
      setIsPaused(!isPaused);
    }
  };

  const updateConnectionQuality = (): void => {
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      const effectiveType = conn.effectiveType;
      const rtt = conn.rtt || 0;
      
      let quality = 'excellent';
      if (effectiveType === '2g' || rtt > 800) quality = 'poor';
      else if (effectiveType === '3g' || rtt > 300) quality = 'good';
      
      setConnectionQuality(quality);
    }
  };

  const resetSession = (): void => {
    setConversation([]);
    setSessionMetrics({
      totalMessages: 0,
      avgLatency: 0,
      interruptions: 0,
      errors: 0
    });
    latencyMeasurements.current = [];
    conversationStartTime.current = null;
    setError(null);
  };

  const getQualityColor = (): string => {
    switch (connectionQuality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getConfidenceColor = (): string => {
    if (confidence > 0.7) return 'bg-green-500';
    if (confidence > 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-bold">ODIADEV Voice AI</h1>
              <p className="text-sm text-gray-400">Advanced Voice Interface v2.0</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3 bg-white/5 rounded-lg p-4 backdrop-blur mb-6 text-sm">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${getQualityColor()}`} />
            <span className="text-gray-300">{latency}ms</span>
          </div>
          <div className="flex items-center gap-2">
            {connectionQuality === 'poor' ? <WifiOff className="w-4 h-4 text-red-500" /> : <Wifi className="w-4 h-4 text-green-500" />}
            <span className="text-gray-300 capitalize">{connectionQuality}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300">{Math.round(confidence * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-gray-300">Secure</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {showSettings && (
          <div className="mb-6 bg-white/10 backdrop-blur rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Voice Selection</h3>
            <div className="grid grid-cols-2 gap-3">
              {VOICES.map(voice => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice)}
                  className={`p-4 rounded-xl text-left transition ${
                    selectedVoice.id === voice.id
                      ? 'bg-purple-500 shadow-lg'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold">{voice.name}</div>
                  <div className="text-sm text-gray-400">{voice.accent}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6 max-h-80 overflow-y-auto space-y-3 bg-white/5 backdrop-blur rounded-2xl p-6">
          {conversation.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Start speaking to begin</p>
              <p className="text-sm mt-2">Press the microphone button below</p>
            </div>
          ) : (
            conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/10 text-gray-100'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  {msg.confidence && (
                    <div className="mt-2 text-xs opacity-70">
                      Confidence: {Math.round(msg.confidence * 100)}%
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white/10 p-4 rounded-2xl">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {(transcript || interimTranscript) && (
          <div className="mb-4 bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <p className="text-sm text-gray-300">
              {transcript && <span className="font-semibold">"{transcript}"</span>}
              {interimTranscript && <span className="italic opacity-70"> {interimTranscript}</span>}
            </p>
          </div>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-center gap-1 h-24 mb-4">
            {[...Array(40)].map((_, i) => {
              const height = isListening ? Math.random() * volume * 100 + 20 : 20;
              return (
                <div
                  key={i}
                  className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full transition-all duration-100"
                  style={{
                    height: `${height}%`,
                    opacity: isListening ? 0.8 : 0.2
                  }}
                />
              );
            })}
          </div>

          {isListening && (
            <div className="mb-4 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${getConfidenceColor()}`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            {isListening && (
              <button
                onClick={togglePause}
                className="w-16 h-16 rounded-full bg-yellow-500 hover:bg-yellow-600 flex items-center justify-center transition shadow-lg"
                title={isPaused ? "Resume listening" : "Pause listening"}
              >
                {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
              </button>
            )}

            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse'
                  : 'bg-purple-500 hover:bg-purple-600'
              }`}
              disabled={isProcessing}
            >
              {isListening ? (
                <MicOff className="w-10 h-10" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>

            {conversation.length > 0 && (
              <button
                onClick={resetSession}
                className="w-16 h-16 rounded-full bg-gray-600 hover:bg-gray-700 flex items-center justify-center transition shadow-lg"
                title="Reset session"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
            )}
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold">
              {isListening ? (isPaused ? 'Paused' : 'Listening...') : isSpeaking ? 'Speaking...' : 'Tap to Start'}
            </p>
            <p className="text-sm text-gray-400">
              {selectedVoice.name} • {selectedVoice.accent}
            </p>
          </div>
        </div>

        {sessionMetrics.totalMessages > 0 && (
          <div className="mt-8 grid grid-cols-4 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl font-bold text-purple-400">{sessionMetrics.totalMessages}</div>
              <div className="text-gray-400">Messages</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{sessionMetrics.avgLatency}ms</div>
              <div className="text-gray-400">Avg Latency</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">{sessionMetrics.interruptions}</div>
              <div className="text-gray-400">Interruptions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{sessionMetrics.errors}</div>
              <div className="text-gray-400">Errors</div>
            </div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-3 gap-4 text-center text-xs text-gray-400">
          <div>
            <Zap className="w-5 h-5 mx-auto mb-2 text-purple-400" />
            <p>Ultra-Low Latency</p>
          </div>
          <div>
            <Shield className="w-5 h-5 mx-auto mb-2 text-blue-400" />
            <p>Advanced VAD</p>
          </div>
          <div>
            <Wifi className="w-5 h-5 mx-auto mb-2 text-green-400" />
            <p>3G Optimized</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceAIApp;

// Add type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// Add SpeechRecognitionResultList interface
interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

// Add SpeechRecognitionResult interface
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

// Add SpeechRecognitionAlternative interface
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Add SpeechRecognition interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

// Extend Window interface
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}