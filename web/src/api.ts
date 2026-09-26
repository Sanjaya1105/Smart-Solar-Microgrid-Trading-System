const API_URL = import.meta.env.VITE_API_URL ?? ''

export async function apiRequest(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } })
  const text = await response.text()
  let data = null
  if (text) { try { data = JSON.parse(text) } catch { data = { detail: text } } }
  if (!response.ok) {
    const validationErrors = data?.errors ? Object.values(data.errors).flat().filter((message): message is string => typeof message === 'string').join(' ') : ''
    throw new Error(data?.detail || validationErrors || data?.title || `API ${response.status}`)
  }
  return data
}

