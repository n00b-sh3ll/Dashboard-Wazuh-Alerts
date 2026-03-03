# Logs Directory

Este diretório armazena todos os logs da aplicação:

## Estrutura

- `audit/` - Logs de auditoria para ações de usuários e alterações de configuração
- `errors/` - Logs de erros para falhas do sistema e erros de API

## Formato dos Logs

Os logs são organizados por data no formato:
- `audit-YYYY-MM-DD.log` - Logs de auditoria
- `error-YYYY-MM-DD.log` - Logs de erros

Cada entrada de log é um objeto JSON com timestamp e informações relevantes.

## Exemplo de Entrada de Log

```json
{
  "timestamp": "2026-03-03T01:00:00.000Z",
  "action": "SSH_CONNECTION_SUCCESS",
  "userId": "user123",
  "ipAddress": "192.168.1.1",
  "details": {
    "ip": "192.168.1.100",
    "username": "root",
    "authType": "password"
  }
}
```

## Observações

- Os arquivos de log (*.log) não são versionados no Git (ver .gitignore)
- Os logs são criados automaticamente quando necessário
- Logs antigos podem ser removidos manualmente ou usando a função `clearOldLogs()` do logger
