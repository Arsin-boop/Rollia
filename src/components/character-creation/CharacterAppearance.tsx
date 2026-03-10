import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { StarryBackground } from "../StarryBackground";
import { useI18n } from "../../i18n";

export function CharacterAppearance() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
          <h2 className="text-3xl font-bold text-white">{t("characterAppearance.title")}</h2>
          <p className="text-[#B8BCC8]">{t("characterAppearance.step")}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="appearance" className="text-white">{t("characterAppearance.label")}</Label>
            <Textarea
              id="appearance"
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              placeholder={t("characterAppearance.placeholder")}
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
              {t("common.back")}
            </Button>
            <Button
              onClick={handleNext}
              disabled={!appearance.trim()}
              className="flex-1 gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
            >
              {t("common.next")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

