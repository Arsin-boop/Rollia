import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { StarryBackground } from "../StarryBackground";

export function CharacterAppearance() {
  const navigate = useNavigate();
  const [appearance, setAppearance] = useState("");

  const handleNext = () => {
    if (appearance.trim()) {
      localStorage.setItem("characterAppearance", appearance);
      navigate("/character/review");
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] p-4 relative overflow-hidden">
      <StarryBackground />
      
      <div className="w-full max-w-2xl p-8 space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 relative z-10">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">Character Appearance</h2>
          <p className="text-[#B8BCC8]">Step 4 of 5: Describe your character's appearance</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appearance" className="text-white">Physical Appearance</Label>
            <Textarea
              id="appearance"
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              placeholder="Describe your character's physical features, clothing, distinctive marks, and overall appearance..."
              className="min-h-[200px] bg-slate-700 border-[#6C5CE7]/30 text-white"
            />
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/character/backstory")}
              className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!appearance.trim()}
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