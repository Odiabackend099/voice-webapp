import React from 'react';

interface TranscriptDisplayProps {
  transcript: string;
  interimTranscript: string;
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ 
  transcript, 
  interimTranscript 
}) => {
  return (
    <div className="mb-6 bg-white/10 backdrop-blur rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Transcript</h3>
      <div className="h-32 overflow-y-auto bg-black/20 rounded-lg p-4 font-mono text-sm">
        <div className="text-green-400">{transcript}</div>
        <div className="text-yellow-400 opacity-75">{interimTranscript}</div>
      </div>
    </div>
  );
};

export default TranscriptDisplay;