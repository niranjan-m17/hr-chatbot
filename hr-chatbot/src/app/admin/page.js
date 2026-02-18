'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Normalize email to lowercase for case-insensitive login
    const normalizedEmail = email.toLowerCase().trim()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    })

    if (error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    router.push('/admin/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl" style={{ background: 'linear-gradient(135deg, #4361ee, #f72585)' }}>
            <span className="text-white text-2xl font-bold">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-slate-500 text-sm mt-1">TalentScreen HR Dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }} className="backdrop-blur border rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@company.com"
              className="w-full border rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full border rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }} className="border rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ background: '#4361ee' }}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          🔒 Restricted to authorized HR personnel only
        </p>
      </div>
    </div>
  )
}
