import React from 'react';

interface AudioVisualizerProps {
  volume: number;
  isListening: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ volume, isListening }) => {
  return (
    <div className="mb-6 bg-white/10 backdrop-blur rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Audio Input</h3>
      <div className="flex items-center gap-4">
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-100"
            style={{ width: `${volume * 100}%` }}
          />
        </div>
        <span className="text-sm text-gray-400 w-12 text-right">
          {Math.round(volume * 100)}%
        </span>
      </div>
      {isListening && (
        <div className="mt-3 text-center">
          <div className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-500 ml-2">Listening</span>
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;