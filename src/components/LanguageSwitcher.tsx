import { useI18n, type Language } from "../i18n";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="absolute right-4 top-4 z-50">
      <label className="flex items-center gap-2 rounded-md border border-[#6C5CE7]/40 bg-slate-900/70 px-3 py-2 text-sm text-white backdrop-blur-sm">
        <span>{t("language.label")}:</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
          className="rounded border border-[#6C5CE7]/40 bg-slate-800 px-2 py-1 text-sm text-white outline-none"
          aria-label={t("language.label")}
        >
          <option value="en">{t("language.english")}</option>
          <option value="ru">{t("language.russian")}</option>
        </select>
      </label>
    </div>
  );
}
