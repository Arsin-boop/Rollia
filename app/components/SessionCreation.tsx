import { ArrowRight, Play, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { StarryBackground } from "./StarryBackground";

export function SessionCreation() {
  const navigate = useNavigate();
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [hasCharacter, setHasCharacter] = useState(false);

  useEffect(() => {
    const character = localStorage.getItem("character");
    if (!character) {
      setHasCharacter(false);
    } else {
      setHasCharacter(true);
    }
  }, []);

  const handleStart = () => {
    if (sessionName.trim()) {
      const sessionId = Date.now().toString();
      const session = {
        id: sessionId,
        name: sessionName,
        description: sessionDescription,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(`session_${sessionId}`, JSON.stringify(session));
      navigate(`/game/${sessionId}`);
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] p-4 relative overflow-hidden">
      <StarryBackground />
      
      <div className="w-full max-w-2xl p-8 space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 relative z-10">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">Create New Session</h2>
          <p className="text-[#B8BCC8]">Begin your adventure</p>
        </div>

        {!hasCharacter && (
          <div className="p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
            <p className="text-yellow-200">
              No character found. You can still start a session, or{" "}
              <button
                onClick={() => navigate("/character/name")}
                className="underline hover:text-yellow-100"
              >
                create a character first
              </button>
              .
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sessionName" className="text-white">Session Name</Label>
            <Input
              id="sessionName"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="The Quest for the Lost Artifact"
              className="bg-slate-700 border-[#6C5CE7]/30 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionDescription" className="text-white">
              Session Description (Optional)
            </Label>
            <Textarea
              id="sessionDescription"
              value={sessionDescription}
              onChange={(e) => setSessionDescription(e.target.value)}
              placeholder="A brief description of your adventure..."
              className="min-h-[100px] bg-slate-700 border-[#6C5CE7]/30 text-white"
            />
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              onClick={handleStart}
              disabled={!sessionName.trim()}
              className="flex-1 gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
            >
              <Play className="size-4" />
              Start Adventure
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}