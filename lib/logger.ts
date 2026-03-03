/**
 * Logger Service
 * Handles audit logging and error logging to the file system
 */

import fs from 'fs'
import path from 'path'

// Determine the logs directory
const logsDir = path.join(process.cwd(), 'logs')
const auditDir = path.join(logsDir, 'audit')
const errorsDir = path.join(logsDir, 'errors')

/**
 * Ensure log directories exist
 */
function ensureLogDirectoriesExist() {
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true })
    }
    if (!fs.existsSync(errorsDir)) {
      fs.mkdirSync(errorsDir, { recursive: true })
    }
  } catch (error) {
    console.error('❌ Erro ao criar diretórios de logs:', error)
  }
}

/**
 * Get formatted timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Get log filename with date
 */
function getLogFilename(type: 'audit' | 'error'): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  return `${type}-${year}-${month}-${day}.log`
}

/**
 * Write log entry to file
 */
function writeLog(type: 'audit' | 'error', data: Record<string, any>): void {
  try {
    ensureLogDirectoriesExist()
    
    const dir = type === 'audit' ? auditDir : errorsDir
    const filename = getLogFilename(type)
    const filepath = path.join(dir, filename)
    
    const logEntry = {
      timestamp: getTimestamp(),
      ...data
    }
    
    const logLine = JSON.stringify(logEntry) + '\n'
    
    fs.appendFileSync(filepath, logLine, { encoding: 'utf-8' })
  } catch (error) {
    console.error(`❌ Erro ao escrever log de ${type}:`, error)
  }
}

/**
 * Log an audit event (user actions, configuration changes, etc.)
 */
export function logAudit(
  action: string,
  userId?: string,
  details?: Record<string, any>,
  ipAddress?: string
): void {
  writeLog('audit', {
    action,
    userId: userId || 'anonymous',
    ipAddress: ipAddress || 'unknown',
    ...(details && { details })
  })
  
  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`📝 [AUDIT] ${action} - User: ${userId || 'anonymous'}`)
  }
}

/**
 * Log an error event
 */
export function logError(
  errorType: string,
  message: string,
  status?: number,
  details?: Record<string, any>,
  stack?: string
): void {
  writeLog('error', {
    errorType,
    message,
    status: status || 500,
    ...(details && { details }),
    ...(stack && { stack })
  })
  
  // Also log to console
  console.error(`❌ [ERROR] ${errorType}: ${message}`, details || '')
}

/**
 * Log SSH connection attempt
 */
export function logSSHConnection(
  success: boolean,
  ip: string,
  username: string,
  errorMessage?: string
): void {
  logAudit('SSH_CONNECTION_ATTEMPT', 'system', {
    success,
    ip,
    username,
    ...(errorMessage && { errorMessage })
  })
}

/**
 * Log user login/logout
 */
export function logUserAuth(
  action: 'login' | 'logout',
  userId: string,
  email: string,
  ipAddress?: string
): void {
  logAudit(`USER_${action.toUpperCase()}`, userId, {
    email,
    action
  }, ipAddress)
}

/**
 * Log SSH configuration change
 */
export function logSSHConfigChange(
  userId: string,
  action: 'create' | 'update' | 'delete',
  ip: string,
  username: string
): void {
  logAudit('SSH_CONFIG_CHANGE', userId, {
    action,
    ip,
    username
  })
}

/**
 * Log API error
 */
export function logAPIError(
  endpoint: string,
  method: string,
  statusCode: number,
  error: string,
  userId?: string
): void {
  logError('API_ERROR', `${method} ${endpoint} - ${error}`, statusCode, {
    endpoint,
    method,
    userId: userId || 'anonymous'
  })
}

/**
 * Log database error
 */
export function logDatabaseError(
  operation: string,
  error: string,
  details?: Record<string, any>
): void {
  logError('DATABASE_ERROR', `${operation}: ${error}`, 500, details)
}

/**
 * Get audit logs for a specific date range
 */
export function getAuditLogs(startDate?: Date, endDate?: Date): string[] {
  try {
    ensureLogDirectoriesExist()
    
    const files = fs.readdirSync(auditDir)
    const logFiles = files
      .filter(f => f.startsWith('audit-'))
      .sort()
      .reverse()
    
    const logs: string[] = []
    
    for (const file of logFiles) {
      try {
        const content = fs.readFileSync(path.join(auditDir, file), 'utf-8')
        logs.push(...content.trim().split('\n').filter(line => line.length > 0))
      } catch (error) {
        console.error(`Erro ao ler arquivo de log ${file}:`, error)
      }
    }
    
    return logs
  } catch (error) {
    console.error('Erro ao obter logs de auditoria:', error)
    return []
  }
}

/**
 * Get error logs for a specific date range
 */
export function getErrorLogs(startDate?: Date, endDate?: Date): string[] {
  try {
    ensureLogDirectoriesExist()
    
    const files = fs.readdirSync(errorsDir)
    const logFiles = files
      .filter(f => f.startsWith('error-'))
      .sort()
      .reverse()
    
    const logs: string[] = []
    
    for (const file of logFiles) {
      try {
        const content = fs.readFileSync(path.join(errorsDir, file), 'utf-8')
        logs.push(...content.trim().split('\n').filter(line => line.length > 0))
      } catch (error) {
        console.error(`Erro ao ler arquivo de log ${file}:`, error)
      }
    }
    
    return logs
  } catch (error) {
    console.error('Erro ao obter logs de erro:', error)
    return []
  }
}

/**
 * Clear old logs (older than specified days)
 */
export function clearOldLogs(daysToKeep: number = 30): void {
  try {
    const now = Date.now()
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000
    
    // Clear audit logs
    const auditFiles = fs.readdirSync(auditDir)
    for (const file of auditFiles) {
      const filepath = path.join(auditDir, file)
      const stats = fs.statSync(filepath)
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filepath)
        console.log(`🗑️ Arquivo de auditoria removido: ${file}`)
      }
    }
    
    // Clear error logs
    const errorFiles = fs.readdirSync(errorsDir)
    for (const file of errorFiles) {
      const filepath = path.join(errorsDir, file)
      const stats = fs.statSync(filepath)
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filepath)
        console.log(`🗑️ Arquivo de erro removido: ${file}`)
      }
    }
  } catch (error) {
    console.error('Erro ao limpar logs antigos:', error)
  }
}
