import React from 'react';
import { Message } from '../types';
import { MessageCircle } from 'lucide-react';

interface ConversationProps {
  messages: Message[];
  isLoading: boolean;
}

const Conversation: React.FC<ConversationProps> = ({ messages, isLoading }) => {
  return (
    <div className="mb-6 bg-white/10 backdrop-blur rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5" />
        Conversation
      </h3>
      <div className="h-64 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            Start speaking to begin the conversation
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-500/20 ml-8'
                  : 'bg-purple-500/20 mr-8'
              }`}
            >
              <div className="text-sm font-semibold mb-1">
                {message.type === 'user' ? 'You' : 'AI'}
              </div>
              <div className="text-sm">{message.text}</div>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="bg-purple-500/20 p-3 rounded-lg mr-8">
            <div className="text-sm font-semibold mb-1">AI</div>
            <div className="text-sm animate-pulse">Thinking...</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversation;