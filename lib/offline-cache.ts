/**
 * Sistema de cache offline para alertas
 * Garante disponibilidade de dados mesmo com perda de conexão SSH
 */

import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'

// Usar arquivo no servidor para cache persistente
const cacheDir = process.env.CACHE_DIR || path.join(process.cwd(), '.cache')
const cacheFile = path.join(cacheDir, 'alerts-cache.json')
const metadataFile = path.join(cacheDir, 'cache-metadata.json')

export interface CachedAlertsData {
  hits: {
    hits: any[]
    total: any
  }
  cached_at: string
  version: string
}

export interface CacheMetadata {
  last_successful_sync: string | null
  last_failed_attempt: string | null
  sync_count: number
  cache_size: number
}

/**
 * Inicializa o diretório de cache se não existir
 */
function initializeCacheDir() {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
}

/**
 * Salva alertas em cache persistente
 */
export function saveAlertsToCache(alertsData: any): boolean {
  try {
    initializeCacheDir()

    const data: CachedAlertsData = {
      hits: alertsData.hits || { hits: [], total: 0 },
      cached_at: new Date().toISOString(),
      version: '1.0',
    }

    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2))

    // Atualizar metadados
    updateCacheMetadata(true)

    console.log(`[Cache] Alertas salvos em cache (${data.hits.hits.length} itens)`)
    return true
  } catch (err) {
    console.error('[Cache] Erro ao salvar em cache:', err)
    return false
  }
}

/**
 * Recupera alertas do cache persistente
 */
export function getAlertsFromCache(): CachedAlertsData | null {
  try {
    initializeCacheDir()

    if (!fs.existsSync(cacheFile)) {
      console.warn('[Cache] Arquivo de cache não encontrado')
      return null
    }

    const data = fs.readFileSync(cacheFile, 'utf-8')
    const parsed = JSON.parse(data) as CachedAlertsData

    console.log(
      `[Cache] Alertas recuperados do cache (${parsed.hits.hits.length} itens, salvo em ${parsed.cached_at})`
    )
    return parsed
  } catch (err) {
    console.error('[Cache] Erro ao ler cache:', err)
    return null
  }
}

/**
 * Verifica se o cache existe e é válido
 */
export function isCacheAvailable(): boolean {
  try {
    initializeCacheDir()
    return fs.existsSync(cacheFile)
  } catch (err) {
    console.error('[Cache] Erro ao verificar cache:', err)
    return false
  }
}

/**
 * Retorna informações sobre o cache
 */
export function getCacheInfo(): {
  exists: boolean
  cached_at: string | null
  cache_age_minutes: number | null
  items_count: number | null
  metadata: CacheMetadata | null
} {
  try {
    initializeCacheDir()

    if (!fs.existsSync(cacheFile)) {
      return {
        exists: false,
        cached_at: null,
        cache_age_minutes: null,
        items_count: null,
        metadata: loadCacheMetadata(),
      }
    }

    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as CachedAlertsData
    const cachedAt = new Date(data.cached_at)
    const ageMinutes = Math.round((Date.now() - cachedAt.getTime()) / 60000)

    return {
      exists: true,
      cached_at: data.cached_at,
      cache_age_minutes: ageMinutes,
      items_count: data.hits.hits.length,
      metadata: loadCacheMetadata(),
    }
  } catch (err) {
    console.error('[Cache] Erro ao obter informações do cache:', err)
    return {
      exists: false,
      cached_at: null,
      cache_age_minutes: null,
      items_count: null,
      metadata: null,
    }
  }
}

/**
 * Limpa o cache
 */
export function clearCache(): boolean {
  try {
    initializeCacheDir()

    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile)
    }

    console.log('[Cache] Cache de alertas removido')
    return true
  } catch (err) {
    console.error('[Cache] Erro ao limpar cache:', err)
    return false
  }
}

/**
 * Carrega metadados do cache
 */
function loadCacheMetadata(): CacheMetadata {
  try {
    initializeCacheDir()

    if (!fs.existsSync(metadataFile)) {
      return {
        last_successful_sync: null,
        last_failed_attempt: null,
        sync_count: 0,
        cache_size: 0,
      }
    }

    return JSON.parse(fs.readFileSync(metadataFile, 'utf-8'))
  } catch (err) {
    return {
      last_successful_sync: null,
      last_failed_attempt: null,
      sync_count: 0,
      cache_size: 0,
    }
  }
}

/**
 * Atualiza metadados do cache
 */
function updateCacheMetadata(success: boolean) {
  try {
    initializeCacheDir()

    const metadata = loadCacheMetadata()

    if (success) {
      metadata.last_successful_sync = new Date().toISOString()
      metadata.sync_count++
    } else {
      metadata.last_failed_attempt = new Date().toISOString()
    }

    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile)
      metadata.cache_size = stats.size
    }

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
  } catch (err) {
    console.error('[Cache] Erro ao atualizar metadados:', err)
  }
}

/**
 * Registra falha de conexão
 */
export function recordConnectionFailure() {
  try {
    initializeCacheDir()
    const metadata = loadCacheMetadata()
    metadata.last_failed_attempt = new Date().toISOString()
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))
  } catch (err) {
    console.error('[Cache] Erro ao registrar falha:', err)
  }
}
