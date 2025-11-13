import React from 'react';
import { Mic, Square, Pause, Play } from 'lucide-react';

interface ControlButtonsProps {
  isListening: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

const ControlButtons: React.FC<ControlButtonsProps> = ({
  isListening,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume
}) => {
  return (
    <div className="flex gap-3 justify-center">
      {!isListening ? (
        <button
          onClick={onStart}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Mic className="w-5 h-5" />
          Start Listening
        </button>
      ) : (
        <>
          <button
            onClick={onStop}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
          >
            <Square className="w-5 h-5" />
            Stop
          </button>
          {isPaused ? (
            <button
              onClick={onResume}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
            >
              <Play className="w-5 h-5" />
              Resume
            </button>
          ) : (
            <button
              onClick={onPause}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-colors"
            >
              <Pause className="w-5 h-5" />
              Pause
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default ControlButtons;