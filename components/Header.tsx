"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import CacheStatusIndicator from './CacheStatusIndicator'
import { getCurrentUser, logout, canAccessAdmin, type CurrentUser } from '@/lib/auth'

export default function Header() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Carregar usuário atual
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="bg-slate-900 border-b border-slate-800 shadow-sm">
      <div className="container py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-blue-600" />
          <h1 className="text-lg font-bold text-slate-100">Wazuh Alerts</h1>
        </div>
        <div className="flex items-center gap-4">
          <CacheStatusIndicator />
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm text-slate-300 hover:text-white transition">Dashboard</a>
            <a href="/detalhes" className="text-sm text-slate-300 hover:text-white transition">Detalhes</a>
            <a href="/report" className="text-sm text-slate-300 hover:text-white transition">📊 Report</a>
            {canAccessAdmin(currentUser) && (
              <a href="/admin" className="text-sm text-slate-300 hover:text-white transition">⚙️ Configurações</a>
            )}
            {currentUser && (
              <div className="flex items-center gap-3 pl-3 ml-3 border-l border-slate-700">
                <span className="text-sm text-slate-400">
                  {currentUser.name}
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    currentUser.role === 'admin' 
                      ? 'bg-purple-900/40 text-purple-200' 
                      : currentUser.role === 'operador'
                      ? 'bg-orange-900/40 text-orange-200'
                      : 'bg-blue-900/40 text-blue-200'
                  }`}>
                    {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'operador' ? 'Operador' : 'Usuário'}
                  </span>
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-400 hover:text-red-300 transition"
                  title="Sair"
                >
                  🚪 Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
