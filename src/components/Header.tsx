import React from 'react';
import { Radio, Settings } from 'lucide-react';

interface HeaderProps {
  onSettingsClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSettingsClick }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Radio className="w-8 h-8 text-purple-400" />
        <div>
          <h1 className="text-2xl font-bold">ODIADEV Voice AI</h1>
          <p className="text-sm text-gray-400">Advanced Voice Interface v2.0</p>
        </div>
      </div>
      <button
        onClick={onSettingsClick}
        className="p-2 hover:bg-white/10 rounded-lg transition"
      >
        <Settings className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Header;