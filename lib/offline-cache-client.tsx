/**
 * Exemplo de como usar o sistema de cache offline no cliente
 * Este é um guia prático para integração em componentes React
 */

import { useEffect, useState } from 'react'
import type { SyncAlertsResponse, GetAlertsResponse, CacheStatusResponse } from '@/types/offline-cache'

/**
 * Hook customizado para sincronizar alertas com suporte offline
 */
export function useSyncAlerts() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncAlertsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sync = async (limit: number = 500) => {
    setSyncing(true)
    setError(null)

    try {
      const response = await fetch('/api/sync-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit }),
      })

      const data = (await response.json()) as SyncAlertsResponse

      if (!response.ok) {
        throw new Error(data.error || 'Erro na sincronização')
      }

      setSyncResult(data)

      // Mostrar mensagem ao usuário
      if (data.fromCache) {
        console.warn('⚠️ Usando dados em cache (conexão SSH indisponível)')
      } else {
        console.log('✓ Dados sincronizados com sucesso')
      }

      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      console.error('Erro ao sincronizar:', message)
      throw err
    } finally {
      setSyncing(false)
    }
  }

  return { sync, syncing, syncResult, error }
}

/**
 * Hook customizado para buscar alertas com suporte offline
 */
export function useGetAlerts() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAlertsData = async (limit: number = 50, offset: number = 0) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
      const response = await fetch(`/api/alerts?${params}`, {
        headers: { 'Content-Type': 'application/json' },
      })

      const data = (await response.json()) as GetAlertsResponse

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar alertas')
      }

      setAlerts(data.hits.hits)
      setOffline(data.offline || false)

      if (data.offline) {
        console.warn('📴 Modo offline ativo - usando dados em cache')
      }

      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      console.error('Erro ao buscar alertas:', message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { alerts, loading, offline, error, fetch: fetchAlertsData }
}

/**
 * Hook customizado para consultar status do cache
 */
export function useCacheStatus() {
  const [status, setStatus] = useState<CacheStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/cache-status')
      const data = (await response.json()) as CacheStatusResponse
      setStatus(data)
    } catch (err) {
      console.error('Erro ao obter status do cache:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()

    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  return { status, loading, refetch: fetchStatus }
}

/**
 * Exemplo de uso em componente
 */
export function ExampleSyncComponent() {
  const { sync, syncing, syncResult, error } = useSyncAlerts()
  const { alerts, loading, offline, fetch: fetchAlerts } = useGetAlerts()

  const handleSync = async () => {
    try {
      const result = await sync(500)
      // Após sincronizar, buscar alertas
      await fetchAlerts(50, 0)
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  return (
    <div>
      <button onClick={handleSync} disabled={syncing}>
        {syncing ? 'Sincronizando...' : 'Sincronizar Alertas'}
      </button>

      {error && <div style={{ color: 'red' }}>Erro: {error}</div>}

      {offline && <div style={{ color: 'orange' }}>📴 Modo Offline - Usando Cache</div>}

      {syncResult && (
        <div>
          {syncResult.fromCache && <p>✓ Dados carregados do cache</p>}
          <p>Total: {syncResult.count} alertas</p>
        </div>
      )}

      {loading && <p>Carregando...</p>}

      <ul>
        {alerts.map((alert) => (
          <li key={alert._id}>
            {alert._source?.rule?.name || 'Alerta Unknown'} (Nível:{' '}
            {alert._source?.rule?.level})
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Utilitário para serializar respostas de cache
 */
export function formatCacheInfo(cacheResult: SyncAlertsResponse) {
  if (!cacheResult.cacheInfo) return 'Sem informações de cache'

  const { cached_at, cache_age_minutes, items_count } = cacheResult.cacheInfo

  return `
    Cache Status:
    - Alertas em cache: ${items_count}
    - Data do cache: ${cached_at ? new Date(cached_at).toLocaleString('pt-BR') : 'Desconhecida'}
    - Idade: ${cache_age_minutes === null ? 'Desconhecida' : cache_age_minutes < 1 ? 'Agora' : cache_age_minutes < 60 ? `${cache_age_minutes}min` : `${Math.floor(cache_age_minutes / 60)}h`}
  `.trim()
}

/**
 * Indicador visual de status offline
 */
export function OfflineIndicator({ offline }: { offline: boolean }) {
  if (!offline) return null

  return (
    <div className="fixed bottom-4 right-4 bg-orange-500 text-white p-4 rounded shadow-lg">
      <p>📴 Modo offline ativo</p>
      <p className="text-sm">Usando dados em cache</p>
    </div>
  )
}
