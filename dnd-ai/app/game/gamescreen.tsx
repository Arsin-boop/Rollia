'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { aiService } from '@/lib/ai-service';
import type { Character } from '@/types';

// ПЛЕЙСХОЛДЕРЫ — позже заменим реальными компонентами
function MapView() {
  return (
    <div className="w-full h-64 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-400">
      (Map will be generated here)
    </div>
  );
}

function DialogWindow({ messages, onSend }: any) {
  const [input, setInput] = useState('');

  function handleSend() {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  }

  return (
    <div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="h-64 overflow-y-auto p-2 bg-slate-900 rounded border border-slate-700 space-y-2">
        {messages.map((msg: any, i: number) => (
          <div
            key={i}
            className={`p-2 rounded text-sm ${
              msg.sender === 'DM'
                ? 'bg-slate-700 text-amber-300'
                : 'bg-amber-600/20 text-amber-200'
            }`}
          >
            <strong>{msg.sender}:</strong> {msg.text}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 rounded p-2"
          placeholder="Say something..."
        />

        <Button onClick={handleSend} className="bg-amber-600 hover:bg-amber-700">
          Send
        </Button>
      </div>
    </div>
  );
}

// === ОСНОВНОЙ КОМПОНЕНТ ===

export default function GameScreen({ character }: { character: Character }) {
  const [messages, setMessages] = useState([
    {
      sender: 'DM',
      text: `Welcome, ${character.name}. The adventure begins...`,
    },
  ]);

  const [isLoadingDM, setIsLoadingDM] = useState(false);

  async function handlePlayerMessage(text: string) {
    const newMessages = [...messages, { sender: 'Player', text }];
    setMessages(newMessages);

    setIsLoadingDM(true);

    // Пример вызова ИИ-DM
    const dmReply = await aiService.sendDMMessage({
      message: text,
      character,
    });

    setMessages((prev) => [...prev, { sender: 'DM', text: dmReply.text }]);
    setIsLoadingDM(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">

      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <aside className="w-72 border-r border-slate-700 p-4 space-y-4">

        <Card className="p-4 bg-slate-800 border-slate-700">
          <h2 className="text-xl font-bold">{character.name}</h2>
          <p className="text-sm text-slate-400">
            {character.race.name} {character.characterClass.name}
          </p>

          <img
            src={character.portrait}
            className="rounded-lg mt-4 w-full border border-slate-600"
            alt="portrait"
          />
        </Card>

        <Card className="p-4 bg-slate-800 border-slate-700">
          <h3 className="font-semibold mb-2 text-lg">Ability Scores</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
            {Object.entries(character.abilityScores).map(([key, value]) => (
              <div key={key}>
                <span className="font-bold uppercase">{key}: </span>
                {value}
              </div>
            ))}
          </div>
        </Card>
      </aside>

      {/* ОСНОВНАЯ ОБЛАСТЬ */}
      <main className="flex-1 p-6 space-y-6">

        {/* Map */}
        <MapView />

        {/* Dialog */}
        <DialogWindow messages={messages} onSend={handlePlayerMessage} />

        {isLoadingDM && (
          <p className="text-amber-400 animate-pulse text-sm">
            DM is thinking...
          </p>
        )}
      </main>
    </div>
  );
}
