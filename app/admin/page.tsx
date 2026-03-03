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
      const updatedUsers = users.filter(u => u.id !== id)
      saveUsers(updatedUsers)
      setMessage({ type: 'success', text: 'Usuário removido com sucesso' })
      
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
      </main>
    </div>
  )
}
