import { useState, useRef, useEffect, type ReactNode } from "react";
import { Search, X } from "lucide-react";

interface SearchSuggestion {
  id: string;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
}

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  suggestions?: SearchSuggestion[];
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  onSubmit?: (value: string) => void;
  className?: string;
  size?: "sm" | "md";
  forceSelection?: boolean;
}

export function SearchBar({
  placeholder = "Search...",
  value: controlledValue,
  onChange,
  suggestions = [],
  onSuggestionSelect,
  onSubmit,
  className = "",
  size = "md",
  forceSelection = false,
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  const value = controlledValue ?? internalValue;
  const setValue = (v: string) => {
    setInternalValue(v);
    onChange?.(v);
    setShowSuggestions(true);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sizeClasses = size === "sm" ? "py-1.5 px-3 text-body-sm" : "py-2.5 px-4 text-body-md";

  return (
    <search ref={containerRef} className={`relative ${className}`}>
      <label className="sr-only" htmlFor="search-input">{placeholder}</label>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none">
        <Search size={size === "sm" ? 14 : 16} />
      </span>

      <input
        id="search-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (forceSelection) {
              if (suggestions.length > 0) {
                onSuggestionSelect?.(suggestions[0]);
              }
            } else {
              onSubmit?.(value);
            }
            setShowSuggestions(false);
          }
        }}
        placeholder={placeholder}
        className={`w-full rounded-xl bg-surface border border-border-custom text-on-surface placeholder:text-on-surface-muted focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all pl-9 ${sizeClasses}`}
      />

      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-muted hover:text-on-surface transition-colors"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 z-40 max-h-60 overflow-y-auto rounded-xl bg-surface border border-border-custom shadow-xl py-1 animate-slide-down">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => {
                  onSuggestionSelect?.(suggestion);
                  setShowSuggestions(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-border-custom/50 transition-colors"
              >
                {suggestion.icon}
                <span className="flex flex-col">
                  <span className="text-body-sm text-on-surface">{suggestion.label}</span>
                  {suggestion.sublabel && (
                    <span className="text-label-sm text-on-surface-muted">{suggestion.sublabel}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </search>
  );
}
