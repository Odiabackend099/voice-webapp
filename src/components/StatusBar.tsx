import React from 'react';
import { Zap, Wifi, WifiOff, Activity, Shield } from 'lucide-react';

interface StatusBarProps {
  latency: number;
  connectionQuality: string;
  confidence: number;
  getQualityColor: () => string;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  latency, 
  connectionQuality, 
  confidence, 
  getQualityColor 
}) => {
  return (
    <div className="grid grid-cols-4 gap-3 bg-white/5 rounded-lg p-4 backdrop-blur mb-6 text-sm">
      <div className="flex items-center gap-2">
        <Zap className={`w-4 h-4 ${getQualityColor()}`} />
        <span className="text-gray-300">{latency}ms</span>
      </div>
      <div className="flex items-center gap-2">
        {connectionQuality === 'poor' ? 
          <WifiOff className="w-4 h-4 text-red-500" /> : 
          <Wifi className="w-4 h-4 text-green-500" />
        }
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
  );
};

export default StatusBar;