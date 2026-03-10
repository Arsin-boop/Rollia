import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Sword, ScrollText } from "lucide-react";
import { StarryBackground } from "./StarryBackground";

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] relative overflow-hidden">
      <StarryBackground />

      <div className="text-center space-y-8 p-8 relative z-10">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-white">D&D AI Game</h1>
          <p className="text-xl text-[#B8BCC8]">
            Create your character and embark on an epic adventure
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => navigate("/character/name")}
            size="lg"
            className="gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1] text-white"
          >
            <Sword className="size-5" />
            Create Character
          </Button>
          <Button
            onClick={() => navigate("/session/create")}
            size="lg"
            variant="outline"
            className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
          >
            <ScrollText className="size-5" />
            New Session
          </Button>
        </div>
      </div>
    </div>
  );
}