import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { StarryBackground } from "../StarryBackground";

export function CharacterBackstory() {
  const navigate = useNavigate();
  const [backstory, setBackstory] = useState("");

  const handleNext = () => {
    if (backstory.trim()) {
      localStorage.setItem("characterBackstory", backstory);
      navigate("/character/appearance");
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] p-4 relative overflow-hidden">
      <StarryBackground />
      
      <div className="w-full max-w-2xl p-8 space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 relative z-10">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">Your Backstory</h2>
          <p className="text-[#B8BCC8]">Step 3 of 5: Tell us about your character's past</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backstory" className="text-white">Character Backstory</Label>
            <Textarea
              id="backstory"
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="Where did your character come from? What drives them? What are their goals and fears?"
              className="min-h-[200px] bg-slate-700 border-[#6C5CE7]/30 text-white"
            />
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/character/class")}
              className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!backstory.trim()}
              className="flex-1 gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}