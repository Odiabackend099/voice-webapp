import { voiceDebugger } from './debug';
import { useEffect } from 'react';

// Resource cleanup utilities for audio contexts and media streams
export class ResourceCleanup {
  private static activeAudioContexts = new Set<AudioContext>();
  private static activeMediaStreams = new Set<MediaStream>();
  private static activeAnimationFrames = new Set<number>();
  private static activeAudioNodes = new Set<AudioNode>();

  // Track audio context for cleanup
  static trackAudioContext(context: AudioContext): void {
    this.activeAudioContexts.add(context);
    voiceDebugger.logInfo('ResourceCleanup', { message: `Tracked audio context: ${context.state}` });
  }

  // Track media stream for cleanup
  static trackMediaStream(stream: MediaStream): void {
    this.activeMediaStreams.add(stream);
    voiceDebugger.logInfo('ResourceCleanup', { message: `Tracked media stream with ${stream.getTracks().length} tracks` });
  }

  // Track animation frame for cleanup
  static trackAnimationFrame(id: number): void {
    this.activeAnimationFrames.add(id);
    voiceDebugger.logInfo('ResourceCleanup', { message: `Tracked animation frame: ${id}` });
  }

  // Track audio node for cleanup
  static trackAudioNode(node: AudioNode): void {
    this.activeAudioNodes.add(node);
    voiceDebugger.logInfo('ResourceCleanup', { message: `Tracked audio node: ${node.constructor.name}` });
  }

  // Clean up audio context
  static async cleanupAudioContext(context: AudioContext | null): Promise<void> {
    if (!context) return;

    try {
      if (context.state !== 'closed') {
        await context.close();
        this.activeAudioContexts.delete(context);
        voiceDebugger.logInfo('ResourceCleanup', { message: 'Audio context closed successfully' });
      }
    } catch (error) {
      voiceDebugger.logError('ResourceCleanup', `Error closing audio context: ${error}`);
    }
  }

  // Clean up media stream
  static cleanupMediaStream(stream: MediaStream | null): void {
    if (!stream) return;

    try {
      const tracks = stream.getTracks();
      tracks.forEach(track => {
        track.stop();
        voiceDebugger.logInfo('ResourceCleanup', { message: `Stopped track: ${track.kind} - ${track.label}` });
      });
      
      this.activeMediaStreams.delete(stream);
      voiceDebugger.logInfo('ResourceCleanup', { message: `Media stream cleaned up: ${tracks.length} tracks stopped` });
    } catch (error) {
      voiceDebugger.logError('ResourceCleanup', `Error cleaning up media stream: ${error}`);
    }
  }

  // Clean up animation frame
  static cleanupAnimationFrame(id: number | null): void {
    if (id === null) return;

    try {
      cancelAnimationFrame(id);
      this.activeAnimationFrames.delete(id);
      voiceDebugger.logInfo('ResourceCleanup', { message: `Animation frame cancelled: ${id}` });
    } catch (error) {
      voiceDebugger.logError('ResourceCleanup', `Error cancelling animation frame: ${error}`);
    }
  }

  // Clean up audio nodes
  static cleanupAudioNodes(): void {
    this.activeAudioNodes.forEach(node => {
      try {
        if (node && typeof node.disconnect === 'function') {
          node.disconnect();
          voiceDebugger.logInfo('ResourceCleanup', { message: `Audio node disconnected: ${node.constructor.name}` });
        }
      } catch (error) {
        voiceDebugger.logError('ResourceCleanup', `Error disconnecting audio node: ${error}`);
      }
    });
    this.activeAudioNodes.clear();
  }

  // Clean up speech synthesis
  static cleanupSpeechSynthesis(): void {
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        voiceDebugger.logInfo('ResourceCleanup', { message: 'Speech synthesis cancelled' });
      }
    } catch (error) {
      voiceDebugger.logError('ResourceCleanup', `Error cancelling speech synthesis: ${error}`);
    }
  }

  // Comprehensive cleanup of all tracked resources
  static async cleanupAll(): Promise<void> {
    voiceDebugger.logInfo('ResourceCleanup', { message: 'Starting comprehensive resource cleanup...' });

    // Clean up animation frames first
    this.activeAnimationFrames.forEach(id => this.cleanupAnimationFrame(id));

    // Clean up audio nodes
    this.cleanupAudioNodes();

    // Clean up media streams
    this.activeMediaStreams.forEach(stream => this.cleanupMediaStream(stream));

    // Clean up speech synthesis
    ResourceCleanup.cleanupSpeechSynthesis();

    // Clean up audio contexts last
    const cleanupPromises = Array.from(this.activeAudioContexts).map(context => 
      this.cleanupAudioContext(context)
    );
    
    await Promise.allSettled(cleanupPromises);

    voiceDebugger.logInfo('ResourceCleanup', { message: 'Comprehensive cleanup completed' });
  }

  // Get resource usage statistics
  static getResourceStats(): {
    audioContexts: number;
    mediaStreams: number;
    animationFrames: number;
    audioNodes: number;
  } {
    return {
      audioContexts: this.activeAudioContexts.size,
      mediaStreams: this.activeMediaStreams.size,
      animationFrames: this.activeAnimationFrames.size,
      audioNodes: this.activeAudioNodes.size
    };
  }

  // Check for resource leaks
  static checkForLeaks(): boolean {
    const stats = this.getResourceStats();
    const hasLeaks = stats.audioContexts > 0 || stats.mediaStreams > 0 || 
                    stats.animationFrames > 0 || stats.audioNodes > 0;

    if (hasLeaks) {
      voiceDebugger.logInfo('ResourceCleanup', { message: 'Potential resource leaks detected', stats });
    }

    return hasLeaks;
  }

  // Reset all tracking (use with caution)
  static reset(): void {
    this.activeAudioContexts.clear();
    this.activeMediaStreams.clear();
    this.activeAnimationFrames.clear();
    this.activeAudioNodes.clear();
    voiceDebugger.logInfo('ResourceCleanup', { message: 'All resource tracking reset' });
  }
}

// React hook for automatic cleanup
export function useResourceCleanup(): void {
  useEffect(() => {
    return () => {
      ResourceCleanup.cleanupAll().catch((error: any) => {
        console.error('Error during resource cleanup:', error);
      });
    };
  }, []);
}

export default ResourceCleanup;