import { API_URL } from "~/config";
import { STORAGE_KEYS } from "~/constants/storage";
import { API_ENDPOINTS, HTTP_METHODS, HTTP_HEADERS } from "~/constants/api";

/**
 * Upload image to backend.
 * Uses POST /api/upload with Authorization header.
 */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const token = !!window ? localStorage.getItem(STORAGE_KEYS.TOKEN) : null;

  const res = await fetch(`${API_URL}${API_ENDPOINTS.UPLOAD}`, {
    method: HTTP_METHODS.POST,
    headers: {
      ...(token ? { [HTTP_HEADERS.AUTHORIZATION]: HTTP_HEADERS.BEARER(token) } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to upload image.");
  }

  const data = await res.json();
  return mapImageUrl(data.url);
}

function mapImageUrl(url: string) {
  if (url.startsWith("/")) {
    return API_URL + url;
  }
  return url;
}

