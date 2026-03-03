# 🚀 Quick Start - Cache Offline

## 5 Minutos para Começar

### 1. Instalação (Nenhuma!)
O sistema é totalmente integrado. Nenhuma dependência extra necessária.

```bash
# O projeto já tem tudo que precisa:
# - Node.js filesystem (para cache no servidor)
# - localStorage (para dados no cliente)
# - Next.js API routes (para endpoints)
```

### 2. Configuração Básica
Copie o arquivo `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Adicione as variáveis necessárias:

```bash
# SSH
SSH_USER=usuario
SSH_HOST=192.168.150.210

# Elasticsearch (obrigatório)
WAZUH_ES_USER=seu_usuario
WAZUH_ES_PASSWORD=sua_senha

# Opcional - cache dir (padrão: .cache)
CACHE_DIR=.cache
```

### 3. Primeiro Uso

#### Sincronizar Alertas
Acesse o Dashboard e clique no botão "Sincronizar". O sistema:
- ✅ Tenta buscar dados do SSH/Elasticsearch
- ✅ Se conseguir, salva automaticamente em cache
- ✅ Se falhar, usa dados em cache (se existir)

#### Verificar Status do Cache
Olhe para a barra de navegação no topo da página. Você verá:

```
🔵 Dados em cache: 145 alertas (5 min atrás)
```

#### Testar Offline
```bash
# Teste o sistema (requer jq instalado)
chmod +x test-offline-cache.sh
./test-offline-cache.sh
```

### 4. APIs Disponíveis

#### Sincronizar Alertas
```bash
curl -X POST http://localhost:3000/api/sync-alerts \
  -H "Content-Type: application/json" \
  -d '{"limit": 500}'
```

**Resposta:**
```json
{
  "message": "Alerts synced successfully",
  "count": 145,
  "fromCache": false,
  "cacheInfo": {
    "exists": true,
    "items_count": 145,
    "cache_age_minutes": 0
  }
}
```

#### Buscar Alertas
```bash
# Online (SSH conectado)
curl http://localhost:3000/api/alerts?limit=50

# Modo banco de dados local
curl "http://localhost:3000/api/alerts?useDB=true&limit=50"
```

#### Status do Cache
```bash
curl http://localhost:3000/api/cache-status | jq
```

**Resposta:**
```json
{
  "available": true,
  "exists": true,
  "cached_at": "2024-01-15T10:30:00Z",
  "cache_age_minutes": 5,
  "items_count": 145,
  "metadata": {
    "last_successful_sync": "2024-01-15T10:30:00Z",
    "sync_count": 24
  }
}
```

### 5. Usar em Componentes React

#### Com Hooks
```tsx
import { useSyncAlerts, useGetAlerts } from '@/lib/offline-cache-client'

