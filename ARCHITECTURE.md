# 🔄 Sistema de Cache Offline - Arquitetura Visual

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (React)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐          ┌──────────────────────┐         │
│  │  Components     │          │ CacheStatusIndicator │         │
│  │  - AlertList    │────────► │ - Mostra status      │         │
│  │  - AlertModal   │          │ - Atualiza a cada    │         │
│  │  - Dashboard    │          │   30 segundos        │         │
│  └─────────────────┘          └──────────────────────┘         │
│           │                                                      │
│           │ useSyncAlerts()  useGetAlerts()                    │
│           │ useGetAlerts()   useCacheStatus()                  │
│           ↓                                                      │
│  ┌──────────────────────────────────────────┐                  │
│  │ API Client (fetch)                       │                  │
│  │ - /api/sync-alerts (POST)                │                  │
│  │ - /api/alerts (GET)                      │                  │
│  │ - /api/cache-status (GET)                │                  │
│  └──────────────────────────────────────────┘                  │
│           │                                                      │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │ HTTP Request/Response
            │
┌───────────┼──────────────────────────────────────────────────────┐
│           ↓          SERVIDOR (Next.js API Routes)               │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │ /api/sync-alerts     │  │ /api/alerts          │             │
│  └──────────────────────┘  └──────────────────────┘             │
│           │                           │                         │
│           ├──────────┬────────────┬───┤                         │
│           │          │            │   │                         │
│           ↓          ↓            ↓   ↓                         │
│  ┌──────────────────────────────────┐                           │
│  │  fetchAlertsViaSSH()             │                           │
│  │  - Tenta conectar SSH            │                           │
│  │  - Executa query no ES           │                           │
│  └──────────────────────────────────┘                           │
│           │                                                      │
│     ┌─────┴──────┐                                              │
│     │            │                                              │
│  SUCCESS      FAILURE (erro de conexão)                         │
│     │            │                                              │
│     ↓            ↓                                              │
│  Salva em    Tenta usar                                        │
│  Cache      Cache offline                                      │
│     │            │                                              │
│     └─────┬──────┘                                              │
│           ↓                                                      │
│  ┌──────────────────────────────────────────┐                  │
│  │ offline-cache.ts (Cache Management)      │                  │
│  │                                          │                  │
│  │ saveAlertsToCache(data)                  │                  │
│  │ getAlertsFromCache()                     │                  │
│  │ getCacheInfo()                           │                  │
│  │ recordConnectionFailure()                │                  │
│  └──────────────────────────────────────────┘                  │
│           │                                                      │
│           ↓                                                      │
│  ┌──────────────────────────────────────────┐                  │
│  │ Filesystem (.cache/)                     │                  │
│  │                                          │                  │
│  │ alerts-cache.json                        │                  │
│  │ └─ { hits: { hits: [...], total: ... }} │                  │
│  │                                          │                  │
│  │ cache-metadata.json                      │                  │
│  │ └─ { sync_count, last_sync, ... }       │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Fluxo de Sincronização Detalhado

```
SINCRONIZAÇÃO MANUAL
════════════════════════════════════════════════════════════════════

Usuário clica em "Sincronizar" (Dashboard)
│
├─► POST /api/sync-alerts { limit: 500 }
│   │
│   ├─► fetchAlertsViaSSH(500)
│   │   │
│   │   ├─ SSH -o ConnectTimeout=10
│   │   ├─ Python3 /script/fetch.py
│   │   └─ POST ES: /wazuh-alerts-*/_search
│   │
│   ├─ SSH CONECTADO ✓
│   │ │
│   │ ├─► saveAlertsToCache(alertsData)
│   │ │   ├─ Salva: .cache/alerts-cache.json
│   │ │   └─ Atualiza: .cache/cache-metadata.json
│   │ │
│   │ ├─► syncAlertsFromES() [SQLite]
│   │ │   └─ Insere/Atualiza banco local
│   │ │
│   │ └─ RESPOSTA: { fromCache: false, count: 145 }
│   │
│   └─ SSH FALHOU ✗ (ConnectTimeout, etc)
│     │
│     ├─► recordConnectionFailure()
│     │
│     ├─► getAlertsFromCache()
│     │   └─ Lê: .cache/alerts-cache.json
│     │
│     └─ RESPOSTA: { fromCache: true, count: 145 }
│
└─ Cliente recebe resultado e atualiza UI

════════════════════════════════════════════════════════════════════
```

## Fluxo de Busca com Fallback

```
BUSCA DE ALERTAS
════════════════════════════════════════════════════════════════════

GET /api/alerts?limit=50&useDB=false
│
├─ useDB=true?
│ ├─ SIM ──► getAlertsFromDB() ──► Retorna dados do SQLite
│ │
│ └─ NÃO
│
├─► fetchAlertsViaSSH()
│   │
│   ├─ SSH CONECTADO ✓
│   │ └─ Retorna: { hits: { hits: [...] } }
│   │
│   └─ SSH FALHOU ✗
│     │
│     ├─► getAlertsFromCache()
│     │   │
│     │   ├─ Cache existe? ✓
│     │   │ └─ Retorna: { hits: {...}, offline: true, offlineMessage: "..." }
│     │   │
│     │   └─ Cache existe? ✗
│     │     └─ Erro 503: Service Unavailable
│     │
│     └─ Como fallback final:
│       └─ getAlertsFromCache() novamente
│
└─ UI mostra: 
  - offline: true ──► Mostra badge "📴 Modo Offline"
  - Dados em cache com idade

════════════════════════════════════════════════════════════════════
```

