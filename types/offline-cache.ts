/**
 * Tipos e interfaces para o sistema de cache offline
 */

export interface CacheMetadata {
  last_successful_sync: string | null
  last_failed_attempt: string | null
  sync_count: number
  cache_size: number
}

export interface CacheInfo {
  exists: boolean
  cached_at: string | null
  cache_age_minutes: number | null
  items_count: number | null
  metadata: CacheMetadata | null
}

export interface CachedAlertsData {
  hits: {
    hits: any[]
    total: any
  }
  cached_at: string
  version: string
}

export interface SyncAlertsResponse {
  message: string
  count: number
  total?: number
  fromCache?: boolean
  warning?: string
  error?: string
  errorDetails?: string
  cacheInfo?: CacheInfo
}

export interface GetAlertsResponse {
  hits: {
    hits: any[]
    total: {
      value: number
    }
  }
  offline?: boolean
  offlineMessage?: string
  cacheInfo?: CacheInfo
  error?: string
}

export interface CacheStatusResponse {
  available: boolean
  exists: boolean
  cached_at: string | null
  cache_age_minutes: number | null
  items_count: number | null
  timestamp: string
  metadata?: CacheMetadata
  error?: string
}
