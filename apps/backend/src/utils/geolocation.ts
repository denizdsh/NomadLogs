/**
 * Geolocation utility to resolve IP addresses to coordinates.
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

// Sensible default coordinates (London, UK)
export const DEFAULT_COORDINATES: Coordinates = {
  latitude: 51.5074,
  longitude: -0.1278,
};

/**
 * Resolves an IP address to latitude/longitude coordinates.
 * Supports public IP resolution via ip-api.com and falls back to default coordinates.
 */
export async function geolocateIp(ip: string | null): Promise<Coordinates> {
  if (!ip) {
    return DEFAULT_COORDINATES;
  }

  // Check if IP is local/loopback
  const cleanIp = ip.trim();
  if (
    cleanIp === "127.0.0.1" ||
    cleanIp === "::1" ||
    cleanIp === "localhost" ||
    cleanIp.startsWith("192.168.") ||
    cleanIp.startsWith("10.") ||
    cleanIp.startsWith("172.16.") ||
    cleanIp.startsWith("::ffff:127.0.0.1")
  ) {
    return DEFAULT_COORDINATES;
  }

  try {
    // Call free ip-api.com service with a 1.5s timeout fallback
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,lat,lon`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return DEFAULT_COORDINATES;
    }

    const data = (await response.json()) as { status: string; lat?: number; lon?: number };

    if (data.status === "success" && typeof data.lat === "number" && typeof data.lon === "number") {
      return {
        latitude: data.lat,
        longitude: data.lon,
      };
    }
  } catch (error) {
    // Silently fall back to default coordinates on network error or timeout
    console.warn(`[geolocation] Failed to geolocate IP ${cleanIp}:`, error);
  }

  return DEFAULT_COORDINATES;
}

/**
 * Calculates the distance between two coordinates in kilometers using the Haversine formula.
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
