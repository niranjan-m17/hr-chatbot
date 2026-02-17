'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import TypingTest from '@/components/TypingTest'
import ResumeUpload from '@/components/ResumeUpload'

function renderText(text) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    const rendered = parts.map((part, j) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
        : <span key={j}>{part}</span>
    )
    return <div key={i} className={line === '' ? 'h-2' : ''}>{rendered}</div>
  })
}

export default function InterviewPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState('welcome')
  const [candidateId, setCandidateId] = useState(null)
  const [collectedData, setCollectedData] = useState({})
  const [roleQuestions, setRoleQuestions] = useState([])
  const [roleQIndex, setRoleQIndex] = useState(0)
  const [showTypingTest, setShowTypingTest] = useState(false)
  const [showResumeUpload, setShowResumeUpload] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [started, setStarted] = useState(false)
  const [dbReady, setDbReady] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, showTypingTest, showResumeUpload])

  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content, id: Date.now() + Math.random() }])
  }

  const startInterview = async () => {
    setStarted(true)
    try {
      if (supabase) {
        const { data } = await supabase
          .from('candidates')
          .insert({ status: 'in_progress' })
          .select().single()
        if (data) {
          setCandidateId(data.id)
          setDbReady(true)
        }
      }
    } catch (e) {
      console.error('DB init error:', e)
    }

    addMessage('assistant', `👋 **Welcome to the Interview Portal!**\n\nI'm your AI Interview Assistant. I'll guide you through a structured screening interview — it takes about **15–20 minutes**.\n\nHere's what we'll cover:\n📋 Personal details\n🎓 Education background\n💼 Work experience\n💰 Compensation details\n🎯 Role-specific questions\n📄 Resume upload\n⌨️ Typing speed test\n\nReady to get started? Type **"Yes, let's go!"** to begin.`)
  }

  const sendMessage = async (overrideMessage) => {
    const userMsg = (overrideMessage || input).trim()
    if (!userMsg || isLoading) return
    setInput('')
    if (!overrideMessage) addMessage('user', userMsg)
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          candidateId,
          currentStep,
          collectedData,
          roleQuestions,
          roleQIndex,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Merge new data
      const newData = { ...collectedData, ...(data.extractedData || {}) }
      setCollectedData(newData)
      setCurrentStep(data.nextStep)

      if (data.roleQuestions) setRoleQuestions(data.roleQuestions)
      if (typeof data.roleQIndex === 'number') setRoleQIndex(data.roleQIndex)

      // Show bot response with slight delay
      setTimeout(() => {
        addMessage('assistant', data.botResponse)
        setTimeout(() => {
          if (data.showResumeUpload) { setShowResumeUpload(true); setShowTypingTest(false) }
          if (data.showTypingTest) { setShowTypingTest(true); setShowResumeUpload(false) }
          if (data.isComplete) { setIsComplete(true); setShowTypingTest(false); setShowResumeUpload(false) }
        }, 400)
      }, 400)

    } catch (err) {
      console.error(err)
      addMessage('assistant', '⚠️ Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleTypingComplete = async (results) => {
    if (candidateId && supabase) {
      await supabase.from('candidates').update({
        typing_wpm: results.wpm,
        typing_accuracy: results.accuracy,
        typing_test_completed: true,
      }).eq('id', candidateId)
    }
    setShowTypingTest(false)
    setCollectedData(prev => ({ ...prev, ...results, typing_test_completed: true }))
    addMessage('user', `⌨️ Typing test done — ${results.wpm} WPM · ${results.accuracy}% accuracy`)
    sendMessage('TYPING_TEST_DONE')
  }

  const handleResumeUploaded = (url, filename) => {
    setShowResumeUpload(false)
    setCollectedData(prev => ({ ...prev, resume_url: url, resume_filename: filename }))
    addMessage('user', `📎 Resume uploaded: ${filename}`)
    sendMessage('RESUME_UPLOADED')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const inputDisabled = isLoading || showTypingTest || showResumeUpload || isComplete

  if (!started) return <LandingScreen onStart={startInterview} />

  return (
    <div className="flex flex-col h-screen" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' }}>
      <header className="bg-white border-b border-slate-100 shadow-sm flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4361ee, #7b5ea7)' }}>
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">TalentScreen AI</h1>
            <p className="text-xs text-slate-500">Interview Assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-500">Live Session</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mr-2 mt-1" style={{ background: 'linear-gradient(135deg, #4361ee, #7b5ea7)' }}>
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-tr-sm'
                  : 'bg-white border border-slate-100 shadow-sm text-slate-800 rounded-tl-sm'
              }`} style={msg.role === 'user' ? { background: '#4361ee' } : {}}>
                {msg.role === 'assistant' ? renderText(msg.content) : msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="chat-message flex justify-start">
              <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mr-2 mt-1" style={{ background: 'linear-gradient(135deg, #4361ee, #7b5ea7)' }}>
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  {[0,1,2].map(i => (
                    <div key={i} className="typing-dot w-2 h-2 rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {showResumeUpload && candidateId && (
            <div className="flex justify-start">
              <div className="ml-9 w-full max-w-md">
                <ResumeUpload candidateId={candidateId} onUploaded={handleResumeUploaded} />
              </div>
            </div>
          )}

          {showTypingTest && (
            <div className="flex justify-start">
              <div className="ml-9 w-full">
                <TypingTest onComplete={handleTypingComplete} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="bg-white border-t border-slate-100 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={inputDisabled}
              placeholder={
                isComplete ? '✅ Interview complete — thank you!' :
                showTypingTest ? '⌨️ Complete the typing test above...' :
                showResumeUpload ? '📎 Upload your resume using the widget above...' :
                'Type your answer here...'
              }
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:cursor-not-allowed transition-all"
              style={{ maxHeight: '120px', outlineColor: '#4361ee' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || inputDisabled}
              className="w-11 h-11 rounded-xl text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              style={{ background: '#4361ee' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </footer>
    </div>
  )
}

function LandingScreen({ onStart }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl" style={{ background: 'linear-gradient(135deg, #4361ee, #f72585)' }}>
          <span className="text-white text-3xl font-bold">AI</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Welcome to Your Interview</h1>
        <p className="text-slate-400 text-lg mb-2">Powered by AI · Takes about 15–20 minutes</p>
        <p className="text-slate-500 text-sm mb-10">Answer honestly. Our system is fair and judgment-free.</p>
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[{ icon: '💬', label: 'Structured Chat' }, { icon: '📄', label: 'Resume Upload' }, { icon: '⌨️', label: 'Typing Test' }].map(item => (
            <div key={item.label} className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}>
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-white text-xs">{item.label}</div>
            </div>
          ))}
        </div>
        <button onClick={onStart} className="w-full py-4 rounded-2xl text-white font-semibold text-lg transition-all shadow-xl hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #4361ee, #7b5ea7)' }}>
          Start Interview →
        </button>
        <p className="text-slate-600 text-xs mt-4">Your responses are securely stored and reviewed by HR only</p>
      </div>
    </div>
  )
}
