#!/bin/bash
# Script para testar o sistema de cache offline

set -e

echo "🔍 Testando Sistema de Cache Offline..."
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:3000}"
CACHE_DIR=".cache"

# Teste 1: Verificar se o diretório de cache existe
echo "[Teste 1] Verificando diretório de cache..."
if [ -d "$CACHE_DIR" ]; then
  echo -e "${GREEN}✓${NC} Diretório de cache encontrado: $CACHE_DIR"
else
  echo -e "${YELLOW}⚠${NC} Diretório de cache não encontrado (será criado na primeira sincronização)"
fi

# Teste 2: Verificar status do cache via API
echo ""
echo "[Teste 2] Consultando status do cache..."
CACHE_STATUS=$(curl -s "$API_URL/api/cache-status")

if [ -z "$CACHE_STATUS" ] || [ "$CACHE_STATUS" = "{}" ]; then
  echo -e "${RED}✗${NC} Não foi possível conectar à API"
  echo "  Certifique-se que o servidor está rodando em $API_URL"
  exit 1
fi

echo -e "${GREEN}✓${NC} Cache Status:"
echo "$CACHE_STATUS" | jq '.' 2>/dev/null || echo "$CACHE_STATUS"

# Teste 3: Testar sincronização
echo ""
echo "[Teste 3] Testando sincronização de alertas..."
echo "  (Nota: Isso pode falhar se SSH não estiver disponível)"

SYNC_RESPONSE=$(curl -s -X POST "$API_URL/api/sync-alerts" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}')

echo -e "${GREEN}✓${NC} Resposta de sincronização:"
echo "$SYNC_RESPONSE" | jq '.' 2>/dev/null || echo "$SYNC_RESPONSE"

# Teste 4: Testar busca de alertas
echo ""
echo "[Teste 4] Testando busca de alertas..."
ALERTS_RESPONSE=$(curl -s "$API_URL/api/alerts?limit=5&useDB=false")

if echo "$ALERTS_RESPONSE" | grep -q "offline"; then
  echo -e "${YELLOW}⚠${NC} Sistema está em modo OFFLINE"
  echo "  (Usando dados em cache)"
else
  echo -e "${GREEN}✓${NC} Sistema ONLINE"
fi

echo "$ALERTS_RESPONSE" | jq '.hits.hits | length' 2>/dev/null | xargs echo "  Alertas recuperados:"

# Teste 5: Verificar arquivos de cache
echo ""
echo "[Teste 5] Verificando arquivos de cache..."

if [ -f "$CACHE_DIR/alerts-cache.json" ]; then
  SIZE=$(du -h "$CACHE_DIR/alerts-cache.json" | cut -f1)
  COUNT=$(jq '.hits.hits | length' "$CACHE_DIR/alerts-cache.json" 2>/dev/null || echo "?")
  echo -e "${GREEN}✓${NC} Cache de alertas encontrado"
  echo "  Tamanho: $SIZE"
  echo "  Alertas: $COUNT"
else
  echo -e "${YELLOW}⚠${NC} Cache de alertas não encontrado"
fi

if [ -f "$CACHE_DIR/cache-metadata.json" ]; then
  echo -e "${GREEN}✓${NC} Metadados do cache encontrados"
  jq '.' "$CACHE_DIR/cache-metadata.json" 2>/dev/null
else
  echo -e "${YELLOW}⚠${NC} Metadados do cache não encontrados"
fi

echo ""
echo -e "${GREEN}✅ Testes concluídos!${NC}"
echo ""
echo "Dicas:"
echo "  - Verifique os logs do servidor para mais detalhes"
echo "  - Use 'jq' para uma melhor visualização do JSON"
echo "  - Cache funciona automaticamente em caso de falha SSH"
echo ""
