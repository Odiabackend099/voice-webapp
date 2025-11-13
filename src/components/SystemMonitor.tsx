import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Activity, Clock, Wifi, Cpu } from 'lucide-react';
import { voiceDebugger } from '../utils/debug';

interface SystemMonitorProps {
  isVisible: boolean;
  onClose: () => void;
}

const SystemMonitor: React.FC<SystemMonitorProps> = ({ isVisible, onClose }) => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [overallHealth, setOverallHealth] = useState<'healthy' | 'warning' | 'error'>('healthy');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshHealth = async () => {
    setIsRefreshing(true);
    try {
      // Mock health status for testing
      const mockStatus = {
        browser: { status: 'healthy' as const, message: 'Browser is compatible' },
        microphone: { status: 'healthy' as const, message: 'Microphone access granted' },
        speechRecognition: { status: 'healthy' as const, message: 'Speech recognition available' },
        network: { status: 'healthy' as const, message: 'Network connection stable' },
        audio: { status: 'healthy' as const, message: 'Audio system working' },
        api: { status: 'healthy' as const, message: 'API services operational' }
      };
      
      setHealthStatus(mockStatus);
      setOverallHealth('healthy');
      setLastUpdated(new Date());
    } catch (error) {
      voiceDebugger.logError('Failed to refresh health status:', error instanceof Error ? error.message : String(error));
      setOverallHealth('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      refreshHealth();
      const interval = setInterval(refreshHealth, 5000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const getStatusIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500/20 border-green-500';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500';
      case 'error':
        return 'bg-red-500/20 border-red-500';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold">System Health Monitor</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshHealth}
                disabled={isRefreshing}
                className="p-2 hover:bg-white/10 rounded-lg transition disabled:opacity-50"
                title="Refresh health status"
              >
                <Clock className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition"
                title="Close monitor"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              overallHealth === 'healthy' ? 'bg-green-400' :
              overallHealth === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
            } animate-pulse`} />
            <span className="capitalize font-semibold">
              System Status: {overallHealth}
            </span>
            <span className="text-sm text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {healthStatus ? (
            Object.entries(healthStatus).map(([key, status]: [string, any]) => (
              <div key={key} className={`p-4 rounded-lg border ${getStatusColor(status.status)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status.status)}
                    <div>
                      <h3 className="font-semibold capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h3>
                      <p className="text-sm text-gray-300">{status.message}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {status.status === 'healthy' ? '✓ Operational' :
                     status.status === 'warning' ? '⚠ Attention' : '✗ Error'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Cpu className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
              <p className="text-gray-400">Loading system health status...</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={refreshHealth}
              disabled={isRefreshing}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg transition"
            >
              <Activity className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
            </button>
            <button
              onClick={() => {
                const report = {
                  timestamp: new Date().toISOString(),
                  overallHealth,
                  healthStatus,
                  userAgent: navigator.userAgent,
                  platform: navigator.platform
                };
                voiceDebugger.logInfo('Diagnostic Report:', report);
                alert('Diagnostic report logged to console');
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 rounded-lg transition"
            >
              <Wifi className="w-4 h-4" />
              Export Report
            </button>
          </div>
          
          <p className="text-xs text-gray-400 text-center mt-4">
            This diagnostic information can help troubleshoot issues. Share the exported report with support if needed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;