'use client'
import { useState } from 'react'
import { getScoreBadge } from '@/lib/scoring'

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/your-org/interview'

function ScoreBar({ label, value, color = '#4361ee' }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-600 text-slate-700">{Math.round(value)}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  )
}

function ScoreCircle({ score }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const badge = getScoreBadge(score)

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={score >= 80 ? '#10b981' : score >= 65 ? '#4361ee' : score >= 50 ? '#f59e0b' : '#ef4444'}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring transition-all duration-1000"
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="text-center -mt-16">
        <div className="text-3xl font-bold text-slate-800">{Math.round(score)}</div>
        <div className="text-xs text-slate-400">/ 100</div>
      </div>
      <div className={`mt-2 text-xs px-2 py-0.5 rounded-full font-500 ${badge.color}`}>
        {badge.label}
      </div>
    </div>
  )
}

export default function CandidateModal({ candidate: c, onClose, onScoreOverride, onStatusChange, onRefresh }) {
  const [overrideScore, setOverrideScore] = useState(c.hr_score_override || '')
  const [notes, setNotes] = useState(c.hr_notes || '')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('profile')

  const displayScore = c.hr_score_override || c.total_score || 0

  const handleSave = async () => {
    setSaving(true)
    const updates = { id: c.id, hr_notes: notes }
    if (overrideScore !== '') updates.hr_score_override = parseFloat(overrideScore)

    await fetch('/api/candidates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setSaving(false)
    onRefresh()
  }

  const handleCalendly = () => {
    const url = `${CALENDLY_URL}?name=${encodeURIComponent(c.full_name || '')}&email=${encodeURIComponent(c.email || '')}`
    window.open(url, '_blank')
  }

  const handleExport = () => {
    const exportData = {
      profile: {
        name: c.full_name, email: c.email, phone: c.phone,
        location: c.location, role: c.applied_role,
      },
      education: { qualification: c.highest_qualification, institution: c.institution, year: c.graduation_year },
      experience: { years: c.total_experience_years, company: c.current_company, role: c.current_job_role },
      compensation: { last_ctc: c.last_ctc, expected: c.expected_ctc, notice: c.notice_period },
      scores: { total: displayScore, experience: c.score_experience, skills: c.score_skills },
      ai_observations: c.ai_observations,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${c.full_name?.replace(/\s+/g, '_')}_profile.json`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0f172a] to-[#1e1b4b] p-6 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <span className="text-white text-xl font-bold">{c.full_name?.charAt(0) || '?'}</span>
              </div>
              <div>
                <h2 className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  {c.full_name || 'Unknown Candidate'}
                </h2>
                <p className="text-slate-400 text-sm">{c.email} · {c.phone}</p>
                <p className="text-slate-500 text-xs mt-0.5">{c.applied_role} · {c.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {c.is_shortlisted && (
                <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/30">
                  ⭐ Shortlisted
                </span>
              )}
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCalendly}
              className="px-4 py-2 bg-[#4361ee] text-white rounded-xl text-xs font-600 hover:bg-[#3451d1] transition-colors"
            >
              📅 Schedule Interview
            </button>
            {c.resume_url && (
              <a
                href={c.resume_url}
                target="_blank"
                className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs hover:bg-white/20 transition-colors"
              >
                📄 View Resume
              </a>
            )}
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs hover:bg-white/20 transition-colors"
            >
              ⬇️ Export
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 flex-shrink-0 px-2">
          {['profile', 'scores', 'notes'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm capitalize border-b-2 transition-colors ${
                tab === t
                  ? 'border-[#4361ee] text-[#4361ee] font-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'profile' && (
            <div className="space-y-6">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Education', value: `${c.highest_qualification} — ${c.field_of_study}` },
                  { label: 'Institution', value: c.institution },
                  { label: 'Graduation', value: c.graduation_year },
                  { label: 'Experience', value: c.total_experience_years ? `${c.total_experience_years} years` : 'Fresher' },
                  { label: 'Current Company', value: c.current_company },
                  { label: 'Current Role', value: c.current_job_role },
                  { label: 'Last CTC', value: c.last_ctc },
                  { label: 'Expected CTC', value: c.expected_ctc },
                  { label: 'Notice Period', value: c.notice_period },
                  { label: 'Job Switches', value: c.job_switches },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                    <div className="text-xs text-slate-400 mb-0.5">{item.label}</div>
                    <div className="text-sm font-500 text-slate-800">{item.value || '—'}</div>
                  </div>
                ))}
              </div>

              {/* Typing test */}
              {c.typing_test_completed && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-xs font-600 text-slate-500 mb-3 uppercase tracking-wide">⌨️ Typing Test</div>
                  <div className="flex gap-8">
                    <div>
                      <div className="text-2xl font-bold text-[#4361ee]">{c.typing_wpm}</div>
                      <div className="text-xs text-slate-400">WPM</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-500">{c.typing_accuracy}%</div>
                      <div className="text-xs text-slate-400">Accuracy</div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Observations */}
              {c.ai_observations && (
                <div className="bg-[#4361ee]/5 border border-[#4361ee]/10 rounded-xl p-4">
                  <div className="text-xs font-600 text-[#4361ee] mb-2">🤖 AI Analysis</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{c.ai_observations}</p>
                  {c.strengths?.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-slate-500 mb-1">Strengths</div>
                      <div className="flex flex-wrap gap-1">
                        {c.strengths.map((s, i) => (
                          <span key={i} className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.concerns?.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-500 mb-1">Concerns</div>
                      <div className="flex flex-wrap gap-1">
                        {c.concerns.map((s, i) => (
                          <span key={i} className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reason for leaving */}
              {c.reason_for_leaving && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-xs text-slate-400 mb-1">Reason for Leaving</div>
                  <p className="text-sm text-slate-700">{c.reason_for_leaving}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'scores' && (
            <div className="space-y-6">
              <div className="flex justify-center mb-4">
                <ScoreCircle score={displayScore} />
              </div>
              <div className="space-y-4">
                <ScoreBar label="Experience" value={c.score_experience || 0} color="#4361ee" />
                <ScoreBar label="Skills" value={c.score_skills || 0} color="#7b5ea7" />
                <ScoreBar label="Stability" value={c.score_stability || 0} color="#06b6d4" />
                <ScoreBar label="Communication" value={c.score_communication || 0} color="#10b981" />
                <ScoreBar label="Role Fit" value={c.score_role_fit || 0} color="#f59e0b" />
                <ScoreBar label="Typing" value={c.score_typing || 0} color="#f72585" />
              </div>

              {/* Score override */}
              <div className="border-t border-slate-100 pt-4">
                <div className="text-xs font-600 text-slate-500 mb-2">HR Score Override</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={overrideScore}
                    onChange={e => setOverrideScore(e.target.value)}
                    placeholder={`Current: ${Math.round(displayScore)}`}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4361ee]"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-[#4361ee] text-white rounded-xl text-sm font-600 hover:bg-[#3451d1] disabled:opacity-50"
                  >
                    {saving ? '...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-600 text-slate-500 mb-2">HR Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes about this candidate..."
                  rows={6}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-[#4361ee]"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-slate-500 mb-2">Status</label>
                <select
                  value={c.status}
                  onChange={e => onStatusChange(c.id, e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4361ee] w-full"
                >
                  {['in_progress','completed','shortlisted','rejected'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-[#4361ee] text-white rounded-xl text-sm font-600 hover:bg-[#3451d1] disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
