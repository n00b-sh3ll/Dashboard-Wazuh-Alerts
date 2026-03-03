import { readStorageJson, writeStorageJson } from './storage'

export interface User {
  id: string
  name: string
  email: string
  password: string
  createdAt: string
  role: 'admin' | 'operador' | 'user'
}

export interface CurrentUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'operador' | 'user'
}

export function getCurrentUser(): CurrentUser | null {
  return readStorageJson<CurrentUser | null>('currentUser', null)
}

export function setCurrentUser(user: CurrentUser | null): void {
  if (user) {
    writeStorageJson('currentUser', user)
  } else {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser')
    }
  }
}

export function login(email: string, password: string): CurrentUser | null {
  const users = readStorageJson<User[]>('consoleUsers', [])
  const user = users.find(u => u.email === email && u.password === password)
  
  if (user) {
    const currentUser: CurrentUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
    setCurrentUser(currentUser)
    return currentUser
  }
  
  return null
}

export function logout(): void {
  setCurrentUser(null)
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === 'admin'
}

export function isOperador(user: CurrentUser | null): boolean {
  return user?.role === 'operador'
}

export function canAccessAdmin(user: CurrentUser | null): boolean {
  return user?.role === 'admin'
}

export function initializeDefaultAdmin(): void {
  const users = readStorageJson<User[]>('consoleUsers', [])
  
  // Se não houver usuários, criar admin padrão
  if (users.length === 0) {
    const defaultAdmin: User = {
      id: Date.now().toString(),
      name: 'Administrador',
      email: 'admin@wazuh.local',
      password: 'admin123',
      role: 'admin',
      createdAt: new Date().toISOString()
    }
    
    writeStorageJson('consoleUsers', [defaultAdmin])
  }
}
