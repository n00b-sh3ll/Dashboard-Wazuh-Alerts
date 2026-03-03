"use client"

import React, { useState } from 'react'
import { findDuplicateAlerts, mergeAlerts, type MergeGroup } from '@/lib/alert-merge'

type Props = {
  alerts: any[]
  onMergeComplete?: () => void
}

export default function MergeAlertsPanel({ alerts, onMergeComplete }: Props) {
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([])
  const [showMergePanel, setShowMergePanel] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [selectedMain, setSelectedMain] = useState<string | null>(null)
  const [selectedToMerge, setSelectedToMerge] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  const handleAnalyzeDuplicates = () => {
    const duplicates = findDuplicateAlerts(alerts)
    setMergeGroups(duplicates)
    setShowMergePanel(true)

    if (duplicates.length === 0) {
      setMessage({ type: 'info', text: 'Nenhum alerta duplicado encontrado.' })
    } else {
      setMessage({ type: 'info', text: `Encontrados ${duplicates.length} grupo(s) de alertas duplicados.` })
    }

    setTimeout(() => setMessage(null), 4000)
  }

  const handleSelectGroup = (index: number) => {
    setSelectedGroup(index)
    setSelectedMain(null)
    setSelectedToMerge(new Set())
  }

  const handleSelectMainAlert = (alertId: string) => {
    setSelectedMain(alertId)
    // Limpar seleção de merge se o mesmo alerta é selecionado como principal
    setSelectedToMerge(prev => {
      const newSet = new Set(prev)
      newSet.delete(alertId)
      return newSet
    })
  }

  const handleToggleMergeAlert = (alertId: string) => {
    if (alertId === selectedMain) return // Não permitir selecionar o principal para merge

    setSelectedToMerge(prev => {
      const newSet = new Set(prev)
      if (newSet.has(alertId)) {
        newSet.delete(alertId)
      } else {
        newSet.add(alertId)
      }
      return newSet
    })
  }

  const handleExecuteMerge = () => {
    if (!selectedMain || selectedToMerge.size === 0) {
      setMessage({ type: 'error', text: 'Selecione um alerta principal e pelo menos um alerta para mesclar.' })
      setTimeout(() => setMessage(null), 3000)
      return
    }

    try {
      mergeAlerts(selectedMain, Array.from(selectedToMerge))
      setMessage({ type: 'success', text: `${selectedToMerge.size} alerta(s) mesclado(s) com sucesso!` })
      
      // Limpar seleções e atualizar
      setTimeout(() => {
        setSelectedGroup(null)
        setSelectedMain(null)
        setSelectedToMerge(new Set())
        handleAnalyzeDuplicates()
        if (onMergeComplete) {
          onMergeComplete()
        }
      }, 1500)
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao mesclar alertas.' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const currentGroup = selectedGroup !== null ? mergeGroups[selectedGroup] : null

  return (
    <div>
      <button
        onClick={handleAnalyzeDuplicates}
        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        title="Encontrar e mesclar alertas duplicados"
      >
        🔗 Merge Alertas
      </button>

      {showMergePanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-100">🔗 Mesclar Alertas Duplicados</h3>
                <button
                  onClick={() => setShowMergePanel(false)}
                  className="text-slate-400 hover:text-slate-100 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              {message && (
                <div className={`mb-6 px-4 py-3 rounded-lg border ${
                  message.type === 'success' 
                    ? 'bg-green-900/30 border-green-500 text-green-200' 
                    : message.type === 'error'
                    ? 'bg-red-900/30 border-red-500 text-red-200'
                    : 'bg-blue-900/30 border-blue-500 text-blue-200'
                }`}>
                  {message.text}
                </div>
              )}

              {mergeGroups.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-lg mb-4">✅ Nenhum alerta duplicado encontrado</p>
                  <button
                    onClick={() => setShowMergePanel(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <div>
                  {/* Lista de grupos duplicados */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-slate-300 mb-3">
                      Grupos com alertas duplicados ({mergeGroups.length}):
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {mergeGroups.map((group, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectGroup(idx)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors border ${
                            selectedGroup === idx
                              ? 'bg-blue-900/40 border-blue-500 text-blue-200'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{group.description}</span>
                            <span className="text-xs bg-amber-900/40 text-amber-200 px-2 py-1 rounded-full ml-2">
                              {group.count} alertas
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Seleção de alertas para merge */}
                  {currentGroup && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-300 mb-3">
                        Selecione um alerta principal e os alertas a mesclar:
                      </h4>

                      <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
                        {currentGroup.alerts.map((alert) => (
                          <div
                            key={alert._id}
                            className="p-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="radio"
                                  name="mainAlert"
                                  checked={selectedMain === alert._id}
                                  onChange={() => handleSelectMainAlert(alert._id)}
                                  className="cursor-pointer"
                                />
                                <label className="text-xs text-slate-400 cursor-pointer font-medium">Principal</label>
                              </div>

                              {selectedMain !== alert._id && (
                                <div className="flex items-center gap-2 pt-1">
                                  <input
                                    type="checkbox"
                                    checked={selectedToMerge.has(alert._id)}
                                    onChange={() => handleToggleMergeAlert(alert._id)}
                                    className="cursor-pointer"
                                  />
                                  <label className="text-xs text-slate-400 cursor-pointer font-medium">Mesclar</label>
                                </div>
                              )}

                              <div className="flex-1">
                                <div className="text-sm text-slate-100 font-medium">
                                  {alert.agent?.name && <span className="text-blue-400">[{alert.agent.name}]</span>} 
                                  {' '}
                                  Nível {alert.rule?.level || '?'}
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  {new Date(alert['@timestamp'] || alert.timestamp).toLocaleString('pt-BR')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3 pt-4 border-t border-slate-700">
                        <button
                          onClick={handleExecuteMerge}
                          disabled={!selectedMain || selectedToMerge.size === 0}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          ✓ Mesclar {selectedToMerge.size} alerta(s)
                        </button>
                        <button
                          onClick={() => setSelectedGroup(null)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
