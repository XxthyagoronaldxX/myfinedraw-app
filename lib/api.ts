export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4778';

const TOKEN_KEY = 'mfd.token';

export const getToken = () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY));
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, body });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    setToken(null);
    window.location.href = '/login';
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = Array.isArray(data.message) ? data.message.join(', ') : data.message ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

/** URL absoluta para arquivos servidos pela API (ex.: /uploads/...). */
export const assetUrl = (url: string) => (url.startsWith('http') ? url : `${API_URL}${url}`);

export function uploadImage(projectId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return api<Asset>(`/projects/${projectId}/assets`, { method: 'POST', body: fd });
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'superadmin';
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  tags: string[];
  updatedAt: string;
  _count?: { boards: number };
  boards?: BoardSummary[];
}

export interface BoardSummary {
  id: string;
  name: string;
  type: 'mixed' | 'er' | 'flow';
  position: number;
  updatedAt: string;
}

export interface Board extends BoardSummary {
  projectId: string;
  projectName: string;
  content: { version: number; viewport: { x: number; y: number; zoom: number }; nodes: any[]; edges: any[] };
}

export interface Asset {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}
