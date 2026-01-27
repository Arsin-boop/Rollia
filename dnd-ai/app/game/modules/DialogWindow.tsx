'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Message {
  sender: 'DM' | 'Player';
  text: string;
}

interface DialogWindowProps {
  messages: Message[];
  onSend: (message: string) => void;
}

export function DialogWindow({ messages, onSend }: DialogWindowProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  function handleSend() {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  }

  // Автопрокрутка вниз
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
      {/* Сообщения */}
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto p-3 bg-slate-900 rounded-lg border border-slate-600 space-y-3"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg max-w-[80%] ${
              msg.sender === 'DM'
                ? 'bg-slate-700 text-amber-300 mr-auto'
                : 'bg-amber-600/20 text-amber-200 ml-auto'
            }`}
          >
            <span className="font-semibold">{msg.sender}:</span> {msg.text}
          </div>
        ))}
      </div>

      {/* Поле ввода */}
      <div className="flex gap-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-600 text-slate-200 rounded-lg p-3 focus:ring-amber-600 focus:outline-none"
          placeholder="Speak to the Dungeon Master..."
        />
        <Button
          onClick={handleSend}
          className="bg-amber-600 hover:bg-amber-700 text-white px-5"
        >
          Send
        </Button>
      </div>
    </div>
  );
}
