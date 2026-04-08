const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data as T;
}

export function getApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
