# Sistema de Cache Offline - Resumo de Implementação

## 🎯 Objetivo
Implementar disponibilidade offline dos dados de alertas coletados, garantindo que a aplicação funcione mesmo quando há perda de conexão SSH com o servidor Wazuh.

## ✅ O que foi implementado

### 1. **Módulo de Cache Offline** 
📁 `lib/offline-cache.ts`
- Armazenamento persistente de alertas em arquivo JSON
- Funções de leitura/escrita de cache
- Rastreamento de metadados (sincronizações, falhas)
- Gerenciamento de cache (verificação, limpeza)

**Principais funções:**
```typescript
saveAlertsToCache(data)           // Salva alertas em cache
getAlertsFromCache()              // Recupera alertas do cache
isCacheAvailable()                // Verifica se cache existe
getCacheInfo()                    // Retorna informações do cache
clearCache()                      // Remove cache
recordConnectionFailure()         // Registra tentativa de conexão falhada
```

### 2. **Rotas API com Fallback Offline**

#### `/api/sync-alerts` (POST)
📁 `app/api/sync-alerts/route.ts`
- ✅ Busca alertas via SSH/ES
- ✅ Salva em cache automaticamente quando bem-sucedido
- ❌ Se SSH falhar, retorna dados em cache
- 📊 Inclui status do cache na resposta

**Resposta:**
```json
{
  "message": "Alerts synced successfully",
  "count": 145,
  "fromCache": false,
  "cacheInfo": {...}
}
```

#### `/api/alerts` (GET)
📁 `app/api/alerts/route.ts`
- ✅ Busca alertas via SSH/ES
- ❌ Se SSH falhar, retorna dados em cache com flag `offline: true`
- 📊 Inclui informações de cache na resposta

**Resposta em offline:**
```json
{
  "hits": {...},
  "offline": true,
  "offlineMessage": "Serving cached data due to unavailable SSH connection",
  "cacheInfo": {...}
}
```

#### `/api/cache-status` (GET)
📁 `app/api/cache-status/route.ts`
- Retorna informações sobre estado do cache
- Inclui metadados de sincronizações
- Atualizado automaticamente

### 3. **Componentes de UI**

#### CacheStatusIndicator
📁 `components/CacheStatusIndicator.tsx`
- Indicador visual na barra de navegação
- Mostra quantidade de alertas em cache
- Exibe tempo desde último sincronismo
- Atualiza a cada 30 segundos

#### Header Atualizado
📁 `components/Header.tsx`
- Integração do indicador de cache
- Status visual em tempo real

### 4. **Sistema de Tipos**
📁 `types/offline-cache.ts`
```typescript
interface CacheInfo { ... }
interface SyncAlertsResponse { ... }
interface GetAlertsResponse { ... }
interface CacheStatusResponse { ... }
```

### 5. **Utilitários para Cliente**
📁 `lib/offline-cache-client.ts`
- Hooks React para sincronização
- Hooks para busca com suporte offline
- Hooks para status do cache
- Exemplos de uso e componentes

**Hooks disponíveis:**
```typescript
useSyncAlerts()      // Para sincronizar alertas
useGetAlerts()       // Para buscar alertas
useCacheStatus()     // Para status do cache
```

### 6. **Documentação**
📁 `OFFLINE_CACHE.md`
- Guia completo de uso
- Explicação de funcionamento
- Configuração e variáveis de ambiente
- Troubleshooting
- Exemplos práticos

### 7. **Script de Teste**
📁 `test-offline-cache.sh`
- Testa conectividade da API
- Verifica status do cache
- Testa sincronização
- Valida arquivos de cache

## 🔄 Fluxo de Funcionamento

```
Usuario clica "Sincronizar"
         ↓
   Tenta SSH/ES
    ✓ Sucesso  ✗ Erro
        ↓       ↓
    Salva  Tem Cache?
    Cache     ✓ ✗
        ↓      ↓
    Retorna  Retorna  Retorna
    Dados    Cache    Erro 503
```

## 📁 Estrutura de Arquivos Criados/Modificados

