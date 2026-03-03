"use client"

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import ProtectedRoute from '@/components/ProtectedRoute'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

export default function ReportPage() {
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<any[]>([])
  const [totalAlerts, setTotalAlerts] = useState(0)
  const [levelFilter, setLevelFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [availableAgents, setAvailableAgents] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [query, setQuery] = useState('')

  const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const formatInputDate = (value: string) => {
    if (!value) return '...'
    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
  }

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Buscar todos os alertas em lotes para evitar truncamento em 500
        const batchSize = 500
        // Elasticsearch geralmente limita paginação por from/size em 10k (max_result_window)
        const maxAlerts = 10000
        let offset = 0
        let alerts: any[] = []
        let totalFromApi: number | null = null

        while (offset < maxAlerts) {
          const params = new URLSearchParams()
          params.set('limit', String(batchSize))
          params.set('offset', String(offset))
          if (levelFilter) params.set('level', levelFilter)

          const res = await fetch(`/api/alerts?${params.toString()}`)
          if (!res.ok) {
            // Mantém os lotes já coletados em vez de zerar tudo se algum lote falhar
            break
          }

          const data = await res.json()
          const hits = Array.isArray(data?.hits?.hits) ? data.hits.hits : []

          if (totalFromApi === null) {
            totalFromApi = data?.hits?.total?.value ?? data?.hits?.total ?? null
          }

          if (hits.length === 0) break

          alerts = alerts.concat(hits.map((hit: any) => hit._source))
          offset += hits.length

          if (hits.length < batchSize) break
          if (totalFromApi !== null && offset >= totalFromApi) break
        }

        // Extrair agentes únicos
        const agentSet = new Set<string>()
        alerts.forEach(alert => {
          const agentName = alert.agent?.name
          if (agentName) agentSet.add(agentName)
        })
        setAvailableAgents(Array.from(agentSet).sort())

        // Filtrar por agente se necessário
        let filteredAlerts = alerts
        if (agentFilter) {
          filteredAlerts = filteredAlerts.filter(alert => alert.agent?.name === agentFilter)
        }

        // Filtrar por período se necessário
        if (startDate || endDate) {
          const startBoundary = startDate
            ? new Date(parseLocalDate(startDate).setHours(0, 0, 0, 0))
            : null
          const endBoundary = endDate
            ? new Date(parseLocalDate(endDate).setHours(23, 59, 59, 999))
            : null

          filteredAlerts = filteredAlerts.filter(alert => {
            const alertDate = new Date(alert['@timestamp'] || alert.timestamp)

            if (startBoundary && alertDate < startBoundary) return false
            if (endBoundary && alertDate > endBoundary) return false
            return true
          })
        }

        // Filtrar por query (case-insensitive)
        if (query && query.trim()) {
          const searchTerm = query.trim().toLowerCase()
          filteredAlerts = filteredAlerts.filter(alert => {
            const description = (alert.rule?.description || '').toLowerCase()
            return description.includes(searchTerm)
          })
        }

        setTotalAlerts(filteredAlerts.length)

        // Contar descrições de alertas
        const descriptionCount: Record<string, number> = {}
        
        filteredAlerts.forEach(alert => {
          const description = alert.rule?.description || 'Sem descrição'
          descriptionCount[description] = (descriptionCount[description] || 0) + 1
        })

        // Converter para array e ordenar por quantidade
        const sortedData = Object.entries(descriptionCount)
          .map(([description, count]) => ({
            description: description.length > 60 ? description.substring(0, 60) + '...' : description,
            fullDescription: description,
            count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15) // Top 15

        setChartData(sortedData)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [levelFilter, agentFilter, startDate, endDate, query])

  const COLORS = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1',
    '#84cc16', '#f43f5e', '#22c55e', '#a855f7', '#0ea5e9'
  ]

  return (
    <ProtectedRoute>
      <div>
        <Header />
        <main className="container py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Relatório de Alertas</h2>
            <p className="text-slate-400">
              Visualização dos alertas mais frequentes no sistema
            </p>
          </div>

          {/* Filtros */}
          <div className="mb-6 bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">🔍 Filtros</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300 font-medium min-w-[60px]">Nível:</label>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 text-sm flex-1"
                >
                  <option value="">Todos</option>
                  <option value="0">Nível 0</option>
                  <option value="1">Nível 1</option>
                  <option value="2">Nível 2</option>
                  <option value="3">Nível 3</option>
                  <option value="4">Nível 4</option>
                  <option value="5">Nível 5</option>
                  <option value="6">Nível 6</option>
                  <option value="7">Nível 7</option>
                  <option value="8">Nível 8</option>
                  <option value="9">Nível 9</option>
                  <option value="10">Nível 10+</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300 font-medium min-w-[60px]">Agente:</label>
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 text-sm flex-1"
                >
                  <option value="">Todos os Agentes</option>
                  {availableAgents.map(agent => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300 font-medium min-w-[60px]">De:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 text-sm flex-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-300 font-medium min-w-[60px]">Até:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-slate-700 bg-slate-900 text-slate-100 rounded px-3 py-2 text-sm flex-1"
                />
              </div>

              <div className="flex items-center gap-2 col-span-2">
                <label className="text-sm text-slate-300 font-medium min-w-[60px]">Buscar:</label>
                <input
                  placeholder="Buscar por descrição..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="border border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-400 rounded px-3 py-2 text-sm flex-1"
                />
              </div>
            </div>
          </div>

          {/* Indicador de filtro ativo */}
          {(levelFilter || agentFilter || startDate || endDate || query) && (
            <div className="mb-4 px-4 py-2 bg-blue-900/30 border border-blue-500 rounded-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-blue-200 text-sm">
                  📊 Mostrando alertas
                  {levelFilter && <strong className="ml-1">Nível {levelFilter}</strong>}
                  {(levelFilter && (agentFilter || startDate || endDate || query)) && <span className="mx-1">•</span>}
                  {agentFilter && <strong>Agente: {agentFilter}</strong>}
                  {(agentFilter && (startDate || endDate || query)) && <span className="mx-1">•</span>}
                  {(startDate || endDate) && (
                    <strong>
                      Período: {formatInputDate(startDate)} até {formatInputDate(endDate)}
                    </strong>
                  )}
                  {((startDate || endDate) && query) && <span className="mx-1">•</span>}
                  {query && <strong>Busca: "{query}"</strong>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {levelFilter && (
                  <button
                    onClick={() => setLevelFilter('')}
                    className="text-blue-300 hover:text-blue-100 text-xs font-medium px-2 py-1 bg-blue-800/50 rounded"
                  >
                    ✕ Nível
                  </button>
                )}
                {agentFilter && (
                  <button
                    onClick={() => setAgentFilter('')}
                    className="text-blue-300 hover:text-blue-100 text-xs font-medium px-2 py-1 bg-blue-800/50 rounded"
                  >
                    ✕ Agente
                  </button>
                )}
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate('') }}
                    className="text-blue-300 hover:text-blue-100 text-xs font-medium px-2 py-1 bg-blue-800/50 rounded"
                  >
                    ✕ Período
                  </button>
                )}
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="text-blue-300 hover:text-blue-100 text-xs font-medium px-2 py-1 bg-blue-800/50 rounded"
                  >
                    ✕ Busca
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Gráfico */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-slate-100 mb-6">
              Top 15 Descrições de Alertas Mais Gerados
              {(levelFilter || agentFilter || startDate || endDate || query) && (
                <span className="text-blue-400 text-base ml-2">
                  ({[levelFilter && `Nível ${levelFilter}`, agentFilter, (startDate || endDate) && 'Período', query && `Busca: "${query}"`].filter(Boolean).join(' • ')})
                </span>
              )}
            </h3>
            
            {loading ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-slate-400">Carregando dados...</div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-96 flex items-center justify-center">
                <div className="text-slate-400">Nenhum dado disponível</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={500}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="description" 
                    angle={-45} 
                    textAnchor="end" 
                    height={150}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '6px',
                      color: '#e2e8f0'
                    }}
                    labelStyle={{ color: '#cbd5e1' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value} ocorrências`,
                      props.payload.fullDescription
                    ]}
                  />
                  <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                  <Bar dataKey="count" name="Quantidade de Alertas">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Resumo */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-sm font-semibold text-blue-300">Total de Alertas</div>
              <div className="text-3xl font-bold text-blue-100 mt-2">{totalAlerts.toLocaleString()}</div>
            </div>
            
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-sm font-semibold text-green-300">Tipos Únicos</div>
              <div className="text-3xl font-bold text-green-100 mt-2">{chartData.length}</div>
            </div>
            
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
              <div className="text-sm font-semibold text-orange-300">Mais Frequente</div>
              <div className="text-lg font-bold text-orange-100 mt-2">
                {chartData[0]?.count.toLocaleString() || 0} ocorrências
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
