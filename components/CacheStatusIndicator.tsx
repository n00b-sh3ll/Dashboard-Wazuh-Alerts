'use client'

import { useEffect, useState } from 'react'

interface CacheInfo {
  available: boolean
  exists: boolean
  cached_at: string | null
  cache_age_minutes: number | null
  items_count: number | null
  timestamp: string
  metadata?: {
    last_successful_sync: string | null
    last_failed_attempt: string | null
    sync_count: number
    cache_size: number
  }
}

export default function CacheStatusIndicator() {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCacheStatus = async () => {
      try {
        const response = await fetch('/api/cache-status')
        const data = await response.json()
        setCacheInfo(data)
      } catch (err) {
        console.error('[CacheStatusIndicator] Error fetching cache info:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCacheStatus()
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchCacheStatus, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading || !cacheInfo) return null

  if (!cacheInfo.available) return null

  const ageText =
    cacheInfo.cache_age_minutes === null
      ? 'Sem dados'
      : cacheInfo.cache_age_minutes < 1
        ? 'Agora'
        : cacheInfo.cache_age_minutes < 60
          ? `${cacheInfo.cache_age_minutes} min atrás`
          : `${Math.floor(cacheInfo.cache_age_minutes / 60)}h atrás`

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/40 border border-blue-700 rounded text-blue-200 text-sm">
      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
      <span>
        Dados em cache: {cacheInfo.items_count || 0} alertas ({ageText})
      </span>
    </div>
  )
}
