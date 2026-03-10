import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { StarryBackground } from "../StarryBackground";

export function CharacterReview() {
  const navigate = useNavigate();
  const [character, setCharacter] = useState({
    name: "",
    class: "",
    backstory: "",
    appearance: "",
  });

  useEffect(() => {
    const name = localStorage.getItem("characterName") || "";
    const characterClass = localStorage.getItem("characterClass") || "";
    const backstory = localStorage.getItem("characterBackstory") || "";
    const appearance = localStorage.getItem("characterAppearance") || "";

    if (!name || !characterClass || !backstory || !appearance) {
      navigate("/character/name");
      return;
    }

    setCharacter({
      name,
      class: characterClass,
      backstory,
      appearance,
    });
  }, [navigate]);

  const handleConfirm = () => {
    // Save complete character
    localStorage.setItem("character", JSON.stringify(character));
    navigate("/session/create");
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] p-4 overflow-auto relative">
      <StarryBackground />
      
      <div className="w-full max-w-2xl p-8 space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 my-8 relative z-10">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">Review Your Character</h2>
          <p className="text-[#B8BCC8]">Step 5 of 5: Confirm your character details</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">Name</h3>
            <p className="text-white">{character.name}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">Class</h3>
            <p className="text-white capitalize">{character.class}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">Backstory</h3>
            <p className="text-white">{character.backstory}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">Appearance</h3>
            <p className="text-white">{character.appearance}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/character/appearance")}
            className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
          >
            <Check className="size-4" />
            Confirm Character
          </Button>
        </div>
      </div>
    </div>
  );
}