import { useState, useEffect } from "react";
import { useDebounce } from "./useDebounce";
import { searchLocation, type LocationSuggestion } from "~/utils/geocoding";

/**
 * Hook to search locations reactively with debouncing.
 */
export function useLocationSearch(initialQuery = "") {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    if (debouncedQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    searchLocation(debouncedQuery)
      .then((results) => {
        if (!active) return;
        setSuggestions(results);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  return {
    query,
    setQuery,
    suggestions,
    setSuggestions,
    loading,
    error,
  };
}
