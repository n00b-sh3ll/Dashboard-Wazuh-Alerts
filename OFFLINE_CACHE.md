# Sistema de Cache Offline para Alertas

## Visão Geral

O sistema de cache offline garante que os dados coletados continuem disponíveis mesmo quando há perda de conexão SSH com o servidor Wazuh. Todos os alertas sincronizados são automaticamente salvos em cache persistente.

## Como Funciona

### 1. **Sincronização Automática**
- Quando você clica em sincronizar alertas, o sistema:
  1. Tenta buscar dados do Elasticsearch via SSH
  2. Se conseguir, salva os dados em cache automaticamente
  3. Se falhar, tenta usar os dados em cache armazenados

### 2. **Fallback em Cascade**
Quando há falha na conexão SSH, o sistema segue esta ordem:

```
SSH/Elasticsearch → Cache Offline → Banco de Dados Local → Erro
```

**Rotas e Fallbacks:**

#### `/api/sync-alerts` (POST - Sincronização Manual)
- ✅ SSH conecta → Salva em cache + BD → Sucesso
- ❌ SSH falha → Usa cache → Retorna dados com `fromCache: true`
- ❌ Sem cache → Retorna erro 503

#### `/api/alerts` (GET - Buscar Alertas)
- ✅ SSH conecta → Retorna dados frescos
- ❌ SSH falha → Usa cache → Marca como `offline: true`
- ❌ Sem cache → Retorna erro 503

### 3. **Armazenamento do Cache**
O cache é armazenado em:
- **Local**: `.cache/alerts-cache.json` (no servidor)
- **Metadados**: `.cache/cache-metadata.json`

Para mudar o diretório de cache:
```bash
export CACHE_DIR=/caminho/para/cache
```

## Indicador de Status

Na barra de navegação, você verá um indicador azul que mostra:
- 📍 Status do cache
- 📊 Quantidade de alertas em cache
- ⏱️ Tempo desde o último sincronismo

## API Endpoints

### GET `/api/cache-status`
Retorna informações sobre o cache:

```json
{
  "available": true,
  "exists": true,
  "cached_at": "2024-01-15T10:30:00Z",
  "cache_age_minutes": 5,
  "items_count": 312,
  "metadata": {
    "last_successful_sync": "2024-01-15T10:30:00Z",
    "last_failed_attempt": "2024-01-15T10:25:00Z",
    "sync_count": 24,
    "cache_size": 524288
  }
}
```

## Resposta de Sincronização

Quando você sincroniza, a resposta inclui informações de cache:

```json
{
  "message": "Alerts synced successfully",
  "count": 145,
  "fromCache": false,
  "cacheInfo": {
    "exists": true,
    "cached_at": "2024-01-15T10:30:00Z",
    "cache_age_minutes": 5,
    "items_count": 145
  }
}
```

### Indicadores de Status
- `"fromCache": false` → Dados frescos do SSH/Elasticsearch
- `"fromCache": true` → Dados vieram do cache offline
- `"offline": true` (endpoint `/api/alerts`) → Modo offline ativo

## Limpeza Manual do Cache

Para limpar o cache manualmente (via terminal):

```bash
# Remover arquivo de cache
rm -f .cache/alerts-cache.json

# Remover arquivo de metadados
rm -f .cache/cache-metadata.json

# Remover diretório inteiro
rm -rf .cache
```

## Configuração

### Variáveis de Ambiente

```bash
# Diretório onde o cache será armazenado (padrão: .cache)
CACHE_DIR=/caminho/customizado/cache

# Credenciais SSH (obrigatório)
SSH_USER=usuario
SSH_HOST=192.168.150.210

# Credenciais Elasticsearch
WAZUH_ES_USER=admin
WAZUH_ES_PASSWORD=senha
```

## Logs

O sistema registra todas as operações de cache:

```
[Cache] Alertas salvos em cache (312 itens)
[API /sync-alerts] Using cached alerts due to SSH failure
[Cache] Alertas recuperados do cache (312 itens, salvo em 2024-01-15T10:30:00Z)
```

## Limitações e Considerações

1. **Tamanho do Cache**
   - O cache armazena todos os alertas sincronizados
   - Típico: ~5-10 MB para 500+ alertas

2. **Atualização**
   - O cache é atualizado apenas durante sincronização manual
   - Use o botão "Sincronizar" para obter dados novos

3. **Dados Locais**
   - Anotações (status, notas) são armazenadas em localStorage
   - Não são afetadas pela perda de conexão SSH

4. **Expiração**
   - Não há expiração automática (cache persiste indefinidamente)
   - Limpe manualmente se necessário

## Fluxo Completo

```
┌─────────────────────────────────────────────────────┐
│  Usuário clica em "Sincronizar"                     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │ Tenta SSH/ES?        │
         └──────┬───────────┬───┘
                │ ✅ Sucesso│ ❌ Falha
                ▼           ▼
        ┌─────────────┐  ┌────────────────┐
        │  Savein     │  │ Tém Cache?     │
        │  Cache + BD │  └────┬───────┬──┘
        └─────────────┘       │ ✅    │ ❌
              │               ▼       ▼
              │           ┌───────┐ ┌─────────┐
              │           │ Usar  │ │ Erro:   │
              │           │ Cache │ │ 503     │
              │           └───────┘ └─────────┘
              │               │
              └───────┬───────┘
                      ▼
            ┌──────────────────┐
            │ Retornar Alertas │
            │ + Info Cache     │
            └──────────────────┘
```

## Troubleshooting

### Cache não está sendo salvo
- Verificar se `.cache/` diretório existe e é gravável
- Verificar permissões: `ls -la .cache/`
- Verificar logs do servidor para erros

### Dados desatualizados
- O cache só é atualizado em sincronização bem-sucedida
- Clique em "Sincronizar" para obter dados novos
- Se SSH estiver indisponível, o cache permanece inalterado

### Limpar dados antigos
```bash
# Remover cache completamente
rm -rf .cache/

# Na próxima sincronização, novo cache será criado
```

## Desenvolvimento

Para testar o sistema localmente:

```typescript
// Simular falha SSH (em desenvolvimento)
import { getAlertsFromCache } from '@/lib/offline-cache'

const cached = getAlertsFromCache()
console.log('Dados em cache:', cached)
```

## Segurança

- Cache é armazenado em arquivo local (`.cache/`)
- Não contém credenciais
- Acesso restrito ao servidor Node.js
- Dados sensíveis: proteja o diretório `.cache/` com permissões apropriadas

```bash
chmod 700 .cache/
```
