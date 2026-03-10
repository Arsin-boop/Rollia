import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ArrowRight, ArrowLeft, Sword, Wand2, Shield, BookOpen, Heart, Zap, Sparkles } from "lucide-react";
import { StarryBackground } from "../StarryBackground";

const classes = [
  { id: "warrior", name: "Warrior", icon: Sword, description: "Masters of combat and physical prowess" },
  { id: "mage", name: "Mage", icon: Wand2, description: "Wielders of arcane magic and elemental forces" },
  { id: "paladin", name: "Paladin", icon: Shield, description: "Holy warriors bound by sacred oaths" },
  { id: "rogue", name: "Rogue", icon: Zap, description: "Cunning and stealthy masters of deception" },
  { id: "cleric", name: "Cleric", icon: Heart, description: "Divine healers and protectors" },
  { id: "warlock", name: "Warlock", icon: BookOpen, description: "Pact-makers with otherworldly beings" },
];

export function CharacterClass() {
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [customClass, setCustomClass] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateCustomClass = () => {
    if (!customClass.trim()) return;
    
    setIsGenerating(true);
    // Mock AI response
    setTimeout(() => {
      const response = `The ${customClass} is a unique class that combines elements of strategy and versatility. They excel at adapting to any situation with their specialized skills and abilities. Their primary focus is on using their unique talents to overcome challenges in creative ways.`;
      setAiResponse(response);
      setSelectedClass(`custom_${customClass.toLowerCase()}`);
      setIsGenerating(false);
    }, 1500);
  };

  const handleNext = () => {
    if (selectedClass) {
      // If it's a custom class, save the custom class name
      if (selectedClass.startsWith("custom_")) {
        localStorage.setItem("characterClass", customClass);
      } else {
        localStorage.setItem("characterClass", selectedClass);
      }
      navigate("/character/backstory");
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] p-4 relative overflow-hidden">
      <StarryBackground />
      
      <div className="w-full max-w-4xl space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 bg-[#34405080] p-[32px] relative z-10">
        <div className="space-y-2">
          <h2 className="font-bold text-white text-[24px] mx-[0px] mt-[0px] mb-[8px]">Choose Your Class</h2>
          <p className="text-[#B8BCC8]">Step 2 of 5: Select your character class</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const Icon = cls.icon;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={`p-6 rounded-lg border-2 transition-all ${
                  selectedClass === cls.id
                    ? "border-[#6C5CE7] bg-[#6C5CE7]/20"
                    : "border-[#6C5CE7]/30 bg-slate-700/30 hover:border-[#6C5CE7]/60"
                }`}
              >
                <Icon className="size-12 text-[#C6A75E] mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{cls.name}</h3>
                <p className="text-[#B8BCC8] text-sm">{cls.description}</p>
              </button>
            );
          })}
        </div>

        {/* Custom Class Section */}
        <div className="space-y-4 p-6 bg-slate-700/30 rounded-lg border border-[#6C5CE7]/30">
          <div className="space-y-2">
            <Label htmlFor="customClass" className="text-white font-semibold flex items-center gap-2 text-[24px]">
              <Sparkles className="size-5 text-[#C6A75E]" />
              Custom Class
            </Label>
            <p className="text-[#B8BCC8] text-[16px]">Describe your own unique class and let AI create it for you</p>
          </div>

          <div className="flex gap-2">
            <Input
              id="customClass"
              value={customClass}
              onChange={(e) => setCustomClass(e.target.value)}
              placeholder="e.g., Shadow Dancer, Battle Mage, Beast Tamer..."
              className="bg-slate-700 border-[#6C5CE7]/30 text-white"
              onKeyPress={(e) => e.key === "Enter" && handleGenerateCustomClass()}
            />
            <Button
              onClick={handleGenerateCustomClass}
              disabled={!customClass.trim() || isGenerating}
              className="gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
            >
              <Sparkles className="size-4" />
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>

          {aiResponse && (
            <div className="p-4 bg-[#6C5CE7]/20 border border-[#6C5CE7]/30 rounded-lg">
              <h4 className="text-[#C6A75E] font-semibold mb-2 capitalize">{customClass}</h4>
              <p className="text-[#B8BCC8] text-sm">{aiResponse}</p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/character/name")}
            className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedClass}
            className="flex-1 gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}