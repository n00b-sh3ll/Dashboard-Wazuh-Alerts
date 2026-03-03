#!/usr/bin/env node

/**
 * Elasticsearch Connection Test Script
 * Testa a conexão com Elasticsearch diretamente do CLI
 * 
 * Uso: node test-elasticsearch.mjs
 * Ou: npm run test:elasticsearch
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env.local file
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '..', '.env.local')

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^['"]|['"]$/g, '')
        process.env[key] = value
      }
    }
  })
}

// Create HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 10000
})

// Configuration from .env.local
const config = {
  url: process.env.ELASTICSEARCH_URL || 'https://192.168.150.210:9200',
  username: process.env.ELASTICSEARCH_USERNAME || 'admin',
  password: process.env.ELASTICSEARCH_PASSWORD || ''
}

console.log('\n🔍 Testando conexão com Elasticsearch...\n')
console.log('Configuração:')
console.log(`  URL: ${config.url}`)
console.log(`  Usuário: ${config.username}`)
console.log(`  Senha: ${config.password ? '***' : 'não configurada'}\n`)

async function testConnection() {
  try {
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64')

    // Test basic connection
    console.log('📡 Conectando ao servidor...')
    const response = await fetch(`${config.url}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      agent: httpsAgent,
      timeout: 10000
    })

    if (!response.ok) {
      console.error(`\n❌ Erro na resposta: Status ${response.status}`)
      const text = await response.text()
      console.error('Resposta:', text)
      return false
    }

    const data = await response.json()

    console.log('✅ Conectado com sucesso!\n')
    console.log('Informações do Elasticsearch:')
    console.log(`  Nome do Node: ${data.name}`)
    console.log(`  Cluster: ${data.cluster_name}`)
    console.log(`  Versão: ${data.version.number}\n`)

    // Test cluster health
    console.log('📊 Verificando saúde do cluster...')
    const healthResponse = await fetch(`${config.url}/_cluster/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      agent: httpsAgent,
      timeout: 10000
    })

    if (healthResponse.ok) {
      const healthData = await healthResponse.json()
      console.log('✅ Status do Cluster:')
      console.log(`  Status: ${healthData.status.toUpperCase()}`)
      console.log(`  Nós Ativos: ${healthData.number_of_nodes}`)
      console.log(`  Shards: ${healthData.active_shards}\n`)
    } else {
      console.warn('⚠️  Não foi possível obter status do cluster')
    }

    console.log('✨ Conexão teste concluída com sucesso!\n')
    return true
  } catch (error) {
    console.error('\n❌ Erro durante teste:')
    if (error instanceof TypeError) {
      if (error.message.includes('fetch failed')) {
        console.error('   Erro de conexão: Verifique se a URL está correta e acessível')
      } else if (error.message.includes('timeout')) {
        console.error('   Tempo esgotado: Servidor demora para responder')
      } else {
        console.error(`   ${error.message}`)
      }
    } else if (error instanceof Error) {
      console.error(`   ${error.message}`)
    } else {
      console.error('   Erro desconhecido')
    }
    console.log('\n💡 Dicas:')
    console.log('   1. Verifique se a URL do Elasticsearch está correta')
    console.log('   2. Verifique se o servidor está rodando')
    console.log('   3. Verifique usuário e senha')
    console.log('   4. Teste com: curl -k -u admin:senha https://192.168.150.210:9200/\n')
    return false
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1)
})
