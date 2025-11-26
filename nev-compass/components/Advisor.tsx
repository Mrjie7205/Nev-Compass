import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Sparkles, Loader2 } from 'lucide-react';
import { sendMessageToGemini } from '../services/geminiService';
import { ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';

const Advisor: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: '你好！我是你的新能源购车顾问。无论你有预算方面的疑问，还是想对比不同车型，我都可以帮你。\n\n比如你可以问我：\n- "25万左右推荐什么纯电轿车？"\n- "理想L6和问界M7哪个更适合家用？"\n- "什么是增程式电动车？"',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const streamResult = await sendMessageToGemini(userMessage.text);
      
      // Create a placeholder for the model response
      const modelMessageId = Date.now() + 1;
      setMessages(prev => [...prev, { role: 'model', text: '', timestamp: modelMessageId }]);

      let fullText = '';
      
      for await (const chunk of streamResult) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => prev.map(msg => 
            msg.timestamp === modelMessageId 
              ? { ...msg, text: fullText } 
              : msg
          ));
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'model',
        text: '抱歉，我遇到了一些连接问题，请稍后再试。',
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4 flex items-center text-white">
        <Sparkles className="mr-2" size={20} />
        <div>
            <h2 className="font-bold text-lg">AI 智能购车顾问</h2>
            <p className="text-cyan-100 text-xs">基于 Gemini 2.5 Flash 模型驱动</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`flex max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-indigo-100 ml-2' : 'bg-cyan-100 mr-2'}`}>
                {msg.role === 'user' ? <User size={16} className="text-indigo-600" /> : <Bot size={16} className="text-cyan-600" />}
              </div>
              
              <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-white text-slate-800 rounded-tr-none border border-slate-100' 
                  : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
              }`}>
                <ReactMarkdown 
                    className="markdown-content"
                    components={{
                        ul: ({node, ...props}) => <ul className="list-disc list-outside ml-4 my-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-4 my-1" {...props} />,
                        li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-cyan-800" {...props} />
                    }}
                >
                    {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的需求，例如：20万左右性价比最高的车..."
            disabled={isLoading}
            className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all disabled:bg-slate-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <div className="text-center mt-2">
            <p className="text-[10px] text-slate-400">AI 可能会产生不准确的信息，请以官方配置表为准。</p>
        </div>
      </div>
    </div>
  );
};

export default Advisor;