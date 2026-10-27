import { API_BASE, supabase } from './cfg'

export const readError = async (response: Response, fallback: string): Promise<string> => {
  const text = await response.text().catch(() => '')
  try {
    const j = JSON.parse(text)
    return j.message || j.error || fallback
  } catch {
    return text || fallback
  }
}

export const authFetch = async (path: string, init: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  })
}