import { readStorageJson, writeStorageJson } from './storage'

export interface MergableAlert {
  _id: string
  timestamp: string
  rule: {
    description: string
    level: number
  }
  agent?: {
    name: string
  }
}

export interface MergeGroup {
  description: string
  alerts: MergableAlert[]
  count: number
}

export function findDuplicateAlerts(alerts: any[]): MergeGroup[] {
  // Agrupar alertas por descrição da regra
  const groupedByDescription: Record<string, MergableAlert[]> = {}

  alerts.forEach(alert => {
    const description = alert.rule?.description || 'Sem descrição'
    if (!groupedByDescription[description]) {
      groupedByDescription[description] = []
    }
    groupedByDescription[description].push(alert)
  })

  // Filtrar apenas grupos com mais de 1 alerta
  return Object.entries(groupedByDescription)
    .filter(([, alerts]) => alerts.length > 1)
    .map(([description, alertList]) => ({
      description,
      alerts: alertList.sort((a, b) => 
        new Date(b['@timestamp'] || b.timestamp).getTime() - 
        new Date(a['@timestamp'] || a.timestamp).getTime()
      ),
      count: alertList.length
    }))
}

export function mergeAlerts(mainAlertId: string, alertsToMerge: string[]): void {
  const annotations = readStorageJson<Record<string, any>>('alertAnnotations', {})
  const mergeHistory = readStorageJson<Record<string, any>>('alertMergeHistory', {})

  // Copiar anotações dos alertas a mesclar para o alerta principal
  const mainAnnotation = annotations[mainAlertId] || { notes: [], assignedTo: '', status: '' }
  
  alertsToMerge.forEach(mergeAlertId => {
    const sourceAnnotation = annotations[mergeAlertId]
    if (sourceAnnotation) {
      // Combinar notas
      if (Array.isArray(sourceAnnotation.notes) && Array.isArray(mainAnnotation.notes)) {
        mainAnnotation.notes = [
          ...mainAnnotation.notes,
          ...sourceAnnotation.notes.map((note: any) => ({
            ...note,
            text: `[Merged] ${note.text}`
          }))
        ]
      }

      // Registrar no histórico de merge
      if (!mergeHistory[mainAlertId]) {
        mergeHistory[mainAlertId] = []
      }
      mergeHistory[mainAlertId].push({
        mergedAlertId: mergeAlertId,
        timestamp: new Date().toISOString(),
        sourceStatus: sourceAnnotation.status || 'novo alerta'
      })

      // Remover alertas mesclados (marcar como merged)
      annotations[mergeAlertId] = {
        ...sourceAnnotation,
        merged: true,
        mergedInto: mainAlertId
      }
    }
  })

  annotations[mainAlertId] = mainAnnotation
  writeStorageJson('alertAnnotations', annotations)
  writeStorageJson('alertMergeHistory', mergeHistory)
}

export function getAlertsMergedInfo(alertId: string): { mergedInto?: string; mergedAlerts?: Array<{ id: string; timestamp: string }> } {
  const annotations = readStorageJson<Record<string, any>>('alertAnnotations', {})
  const mergeHistory = readStorageJson<Record<string, any>>('alertMergeHistory', {})

  const alertData = annotations[alertId]
  
  return {
    mergedInto: alertData?.mergedInto,
    mergedAlerts: mergeHistory[alertId]?.[0] ? 
      mergeHistory[alertId].map((m: any) => ({ id: m.mergedAlertId, timestamp: m.timestamp })) 
      : undefined
  }
}
