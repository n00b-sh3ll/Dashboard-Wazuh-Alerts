export function readStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  const rawValue = localStorage.getItem(key)
  if (!rawValue) return fallback

  try {
    const parsed = JSON.parse(rawValue)
    return (parsed ?? fallback) as T
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}

export function writeStorageJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error(`[Storage] Failed to write ${key}:`, err)
  }
}

export function clearStorageKey(key: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch (err) {
    console.error(`[Storage] Failed to clear ${key}:`, err)
  }
}
