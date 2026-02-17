/**
 * HR Chatbot Scoring Engine
 * Scores candidates out of 100 based on multiple factors
 */

export function scoreCandidate(candidateData) {
  const scores = {
    experience: scoreExperience(candidateData),
    skills: scoreSkills(candidateData),
    stability: scoreStability(candidateData),
    communication: scoreCommunication(candidateData),
    roleFit: scoreRoleFit(candidateData),
    typing: scoreTyping(candidateData),
  }

  // Weighted total
  const weights = {
    experience: 0.25,
    skills: 0.20,
    stability: 0.15,
    communication: 0.15,
    roleFit: 0.15,
    typing: 0.10,
  }

  const total = Object.entries(scores).reduce((sum, [key, val]) => {
    return sum + val * weights[key]
  }, 0)

  return {
    ...scores,
    total: Math.round(total * 10) / 10,
  }
}

function scoreExperience(data) {
  const years = parseFloat(data.total_experience_years) || 0
  if (years === 0) return 20
  if (years < 1) return 35
  if (years < 2) return 50
  if (years < 3) return 62
  if (years < 5) return 75
  if (years < 8) return 88
  return 95
}

function scoreSkills(data) {
  // Based on AI-parsed skills match
  const obs = (data.ai_observations || '').toLowerCase()
  const strengths = data.strengths || []
  
  if (strengths.length >= 5) return 90
  if (strengths.length >= 3) return 75
  if (strengths.length >= 1) return 60
  return 40
}

function scoreStability(data) {
  const switches = data.job_switches || 0
  const years = parseFloat(data.total_experience_years) || 1
  const switchRate = switches / Math.max(years, 1)
  
  if (switchRate === 0) return 95
  if (switchRate < 0.5) return 85
  if (switchRate < 1) return 70
  if (switchRate < 1.5) return 55
  return 35
}

function scoreCommunication(data) {
  // Based on completeness of answers and AI observation
  const chatHistory = data.chat_history || []
  const userMessages = chatHistory.filter(m => m.role === 'user')
  const avgLength = userMessages.length > 0
    ? userMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0) / userMessages.length
    : 0
  
  if (avgLength > 200) return 90
  if (avgLength > 100) return 75
  if (avgLength > 50) return 60
  if (avgLength > 20) return 45
  return 30
}

function scoreRoleFit(data) {
  const role = (data.applied_role || '').toLowerCase()
  const currentRole = (data.current_role || '').toLowerCase()
  const obs = (data.ai_observations || '').toLowerCase()
  
  // Simple keyword match - AI will provide better analysis
  if (currentRole.includes(role.split(' ')[0]) || role.includes(currentRole.split(' ')[0])) {
    return 85
  }
  if (obs.includes('good fit') || obs.includes('strong match')) return 80
  if (obs.includes('relevant') || obs.includes('suitable')) return 70
  return 55
}

function scoreTyping(data) {
  const wpm = data.typing_wpm || 0
  const accuracy = data.typing_accuracy || 0
  
  if (!data.typing_test_completed) return 50

  let wpmScore = 0
  if (wpm >= 60) wpmScore = 100
  else if (wpm >= 45) wpmScore = 80
  else if (wpm >= 35) wpmScore = 65
  else if (wpm >= 25) wpmScore = 50
  else wpmScore = 30

  let accScore = 0
  if (accuracy >= 98) accScore = 100
  else if (accuracy >= 95) accScore = 85
  else if (accuracy >= 90) accScore = 70
  else if (accuracy >= 80) accScore = 55
  else accScore = 35

  return Math.round((wpmScore * 0.6 + accScore * 0.4))
}

export function getScoreBadge(score) {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald-600 bg-emerald-50' }
  if (score >= 65) return { label: 'Good', color: 'text-blue-600 bg-blue-50' }
  if (score >= 50) return { label: 'Average', color: 'text-amber-600 bg-amber-50' }
  return { label: 'Below Average', color: 'text-red-600 bg-red-50' }
}
