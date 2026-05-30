import { useEffect, useMemo, useRef, useState } from "react";
import { filterCountries, isValidCountryName, type CountrySelection } from "@/lib/countries";

export function CountrySelector({
  value,
  onChange,
  disabled,
  error,
}: {
  value: CountrySelection | null;
  onChange: (country: CountrySelection | null) => void;
  disabled?: boolean;
  error?: string;
}) {
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

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-sm font-medium text-slate-200">
        Country
        <input
          type="text"
          autoComplete="off"
          disabled={disabled}
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          placeholder="Search country (e.g. South Africa)"
          value={query}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </label>
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-900 shadow-xl">
          {matches.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-violet-600/30"
                onClick={() => selectCountry(c.name, c.code)}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-1 text-sm text-red-400">{error}</p> : null}
      {!value && query.trim().length > 0 && !open ? (
        <p className="mt-1 text-xs text-amber-400">Select a country from the list.</p>
      ) : null}
    </div>
  );
}
