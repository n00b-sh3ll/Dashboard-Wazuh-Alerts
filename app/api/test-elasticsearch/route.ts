import { NextRequest, NextResponse } from 'next/server'
import https from 'https'

interface ElasticsearchConfig {
  url: string
  username: string
  password: string
}

interface ElasticsearchResponse {
  name: string
  cluster_name: string
  version: {
    number: string
  }
}

interface ClusterHealthResponse {
  status: string
  cluster_name: string
}

// Create HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 10000
})

/**
 * Test Elasticsearch connection
 */
export async function POST(request: NextRequest) {
  try {
    const config: ElasticsearchConfig = await request.json()

    // Validate configuration
    if (!config.url || !config.username || !config.password) {
      return NextResponse.json(
        { success: false, error: 'URL, usuário e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(config.url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'URL inválida' },
        { status: 400 }
      )
    }

    // Test connection to Elasticsearch
    try {
      // Prepare authentication header
      const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64')
      
      console.log('🔗 Testando conexão com Elasticsearch:', {
        url: config.url,
        username: config.username,
        timestamp: new Date().toISOString()
      })

      // Test basic connection with agent for self-signed certificates
      const response = await fetch(`${config.url}/`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        // @ts-ignore - Using https agent for Node.js
        agent: httpsAgent,
        timeout: 10000
      })

      if (!response.ok) {
        const errorData = await response.text()
        let errorMessage = `Erro ${response.status}`
        
        if (response.status === 401) {
          errorMessage = 'Erro de autenticação: Verifique usuário e senha'
        } else if (response.status === 403) {
          errorMessage = 'Acesso negado: Usuário sem permissões'
        } else if (response.status === 404) {
          errorMessage = 'Servidor não encontrado: Verifique a URL'
        }
        
        console.error('❌ Elasticsearch Auth Error:', {
          status: response.status,
          url: config.url,
          timestamp: new Date().toISOString()
        })
        
        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: 400 }
        )
      }

      const data: ElasticsearchResponse = await response.json()

      // Test cluster health
      let clusterHealth = 'unknown'
      try {
        const healthResponse = await fetch(`${config.url}/_cluster/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
          },
          // @ts-ignore - Using https agent for Node.js
          agent: httpsAgent,
          timeout: 10000
        })

        if (healthResponse.ok) {
          const healthData: ClusterHealthResponse = await healthResponse.json()
          clusterHealth = healthData.status
        }
      } catch (err) {
        console.warn('Erro ao obter saúde do cluster:', err)
      }

      console.log('✅ Conexão Elasticsearch estabelecida:', {
        url: config.url,
        username: config.username,
        clusterName: data.cluster_name,
        version: data.version.number,
        timestamp: new Date().toISOString()
      })

      return NextResponse.json({
        success: true,
        message: 'Conectado com sucesso ao Elasticsearch',
        clusterName: data.cluster_name,
        clusterHealth: clusterHealth,
        version: data.version.number,
        details: {
          url: config.url,
          username: config.username,
          connectedAt: new Date().toISOString()
        }
      })
    } catch (connectionError) {
      let errorMessage = 'Erro ao conectar'
      
      if (connectionError instanceof TypeError) {
        // Network errors
        if (connectionError.message.includes('fetch failed')) {
          errorMessage = 'Erro de conexão: Verifique se a URL está correta e o servidor está acessível'
        } else if (connectionError.message.includes('socket hang up')) {
          errorMessage = 'Servidor desconectou inesperadamente'
        } else if (connectionError.message.includes('timeout')) {
          errorMessage = 'Tempo esgotado: Servidor não respondeu no tempo esperado'
        } else {
          errorMessage = connectionError.message
        }
      } else if (connectionError instanceof Error) {
        errorMessage = connectionError.message
      }
      
      console.error('❌ Elasticsearch Connection Error:', {
        error: errorMessage,
        url: config.url,
        timestamp: new Date().toISOString()
      })
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      )
    }
  } catch (error) {
    let errorMessage = 'Erro desconhecido'
    
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    console.error('❌ Elasticsearch Connection Test Error:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
