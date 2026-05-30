import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { filterCountries, isValidCountryName, type CountrySelection } from "@/lib/countries";

export function CountrySelector({
  value,
  onChange,
  disabled,
  error,
  theme = "dark",
  label = "Country",
  placeholder = "Search country (e.g. South Africa)",
  icon: Icon = Globe,
}: {
  value: CountrySelection | null;
  onChange: (country: CountrySelection | null) => void;
  disabled?: boolean;
  error?: string;
  theme?: "light" | "dark";
  label?: string;
  placeholder?: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  const isLight = theme === "light";
  const [query, setQuery] = useState(value?.countryName ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value?.countryName) setQuery(value.countryName);
  }, [value?.countryName]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matches = useMemo(() => filterCountries(query).slice(0, 8), [query]);

  function selectCountry(name: string, code: string) {
    onChange({ countryName: name, countryCode: code });
    setQuery(name);
    setOpen(false);
  }

  function onInputChange(text: string) {
    setQuery(text);
    setOpen(true);
    if (isValidCountryName(text)) {
      const c = filterCountries(text).find((x) => x.name.toLowerCase() === text.trim().toLowerCase());
      if (c) onChange({ countryName: c.name, countryCode: c.code });
      else onChange(null);
    } else {
      onChange(null);
    }
  }

  const inputEl = (
    <input
      type="text"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      value={query}
      onChange={(e) => onInputChange(e.target.value)}
      onFocus={() => setOpen(true)}
      className={
        isLight
          ? `mt-0.5 w-full bg-transparent text-xs outline-none sm:text-sm ${
              query ? "font-medium text-[#0B1220]" : "text-[#94A3B8]"
            }`
          : "mt-1 w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
      }
    />
  );

  return (
    <div ref={wrapRef} className="relative">
      {isLight ? (
        <label className="block">
          <div
            className={`flex items-center gap-3 rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition-colors ${
              error ? "border-red-300" : "border-[#E2E8F0] hover:border-[#C7D2FE]"
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#5B21FF]">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-[#0B1220]">{label}</span>
              {inputEl}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
          </div>
        </label>
      ) : (
        <label className="block text-sm font-medium text-slate-200">
          {label}
          {inputEl}
        </label>
      )}
      {open && matches.length > 0 && (
        <ul
          className={
            isLight
              ? "absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-xl"
              : "absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-900 shadow-xl"
          }
        >
          {matches.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className={
                  isLight
                    ? "w-full px-3 py-2 text-left text-sm text-[#0B1220] hover:bg-[#F5F3FF]"
                    : "w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-violet-600/30"
                }
                onClick={() => selectCountry(c.name, c.code)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p className={`mt-1 text-xs ${isLight ? "text-red-600" : "text-red-400"}`}>{error}</p>
      ) : null}
      {!value && query.trim().length > 0 && !open ? (
        <p className={`mt-1 text-xs ${isLight ? "text-amber-600" : "text-amber-400"}`}>
          Select a country from the list.
        </p>
      ) : null}
    </div>
  );
}
