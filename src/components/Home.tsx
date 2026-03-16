import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { GrimoirePage } from "./grimoire/GrimoirePage";
import { GrimoireHeader } from "./grimoire/GrimoireHeader";

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
    <GrimoirePage showRunes emberCount={140}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <GrimoireHeader showNav />

        {/* Main centered content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          gap: 0,
        }}>

          {/* Decorative top rune line */}
          <div className="g-ornament" style={{ width: '100%', maxWidth: 480, marginBottom: 32, opacity: 0.4 }}>
            <div className="g-ornament-line" />
            <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, color: 'var(--g-gold-dim)', letterSpacing: '0.3em' }}>✦</span>
            <div className="g-ornament-line" />
          </div>

          {/* Title */}
          <h1
            className="g-title-display g-anim-fade-up"
            style={{ fontSize: 'clamp(48px, 10vw, 88px)', marginBottom: 16, textAlign: 'center' }}
          >
            Rollia
          </h1>

          {/* Tagline */}
          <p
            className="g-body-italic g-anim-fade-up"
            style={{
              fontSize: 18,
              textAlign: 'center',
              maxWidth: 400,
              marginBottom: 40,
              animationDelay: '0.1s',
              opacity: 0,
            }}
          >
            {t("home.tagline")}
          </p>

          {/* Ornament divider */}
          <div
            className="g-ornament g-anim-fade-in"
            style={{ width: '100%', maxWidth: 360, marginBottom: 36, animationDelay: '0.2s', opacity: 0 }}
          >
            <div className="g-ornament-line" />
            <div className="g-ornament-diamond" />
            <span className="g-ornament-text">Begin your tale</span>
            <div className="g-ornament-diamond" />
            <div className="g-ornament-line" />
          </div>

          {/* Action buttons */}
          <div
            className="g-anim-fade-up"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              animationDelay: '0.3s',
              opacity: 0,
            }}
          >
            {continueCampaignId && (
              <button
                className="g-btn-primary"
                style={{ minWidth: 240 }}
                onClick={() => navigate(`/game/${continueCampaignId}`)}
              >
                ⚔ {t("home.continueSession")}
              </button>
            )}
            <button
              className="g-btn-primary"
              style={{ minWidth: 240 }}
              onClick={() => navigate("/character/name")}
            >
              ✦ {t("home.createCharacter")}
            </button>
            <button
              className="g-btn-secondary"
              style={{ minWidth: 240 }}
              onClick={() => navigate("/session/create")}
            >
              ◈ {t("home.newSession")}
            </button>
          </div>

          {/* Decorative bottom rune line */}
          <div className="g-ornament" style={{ width: '100%', maxWidth: 480, marginTop: 48, opacity: 0.4 }}>
            <div className="g-ornament-line" />
            <span style={{ fontFamily: 'var(--g-font-title)', fontSize: 11, color: 'var(--g-gold-dim)', letterSpacing: '0.3em' }}>✦</span>
            <div className="g-ornament-line" />
          </div>
        </div>
      </div>
    </GrimoirePage>
  );
}
