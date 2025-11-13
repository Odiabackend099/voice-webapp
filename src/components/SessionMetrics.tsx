import React from 'react';
import { Clock, MessageSquare, Zap, TrendingUp } from 'lucide-react';
import { SessionMetrics } from '../types';

interface SessionMetricsProps {
  metrics: SessionMetrics;
}

const SessionMetricsDisplay: React.FC<SessionMetricsProps> = ({ metrics }) => {
  return (
    <div className="mt-6 bg-white/10 backdrop-blur rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5" />
        Session Metrics
      </h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-gray-300">Duration: {metrics.sessionDuration}s</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-400" />
          <span className="text-gray-300">Messages: {metrics.totalMessages}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-gray-300">Avg Latency: {metrics.averageLatency}ms</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          <span className="text-gray-300">Accuracy: {Math.round(metrics.accuracy * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export default SessionMetricsDisplay;