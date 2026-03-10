import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ArrowRight, ArrowLeft, Sword, Wand2, Shield, BookOpen, Heart, Zap, Sparkles } from "lucide-react";
import { StarryBackground } from "../StarryBackground";
import { useI18n } from "../../i18n";
import { generateCustomClass, type CustomClassResponse } from "../../utils/api";

type StatKey = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
type CharacterStat = { key: StatKey; score: number; bonus: number };

const classes = [
  {
    id: "warrior",
    translationKey: "class.warrior",
    icon: Sword,
  },
  {
    id: "mage",
    translationKey: "class.mage",
    icon: Wand2,
  },
  {
    id: "paladin",
    translationKey: "class.paladin",
    icon: Shield,
  },
  {
    id: "rogue",
    translationKey: "class.rogue",
    icon: Zap,
  },
  {
    id: "cleric",
    translationKey: "class.cleric",
    icon: Heart,
  },
  {
    id: "warlock",
    translationKey: "class.warlock",
    icon: BookOpen,
  },
];

const BASE_STATS: CharacterStat[] = [
  { key: "STR", score: 10, bonus: 0 },
  { key: "DEX", score: 10, bonus: 0 },
  { key: "CON", score: 10, bonus: 0 },
  { key: "INT", score: 10, bonus: 0 },
  { key: "WIS", score: 10, bonus: 0 },
  { key: "CHA", score: 10, bonus: 0 },
];

const PRESET_CLASS_STATS: Record<string, CharacterStat[]> = {
  warrior: [
    { key: "STR", score: 16, bonus: 3 },
    { key: "DEX", score: 12, bonus: 1 },
    { key: "CON", score: 15, bonus: 2 },
    { key: "INT", score: 10, bonus: 0 },
    { key: "WIS", score: 11, bonus: 0 },
    { key: "CHA", score: 10, bonus: 0 },
  ],
  mage: [
    { key: "STR", score: 8, bonus: -1 },
    { key: "DEX", score: 13, bonus: 1 },
    { key: "CON", score: 12, bonus: 1 },
    { key: "INT", score: 16, bonus: 3 },
    { key: "WIS", score: 14, bonus: 2 },
    { key: "CHA", score: 10, bonus: 0 },
  ],
  paladin: [
    { key: "STR", score: 15, bonus: 2 },
    { key: "DEX", score: 10, bonus: 0 },
    { key: "CON", score: 14, bonus: 2 },
    { key: "INT", score: 9, bonus: -1 },
    { key: "WIS", score: 12, bonus: 1 },
    { key: "CHA", score: 16, bonus: 3 },
  ],
  rogue: [
    { key: "STR", score: 9, bonus: -1 },
    { key: "DEX", score: 16, bonus: 3 },
    { key: "CON", score: 12, bonus: 1 },
    { key: "INT", score: 13, bonus: 1 },
    { key: "WIS", score: 11, bonus: 0 },
    { key: "CHA", score: 14, bonus: 2 },
  ],
  cleric: [
    { key: "STR", score: 11, bonus: 0 },
    { key: "DEX", score: 10, bonus: 0 },
    { key: "CON", score: 13, bonus: 1 },
    { key: "INT", score: 10, bonus: 0 },
    { key: "WIS", score: 16, bonus: 3 },
    { key: "CHA", score: 14, bonus: 2 },
  ],
  warlock: [
    { key: "STR", score: 8, bonus: -1 },
    { key: "DEX", score: 14, bonus: 2 },
    { key: "CON", score: 12, bonus: 1 },
    { key: "INT", score: 12, bonus: 1 },
    { key: "WIS", score: 10, bonus: 0 },
    { key: "CHA", score: 16, bonus: 3 },
  ],
};

const PRESET_HIT_DIE: Record<string, string> = {
  warrior: "d10",
  mage: "d6",
  paladin: "d10",
  rogue: "d8",
  cleric: "d8",
  warlock: "d8",
};

const PRESET_PROFICIENCIES: Record<string, string[]> = {
  warrior: ["All armor", "Shields", "Simple weapons", "Martial weapons"],
  mage: ["Daggers", "Quarterstaffs", "Light crossbows"],
  paladin: ["All armor", "Shields", "Simple weapons", "Martial weapons"],
  rogue: ["Light armor", "Simple weapons", "Rapiers", "Shortswords"],
  cleric: ["Light armor", "Medium armor", "Shields", "Simple weapons"],
  warlock: ["Light armor", "Simple weapons"],
};

const PRESET_STARTING_LOADOUT: Record<
  string,
  { weapon: { name: string; type: string; damage: string; description: string }; armor: { name: string; armorClass: number; description: string } }
