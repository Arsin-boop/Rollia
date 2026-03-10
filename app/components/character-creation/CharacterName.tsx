import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ArrowRight } from "lucide-react";
import { StarryBackground } from "../StarryBackground";

export function CharacterName() {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const handleNext = () => {
    if (name.trim()) {
      localStorage.setItem("characterName", name);
      navigate("/character/class");
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] relative overflow-hidden">
      <StarryBackground />
      
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 relative z-10">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">Create Your Character</h2>
          <p className="text-[#B8BCC8]">Step 1 of 5: Choose a name</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">Character Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your character's name"
              className="bg-slate-700 border-[#6C5CE7]/30 text-white"
              onKeyPress={(e) => e.key === "Enter" && handleNext()}
            />
          </div>

          <Button
            onClick={handleNext}
            disabled={!name.trim()}
            className="w-full gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}