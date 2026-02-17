'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getScoreBadge } from '@/lib/scoring'
import CandidateModal from '@/components/CandidateModal'

const ROLES = ['all', 'Software Engineer', 'Data Analyst', 'HR Executive', 'Sales Executive', 'Customer Support']
const STATUSES = ['all', 'in_progress', 'completed', 'shortlisted', 'rejected']

export default function DashboardPage() {
  const router = useRouter()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [shortlisting, setShortlisting] = useState(false)
  const [tab, setTab] = useState('all')
  const [notifying, setNotifying] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => { checkAuth(); fetchCandidates() }, [])
  useEffect(() => { fetchCandidates() }, [roleFilter, statusFilter, tab])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const checkAuth = async () => {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/admin')
  }

  const fetchCandidates = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (roleFilter !== 'all') params.set('role', roleFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (tab === 'shortlisted') params.set('shortlisted', 'true')
    const res = await fetch(`/api/candidates?${params}`)
    const data = await res.json()
    setCandidates(data.candidates || [])
    setLoading(false)
  }

  const handleShortlist = async () => {
    if (roleFilter === 'all') { showToast('Please select a specific role first', 'error'); return }
    setShortlisting(true)
    const res = await fetch('/api/shortlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleFilter }),
    })
    const data = await res.json()
    setShortlisting(false)
    if (data.success) {
      showToast(`✅ Shortlisted top ${data.count} candidates for ${roleFilter}`)
      fetchCandidates()
    }
  }

  const handleSendCalendly = async (candidate, e) => {
    e.stopPropagation()
    setNotifying(candidate.id)
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId: candidate.id }),
    })
    const data = await res.json()
    setNotifying(null)
    if (data.success) {
      showToast(`📅 Calendly link sent to ${candidate.full_name}!`)
      fetchCandidates()
    } else {
      showToast(data.error || 'Failed to send', 'error')
    }
  }

  const handleStatusChange = async (id, status, e) => {
    e?.stopPropagation()
    const isShortlisted = status === 'shortlisted'
    await fetch('/api/candidates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, is_shortlisted: isShortlisted }),
    })
    fetchCandidates()
  }

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
    router.push('/admin')
  }

  const filtered = candidates.filter(c => {
    const q = search.toLowerCase()
    return !q || c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.applied_role?.toLowerCase().includes(q)
  })

  const stats = {
    total: candidates.length,
    completed: candidates.filter(c => ['completed','shortlisted'].includes(c.status)).length,
    inProgress: candidates.filter(c => c.status === 'in_progress').length,
    shortlisted: candidates.filter(c => c.is_shortlisted).length,
    avgScore: candidates.length ? Math.round(candidates.reduce((s, c) => s + (c.total_score || 0), 0) / candidates.length) : 0,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4361ee, #7b5ea7)' }}>
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <span className="font-semibold text-slate-900">TalentScreen</span>
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-sm text-slate-500">HR Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { navigator.clipboard.writeText(window.location.origin); showToast('Interview link copied!') }}
              className="text-xs border rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
              style={{ color: '#4361ee', borderColor: 'rgba(67,97,238,0.3)', background: 'rgba(67,97,238,0.05)' }}
            >
              📎 Copy Interview Link
            </button>
            <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-800">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Applicants', value: stats.total, color: 'text-slate-800', bg: 'bg-white' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Round 1 Done', value: stats.completed, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Shortlisted', value: stats.shortlisted, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Avg Score', value: `${stats.avgScore}/100`, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-slate-100`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-50 flex flex-wrap items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-slate-100 rounded-xl p-1 text-xs">
              {[
                { key: 'all', label: `All (${stats.total})` },
                { key: 'shortlisted', label: `⭐ Shortlisted (${stats.shortlisted})` },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${tab === t.key ? 'bg-white text-slate-800 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, role..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none transition-colors" />
            </div>

            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
              {ROLES.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : r}</option>)}
            </select>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white capitalize">
              {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Status' : s}</option>)}
            </select>

            <button onClick={handleShortlist} disabled={shortlisting || roleFilter === 'all'}
              className="px-4 py-2 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
              style={{ background: '#4361ee' }}
              title={roleFilter === 'all' ? 'Select a role first' : ''}>
              {shortlisting ? '⏳ Processing...' : '⭐ Auto-Shortlist Top 10'}
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400">Loading candidates...</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-slate-500 text-sm">No candidates found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-50">
                    {['#', 'Candidate', 'Role', 'Experience', 'Score', 'Typing', 'Round 1 Status', 'Actions'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const score = c.hr_score_override || c.total_score || 0
                    const badge = getScoreBadge(score)
                    const isCompleted = c.interview_completed
                    return (
                      <tr key={c.id}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer ${c.is_shortlisted ? 'bg-emerald-50/30' : ''}`}
                        onClick={() => setSelectedCandidate(c)}>
                        <td className="px-4 py-3.5 text-sm text-slate-400">
                          {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i+1}`}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(67,97,238,0.1)' }}>
                              <span className="text-xs font-bold" style={{ color: '#4361ee' }}>{c.full_name?.charAt(0)?.toUpperCase() || '?'}</span>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{c.full_name || 'Unknown'}</div>
                              <div className="text-xs text-slate-400">{c.email || '—'}</div>
                            </div>
                            {c.is_shortlisted && <span>⭐</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">{c.applied_role || '—'}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {c.total_experience_years > 0 ? `${c.total_experience_years}y` : 'Fresher'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{Math.round(score) || '—'}</span>
                            {score > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${badge.color}`}>{badge.label}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {c.typing_test_completed ? `${c.typing_wpm} WPM` : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            c.interview_completed ? 'bg-blue-100 text-blue-700' :
                            c.status === 'shortlisted' ? 'bg-emerald-100 text-emerald-700' :
                            c.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {c.interview_completed ? '✅ Round 1 Done' :
                             c.status === 'shortlisted' ? '⭐ Shortlisted' :
                             c.status === 'rejected' ? '❌ Rejected' :
                             '⏳ In Progress'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2 items-center">
                            {c.is_shortlisted && !c.calendly_event_url && (
                              <button
                                onClick={(e) => handleSendCalendly(c, e)}
                                disabled={notifying === c.id}
                                className="text-xs px-2 py-1 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
                                style={{ background: '#4361ee' }}
                                title="Send Calendly link to candidate"
                              >
                                {notifying === c.id ? '⏳' : '📅 Send Link'}
                              </button>
                            )}
                            {c.calendly_event_url && (
                              <span className="text-xs text-emerald-600 font-medium">✅ Link Sent</span>
                            )}
                            <select
                              value={c.status}
                              onChange={e => handleStatusChange(c.id, e.target.value, e)}
                              className={`text-xs border rounded-lg px-2 py-1 focus:outline-none cursor-pointer ${
                                c.status === 'shortlisted' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                                c.status === 'rejected' ? 'border-red-200 text-red-700 bg-red-50' :
                                c.status === 'completed' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                'border-slate-200 text-slate-600'
                              }`}>
                              {STATUSES.filter(s => s !== 'all').map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onRefresh={fetchCandidates}
        />
      )}
    </div>
  )
}