> = {
  warrior: {
    weapon: { name: "Longsword", type: "melee", damage: "1d8 slashing", description: "A dependable steel blade." },
    armor: { name: "Chain Mail", armorClass: 16, description: "Heavy armor of interlocked rings." },
  },
  mage: {
    weapon: { name: "Arcane Staff", type: "magic", damage: "1d6 force", description: "A focus carved with runes." },
    armor: { name: "Apprentice Robes", armorClass: 11, description: "Layered robes reinforced with warding thread." },
  },
  paladin: {
    weapon: { name: "Blessed Sword", type: "melee", damage: "1d8 radiant", description: "A sword etched with sacred marks." },
    armor: { name: "Plate Harness", armorClass: 18, description: "Sanctified plate forged for frontline defense." },
  },
  rogue: {
    weapon: { name: "Balanced Dagger", type: "melee", damage: "1d4 piercing", description: "A quick blade for close strikes." },
    armor: { name: "Shadow Leather", armorClass: 13, description: "Flexible leather suited for stealth." },
  },
  cleric: {
    weapon: { name: "Mace of Oaths", type: "melee", damage: "1d6 bludgeoning", description: "A sanctified mace for holy battles." },
    armor: { name: "Scale Vestments", armorClass: 14, description: "Blessed scales over ceremonial cloth." },
  },
  warlock: {
    weapon: { name: "Pact Blade", type: "magic", damage: "1d8 necrotic", description: "A weapon bound to a dark bargain." },
    armor: { name: "Hexwoven Coat", armorClass: 12, description: "A long coat threaded with occult sigils." },
  },
};

const statBonus = (score: number) => Math.floor((score - 10) / 2);

const hashSeed = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildCustomStats = (seed: string): CharacterStat[] => {
  const values = [...BASE_STATS.map(stat => ({ ...stat }))];
  let state = hashSeed(seed || "custom-class");

  for (let i = 0; i < 16; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const statIndex = state % values.length;
    if (values[statIndex].score < 17) {
      values[statIndex].score += 1;
    }
  }

  return values.map(stat => ({
    ...stat,
    bonus: statBonus(stat.score),
  }));
};

const pickBySeed = (seed: number, values: string[], offset: number) => {
  return values[(seed + offset) % values.length];
};

const buildCustomClassDescription = (className: string, generationSeed: string, language: "en" | "ru") => {
  const seed = hashSeed(`${className}:${generationSeed}`);

  const origins = language === "ru"
    ? [
        "закален в приграничных стычках, где правила исчезали до рассвета",
        "обучен в закрытых залах, где ценился только результат",
        "вырос между гильдейскими контрактами и уличным выживанием",
        "отточен в храмовых судах, где милосердие имело цену",
        "проверен в экспедициях, из которых редко возвращались целыми",
      ]
    : [
        "forged in border skirmishes where rules broke before dawn",
        "trained in shuttered halls where only results mattered",
        "raised between guild contracts and street survival",
        "honed in shrine courts where mercy had a cost",
        "tested in expeditions that never returned whole",
      ];

  const combatStyles = language === "ru"
    ? [
        "контролирует темп, заставляя врагов реагировать первыми",
        "побеждает точными всплесками урона и быстрыми перемещениями",
        "ломает построения давлением и точечной дестабилизацией",
        "сдерживает ключевые угрозы, пока союзники занимают позицию",
        "превращает хаос в преимущество за счет своевременных ударов",
      ]
    : [
        "controls tempo by forcing enemies to react first",
        "wins through precision bursts and fast repositioning",
        "breaks formations with pressure and targeted disruption",
        "locks down key threats while allies take ground",
        "turns chaos into advantage with opportunistic strikes",
      ];

  const signatures = language === "ru"
    ? [
        "Фирменный прием позволяет пометить цель и наказывать каждую ошибку.",
        "Ключевая техника превращает импульс в внезапный переломный рывок.",
        "Он может закрепить зону контроля, ослабляющую каждого, кто ее пересекает.",
        "Его главный трюк - связывать мелкие открытия в одно решающее завершение.",
        "Он силен в чтении намерений и контратаке до удара противника.",
      ]
    : [
        "A signature maneuver lets them mark a target and punish every mistake.",
        "Their hallmark technique converts momentum into a sudden, fight-swinging burst.",
        "They can anchor a zone of control that weakens anyone who pushes through it.",
        "Their core trick is chaining small openings into one decisive finish.",
        "They excel at reading intent and countering before the blow lands.",
      ];

  const drawbacks = language === "ru"
    ? [
        "Его сила резко растет, но плохой тайминг оставляет его открытым.",
        "Он смертелен в своем ритме, но уязвим, если выбить его из плана.",
        "Он раскрывается под давлением, но затяжные бои быстро истощают его концентрацию.",
        "Его самые сильные инструменты дорогие, поэтому каждое применение должно быть оправдано.",
        "Он быстро адаптируется, но чрезмерный риск может разрушить его защиту.",
      ]
    : [
        "Their power spikes hard, but poor timing leaves them exposed.",
        "They are deadly in rhythm, yet vulnerable when forced off-plan.",
        "They thrive under pressure, but long fights tax their focus quickly.",
        "Their strongest tools are costly, so every use must matter.",
        "They adapt fast, but overcommitment can collapse their defense.",
      ];

  const origin = pickBySeed(seed, origins, 1);
  const style = pickBySeed(seed, combatStyles, 3);
  const signature = pickBySeed(seed, signatures, 5);
  const drawback = pickBySeed(seed, drawbacks, 7);

  if (language === "ru") {
    return `${className} ${origin}. В бою этот класс ${style}. ${signature} ${drawback}`;
  }

  return `The ${className} is ${origin}. In battle, this class ${style}. ${signature} ${drawback}`;
};