export function MyComponent() {
  const { sync, syncing, syncResult } = useSyncAlerts()
  const { alerts, offline, fetch } = useGetAlerts()

  const handleSync = async () => {
    await sync(500)
    await fetch(50, 0)
  }

  return (
    <div>
      <button onClick={handleSync} disabled={syncing}>
        {syncing ? 'Sincronizando...' : 'Sincronizar'}
      </button>
      
      {offline && <p>📴 Usando cache offline</p>}
      {syncResult?.fromCache && <p>✓ Dados em cache</p>}
      
      <ul>
        {alerts.map(alert => (
          <li key={alert._id}>{alert._source?.rule?.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

#### Com Fetch Direto
```typescript
// Sincronizar
const response = await fetch('/api/sync-alerts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 500 })
})
const data = await response.json()
console.log(data.fromCache) // true se em cache

// Buscar
const alertsResponse = await fetch('/api/alerts?limit=50')
const alerts = await alertsResponse.json()
console.log(alerts.offline) // true se em cache
```

### 6. Indicadores Visuais

#### Na Barra de Navegação
```
┌─ Wazuh Alerts ──────────────────────────────────────────┐
│                   🔵 Dados em cache: 145 alertas (5min) │
└─────────────────────────────────────────────────────────┘
```

#### Na Resposta de API
```json
{
  "offline": true,
  "offlineMessage": "Serving cached data due to unavailable SSH connection",
  "fromCache": true
}
```

### 7. Troubleshooting Rápido

**Cache não está salvando?**
```bash
# Verificar permissões
ls -la .cache/

# Criar se não existir
mkdir -p .cache/
chmod 755 .cache/
```

**Dados desatualizados?**
```bash
# Remover cache (será recriado na próxima sincronização)
rm -rf .cache/
```

**Ver conteúdo do cache?**
```bash
# Alertas em cache
jq '.' .cache/alerts-cache.json | head -20

# Metadados
jq '.' .cache/cache-metadata.json
```

### 8. Arquivos Importantes

```
Código Principal:
├── lib/offline-cache.ts              ← Core do cache offline
├── app/api/sync-alerts/route.ts      ← Endpoint de sincronização
├── app/api/alerts/route.ts           ← Endpoint de busca
└── app/api/cache-status/route.ts     ← Endpoint de status

Componentes:
├── components/CacheStatusIndicator.tsx  ← Indicador visual
└── components/Header.tsx                ← Barra com status

Tipos:
└── types/offline-cache.ts           ← Interfaces TypeScript

Documentação:
├── OFFLINE_CACHE.md                 ← Guia detalhado
├── ARCHITECTURE.md                  ← Arquitetura visual
└── OFFLINE_IMPLEMENTATION.md        ← Resumo de implementação

Testes:
└── test-offline-cache.sh            ← Script de teste
```

### 9. Fluxo Típico de Uso

```
1. Usuário abre Dashboard
   └─ CacheStatusIndicator carrega status do cache

2. Clica em "Sincronizar"
   ├─ Tenta conectar SSH
   ├─ Se OK → Busca dados, salva em cache
   ├─ Se erro → Usa cache existente
   └─ Mostra resultado

3. Alertas são exibidos
   └─ Se offline → Mostra badge "📴"

4. Usuário navega
   └─ Alterações locais (status, notas) são salvas em localStorage
```

### 10. Performance

**Cache típico:**
- Tamanho: 5-10 MB para 500+ alertas
- Tempo de carregamento: <100ms
- Memória: Minimal (arquivo carregado sob demanda)

**Sincronização:**
- Com SSH ativo: ~5-15 segundos
- Fallback para cache: instantâneo
- Atualização UI: <1 segundo

### 11. Quando o Sistema Usa o Cache

✅ **Automático (sem ação do usuário):**
- Perda de conexão SSH durante sincronização
- Servidor Elasticsearch indisponível
- Timeout na conexão SSH

✅ **Manual:**
- Clique em "Sincronizar" quando offline
- Acesse Dashboard sem conexão
- Busque alertas sem Internet

### 12. Próximos Passos

Após entender o básico:

1. **Ler a documentação completa:**
   - [OFFLINE_CACHE.md](./OFFLINE_CACHE.md) - Funcionalidades
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - Como funciona internamente

2. **Integrar em seus componentes:**
   - Ver exemplos em `lib/offline-cache-client.tsx`
   - Usar hooks `useSyncAlerts()`, `useGetAlerts()`

3. **Monitorar em produção:**
   - Usar `/api/cache-status` para alertas
   - Verificar logs no console do servidor

4. **Customizar conforme necessário:**
   - Alterar diretório de cache (CACHE_DIR)
   - Ajustar intervalo de atualização de status (30s padrão)
   - Adicionar notificações customizadas

---

## Cheat Sheet

```bash
# Verificar cache
curl http://localhost:3000/api/cache-status | jq

# Sincronizar
curl -X POST http://localhost:3000/api/sync-alerts \
  -H "Content-Type: application/json" \
  -d '{"limit": 500}'

# Buscar alertas
curl "http://localhost:3000/api/alerts?limit=50&useDB=false"

# Limpar cache
rm -rf .cache/

# Testar sistema completo
./test-offline-cache.sh

# Ver logs do cache
tail -f ~/.pm2/logs/app-error.log | grep Cache
```

---

**Status**: ✅ Pronto para Produção  
**Versão**: 1.0  
**Data**: 2024-01-15
