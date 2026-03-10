import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { StarryBackground } from "../StarryBackground";
import { API_ORIGIN, getCharacter, saveCharacterAppearance } from "../../utils/api";
import { useI18n } from "../../i18n";
import type { CustomClassResponse } from "../../utils/api";

const CHARACTER_COLLECTION_KEY = "rollia_characters_v1";
const CUSTOM_CLASS_DATA_KEY = "characterCustomClassData";

const upsertCharacterCollection = (payload: Record<string, unknown>) => {
  try {
    const raw = localStorage.getItem(CHARACTER_COLLECTION_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const id = String(payload.id || "");
    if (!id) return;
    const next = [...list];
    const index = next.findIndex((entry: any) => entry && entry.id === id);
    if (index >= 0) {
      next[index] = { ...next[index], ...payload };
    } else {
      next.unshift(payload);
    }
    localStorage.setItem(CHARACTER_COLLECTION_KEY, JSON.stringify(next));
  } catch (error) {
    console.error("Failed to update characters collection:", error);
  }
};

export function CharacterReview() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [character, setCharacter] = useState({
    id: "",
    name: "",
    class: "",
    backstory: "",
    appearance: "",
    avatarUrl: "",
  });
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "pending" | "ready" | "failed">("idle");
  const [avatarError, setAvatarError] = useState("");

  const resolveAvatarUrl = (url?: string | null) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_ORIGIN}${url}`;
  };

  useEffect(() => {
    let cancelled = false;

    const loadAndGenerateAvatar = async () => {
      const name = localStorage.getItem("characterName") || "";
      const characterClass = localStorage.getItem("characterClass") || "";
      const backstory = localStorage.getItem("characterBackstory") || "";
      const appearance = localStorage.getItem("characterAppearance") || "";
      const existingCharacterId = localStorage.getItem("characterId") || "";

      if (!name || !characterClass || !backstory || !appearance) {
        navigate("/character/name");
        return;
      }

      setCharacter({
        id: existingCharacterId,
        name,
        class: characterClass,
        backstory,
        appearance,
        avatarUrl: "",
      });

      try {
        setAvatarStatus("pending");
        setAvatarError("");

        const record = await saveCharacterAppearance({
          characterId: existingCharacterId || null,
          appearance,
          name,
          class: characterClass,
          backstory,
        });

        if (cancelled) return;

        localStorage.setItem("characterId", record.id);
        const initialUrl = resolveAvatarUrl(record.avatarUrl);

        setCharacter(prev => ({
          ...prev,
          id: record.id,
          avatarUrl: initialUrl,
        }));

        if (record.avatarStatus === "ready" && initialUrl) {
          setAvatarStatus("ready");
          return;
        }

        if (record.avatarStatus === "failed") {
          setAvatarStatus("failed");
          setAvatarError(record.avatarError || t("characterReview.avatarFailed"));
          return;
        }

        // Poll backend while async generation completes
        for (let i = 0; i < 20; i++) {
          if (cancelled) return;
          await new Promise(resolve => setTimeout(resolve, 1500));
          const polled = await getCharacter(record.id);
          if (cancelled) return;

          const polledUrl = resolveAvatarUrl(polled.avatarUrl);
          if (polledUrl) {
            setCharacter(prev => ({ ...prev, avatarUrl: polledUrl }));
          }

          if (polled.avatarStatus === "ready" && polledUrl) {
            setAvatarStatus("ready");
            return;
          }

          if (polled.avatarStatus === "failed") {
            setAvatarStatus("failed");
            setAvatarError(polled.avatarError || t("characterReview.avatarFailed"));
            return;
          }
        }

        setAvatarStatus("failed");
        setAvatarError(t("characterReview.avatarTimedOut"));
      } catch (error: any) {
        if (cancelled) return;
        setAvatarStatus("failed");
        setAvatarError(error?.message || t("characterReview.avatarFailed"));
      }
    };

    void loadAndGenerateAvatar();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleConfirm = () => {
    const rawStats = localStorage.getItem("characterStats");
    let mappedStats = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };

    if (rawStats) {
      try {
        const parsed = JSON.parse(rawStats) as Array<{ key: string; score: number }>;
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const key = (entry.key || "").toUpperCase();
            const score = Number(entry.score) || 10;
            if (key === "STR") mappedStats.strength = score;
            if (key === "DEX") mappedStats.dexterity = score;
            if (key === "CON") mappedStats.constitution = score;
            if (key === "INT") mappedStats.intelligence = score;
            if (key === "WIS") mappedStats.wisdom = score;
            if (key === "CHA") mappedStats.charisma = score;
          }
        }
      } catch {
        // Fallback to defaults if stats payload is malformed.
      }
    }

    let savedClassData: CustomClassResponse | null = null;
    const rawCustomClassData = localStorage.getItem(CUSTOM_CLASS_DATA_KEY);
    if (rawCustomClassData) {
      try {
        savedClassData = JSON.parse(rawCustomClassData) as CustomClassResponse;
      } catch {
        savedClassData = null;
      }
    }

    const resolvedClassData: CustomClassResponse = savedClassData || {
      className: character.class,
      stats: mappedStats,
      hitDie: "d8",
      proficiencies: [],
      features: [],
      description: `${character.class} profile`,
    };

    const equipment: string[] = [];
    const inventoryItems: Array<{
      id: string;
      name: string;
      description: string;
      tags: string[];
      damage?: string;
      armorClass?: number;
      slot?: "weapon" | "armor";
      equipped?: boolean;
    }> = [];

    const toSlug = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");

    if (resolvedClassData.startingWeapon?.name) {
      equipment.push(resolvedClassData.startingWeapon.name);
      inventoryItems.push({
        id: `weapon-${toSlug(resolvedClassData.startingWeapon.name) || "starter-weapon"}`,
        name: resolvedClassData.startingWeapon.name,
        description:
          resolvedClassData.startingWeapon.description || "A starting weapon tailored to your class.",
        tags:
          Array.isArray(resolvedClassData.startingWeapon.tags) && resolvedClassData.startingWeapon.tags.length
            ? resolvedClassData.startingWeapon.tags
            : ["equipment", "weapon"],
        damage: resolvedClassData.startingWeapon.damage || "1d6",
        slot: "weapon",
        equipped: true,
      });
    }

    if (resolvedClassData.startingArmor?.name) {
      equipment.push(resolvedClassData.startingArmor.name);
      inventoryItems.push({
        id: `armor-${toSlug(resolvedClassData.startingArmor.name) || "starter-armor"}`,
        name: resolvedClassData.startingArmor.name,
        description:
          resolvedClassData.startingArmor.description || "A starting armor set tailored to your class.",
        tags:
          Array.isArray(resolvedClassData.startingArmor.tags) && resolvedClassData.startingArmor.tags.length
            ? resolvedClassData.startingArmor.tags
            : ["equipment", "armor"],
        armorClass: Number.isFinite(resolvedClassData.startingArmor.armorClass)
          ? resolvedClassData.startingArmor.armorClass
          : 12,
        slot: "armor",
        equipped: true,
      });
    }

    const payload = {
      id: character.id,
      name: character.name,
      class: character.class,
      backstory: character.backstory,
      appearance: character.appearance,
      avatarUrl: character.avatarUrl || null,
      avatarStatus,
      classDescription: character.class,
      customClassData: resolvedClassData,
      xp: 0,
      level: 1,
      equipment,
      inventoryItems,
      artifacts: [],
      activeCampaignId: null,
      updatedAt: new Date().toISOString(),
    };

    // New template flow key (used by session creation guard).
    localStorage.setItem("character", JSON.stringify(payload));
    // Legacy/gameplay key consumed by GameSession.
    localStorage.setItem("dnd-ai-character", JSON.stringify(payload));
    upsertCharacterCollection(payload as unknown as Record<string, unknown>);
    navigate("/session/create");
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] p-4 overflow-auto relative">
      <StarryBackground />
      
      <div className="w-full max-w-2xl p-8 space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 my-8 relative z-10">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-white">{t("characterReview.title")}</h2>
          <p className="text-[#B8BCC8]">{t("characterReview.step")}</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">{t("characterReview.portrait")}</h3>
            <div className="w-full rounded-lg border border-[#6C5CE7]/30 bg-slate-900/50 p-4">
              {character.avatarUrl ? (
                <img
                  src={character.avatarUrl}
                  alt={`${character.name || "Character"} portrait`}
                  className="mx-auto h-64 w-64 rounded-lg object-cover border border-[#6C5CE7]/40"
                />
              ) : (
                <div className="mx-auto h-64 w-64 rounded-lg border border-dashed border-[#6C5CE7]/40 bg-slate-800/60 flex items-center justify-center text-[#B8BCC8] text-sm text-center px-4">
                  {avatarStatus === "pending"
                    ? t("characterReview.generatingPortrait")
                    : t("characterReview.noPortrait")}
                </div>
              )}
              {avatarStatus === "pending" && (
                <p className="text-[#B8BCC8] text-sm mt-3">{t("characterReview.generatingImage")}</p>
              )}
              {avatarStatus === "failed" && avatarError && (
                <p className="text-red-300 text-sm mt-3">{avatarError}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">{t("characterReview.name")}</h3>
            <p className="text-white">{character.name}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">{t("characterReview.class")}</h3>
            <p className="text-white capitalize">{character.class}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">{t("characterReview.backstory")}</h3>
            <p className="text-white">{character.backstory}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#C6A75E]">{t("characterReview.appearance")}</h3>
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
            {t("common.back")}
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
          >
            <Check className="size-4" />
            {t("characterReview.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