export function CharacterClass() {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [customClass, setCustomClass] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [customStats, setCustomStats] = useState<CharacterStat[] | null>(null);
  const [generatedClassData, setGeneratedClassData] = useState<CustomClassResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const mapStatsToDisplay = (stats: CustomClassResponse["stats"]): CharacterStat[] => {
    const order: Array<{ source: keyof CustomClassResponse["stats"]; key: StatKey }> = [
      { source: "strength", key: "STR" },
      { source: "dexterity", key: "DEX" },
      { source: "constitution", key: "CON" },
      { source: "intelligence", key: "INT" },
      { source: "wisdom", key: "WIS" },
      { source: "charisma", key: "CHA" },
    ];
    return order.map((entry) => {
      const score = Number(stats[entry.source] || 10);
      return { key: entry.key, score, bonus: statBonus(score) };
    });
  };

  const handleGenerateCustomClass = async () => {
    if (!customClass.trim()) return;
    
    setIsGenerating(true);
    try {
      const generated = await generateCustomClass(customClass.trim());
      setGeneratedClassData(generated);
      setAiResponse(generated.description || buildCustomClassDescription(customClass.trim(), Date.now().toString(), language));
      setCustomStats(mapStatsToDisplay(generated.stats));
      setSelectedClass(`custom_${(generated.className || customClass).toLowerCase()}`);
    } catch {
      const generationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = buildCustomClassDescription(customClass.trim(), generationSeed, language);
      setAiResponse(response);
      setCustomStats(buildCustomStats(`${customClass.trim()}:${generationSeed}`));
      setGeneratedClassData(null);
      setSelectedClass(`custom_${customClass.toLowerCase()}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (selectedClass) {
      // If it's a custom class, save the custom class name
      if (selectedClass.startsWith("custom_")) {
        const resolvedName = generatedClassData?.className || customClass;
        localStorage.setItem("characterClass", resolvedName);
        if (customStats?.length) {
          localStorage.setItem("characterStats", JSON.stringify(customStats));
        }
        if (generatedClassData) {
          localStorage.setItem("characterCustomClassData", JSON.stringify(generatedClassData));
        } else {
          localStorage.removeItem("characterCustomClassData");
        }
      } else {
        localStorage.setItem("characterClass", selectedClass);
        const presetStats = PRESET_CLASS_STATS[selectedClass];
        if (presetStats?.length) {
          localStorage.setItem("characterStats", JSON.stringify(presetStats));
        } else {
          localStorage.removeItem("characterStats");
        }
        const presetLoadout = PRESET_STARTING_LOADOUT[selectedClass];
        const presetClassData: CustomClassResponse = {
          className: selectedClass,
          stats: {
            strength: presetStats?.find((stat) => stat.key === "STR")?.score || 10,
            dexterity: presetStats?.find((stat) => stat.key === "DEX")?.score || 10,
            constitution: presetStats?.find((stat) => stat.key === "CON")?.score || 10,
            intelligence: presetStats?.find((stat) => stat.key === "INT")?.score || 10,
            wisdom: presetStats?.find((stat) => stat.key === "WIS")?.score || 10,
            charisma: presetStats?.find((stat) => stat.key === "CHA")?.score || 10,
          },
          hitDie: PRESET_HIT_DIE[selectedClass] || "d8",
          proficiencies: PRESET_PROFICIENCIES[selectedClass] || [],
          features: [],
          description: `${selectedClass} profile`,
          startingWeapon: presetLoadout
            ? {
                ...presetLoadout.weapon,
                tags: ["equipment", "weapon"],
              }
            : undefined,
          startingArmor: presetLoadout
            ? {
                ...presetLoadout.armor,
                tags: ["equipment", "armor"],
              }
            : undefined,
        };
        localStorage.setItem("characterCustomClassData", JSON.stringify(presetClassData));
      }
      navigate("/character/backstory");
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-[#1C1B22] p-4 relative overflow-hidden">
      <StarryBackground />
      
      <div className="w-full max-w-4xl space-y-6 bg-slate-800/50 rounded-lg border border-[#6C5CE7]/30 bg-[#34405080] p-[32px] relative z-10">
        <div className="space-y-2">
          <h2 className="font-bold text-white text-[24px] mx-[0px] mt-[0px] mb-[8px]">{t("characterClass.title")}</h2>
          <p className="text-[#B8BCC8]">{t("characterClass.step")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const Icon = cls.icon;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={`p-6 rounded-lg border-2 transition-all ${
                  selectedClass === cls.id
                    ? "border-[#6C5CE7] bg-[#6C5CE7]/20"
                    : "border-[#6C5CE7]/30 bg-slate-700/30 hover:border-[#6C5CE7]/60"
                }`}
              >
                <Icon className="size-12 text-[#C6A75E] mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{t(`${cls.translationKey}.name`)}</h3>
                <p className="text-[#B8BCC8] text-sm">{t(`${cls.translationKey}.description`)}</p>
              </button>
            );
          })}
        </div>

        {/* Custom Class Section */}
        <div className="space-y-4 p-6 bg-slate-700/30 rounded-lg border border-[#6C5CE7]/30">
          <div className="space-y-2">
            <Label htmlFor="customClass" className="text-white font-semibold flex items-center gap-2 text-[24px]">
              <Sparkles className="size-5 text-[#C6A75E]" />
              {t("characterClass.customTitle")}
            </Label>
            <p className="text-[#B8BCC8] text-[16px]">{t("characterClass.customHint")}</p>
          </div>

          <div className="flex gap-2">
            <Input
              id="customClass"
              value={customClass}
              onChange={(e) => setCustomClass(e.target.value)}
              placeholder={t("characterClass.customPlaceholder")}
              className="bg-slate-700 border-[#6C5CE7]/30 text-white"
              onKeyPress={(e) => e.key === "Enter" && handleGenerateCustomClass()}
            />
            <Button
              onClick={handleGenerateCustomClass}
              disabled={!customClass.trim() || isGenerating}
              className="gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
            >
              <Sparkles className="size-4" />
              {isGenerating ? t("characterClass.generating") : t("characterClass.generate")}
            </Button>
          </div>

          {aiResponse && (
            <div className="p-4 bg-[#6C5CE7]/20 border border-[#6C5CE7]/30 rounded-lg">
              <h4 className="text-[#C6A75E] font-semibold mb-2 capitalize">{customClass}</h4>
              <p className="text-[#B8BCC8] text-sm">{aiResponse}</p>

              {customStats?.length ? (
                <div className="mt-4">
                  <h5 className="text-[#C6A75E] font-semibold text-sm mb-3">{t("characterClass.suggestedStats")}</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {customStats.map((stat) => (
                      <div
                        key={stat.key}
                        className="rounded-lg border border-[#6C5CE7]/30 bg-slate-800/60 p-3"
                      >
                        <div className="text-[#B8BCC8] text-xs tracking-wide">{stat.key}</div>
                        <div className="mt-1 rounded-md border border-[#6C5CE7]/40 bg-slate-700/50 px-2 py-1 text-center text-white font-bold text-lg">
                          {stat.score}
                        </div>
                        <div className="mt-1 rounded-md border border-[#C6A75E]/30 bg-[#C6A75E]/10 px-2 py-1 text-center text-[#C6A75E] text-sm font-semibold">
                          {stat.bonus >= 0 ? `+${stat.bonus}` : stat.bonus}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/character/name")}
            className="gap-2 border-[#6C5CE7] text-[#6C5CE7] hover:bg-[#6C5CE7]/10"
          >
            <ArrowLeft className="size-4" />
            {t("common.back")}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedClass}
            className="flex-1 gap-2 bg-[#6C5CE7] hover:bg-[#5F4FD1]"
          >
            {t("common.next")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

