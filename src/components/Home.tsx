import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Sword, ScrollText, Play } from "lucide-react";
import { StarryBackground } from "./StarryBackground";
import { useI18n } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

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

export function Home() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [continueCampaignId, setContinueCampaignId] = useState<string | null>(null);
  
  useEffect(() => {
    const readState = () => {
    const primary = parseStored(localStorage.getItem(CHARACTER_KEY));
    const legacy = parseStored(localStorage.getItem(LEGACY_CHARACTER_KEY));
    const character = primary || legacy;

    if (!character || typeof character !== "object") {
      setContinueCampaignId(null);
      return;
    }

    const campaignId =
      (character as { activeCampaignId?: string | null }).activeCampaignId ||
      localStorage.getItem(ACTIVE_CAMPAIGN_KEY);

    if (!campaignId) {
      setContinueCampaignId(null);
      return;
    }

    const hasSession = Boolean(localStorage.getItem(`session_${campaignId}`));
    setContinueCampaignId(hasSession ? campaignId : null);
    };

    readState();
    window.addEventListener("storage", readState);
    return () => window.removeEventListener("storage", readState);
  }, []);

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] relative overflow-hidden py-8">
      <StarryBackground />
      <LanguageSwitcher />

      <div className="text-center space-y-8 p-8 relative z-10 w-full max-w-6xl">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-white">Rollia</h1>
          <p className="text-xl text-[#B8BCC8]">
            {t("home.tagline")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {continueCampaignId && (
            <Button
              onClick={() => navigate(`/game/${continueCampaignId}`)}
              size="lg"
              className="gap-2 bg-[#C6A75E] hover:bg-[#b1924c] text-[#1C1B22]"
            >
              <Play className="size-5" />
              {t("home.continueSession")}
            </Button>
          )}
          <Button
            onClick={() => navigate("/character/name")}
            size="lg"
            className="gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1] text-white"
          >
            <Sword className="size-5" />
            {t("home.createCharacter")}
          </Button>
          <Button
            onClick={() => navigate("/session/create")}
            size="lg"
            variant="outline"
            className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
          >
            <ScrollText className="size-5" />
            {t("home.newSession")}
          </Button>
        </div>
      </div>
    </div>
  );
}

