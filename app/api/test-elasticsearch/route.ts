import { NextRequest, NextResponse } from 'next/server'

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
      
      // Test basic connection
      const response = await fetch(`${config.url}/`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.text()
        return NextResponse.json(
          { success: false, error: `Erro de autenticação ou conexão: ${response.status}` },
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
          }
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
      const errorMessage = connectionError instanceof Error 
        ? connectionError.message 
        : 'Erro ao conectar'
      
      return NextResponse.json(
        { success: false, error: `Falha na conexão: ${errorMessage}` },
        { status: 400 }
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('❌ Elasticsearch Connection Test Error:', errorMessage)

    return NextResponse.json(
      { success: false, error: `Erro ao testar conexão: ${errorMessage}` },
      { status: 500 }
    )
  }
}
