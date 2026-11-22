const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_STORAGE_KEY = 'waterwize_token';
const ACTIVE_FARM_STORAGE_KEY = 'waterwize_active_farm_id';


export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getStoredActiveFarmId() {
  return localStorage.getItem(ACTIVE_FARM_STORAGE_KEY);
}

export function setStoredActiveFarmId(farmId) {
  if (farmId) {
    localStorage.setItem(ACTIVE_FARM_STORAGE_KEY, farmId);
  } else {
    localStorage.removeItem(ACTIVE_FARM_STORAGE_KEY);
  }
}

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  if (isFormData && 'Content-Type' in headers) {
    delete headers['Content-Type'];
  }

  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  const response = await fetch(`${baseUrl}${normalizedEndpoint}`, {
    ...options,
    headers,
    body: isFormData
      ? options.body
      : typeof options.body === 'string' || options.body === undefined
        ? options.body
        : JSON.stringify(options.body)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}