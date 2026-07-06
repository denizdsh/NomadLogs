export const API_ENDPOINTS = {
  UPLOAD: "/api/upload",
  GEOCODING_SEARCH: (query: string, limit = 5) =>
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}`,
} as const;

export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

export const HTTP_HEADERS = {
  AUTHORIZATION: "Authorization",
  USER_AGENT: "User-Agent",
  BEARER: (token: string) => `Bearer ${token}`,
  NOMADLOGS_USER_AGENT: "NomadLogs/1.0.0 (Web Frontend)",
} as const;

export const CONFIRMATION_TEXTS = {
  DELETE: "DELETE",
} as const;
