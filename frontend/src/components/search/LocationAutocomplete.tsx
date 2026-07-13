import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { MapPinIcon } from "@/components/icons";
import { autocompleteLocations, type LocationSuggestion } from "@/lib/api/leads";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}

export function LocationAutocomplete({
  value,
  onChange,
  disabled = false,
  required = false,
}: LocationAutocompleteProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      autocompleteLocations(query)
        .then((rows) => {
          setSuggestions(rows);
          setOpen(rows.length > 0);
          setActiveIndex(-1);
        })
        .catch(() => {
          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (suggestion: LocationSuggestion) => {
    onChange(suggestion.label);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="autocomplete" ref={wrapRef}>
      <div className="input-with-icon">
        <MapPinIcon className="input-with-icon__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          id="location"
          className="text-input text-input--with-icon"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="e.g. Newark NJ"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          disabled={disabled}
          required={required}
        />
      </div>

      {open && (
        <ul className="autocomplete__list" id={listId} role="listbox">
          {loading && suggestions.length === 0 && (
            <li className="autocomplete__item autocomplete__item--muted">
              Searching…
            </li>
          )}
          {suggestions.map((s, i) => (
            <li
              key={s.place_id || `${s.label}-${i}`}
              id={`${listId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`autocomplete__item${i === activeIndex ? " autocomplete__item--active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="autocomplete__main">{s.main_text || s.label}</span>
              {s.secondary_text && (
                <span className="autocomplete__secondary">{s.secondary_text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
