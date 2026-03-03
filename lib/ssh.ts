/**
 * SSH Configuration Manager
 * Provides utilities for managing SSH configurations for Wazuh data collection
 */

import { readStorageJson, writeStorageJson } from './storage'

export interface SSHConfig {
  ip: string
  username: string
  authType: 'password' | 'key'
  password: string
  sshKey: string
}

export interface SSHConnectionStatus {
  connected: boolean
  lastConnectionTime?: string
  lastErrorMessage?: string
}

const SSH_CONFIG_KEY = 'sshConfig'
const SSH_CONNECTION_STATUS_KEY = 'sshConnectionStatus'

/**
 * Get the current SSH configuration
 * @returns SSHConfig if configured, null otherwise
 */
export function getSSHConfig(): SSHConfig | null {
  return readStorageJson<SSHConfig>(SSH_CONFIG_KEY, null)
}

/**
 * Save SSH configuration
 * @param config SSH configuration to save
 */
export function saveSSHConfig(config: SSHConfig): void {
  writeStorageJson(SSH_CONFIG_KEY, config)
}

/**
 * Clear SSH configuration
 */
export function clearSSHConfig(): void {
  writeStorageJson(SSH_CONFIG_KEY, null)
}

/**
 * Check if SSH is configured
 * @returns true if SSH configuration is complete
 */
export function isSSHConfigured(): boolean {
  const config = getSSHConfig()
  return !!(config && config.ip && config.username && 
    (config.authType === 'password' ? config.password : config.sshKey))
}

/**
 * Validate SSH configuration
 * @param config Configuration to validate
 * @returns { valid: boolean, errors: string[] }
 */
export function validateSSHConfig(config: Partial<SSHConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!config.ip?.trim()) {
    errors.push('IP é obrigatório')
  } else {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(config.ip)) {
      errors.push('IP deve estar no formato correto (ex: 192.168.1.100)')
    }
  }

  if (!config.username?.trim()) {
    errors.push('Usuário é obrigatório')
  }

  if (config.authType === 'password') {
    if (!config.password?.trim()) {
      errors.push('Senha é obrigatória para autenticação por senha')
    }
  } else if (config.authType === 'key') {
    if (!config.sshKey?.trim()) {
      errors.push('Chave SSH é obrigatória para autenticação por chave')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Get SSH connection info (for logging/display)
 * @returns Connection info without sensitive data
 */
export function getSSHConnectionInfo(): { ip?: string; username?: string; authType?: string } {
  const config = getSSHConfig()
  if (!config) return {}

  return {
    ip: config.ip,
    username: config.username,
    authType: config.authType === 'password' ? 'Senha' : 'Chave SSH'
  }
}

/**
 * Get SSH connection status
 * @returns Current connection status
 */
export function getSSHConnectionStatus(): SSHConnectionStatus {
  return readStorageJson<SSHConnectionStatus>(SSH_CONNECTION_STATUS_KEY, { connected: false })
}

/**
 * Save SSH connection status
 * @param status Connection status to save
 */
export function saveSSHConnectionStatus(status: SSHConnectionStatus): void {
  writeStorageJson(SSH_CONNECTION_STATUS_KEY, status)
}

/**
 * Check if SSH is currently connected
 * @returns true if last connection was successful
 */
export function isSSHConnected(): boolean {
  const status = getSSHConnectionStatus()
  return status.connected === true
}

/**
 * Get formatted last connection time
 * @returns Formatted timestamp or 'Nunca'
 */
export function getLastSSHConnectionTime(): string {
  const status = getSSHConnectionStatus()
  if (!status.lastConnectionTime) return 'Nunca'
  
  try {
    const date = new Date(status.lastConnectionTime)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return 'Inválido'
  }
}
