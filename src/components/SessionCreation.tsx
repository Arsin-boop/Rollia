import { Play, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { StarryBackground } from "./StarryBackground";
import { useI18n } from "../i18n";

const CHARACTER_KEY = "character";
const LEGACY_CHARACTER_KEY = "dnd-ai-character";
const ACTIVE_CAMPAIGN_KEY = "activeCampaignId";

const parseStored = (raw: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function SessionCreation() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [hasCharacter, setHasCharacter] = useState(false);

  useEffect(() => {
    const character = localStorage.getItem(CHARACTER_KEY) || localStorage.getItem(LEGACY_CHARACTER_KEY);
    if (!character) {
      setHasCharacter(false);
    } else {
      setHasCharacter(true);
    }
  }, []);

  const handleStart = () => {
    if (sessionName.trim()) {
      const sessionId = Date.now().toString();
      const primary = parseStored(localStorage.getItem(CHARACTER_KEY));
      const legacy = parseStored(localStorage.getItem(LEGACY_CHARACTER_KEY));
      const base = primary || legacy;
      const session = {
        id: sessionId,
        name: sessionName,
        description: sessionDescription,
        createdAt: new Date().toISOString(),
        characterId: base?.id || undefined,
        characterName: base?.name || undefined,
      };
      localStorage.setItem(`session_${sessionId}`, JSON.stringify(session));
      localStorage.setItem(ACTIVE_CAMPAIGN_KEY, sessionId);

      if (base && typeof base === "object") {
        const updatedCharacter = {
          ...base,
          activeCampaignId: sessionId,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(CHARACTER_KEY, JSON.stringify(updatedCharacter));
        localStorage.setItem(LEGACY_CHARACTER_KEY, JSON.stringify(updatedCharacter));
      }

      navigate(`/game/${sessionId}`);
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] p-4 relative overflow-hidden isolate">
      <StarryBackground />
      
      <div className="w-full max-w-2xl p-8 space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 relative z-20 pointer-events-auto">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">{t("sessionCreation.title")}</h2>
          <p className="text-[#B8BCC8]">{t("sessionCreation.subtitle")}</p>
        </div>

        {!hasCharacter && (
          <div className="p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
            <p className="text-yellow-200">
              {t("sessionCreation.noCharacter")}{" "}
              <button
                onClick={() => navigate("/character/name")}
                className="underline hover:text-yellow-100"
              >
                {t("sessionCreation.createFirst")}
              </button>
              .
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sessionName" className="text-white">{t("sessionCreation.sessionName")}</Label>
            <input
              id="sessionName"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              autoFocus
              placeholder={t("sessionCreation.sessionNamePlaceholder")}
              className="w-full rounded-md border border-[#6C5CE7]/30 bg-slate-700 text-white px-3 py-2 pointer-events-auto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sessionDescription" className="text-white">
              {t("sessionCreation.sessionDescription")}
            </Label>
            <textarea
              id="sessionDescription"
              value={sessionDescription}
              onChange={(e) => setSessionDescription(e.target.value)}
              placeholder={t("sessionCreation.sessionDescriptionPlaceholder")}
              className="min-h-[100px] w-full rounded-md border border-[#6C5CE7]/30 bg-slate-700 text-white px-3 py-2 pointer-events-auto"
            />
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
            >
              <ArrowLeft className="size-4" />
              {t("common.back")}
            </Button>
            <Button
              onClick={handleStart}
              disabled={!sessionName.trim()}
              className="flex-1 gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
            >
              <Play className="size-4" />
              {t("sessionCreation.start")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

