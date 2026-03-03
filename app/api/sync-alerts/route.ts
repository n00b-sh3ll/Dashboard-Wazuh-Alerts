import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import {
  saveAlertsToCache,
  getAlertsFromCache,
  recordConnectionFailure,
  getCacheInfo,
} from '@/lib/offline-cache'
import { logError, logSSHConnection } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const limit = body.limit || 500

    // Tentar buscar alertas do Elasticsearch
    let alertsData: any = null
    let fromCache = false
    let connectionError: string | null = null

    try {
      alertsData = await fetchAlertsViaSSH(limit)

      if (!alertsData.hits?.hits || alertsData.hits.hits.length === 0) {
        // Tentar usar cache se não houver alertas
        const cachedData = getAlertsFromCache()
        if (cachedData) {
          console.log('[API /sync-alerts] No new alerts, using cached data')
          alertsData = cachedData
          fromCache = true
        } else {
          return NextResponse.json({ message: 'No alerts to sync', count: 0 })
        }
      } else {
        // Salvar alertas bem-sucedidos em cache
        saveAlertsToCache(alertsData)
        
        // Log successful SSH connection
        const sshHost = process.env.SSH_HOST || '192.168.150.210'
        const sshUser = process.env.SSH_USER || 'usuario'
        logSSHConnection(true, sshHost, sshUser)
      }
    } catch (sshErr: any) {
      // SSH falhou - tentar usar cache
      connectionError = sshErr?.message
      console.warn('[API /sync-alerts] SSH connection failed, attempting fallback to cache...')
      
      // Log SSH connection failure
      const sshHost = process.env.SSH_HOST || '192.168.150.210'
      const sshUser = process.env.SSH_USER || 'usuario'
      logSSHConnection(false, sshHost, sshUser, connectionError || 'Unknown SSH error')
      logError('SSH_FETCH_FAILED', `Failed to fetch alerts via SSH: ${connectionError}`, 503, {
        host: sshHost,
        user: sshUser
      })
      
      recordConnectionFailure()

      const cachedData = getAlertsFromCache()
      if (cachedData) {
        console.log('[API /sync-alerts] Using cached alerts due to SSH failure')
        alertsData = cachedData
        fromCache = true
      } else {
        // Nenhum cache disponível
        return NextResponse.json(
          {
            error: 'SSH connection failed and no cached data available',
            connectionError: connectionError,
            cacheInfo: getCacheInfo(),
          },
          { status: 503 } // Service Unavailable
        )
      }
    }

    // Se chegou aqui, tem dados (seja do SSH ou do cache)
    if (!alertsData.hits?.hits || alertsData.hits.hits.length === 0) {
      return NextResponse.json({ message: 'No alerts available', count: 0 })
    }

    // Tentar sincronizar para o banco de dados SQLite
    try {
      const { syncAlertsFromES } = await import('@/lib/db')
      const result = await syncAlertsFromES(alertsData.hits.hits)

      return NextResponse.json({
        message: 'Alerts synced successfully',
        count: result.count,
        total: alertsData.hits?.total?.value ?? alertsData.hits?.total ?? 0,
        fromCache,
        cacheInfo: getCacheInfo(),
      })
    } catch (dbErr: any) {
      // Se SQLite falhar, retornar resposta com aviso
      console.warn('[API /sync-alerts] Database sync failed:', dbErr?.message)
      return NextResponse.json(
        {
          message: 'Alerts fetched but database sync failed',
          warning: dbErr?.message,
          count: alertsData.hits.hits.length,
          total: alertsData.hits?.total?.value ?? alertsData.hits?.total ?? 0,
          fromCache,
          cacheInfo: getCacheInfo(),
        },
        { status: 206 } // Partial Content
      )
    }
  } catch (err: any) {
    console.error('[API /sync-alerts] Error:', err)
    return NextResponse.json(
      {
        error: err?.message || String(err),
        errorDetails: String(err).substring(0, 200),
        cacheInfo: getCacheInfo(),
      },
      { status: 500 }
    )
  }
}

// Helper to fetch alerts via SSH on the server
async function fetchAlertsViaSSH(limit: number) {
  const sshUser = process.env.SSH_USER || 'usuario'
  const sshHost = process.env.SSH_HOST || '192.168.150.210'
  const esUser =
    process.env.WAZUH_ES_USER ||
    process.env.ELASTICSEARCH_USERNAME ||
    process.env.WAZUH_USERNAME
  const esPassword =
    process.env.WAZUH_ES_PASSWORD ||
    process.env.ELASTICSEARCH_PASSWORD ||
    process.env.WAZUH_PASSWORD

  if (!esUser || !esPassword) {
    throw new Error(
      'Missing Elasticsearch credentials. Set WAZUH_ES_USER/WAZUH_ES_PASSWORD or ELASTICSEARCH_USERNAME/ELASTICSEARCH_PASSWORD'
    )
  }

  const levelFilter = `{"range":{"rule.level":{"gte":5}}}`

  const shellScript = `ssh -n -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${sshUser}@${sshHost} 'python3 << PYTHONEOF
import requests,json
from urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)
try:
    r=requests.post("https://localhost:9200/wazuh-alerts-*/_search",auth=("${esUser}","${esPassword}"),json={"query":{"bool":{"filter":[${levelFilter}]}},"size":${limit},"sort":[{"@timestamp":{"order":"desc"}}]},verify=False,timeout=30)
    result=r.json()
    print(json.dumps({"hits":{"hits":result.get("hits",{}).get("hits",[]),"total":result.get("hits",{}).get("total",{})}}))
except Exception as e:
    import sys
    print(json.dumps({"error":str(e)}),file=sys.stderr)
    sys.exit(1)
PYTHONEOF
'`

  try {
    const result = execSync(shellScript, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/bash',
      env: { ...process.env },
    })
    return JSON.parse(result)
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown SSH command error'
    console.error('[SSH] SSH command failed:', errorMsg)
    
    // Log the SSH command failure
    logError('SSH_COMMAND_FAILED', errorMsg, 500, {
      host: sshHost,
      user: sshUser,
      stderr: err.stderr?.toString() || 'No stderr output'
    })
    
    throw new Error(`SSH fetch failed: ${errorMsg}`)
  }
}
