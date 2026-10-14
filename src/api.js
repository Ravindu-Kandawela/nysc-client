const RAW_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '';
export const API_BASE = RAW_URL ? `${RAW_URL}/api` : '/api';
export const API_ORIGIN = RAW_URL;

export function getToken() {
  return localStorage.getItem('nysc_token');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('nysc_user') || 'null');
  } catch (e) {
    return null;
  }
}

export function setAuth(token, user) {
  localStorage.setItem('nysc_token', token);
  localStorage.setItem('nysc_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('nysc_token');
  localStorage.removeItem('nysc_user');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }

  if (!response.ok) {
    const errorMsg = data && data.error ? data.error : (typeof data === 'string' ? data : 'Request failed');
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  get: (url) => request(url, { method: 'GET' }),
  post: (url, body) => request(url, { 
    method: 'POST', 
    body: (typeof FormData !== 'undefined' && body instanceof FormData) ? body : JSON.stringify(body) 
  }),
  put: (url, body) => request(url, { 
    method: 'PUT', 
    body: (typeof FormData !== 'undefined' && body instanceof FormData) ? body : JSON.stringify(body) 
  }),
  delete: (url) => request(url, { method: 'DELETE' }),

  login: async (email, password) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAuth(res.token, res.user);
    return res;
  },

  logout: () => {
    clearAuth();
    window.location.href = '/login';
  }
};
