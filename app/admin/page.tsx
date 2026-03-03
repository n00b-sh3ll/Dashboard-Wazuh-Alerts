"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import { readStorageJson, writeStorageJson } from '@/lib/storage'
import { getCurrentUser, canAccessAdmin } from '@/lib/auth'

interface User {
  id: string
  name: string
  email: string
  password: string
  createdAt: string
  role: 'admin' | 'operador' | 'user'
}

interface SSHConfig {
  ip: string
  username: string
  authType: 'password' | 'key'
  password: string
  sshKey: string
}

interface SSHConnectionStatus {
  connected: boolean
  lastConnectionTime?: string
  lastErrorMessage?: string
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'operador' | 'user'>('user')
  const [showPassword, setShowPassword] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)
  
  // SSH Config states
  const [sshConfig, setSSHConfig] = useState<SSHConfig>({
    ip: '',
    username: '',
    authType: 'password',
    password: '',
    sshKey: ''
  })
  const [showSSHPassword, setShowSSHPassword] = useState(false)
  const [sshMessage, setSSHMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [sshConnectionStatus, setSSHConnectionStatus] = useState<SSHConnectionStatus>({ connected: false })
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    // Verificar permissão de acesso
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      router.push('/login')
      return
    }
    
    if (!canAccessAdmin(currentUser)) {
      router.push('/dashboard')
      return
    }
    
    setIsAuthorized(true)
    const storedUsers = readStorageJson<User[]>('consoleUsers', [])
    setUsers(storedUsers)
    
    // Carregar configuração SSH
    const storedSSHConfig = readStorageJson<SSHConfig>('sshConfig', null)
    if (storedSSHConfig) {
      setSSHConfig(storedSSHConfig)
    }
    
    // Carregar status de conexão SSH
    const storedConnectionStatus = readStorageJson<SSHConnectionStatus>('sshConnectionStatus', { connected: false })
    if (storedConnectionStatus) {
      setSSHConnectionStatus(storedConnectionStatus)
    }
  }, [router])

  const saveUsers = (updatedUsers: User[]) => {
    writeStorageJson('consoleUsers', updatedUsers)
    setUsers(updatedUsers)
  }

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !email.trim() || !password.trim()) {
      setMessage({ type: 'error', text: 'Todos os campos são obrigatórios' })
      return
    }

    if (!email.includes('@')) {
      setMessage({ type: 'error', text: 'Email inválido' })
      return
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter no mínimo 6 caracteres' })
      return
    }

    const emailExists = users.some(u => u.email === email && u.id !== editingId)
    if (emailExists) {
      setMessage({ type: 'error', text: 'Email já cadastrado' })
      return
    }

    if (editingId) {
      // Editar usuário existente
      const updatedUsers = users.map(u => 
        u.id === editingId 
          ? { ...u, name, email, password, role }
          : u
      )
      saveUsers(updatedUsers)
      setMessage({ type: 'success', text: 'Usuário atualizado com sucesso' })
      
      // Log audit event
      const currentUser = getCurrentUser()
      if (currentUser) {
        fetch('/api/log-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'USER_UPDATED',
            userId: currentUser.id,
            details: {
              targetUserId: editingId,
              name,
              email,
              role
            }
          })
        }).catch(error => console.error('Erro ao registrar auditoria:', error))
      }
      
      setEditingId(null)
    } else {
      // Adicionar novo usuário
      const newUser: User = {
        id: Date.now().toString(),
        name,
        email,
        password,
        role,
        createdAt: new Date().toISOString()
      }
      saveUsers([...users, newUser])
      setMessage({ type: 'success', text: 'Usuário adicionado com sucesso' })
      
      // Log audit event
      const currentUser = getCurrentUser()
      if (currentUser) {
        fetch('/api/log-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'USER_CREATED',
            userId: currentUser.id,
            details: {
              newUserId: newUser.id,
              name,
              email,
              role
            }
          })
        }).catch(error => console.error('Erro ao registrar auditoria:', error))
      }
    }

    // Limpar formulário
    setName('')
    setEmail('')
    setPassword('')
    setRole('user')
    
    setTimeout(() => setMessage(null), 3000)
  }

  const handleEditUser = (user: User) => {
    setName(user.name)
    setEmail(user.email)
    setPassword(user.password)
    setRole(user.role)
    setEditingId(user.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setName('')
    setEmail('')
    setPassword('')
    setRole('user')
    setEditingId(null)
  }

  const handleRemoveUser = (id: string) => {
    if (confirm('Tem certeza que deseja remover este usuário?')) {
      const removedUser = users.find(u => u.id === id)
      const updatedUsers = users.filter(u => u.id !== id)
      saveUsers(updatedUsers)
      setMessage({ type: 'success', text: 'Usuário removido com sucesso' })
      
      // Log audit event
      const currentUser = getCurrentUser()
      if (currentUser) {
        fetch('/api/log-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'USER_DELETED',
            userId: currentUser.id,
            details: {
              deletedUserId: id,
              deletedUserName: removedUser?.name,
              deletedUserEmail: removedUser?.email
            }
          })
        }).catch(error => console.error('Erro ao registrar auditoria:', error))
      }
      
      if (editingId === id) {
        handleCancelEdit()
      }
      
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const saveSSHConfig = (updatedConfig: SSHConfig) => {
    writeStorageJson('sshConfig', updatedConfig)
    setSSHConfig(updatedConfig)
  }

  const handleSSHConfigChange = (field: keyof SSHConfig, value: string) => {
    setSSHConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveSSHConfig = () => {
    if (!sshConfig.ip.trim() || !sshConfig.username.trim()) {
      setSSHMessage({ type: 'error', text: 'IP e Usuário são obrigatórios' })
      setTimeout(() => setSSHMessage(null), 3000)
      return
    }

    if (sshConfig.authType === 'password' && !sshConfig.password.trim()) {
      setSSHMessage({ type: 'error', text: 'Senha é obrigatória para autenticação por senha' })
      setTimeout(() => setSSHMessage(null), 3000)
      return
    }

    if (sshConfig.authType === 'key' && !sshConfig.sshKey.trim()) {
      setSSHMessage({ type: 'error', text: 'Chave SSH é obrigatória para autenticação por chave' })
      setTimeout(() => setSSHMessage(null), 3000)
      return
    }

    // Validar IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(sshConfig.ip)) {
      setSSHMessage({ type: 'error', text: 'IP inválido' })
      setTimeout(() => setSSHMessage(null), 3000)
      return
    }

    saveSSHConfig(sshConfig)
    setSSHMessage({ type: 'success', text: 'Configuração SSH salva com sucesso' })
    
    // Log audit event
    const currentUser = getCurrentUser()
    if (currentUser) {
      fetch('/api/log-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SSH_CONFIG_SAVED',
          userId: currentUser.id,
          details: {
            ip: sshConfig.ip,
            username: sshConfig.username,
            authType: sshConfig.authType
          }
        })
      }).catch(error => console.error('Erro ao registrar auditoria:', error))
    }
    
    setTimeout(() => setSSHMessage(null), 3000)
  }

  const handleClearSSHConfig = () => {
    if (confirm('Tem certeza que deseja limpar as configurações SSH?')) {
      setSSHConfig({
        ip: '',
        username: '',
        authType: 'password',
        password: '',
        sshKey: ''
      })
      writeStorageJson('sshConfig', null)
      setSSHConnectionStatus({ connected: false })
      writeStorageJson('sshConnectionStatus', { connected: false })
      setSSHMessage({ type: 'success', text: 'Configurações SSH removidas' })
      
      // Log audit event
      const currentUser = getCurrentUser()
      if (currentUser) {
        fetch('/api/log-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SSH_CONFIG_CLEARED',
            userId: currentUser.id,
            details: {
              previousIp: sshConfig.ip,
              previousUsername: sshConfig.username
            }
          })
        }).catch(error => console.error('Erro ao registrar auditoria:', error))
      }
      
      setTimeout(() => setSSHMessage(null), 3000)
    }
  }

  const handleTestSSHConnection = async () => {
    if (!sshConfig.ip.trim() || !sshConfig.username.trim()) {
      setSSHMessage({ type: 'error', text: 'IP e Usuário são obrigatórios' })
      setTimeout(() => setSSHMessage(null), 3000)
      return
    }

    if (sshConfig.authType === 'password' && !sshConfig.password.trim()) {
      setSSHMessage({ type: 'error', text: 'Senha é obrigatória para testar conexão' })
      setTimeout(() => setSSHMessage(null), 3000)
      return
    }

    if (sshConfig.authType === 'key' && !sshConfig.sshKey.trim()) {
      setSSHMessage({ type: 'error', text: 'Chave SSH é obrigatória para testar conexão' })
      setTimeout(() => setSSHMessage(null), 3000)
      return
    }

    setIsTestingConnection(true)
    try {
      const response = await fetch('/api/test-ssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sshConfig)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const connectionStatus: SSHConnectionStatus = {
          connected: true,
          lastConnectionTime: new Date().toISOString()
        }
        writeStorageJson('sshConnectionStatus', connectionStatus)
        setSSHConnectionStatus(connectionStatus)
        setSSHMessage({ type: 'success', text: '✅ Conexão SSH estabelecida com sucesso!' })
        
        // Log successful connection
        const currentUser = getCurrentUser()
        if (currentUser) {
          fetch('/api/log-audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SSH_CONNECTION_SUCCESS',
              userId: currentUser.id,
              details: {
                ip: sshConfig.ip,
                username: sshConfig.username,
                authType: sshConfig.authType
              }
            })
          }).catch(error => console.error('Erro ao registrar auditoria:', error))
        }
      } else {
        const connectionStatus: SSHConnectionStatus = {
          connected: false,
          lastErrorMessage: data.error || 'Falha ao conectar'
        }
        writeStorageJson('sshConnectionStatus', connectionStatus)
        setSSHConnectionStatus(connectionStatus)
        setSSHMessage({ type: 'error', text: `❌ Erro na conexão: ${data.error || 'Falha desconhecida'}` })
        
        // Log failed connection
        const currentUser = getCurrentUser()
        if (currentUser) {
          fetch('/api/log-audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SSH_CONNECTION_FAILED',
              userId: currentUser.id,
              details: {
                ip: sshConfig.ip,
                username: sshConfig.username,
                authType: sshConfig.authType,
                errorMessage: data.error || 'Falha desconhecida'
              }
            })
          }).catch(error => console.error('Erro ao registrar auditoria:', error))
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      const connectionStatus: SSHConnectionStatus = {
        connected: false,
        lastErrorMessage: errorMessage
      }
      writeStorageJson('sshConnectionStatus', connectionStatus)
      setSSHConnectionStatus(connectionStatus)
      setSSHMessage({ type: 'error', text: `❌ Erro ao testar conexão: ${errorMessage}` })
      
      // Log error
      const currentUser = getCurrentUser()
      if (currentUser) {
        fetch('/api/log-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SSH_CONNECTION_ERROR',
            userId: currentUser.id,
            details: {
              ip: sshConfig.ip,
              username: sshConfig.username,
              errorMessage: errorMessage
            }
          })
        }).catch(error => console.error('Erro ao registrar auditoria:', error))
      }
    } finally {
      setIsTestingConnection(false)
      setTimeout(() => setSSHMessage(null), 5000)
    }
  }

  const formatConnectionTime = (isoDate?: string) => {
    if (!isoDate) return 'Nunca'
    try {
      const date = new Date(isoDate)
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

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Verificando permissões...</div>
      </div>
    )
  }

  return (
    <div>
      <Header />
      <main className="container py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Painel Administrativo</h2>
          <p className="text-slate-400">
            Gerencie os usuários que podem acessar o console
          </p>
        </div>

        {/* Mensagens de feedback */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg border ${
            message.type === 'success' 
              ? 'bg-green-900/30 border-green-500 text-green-200' 
              : 'bg-red-900/30 border-red-500 text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Formulário de Adicionar/Editar Usuário */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-slate-100 mb-4">
            {editingId ? '✏️ Editar Usuário' : '➕ Adicionar Novo Usuário'}
          </h3>
          
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite o nome completo"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@exemplo.com"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Função
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'operador' | 'user')}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="user">Usuário</option>
                  <option value="operador">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {editingId ? '💾 Salvar Alterações' : '➕ Adicionar Usuário'}
              </button>
              
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition-colors"
                >
                  ✕ Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Lista de Usuários */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="text-xl font-semibold text-slate-100">
              👥 Usuários Cadastrados ({users.length})
            </h3>
          </div>

          {users.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400">
              <p className="text-lg mb-2">📭 Nenhum usuário cadastrado</p>
              <p className="text-sm">Adicione um usuário usando o formulário acima</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Função
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Cadastrado em
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-100">{user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-300">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-900/40 text-purple-200 border border-purple-500'
                            : user.role === 'operador'
                            ? 'bg-orange-900/40 text-orange-200 border border-orange-500' 
                            : 'bg-blue-900/40 text-blue-200 border border-blue-500'
                        }`}>
                          {user.role === 'admin' ? '👑 Admin' : user.role === 'operador' ? '🔧 Operador' : '👤 Usuário'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-400">{formatDate(user.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                            title="Editar usuário"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleRemoveUser(user.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                            title="Remover usuário"
                          >
                            🗑️ Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Estatísticas */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-sm font-semibold text-blue-300">Total de Usuários</div>
            <div className="text-3xl font-bold text-blue-100 mt-2">{users.length}</div>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-sm font-semibold text-purple-300">Administradores</div>
            <div className="text-3xl font-bold text-purple-100 mt-2">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-sm font-semibold text-orange-300">Operadores</div>
            <div className="text-3xl font-bold text-orange-100 mt-2">
              {users.filter(u => u.role === 'operador').length}
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <div className="text-sm font-semibold text-green-300">Usuários Comuns</div>
            <div className="text-3xl font-bold text-green-100 mt-2">
              {users.filter(u => u.role === 'user').length}
            </div>
          </div>
        </div>

        {/* Configurações SSH */}
        <div className="mt-8 bg-slate-900 border border-slate-700 rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-100 mb-2">🔐 Configurações SSH</h3>
            <p className="text-slate-400 text-sm">Configure as credenciais SSH para coleta de dados do Wazuh</p>
          </div>

          {/* Mensagem de feedback SSH */}
          {sshMessage && (
            <div className={`mb-6 px-4 py-3 rounded-lg border ${
              sshMessage.type === 'success' 
                ? 'bg-green-900/30 border-green-500 text-green-200' 
                : 'bg-red-900/30 border-red-500 text-red-200'
            }`}>
              {sshMessage.text}
            </div>
          )}

          <div className="space-y-6">
            {/* Campos básicos */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Endereço IP
                </label>
                <input
                  type="text"
                  value={sshConfig.ip}
                  onChange={(e) => handleSSHConfigChange('ip', e.target.value)}
                  placeholder="Ex: 192.168.1.100"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Usuário SSH
                </label>
                <input
                  type="text"
                  value={sshConfig.username}
                  onChange={(e) => handleSSHConfigChange('username', e.target.value)}
                  placeholder="Ex: root ou ubuntu"
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tipo de autenticação */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Tipo de Autenticação
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="password"
                    checked={sshConfig.authType === 'password'}
                    onChange={(e) => handleSSHConfigChange('authType', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-300">Autenticação por Senha</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="key"
                    checked={sshConfig.authType === 'key'}
                    onChange={(e) => handleSSHConfigChange('authType', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-300">Autenticação por Chave SSH</span>
                </label>
              </div>
            </div>

            {/* Campo de Senha ou Chave SSH */}
            {sshConfig.authType === 'password' ? (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showSSHPassword ? "text" : "password"}
                    value={sshConfig.password}
                    onChange={(e) => handleSSHConfigChange('password', e.target.value)}
                    placeholder="Digite a senha SSH"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSSHPassword(!showSSHPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showSSHPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Chave SSH (Privada)
                </label>
                <textarea
                  value={sshConfig.sshKey}
                  onChange={(e) => handleSSHConfigChange('sshKey', e.target.value)}
                  placeholder="Cole sua chave SSH privada aqui (começando com -----BEGIN...)"
                  rows={6}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
              </div>
            )}

            {/* Status da configuração e conexão */}
            {sshConfig.ip && sshConfig.username && (
              <div className="space-y-4">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="text-sm text-slate-300">
                    <div className="mb-2">
                      <span className="font-semibold text-slate-200">Status da Configuração: </span>
                      <span className="text-green-300">✅ Configurada</span>
                    </div>
                    <div className="space-y-1 text-xs text-slate-400">
                      <div><span className="text-slate-300">IP:</span> {sshConfig.ip}</div>
                      <div><span className="text-slate-300">Usuário:</span> {sshConfig.username}</div>
                      <div><span className="text-slate-300">Autenticação:</span> {sshConfig.authType === 'password' ? 'Senha' : 'Chave SSH'}</div>
                    </div>
                  </div>
                </div>

                {/* Status de Conexão */}
                <div className={`border rounded-lg p-4 ${
                  sshConnectionStatus.connected
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-yellow-900/20 border-yellow-500/30'
                }`}>
                  <div className="text-sm">
                    <div className="mb-2">
                      <span className="font-semibold text-slate-200">Status da Conexão: </span>
                      {sshConnectionStatus.connected ? (
                        <span className="text-green-300 font-semibold">🟢 Conectado</span>
                      ) : (
                        <span className="text-yellow-300 font-semibold">🟡 Não Testado</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      <div><span className="text-slate-300">Última Conexão:</span> {formatConnectionTime(sshConnectionStatus.lastConnectionTime)}</div>
                      {sshConnectionStatus.lastErrorMessage && (
                        <div className="mt-1 text-red-300"><span className="text-slate-300">Último Erro:</span> {sshConnectionStatus.lastErrorMessage}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleSaveSSHConfig}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                💾 Salvar Configuração
              </button>
              
              {sshConfig.ip && sshConfig.username && (
                <>
                  <button
                    onClick={handleTestSSHConnection}
                    disabled={isTestingConnection}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    {isTestingConnection ? (
                      <>
                        <span className="inline-block animate-spin">⏳</span>
                        Testando...
                      </>
                    ) : (
                      '🔗 Testar Conexão'
                    )}
                  </button>
                  
                  <button
                    onClick={handleClearSSHConfig}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                  >
                    🗑️ Limpar Configuração
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
