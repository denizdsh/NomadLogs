import { API_ENDPOINTS, HTTP_HEADERS } from "~/constants/api";

export interface LocationSuggestion {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  osmId?: string | null;
  createdAt?: string | Date;
}


/**
 * Searches locations using OpenStreetMap Nominatim autocomplete API.
 */
export async function searchLocation(query: string, limit = 5): Promise<LocationSuggestion[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }

  const res = await fetch(
    API_ENDPOINTS.GEOCODING_SEARCH(query, limit),
    {
      headers: {
        // Politeness header for Nominatim usage policy
        [HTTP_HEADERS.USER_AGENT]: HTTP_HEADERS.NOMADLOGS_USER_AGENT,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch location suggestions");
  }

  const results = await res.json();
  
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((item: any) => ({
    id: String(item.osm_id),
    label: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }));
}
