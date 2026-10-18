import { languageNames, languages, useI18n, type Lang } from "../i18n";

export function LanguagePicker() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="shrink-0">
      <span className="sr-only">{t.language}</span>
      <select
        id="dashboard-language"
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="border-line bg-surface min-h-10 rounded-full border px-3 text-sm font-semibold"
      >
        {languages.map((l) => (
          <option key={l} value={l}>
            {languageNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