## Estado do Sistema

```
MATRIZ DE COMBINAÇÕES
════════════════════════════════════════════════════════════════════

┌─────────────────┬────────────┬──────────┬────────────────────────┐
│ SSH Connection  │ BD Local   │ Cache    │ Resultado              │
├─────────────────┼────────────┼──────────┼────────────────────────┤
│ ✓ Conectado     │ ✓ Sincro   │ ✓ Existe │ Dados frescos + Cache  │
│ ✓ Conectado     │ ✗ Erro     │ ✓ Existe │ Aviso + Cache salvo    │
│ ✓ Conectado     │ ✓ Sincro   │ ✗ Vazio  │ Novo cache criado      │
│ ✗ Offline       │ ✓ Sincro   │ ✓ Existe │ Offline + Cache        │
│ ✗ Offline       │ ✓ Sincro   │ ✗ Vazio  │ BD local como fallback │
│ ✗ Offline       │ ✗ Erro     │ ✓ Existe │ Offline + Cache        │
│ ✗ Offline       │ ✗ Erro     │ ✗ Vazio  │ Erro 503               │
└─────────────────┴────────────┴──────────┴────────────────────────┘

COMPORTAMENTO:
✓ = Disponível/Sucesso
✗ = Indisponível/Erro
```

## Estrutura de Cache

```
.cache/
├── alerts-cache.json          (Dados dos alertas)
│   └── {
│       "hits": {
│         "hits": [
│           {
│             "_id": "uuid-123",
│             "_source": {
│               "@timestamp": "2024-01-15T10:30:00Z",
│               "rule": { "level": 8, "name": "...", ... },
│               "agent": { "name": "agent-01" },
│               "source_ip": "192.168.1.100",
│               ...
│             }
│           },
│           ...
│         ],
│         "total": { "value": 145 }
│       },
│       "cached_at": "2024-01-15T10:30:00Z",
│       "version": "1.0"
│     }
│
└── cache-metadata.json        (Metadados)
    └── {
       "last_successful_sync": "2024-01-15T10:30:00Z",
       "last_failed_attempt": "2024-01-15T10:25:00Z",
       "sync_count": 24,
       "cache_size": 524288
      }
```

## Componentes e Módulos

```
CLIENT SIDE
───────────────────────────────────────────────────────────────
lib/storage.ts
├─ readStorageJson()      ◄─ localStorage
├─ writeStorageJson()     ◄─ localStorage
└─ clearStorageKey()      ◄─ localStorage

lib/offline-cache-client.ts
├─ useSyncAlerts()         ◄─ Hook React
├─ useGetAlerts()          ◄─ Hook React
├─ useCacheStatus()        ◄─ Hook React
└─ ExampleSyncComponent()  ◄─ Componente exemplo

components/CacheStatusIndicator.tsx
└─ Mostra: [🔵] Dados em cache: 145 alertas (5 min atrás)

components/Header.tsx
└─ Integra: CacheStatusIndicator

───────────────────────────────────────────────────────────────

SERVER SIDE
───────────────────────────────────────────────────────────────
lib/offline-cache.ts (Core)
├─ saveAlertsToCache()
├─ getAlertsFromCache()
├─ isCacheAvailable()
├─ getCacheInfo()
├─ clearCache()
└─ recordConnectionFailure()

app/api/sync-alerts/route.ts
├─ POST /api/sync-alerts
└─ Fallback: Cache offline

app/api/alerts/route.ts
├─ GET /api/alerts
├─ Flags: offline, offlineMessage
└─ Fallback: Cache offline

app/api/cache-status/route.ts
├─ GET /api/cache-status
└─ Retorna: CacheStatusResponse

───────────────────────────────────────────────────────────────

TYPES & INTERFACES
───────────────────────────────────────────────────────────────
types/offline-cache.ts
├─ CacheInfo
├─ CacheMetadata
├─ CachedAlertsData
├─ SyncAlertsResponse
├─ GetAlertsResponse
└─ CacheStatusResponse
```

## Ciclo de Vida do Cache

```
NOVA SINCRONIZAÇÃO
════════════════════════════════════════════════════════════════════

1. Usuário clica "Sincronizar"
2. POST /api/sync-alerts
3. Tenta fetchAlertsViaSSH()
   
   ├─ SSH OK ────────────────► saveAlertsToCache() ─────┐
   │                                                     │
   │                           ├─ Salva JSON            │
   │                           ├─ Atualiza metadata      │
   │                           └─ Registra timestamp     │
   │                                                     │
   └─ SSH ERRO ──► getAlertsFromCache() ──────────────┤
                                                        │
4. syncAlertsFromES() (SQLite) ◄────────────────────────┘
   
5. Retorna response com:
   - fromCache: boolean
   - cacheInfo: {...}
   
6. Cliente renderiza:
   - Se offline → mostra badge 📴
   - Mostra idade do cache
   - Carrega dados normalmente

════════════════════════════════════════════════════════════════════
```

## Fluxoglucidálógico de Decisão

```
┌─ Começar /
├─ SSH disponível?
│  ├─ SIM ────► Buscar dados (ES)
│  │           ├─ Sucesso? ──► Salvar Cache
│  │           └─ Erro? ─────► Pular salvamento
│  │
│  └─ NÃO ────► Verificar Cache?
│              ├─ Cache existe? ──► Usar Cache (offline)
│              └─ Não existe? ────► Retornar erro
│
└─ Fim
```

---

**Documentação Visual da Arquitetura**  
Atualizado: 2024-01-15
