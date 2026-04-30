function resolveApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    if (import.meta.env.DEV) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:4000/api`;
    }
    return `${window.location.origin}/api`;
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

export async function apiForm(path, formData, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method: options.method || 'POST',
    headers,
    body: formData
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data;
}

export async function downloadApiFile(path, filename) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    let message = 'Download failed';
    try {
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      message = data?.message || message;
    } catch {
      // ignore parse issue and keep generic message
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