### Novos Arquivos
```
lib/offline-cache.ts                  # Core do sistema offline
lib/offline-cache-client.ts           # Hooks e utilitários
app/api/cache-status/route.ts        # Endpoint de status
components/CacheStatusIndicator.tsx   # Componente de status
types/offline-cache.ts                # Tipos TypeScript
OFFLINE_CACHE.md                      # Documentação completa
test-offline-cache.sh                 # Script de teste
```

### Arquivos Modificados
```
lib/storage.ts                        # Adicionado writeStorageJson, clearStorageKey
app/api/sync-alerts/route.ts         # Integrado cache offline
app/api/alerts/route.ts              # Integrado cache offline
components/Header.tsx                 # Adicionado CacheStatusIndicator
```

## 🚀 Como Usar

### 1. **Sincronização Manual**
```javascript
const response = await fetch('/api/sync-alerts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 500 })
})
const data = await response.json()
console.log(data.fromCache) // true se veio de cache
```

### 2. **Hook React**
```typescript
const { sync, syncing, syncResult } = useSyncAlerts()
await sync(500)
if (syncResult?.fromCache) {
  console.log('Dados em cache!')
}
```

### 3. **Verificar Status**
```javascript
const status = await fetch('/api/cache-status').then(r => r.json())
console.log(status.items_count) // Alertas em cache
console.log(status.cache_age_minutes) // Tempo desde último sync
```

## ⚙️ Configuração

Variáveis de ambiente:
```bash
# Diretório de cache (padrão: .cache)
CACHE_DIR=/path/to/cache

# SSH (obrigatório)
SSH_USER=usuario
SSH_HOST=192.168.150.210

# Elasticsearch
WAZUH_ES_USER=admin
WAZUH_ES_PASSWORD=senha
```

## 📊 Armazenamento

O cache é armazenado em:
- `.cache/alerts-cache.json` - Dados dos alertas
- `.cache/cache-metadata.json` - Metadados

Tamanho típico: 5-10 MB para 500+ alertas

## 🧪 Testando

```bash
# Executar script de teste
chmod +x test-offline-cache.sh
./test-offline-cache.sh

# Ou manualmente
curl http://localhost:3000/api/cache-status | jq
curl -X POST http://localhost:3000/api/sync-alerts \
  -H "Content-Type: application/json" \
  -d '{"limit": 500}'
```

## 🔒 Segurança

- Cache armazenado localmente (não viaja na rede)
- Sem credenciais no cache
- Acesso restrito ao servidor Node.js
- Recomendado: `chmod 700 .cache/`

## 🐛 Troubleshooting

**Cache não está sendo salvo:**
- Verificar permissões do diretório `.cache/`
- Verificar espaço em disco
- Conferir logs do servidor

**Dados desatualizados:**
- Cache só atualiza em sincronização bem-sucedida
- Clique em "Sincronizar" para obter dados novos
- SSH em falha = cache permanece inalterado

**Limpar cache:**
```bash
rm -rf .cache/
```

## 📈 Métricas de Cache

Para cada sincronização:
- `last_successful_sync` - Última sincronização bem-sucedida
- `last_failed_attempt` - Última tentativa falhada
- `sync_count` - Total de sincronizações
- `cache_size` - Tamanho do arquivo em bytes

## 🎉 Benefícios

✅ **Disponibilidade**: Funciona sem conexão SSH  
✅ **Experiência**: Interface ágil com dados locais  
✅ **Resilência**: Fallback automático em caso de erro  
✅ **Transparência**: Usuário sabe quando está offline  
✅ **Dados**: Nunca perde informações já sincronizadas  
✅ **Extensível**: Fácil de integrar em novos componentes  

## 📝 Notas Importantes

1. Cache é atualizado apenas em sincronizações bem-sucedidas
2. Anotações locais (status, notas) não dependem do cache
3. Sem expiração automática - limpe manualmente se necessário
4. Cache é por-servidor, não sincroniza entre instâncias

---

**Status**: ✅ Implementado e Testado  
**Data**: 2024-01-15  
**Compatibilidade**: Next.js 13+ com Node.js
