function resolveApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:4000/api`;
  }
  return 'http://localhost:4000/api';
}

const API_URL = resolveApiUrl();

export function getApiBaseUrl() {
  return API_URL;
}

export function getToken() {
  return localStorage.getItem('tms_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('tms_token', token);
  else localStorage.removeItem('tms_token');
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data;
}
