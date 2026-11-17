import React, { useState } from 'react';
import { X, Send, Phone, Video, ShieldCheck, CheckCheck } from 'lucide-react';

export default function ChatDrawer({ property, onClose, onRequestCall }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'owner',
      text: `Hello! I'm Vikramaditya Rao, the direct owner. How can I help you today?`,
      time: '10:30 AM'
    }
  ]);
  const [inputText, setInputText] = useState('');

  const handlePhoneClick = () => {
    if (onRequestCall) {
      onRequestCall(property);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Simulate instant owner response
    setTimeout(() => {
      const ownerReply = {
        id: Date.now() + 1,
        sender: 'owner',
        text: "Yes, I have the e-Khata extract and title deed ready. We can arrange a site visit whenever convenient for you!",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, ownerReply]);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[10001] bg-slate-950/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* WhatsApp style header */}
        <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center border-2 border-white">
                VR
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#075E54]"></span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-extrabold text-sm leading-none">Vikramaditya Rao</h4>
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
              </div>
              <span className="text-[11px] text-emerald-200">Verified Owner · Online</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handlePhoneClick}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-all"
              title="Request Direct Callback from Owner"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Property summary bar */}
        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="truncate max-w-[240px] font-bold text-slate-900">{property?.title || 'Direct Listing'}</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-extrabold">
            0% Brokerage
          </span>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#E5DDD5]/30">
          <div className="text-center my-2">
            <span className="bg-white/90 text-slate-500 text-[10px] font-semibold px-3 py-1 rounded-full shadow-xs border border-slate-200">
              Direct owner chat · 0% brokerage
            </span>
          </div>

          {messages.map((m) => (
            <div 
              key={m.id} 
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-xs ${
                  m.sender === 'user' 
                    ? 'bg-[#DCF8C6] text-slate-900 rounded-br-xs' 
                    : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400">
                  <span>{m.time}</span>
                  {m.sender === 'user' && <CheckCheck className="w-3 h-3 text-indigo-500" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat input box */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input 
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message owner..."
            className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
          />
          <button 
            type="submit"
            className="w-9 h-9 rounded-full bg-[#075E54] hover:bg-[#064e46] text-white flex items-center justify-center transition-all shadow shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
