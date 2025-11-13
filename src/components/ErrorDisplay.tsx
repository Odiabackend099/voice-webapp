import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorDisplayProps {
  error: string | null;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  if (!error) return null;

  return (
    <div className="mb-4 bg-red-500/20 border border-red-500 rounded-lg p-4 flex items-center gap-3">
      <AlertCircle className="w-5 h-5 text-red-500" />
      <span className="text-sm">{error}</span>
    </div>
  );
};

export default ErrorDisplay;