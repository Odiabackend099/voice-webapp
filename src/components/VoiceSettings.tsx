import React from 'react';
import { Voice } from '../types';

interface VoiceSettingsProps {
  voices: Voice[];
  selectedVoice: Voice;
  onVoiceSelect: (voice: Voice) => void;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({ 
  voices, 
  selectedVoice, 
  onVoiceSelect 
}) => {
  return (
    <div className="mb-6 bg-white/10 backdrop-blur rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">Voice Selection</h3>
      <div className="grid grid-cols-2 gap-3">
        {voices.map(voice => (
          <button
            key={voice.id}
            onClick={() => onVoiceSelect(voice)}
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
  );
};

export default VoiceSettings;