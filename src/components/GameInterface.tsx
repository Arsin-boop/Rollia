import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Progress } from "./ui/progress";
import {
  Send,
  Scroll,
  Swords,
  BookOpen,
  Package,
  Users,
  Sparkles,
  Trophy,
  Gift,
  Shield,
  Dices,
} from "lucide-react";

interface Message {
  id: string;
  role: "dm" | "player";
  content: string;
  timestamp: Date;
}

interface Character {
  name: string;
  class: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  xp: number;
  level: number;
  statusEffects: string[];
}

interface Quest {
  id: string;
  name: string;
  description: string;
  status: "active" | "completed";
}

interface NPC {
  id: string;
  name: string;
  relationship: number;
}

export function GameInterface() {
  const { sessionId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("stats");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Character data
  const [character, setCharacter] = useState<Character>({
    name: "Adventurer",
    class: "Warrior",
    hp: 85,
    maxHp: 100,
    mp: 40,
    maxMp: 50,
    xp: 750,
    level: 5,
    statusEffects: ["Blessed", "Well-Fed"],
  });

  // Mock data
  const [quests] = useState<Quest[]>([
    { id: "1", name: "Find the Lost Artifact", description: "Search the ancient ruins for the legendary Crystal of Light", status: "active" },
    { id: "2", name: "Defeat the Bandit Leader", description: "Clear the trade route by defeating the bandit camp", status: "active" },
  ]);

  const [rumors] = useState([
    "A dragon has been spotted near the northern mountains",
    "The tavern keeper mentioned strange lights in the forest",
    "Merchants speak of increased goblin activity near the mines",
  ]);

  const [inventory] = useState([
    { id: "1", name: "Longsword", quantity: 1 },
    { id: "2", name: "Health Potion", quantity: 5 },
    { id: "3", name: "Gold Coins", quantity: 250 },
    { id: "4", name: "Torch", quantity: 3 },
  ]);

  const [npcs] = useState<NPC[]>([
    { id: "1", name: "Elara the Merchant", relationship: 75 },
    { id: "2", name: "Guard Captain Marcus", relationship: 60 },
    { id: "3", name: "Mysterious Stranger", relationship: 30 },
  ]);

  const [spells] = useState([
    { id: "1", name: "Fireball", cost: 15, description: "Launch a ball of fire at enemies" },
    { id: "2", name: "Heal", cost: 10, description: "Restore health to yourself or an ally" },
    { id: "3", name: "Shield", cost: 8, description: "Create a magical barrier" },
  ]);

  const [skills] = useState([
    { id: "1", name: "Swordsmanship", level: 8 },
    { id: "2", name: "Persuasion", level: 5 },
    { id: "3", name: "Lockpicking", level: 3 },
    { id: "4", name: "Survival", level: 6 },
  ]);

  const [artifacts] = useState([
    { id: "1", name: "Ring of Protection", description: "+2 to all defenses" },
    { id: "2", name: "Blessing of the Ancients", description: "Increased XP gain by 10%" },
  ]);

  useEffect(() => {
    // Load character from localStorage
    const savedCharacter = localStorage.getItem("character");
    if (savedCharacter) {
      const char = JSON.parse(savedCharacter);
      setCharacter({
        name: char.name,
        class: char.class,
        hp: 85,
        maxHp: 100,
        mp: 40,
        maxMp: 50,
        xp: 750,
        level: 5,
        statusEffects: ["Blessed", "Well-Fed"],
      });
    }

    // Initial DM message
    setMessages([
      {
        id: "1",
        role: "dm",
        content: `Welcome, ${character.name}! You find yourself at the entrance of a dimly lit tavern. The smell of ale and roasted meat fills the air. What would you like to do?`,
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const playerMessage: Message = {
      id: Date.now().toString(),
      role: "player",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, playerMessage]);
    setInput("");

    // Mock AI response
    setTimeout(() => {
      const dmMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "dm",
        content: generateMockResponse(input),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, dmMessage]);
    }, 1000);
  };

  const generateMockResponse = (playerInput: string): string => {
    const responses = [
      "As you take action, the room grows quiet. The patrons turn to look at you with curious expressions.",
      "You notice a hooded figure in the corner watching your every move. They slowly stand up and approach you.",
      "Your action catches the attention of the innkeeper, who nods approvingly and gestures for you to come closer.",
      "The atmosphere shifts as mysterious symbols begin to glow faintly on the walls around you.",
      "A roll of thunder echoes outside. Through the window, you see dark clouds gathering ominously.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  return (
    <div className="h-screen flex bg-[#1C1B22] relative overflow-hidden">
      {/* Subtle radial glow in center */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(108,92,231,0.08),transparent_70%)] pointer-events-none" />
      
      {/* Left Sidebar - Stats Panel */}
      <div className="w-80 bg-[#23222A] border-r border-[#6C5CE7]/20 flex flex-col relative z-10 shadow-[inset_-2px_0_8px_rgba(0,0,0,0.3)]">
        <div className="p-6 border-b border-[#C6A75E]/20">
          <h2 className="text-xl font-semibold text-[#E0E3EA] tracking-wide">Adventure Panel</h2>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3 gap-2 bg-transparent p-4">
            <TabsTrigger 
              value="stats" 
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1C1B22]/50 text-[#B8BCC8] text-xs py-2.5 data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white data-[state=active]:shadow-inner hover:bg-[#1C1B22]/70 transition-all duration-200"
            >
              <Shield className="size-3.5" />
              <span>Stats</span>
            </TabsTrigger>
            <TabsTrigger 
              value="quests" 
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1C1B22]/50 text-[#B8BCC8] text-xs py-2.5 data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white data-[state=active]:shadow-inner hover:bg-[#1C1B22]/70 transition-all duration-200"
            >
              <Scroll className="size-3.5" />
              <span>Quests</span>
            </TabsTrigger>
            <TabsTrigger 
              value="more" 
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1C1B22]/50 text-[#B8BCC8] text-xs py-2.5 data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white data-[state=active]:shadow-inner hover:bg-[#1C1B22]/70 transition-all duration-200"
            >
              <Package className="size-3.5" />
              <span>More</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-4 pb-4">
            <TabsContent value="stats" className="mt-0 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-[#C6A75E] px-[8px] py-[0px] mx-[0px] mt-[29px] mb-[16px]">Primary Stats</h3>
                <div className="space-y-1">
                  {[
                    { name: "Strength", value: 16, max: 20 },
                    { name: "Dexterity", value: 14, max: 20 },
                    { name: "Constitution", value: 15, max: 20 },
                    { name: "Intelligence", value: 12, max: 20 },
                    { name: "Wisdom", value: 13, max: 20 },
                    { name: "Charisma", value: 11, max: 20 },
                  ].map((stat) => (
                    <div 
                      key={stat.name}
                      className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-[#1C1B22]/50 transition-all duration-150 cursor-pointer border-b border-[#6C5CE7]/5 last:border-0"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-[#B8BCC8] text-sm">{stat.name}</span>
                        <div className="flex-1 h-1 bg-[#1C1B22]/60 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#B8BCC8]/40 to-[#B8BCC8]/20 rounded-full transition-all"
                            style={{ width: `${(stat.value / stat.max) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[#E0E3EA] font-semibold text-sm tabular-nums ml-3">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="quests" className="mt-0 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-[#C6A75E] mb-4 px-2 flex items-center gap-2">
                  <Scroll className="size-4" />
                  Active Quests
                </h3>
                <div className="space-y-3">
                  {quests.map((quest) => (
                    <div 
                      key={quest.id} 
                      className="group relative p-4 bg-[#1C1B22]/40 rounded-xl border border-[#6C5CE7]/10 hover:border-[#6C5CE7]/30 hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <div className="absolute left-0 top-4 w-1 h-8 bg-[#C6A75E] rounded-r opacity-60" />
                      <h4 className="text-[#E0E3EA] font-semibold text-sm mb-1.5 pl-3">{quest.name}</h4>
                      <p className="text-[#B8BCC8] text-xs leading-relaxed pl-3">{quest.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#C6A75E] mb-4 px-2">Rumors</h3>
                <div className="space-y-2.5 bg-[#1C1B22]/30 rounded-xl p-3">
                  {rumors.map((rumor, idx) => (
                    <div key={idx} className="flex gap-2.5 items-start group">
                      <div className="mt-1.5 size-1.5 rounded-full bg-[#C6A75E]/60 flex-shrink-0" />
                      <p className="text-[#B8BCC8] text-xs leading-relaxed group-hover:text-[#E0E3EA] transition-colors duration-150">
                        {rumor}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="more" className="mt-0">
              <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="grid grid-cols-2 w-full bg-transparent gap-2 mb-4 mt-[30px]">
                  <TabsTrigger 
                    value="inventory" 
                    className="rounded-xl bg-[#1C1B22]/50 text-xs py-2 data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white hover:bg-[#1C1B22]/70 transition-all duration-200"
                  >
                    <Package className="size-3 mr-1.5" />
                    Inventory
                  </TabsTrigger>
                  <TabsTrigger 
                    value="npcs" 
                    className="rounded-xl bg-[#1C1B22]/50 text-xs py-2 data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white hover:bg-[#1C1B22]/70 transition-all duration-200"
                  >
                    <Users className="size-3 mr-1.5" />
                    NPCs
                  </TabsTrigger>
                </TabsList>
                <TabsList className="grid grid-cols-2 w-full bg-transparent gap-2 mb-4">
                  <TabsTrigger 
                    value="spells" 
                    className="rounded-xl bg-[#1C1B22]/50 text-xs py-2 data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white hover:bg-[#1C1B22]/70 transition-all duration-200"
                  >
                    <Sparkles className="size-3 mr-1.5" />
                    Spells
                  </TabsTrigger>
                  <TabsTrigger 
                    value="skills" 
                    className="rounded-xl bg-[#1C1B22]/50 text-xs py-2 data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white hover:bg-[#1C1B22]/70 transition-all duration-200"
                  >
                    <Swords className="size-3 mr-1.5" />
                    Skills
                  </TabsTrigger>
                </TabsList>
                <TabsList className="w-full bg-transparent mb-4">
                  <TabsTrigger 
                    value="artifacts" 
                    className="w-full rounded-xl bg-[#1C1B22]/50 text-xs py-2 data-[state=active]:bg-[#6C5CE7] data-[state=active]:text-white hover:bg-[#1C1B22]/70 transition-all duration-200"
                  >
                    <Gift className="size-3 mr-1.5" />
                    Artifacts & Boons
                  </TabsTrigger>
                </TabsList>

                <div className="space-y-3">
                  <TabsContent value="inventory" className="mt-0 space-y-2">
                    {inventory.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex justify-between items-center p-2.5 bg-[#1C1B22]/40 rounded-lg text-sm hover:bg-[#1C1B22]/60 transition-all duration-150 cursor-pointer border border-[#6C5CE7]/5"
                      >
                        <span className="text-[#E0E3EA]">{item.name}</span>
                        <span className="text-[#B8BCC8] tabular-nums">×{item.quantity}</span>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="npcs" className="mt-0 space-y-3">
                    {npcs.map((npc) => (
                      <div key={npc.id} className="p-2.5 bg-[#1C1B22]/40 rounded-lg border border-[#6C5CE7]/5">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[#E0E3EA] text-sm">{npc.name}</span>
                          <span className="text-xs text-[#B8BCC8] tabular-nums">{npc.relationship}%</span>
                        </div>
                        <Progress value={npc.relationship} className="h-1.5" />
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="spells" className="mt-0 space-y-2.5">
                    {spells.map((spell) => (
                      <div 
                        key={spell.id} 
                        className="p-2.5 bg-[#1C1B22]/40 rounded-lg hover:bg-[#1C1B22]/60 transition-all duration-150 cursor-pointer border border-[#6C5CE7]/5"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[#E0E3EA] text-sm">{spell.name}</span>
                          <span className="text-xs text-[#6C5CE7] font-medium">{spell.cost} MP</span>
                        </div>
                        <p className="text-xs text-[#B8BCC8] leading-relaxed">{spell.description}</p>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="skills" className="mt-0 space-y-2">
                    {skills.map((skill) => (
                      <div 
                        key={skill.id} 
                        className="flex justify-between items-center p-2.5 bg-[#1C1B22]/40 rounded-lg text-sm hover:bg-[#1C1B22]/60 transition-all duration-150 cursor-pointer border border-[#6C5CE7]/5"
                      >
                        <span className="text-[#E0E3EA]">{skill.name}</span>
                        <span className="text-[#C6A75E] font-medium tabular-nums">Lvl {skill.level}</span>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="artifacts" className="mt-0 space-y-2.5">
                    {artifacts.map((artifact) => (
                      <div 
                        key={artifact.id} 
                        className="p-2.5 bg-[#1C1B22]/40 rounded-lg hover:bg-[#1C1B22]/60 transition-all duration-150 cursor-pointer border border-[#6C5CE7]/5"
                      >
                        <h4 className="text-[#E0E3EA] text-sm font-semibold mb-1">{artifact.name}</h4>
                        <p className="text-xs text-[#B8BCC8] leading-relaxed">{artifact.description}</p>
                      </div>
                    ))}
                  </TabsContent>
                </div>
              </Tabs>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative z-10">
        <ScrollArea className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-6 py-8">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "player" ? "justify-end" : "justify-center"}`}
              >
                <div
                  className={`${
                    message.role === "dm"
                      ? "max-w-[85%] p-6 rounded-2xl bg-gradient-to-br from-[#2D2640] to-[#1F1B2E] border border-[#C6A75E]/30 shadow-[0_8px_32px_rgba(108,92,231,0.2),0_0_1px_rgba(198,167,94,0.5)]"
                      : "max-w-[70%] p-4 rounded-xl bg-[#23222A]/80 border border-[#6C5CE7]/20"
                  }`}
                >
                  {message.role === "player" && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-[#6C5CE7]">
                        {character.name}
                      </span>
                    </div>
                  )}
                  <p className={`${message.role === "dm" ? "text-[#D5D9E5]" : "text-[#B8BCC8]"} leading-relaxed`}>
                    {message.content}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Bottom Input Field */}
        <div className="p-6 bg-gradient-to-t from-[#1C1B22] to-transparent relative z-10">
          <div className="max-w-3xl mx-auto flex gap-3">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="What do you do?"
                className="bg-[#23222A] border-[#6C5CE7]/30 text-white placeholder:text-[#B8BCC8]/50 h-12 rounded-xl pr-12 focus:border-[#6C5CE7] focus:ring-2 focus:ring-[#6C5CE7]/20 transition-all shadow-lg"
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-[#C6A75E] hover:text-[#C6A75E] hover:bg-[#6C5CE7]/10"
              >
                <Dices className="size-5" />
              </Button>
            </div>
            <Button
              onClick={handleSend}
              className="gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1] h-12 px-6 rounded-xl shadow-lg shadow-[#6C5CE7]/20"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Character Profile */}
      <div className="w-80 bg-[#23222A] border-l border-[#6C5CE7]/20 p-6 relative z-10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] overflow-y-auto">
        <div className="space-y-6">
          {/* Character Card */}
          <div className="bg-gradient-to-br from-[#6C5CE7]/20 to-[#2D2640] rounded-xl p-4 border border-[#6C5CE7]/30 shadow-lg">
            {/* Character Portrait */}
            <div className="w-full aspect-square bg-gradient-to-br from-[#6C5CE7] to-[#4A3FA8] rounded-lg mb-4 flex items-center justify-center shadow-lg">
              <div className="text-6xl">⚔️</div>
            </div>

            {/* Character Info */}
            <div className="space-y-2 text-center mb-4">
              <h3 className="text-xl font-bold text-white">{character.name}</h3>
              <div className="h-px bg-[#C6A75E]/30 w-16 mx-auto" />
              <p className="text-sm text-[#6C5CE7] capitalize font-medium">{character.class}</p>
              <div className="inline-block px-3 py-1 bg-[#C6A75E]/20 border border-[#C6A75E]/40 rounded-full">
                <span className="text-xs text-[#C6A75E] font-semibold">Level {character.level}</span>
              </div>
            </div>

            {/* HP Bar */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-xs">
                <span className="text-red-400 font-medium">HP</span>
                <span className="text-[#B8BCC8]">{character.hp} / {character.maxHp}</span>
              </div>
              <div className="h-2 bg-[#1C1B22]/50 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all"
                  style={{ width: `${(character.hp / character.maxHp) * 100}%` }}
                />
              </div>
            </div>

            {/* MP Bar */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-xs">
                <span className="text-blue-400 font-medium">MP</span>
                <span className="text-[#B8BCC8]">{character.mp} / {character.maxMp}</span>
              </div>
              <div className="h-2 bg-[#1C1B22]/50 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-[#6C5CE7] to-blue-500 rounded-full transition-all"
                  style={{ width: `${(character.mp / character.maxMp) * 100}%` }}
                />
              </div>
            </div>

            {/* XP Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#C6A75E] font-medium">XP</span>
                <span className="text-[#B8BCC8]">{character.xp} / 1000</span>
              </div>
              <div className="h-2 bg-[#1C1B22]/50 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-[#C6A75E] to-yellow-500 rounded-full transition-all"
                  style={{ width: `${(character.xp / 1000) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Status Effects */}
          <div>
            <h4 className="text-sm font-semibold text-[#C6A75E] mb-3">Status Effects</h4>
            <div className="flex flex-wrap gap-2">
              {character.statusEffects.map((effect, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 bg-green-900/20 border border-green-500/40 rounded-full text-xs text-green-300 hover:bg-green-900/30 hover:shadow-[0_0_12px_rgba(34,197,94,0.3)] transition-all cursor-pointer"
                >
                  {effect}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

