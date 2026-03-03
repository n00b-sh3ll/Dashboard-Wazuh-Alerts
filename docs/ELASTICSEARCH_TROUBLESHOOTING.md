# 🔍 Guia de Troubleshooting - Conexão Elasticsearch

## Problema: "Falha na conexão: fetch failed"

Este erro ocorre quando o cliente não consegue se conectar ao servidor Elasticsearch. Existem várias causas possíveis:

### 1. **Verificar se o Elasticsearch está rodando**

```bash
# Teste a conexão com curl (mais detalhado que o script)
curl -k -u admin:"SUA_SENHA" https://192.168.150.210:9200/
```

**Possíveis respostas:**
- ✅ JSON com informações do Elasticsearch → Serviço está rodando
- ❌ `Couldn't connect to server` → Serviço não está rodando ou IP errado
- ❌ `Connection refused` → Porta errada
- ❌ `401 Unauthorized` → Credenciais inválidas

### 2. **Verificar Conectividade de Rede**

```bash
# Teste ping para o servidor
ping 192.168.150.210

# Teste conexão na porta 9200
nc -zv 192.168.150.210 9200

# Ou usando curl para testar apenas a conexão
curl -I https://192.168.150.210:9200/ --connect-timeout 5
```

### 3. **Verificar no Dashboard**

Use o script CLI para diagnosticar:

```bash
npm run test:elasticsearch
```

Este script:
- Carrega configurações do `.env.local`
- Ignora certificados auto-assinados (como o app faz)
- Mostra logs detalhados do que está acontecendo

### 4. **Verificar Configurações no `.env.local`**

```dotenv
ELASTICSEARCH_URL=https://192.168.150.210:9200
ELASTICSEARCH_USERNAME=admin
ELASTICSEARCH_PASSWORD=SmiPV2J7d8L?j26RfkLkRDC?Sa.7JZB8
```

⚠️ **Importante:**
- URL deve incluir `https://`
- URL deve incluir a porta (9200)
- Não incluir barras extras: `https://host:9200` ✅ (NÃO `https://host:9200/`)
- Verificar se não há caracteres especiais sendo escapados incorretamente

### 5. **Problema Comum: Certificado SSL Auto-Assinado**

O Elasticsearch usa certificado auto-assinado. O app está configurado para aceitar, mas às vezes pode não funcionar:

```bash
# Teste com -k (insecure) para ignorar cert
curl -k -u admin:"SENHA" https://192.168.150.210:9200/

# Se funciona com -k mas não no app, pode ser problema de agent
```

**Solução no app:** O endpoint `/api/test-elasticsearch` já inclui:
```typescript
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Ignora certs auto-assinados
  keepAlive: true,
  timeout: 10000
})
```

### 6. **Problema: Timeout (Servidor lento)**

Se o teste demora muito ou diz "Tempo esgotado":

```bash
# Teste se ping responde rapidamente
ping 192.168.150.210

# Verifique recursos do servidor (se tiver acesso SSH)
ssh usuario@192.168.150.210
free -h
top
```

### 7. **Problema: Credenciais Inválidas**

Se receber "Erro de autenticação: Verifique usuário e senha":

```bash
# Teste as credenciais
curl -k -u admin:"SENHA" https://192.168.150.210:9200/

# Deve retornar JSON, não erro 401
```

### 8. **Usando o Painel Admin**

Na página `/admin`:

1. Vá para seção **🔍 Configurações Elasticsearch**
2. Preencha:
   - URL do Elasticsearch: `https://192.168.150.210:9200`
   - Usuário: `admin`
   - Senha: (copie de `.env.local`)
3. Clique em **💾 Salvar Configuração**
4. Clique em **🔗 Testar Conexão**

**Mensagens esperadas:**
- ✅ "Conexão SSH estabelecida com sucesso!" → Tudo OK
- ❌ "Erro de conexão: Verifique se a URL..." → Problema de rede
- ❌ "Erro de autenticação: Verifique usuário..." → Credenciais erradas

### 9. **Debug Avançado**

Se nada funcionar, inicie o dev server e verifique os logs:

```bash
npm run dev

# Em outra aba, rode o teste
npm run test:elasticsearch

# Verifique os logs do terminal onde npm run dev está rodando
```

O app logará erros detalhados como:
```
❌ Elasticsearch Connection Error: {
  error: 'Couldn\'t connect to server',
  url: 'https://192.168.150.210:9200',
  timestamp: '2026-03-02T...'
}
```

### 10. **Checklist Final**

- [ ] Elasticsearch está rodando: `curl -k -u admin:SENHA https://IP:9200/`
- [ ] IP está correto no `.env.local`
- [ ] Porta é 9200 (padrão)
- [ ] Usuário e senha estão corretos
- [ ] Rede consegue ping para o IP
- [ ] Firewall não está bloqueando porta 9200
- [ ] Dados foram salvos no admin panel antes de testar

## Contato para Problemas Persistentes

Se após seguir este guia ainda tiver problemas:

1. Verifique logs do Elasticsearch:
   ```bash
   ssh usuario@192.168.150.210
   tail -f /var/log/elasticsearch/elasticsearch.log
   ```

2. Verifique se Elasticsearch está em modo seguro (Xpack):
   - Pode exigir configuração extra
   - Documentação: https://www.elastic.co/guide/en/elasticsearch/reference/current/setup-xpack.html

3. Considere usar acesso via SSH tunnel se está em rede diferente:
   ```bash
   ssh -L 9200:localhost:9200 usuario@192.168.150.210
   ```
   Depois use `https://localhost:9200` no admin panel
