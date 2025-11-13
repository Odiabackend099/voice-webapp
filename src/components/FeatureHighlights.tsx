import React from 'react';
import { Brain, Mic, Zap, Shield } from 'lucide-react';

const FeatureHighlights: React.FC = () => {
  return (
    <div className="mt-8 text-center text-gray-400 text-sm">
      <div className="flex justify-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" />
          <span>AI Powered</span>
        </div>
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4" />
          <span>Voice Recognition</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" />
          <span>Real-time</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Secure</span>
        </div>
      </div>
    </div>
  );
};

export default FeatureHighlights;