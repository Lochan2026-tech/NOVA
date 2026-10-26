import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { AskResponse } from '../api/types';
import {
  MessageSquareCode,
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  RotateCw,
  Lightbulb,
} from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  confidence?: number;
  sources?: string[];
  suggestions?: string[];
}

export const AskChronovaPage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: "Hello! I am Chronova Assistant. You can ask questions about file importance, duplicate storage, or run what-if simulations like: 'What happens if I archive main.py?'",
      suggestions: [
        'What happens if I archive main.py?',
        'Which files are duplicates?',
        'Show me high-risk dependencies',
      ],
    },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading) return;

    setInputQuery('');
    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setLoading(true);

    try {
      const resp = await ChronovaApi.askChronova(q, activeScan?.id);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: resp.answer,
          confidence: resp.confidence,
          sources: resp.sources,
          suggestions: resp.suggestions,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Error processing question: ' + (err.message || 'Server error'),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquareCode className="w-5 h-5 text-cyan-400" />
          Ask Chronova & What-If Consequence Simulation
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Query workspace relationships, simulate deletion consequences, and receive local AI explanations.
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 glass-panel rounded-2xl border border-slate-800 p-5 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed space-y-2 ${
                msg.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-none shadow-md shadow-cyan-600/20'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-bl-none shadow-md'
              }`}
            >
              <div className="whitespace-pre-line">{msg.text}</div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">
                  <span className="font-semibold text-cyan-400 mr-1">Sources:</span>
                  {msg.sources.join(', ')}
                </div>
              )}

              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-1.5">
                  {msg.suggestions.map((s, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSend(s)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700/80 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-center text-xs text-slate-400">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
              <RotateCw className="w-4 h-4 animate-spin" />
            </div>
            <span>Simulating consequences and reasoning...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="glass-panel p-2.5 rounded-2xl border border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question or simulate: 'What happens if I archive main.py?'"
          className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !inputQuery.trim()}
          className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition shadow-lg shadow-cyan-600/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
