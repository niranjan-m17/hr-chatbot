'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { STEP_MESSAGES } from '@/lib/interviewFlow'
import TypingTest from '@/components/TypingTest'
import ResumeUpload from '@/components/ResumeUpload'

function renderText(text) {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
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
  const [roleAnswers, setRoleAnswers] = useState([])
  const [showTypingTest, setShowTypingTest] = useState(false)
  const [showResumeUpload, setShowResumeUpload] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [started, setStarted] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const addMessage = (role, content, extra = {}) => {
    setMessages(prev => [...prev, { role, content, id: Date.now() + Math.random(), ...extra }])
  }

  const startInterview = async () => {
    setStarted(true)
    // Create candidate record in DB
    const { data, error } = await supabase
      .from('candidates')
      .insert({ status: 'in_progress' })
      .select()
      .single()
    
    if (data) setCandidateId(data.id)

    addMessage('assistant', STEP_MESSAGES.welcome)
  }

  const sendMessage = async (messageToSend) => {
    const userMsg = messageToSend || input.trim()
    if (!userMsg || isLoading) return

    setInput('')
    addMessage('user', userMsg)
    setIsLoading(true)

    // Handle role-specific questions inline
    if (currentStep === 'role_specific_questions' && roleQuestions.length > 0) {
      const newAnswers = [...roleAnswers, { question: roleQuestions[roleQIndex]?.question, answer: userMsg }]
      setRoleAnswers(newAnswers)

      if (roleQIndex < roleQuestions.length - 1) {
        const nextQ = roleQuestions[roleQIndex + 1]
        setRoleQIndex(prev => prev + 1)
        setIsLoading(false)
        setTimeout(() => addMessage('assistant', `**Q${roleQIndex + 2}:** ${nextQ.question}`), 400)
        return
      }
      // All role questions answered - proceed
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          candidateId,
          currentStep,
          collectedData: { ...collectedData, role_answers: roleAnswers },
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setCollectedData(data.updatedData || {})
      setCurrentStep(data.nextStep)

      // Handle special steps
      if (data.nextStep === 'role_specific_questions' && data.roleQuestions?.length) {
        setRoleQuestions(data.roleQuestions)
        setRoleQIndex(0)
        setTimeout(() => {
          addMessage('assistant', data.botResponse)
          setTimeout(() => {
            addMessage('assistant', `**Q1:** ${data.roleQuestions[0].question}`)
          }, 600)
        }, 400)
      } else if (data.nextStep === 'resume_upload') {
        setTimeout(() => {
          addMessage('assistant', data.botResponse)
          setShowResumeUpload(true)
        }, 400)
      } else if (data.nextStep === 'typing_test') {
        setShowResumeUpload(false)
        setTimeout(() => {
          addMessage('assistant', data.botResponse)
          setTimeout(() => setShowTypingTest(true), 800)
        }, 400)
      } else if (data.isComplete) {
        setShowTypingTest(false)
        setIsComplete(true)
        setTimeout(() => addMessage('assistant', data.botResponse), 400)
      } else {
        setTimeout(() => addMessage('assistant', data.botResponse), 400)
      }
    } catch (err) {
      addMessage('assistant', '⚠️ Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleTypingComplete = async (results) => {
    // Save typing results
    if (candidateId) {
      await supabase.from('candidates').update({
        typing_wpm: results.wpm,
        typing_accuracy: results.accuracy,
        typing_test_completed: true,
      }).eq('id', candidateId)
    }
    addMessage('user', `⌨️ Typing test completed: ${results.wpm} WPM, ${results.accuracy}% accuracy`)
    setShowTypingTest(false)
    setCollectedData(prev => ({ ...prev, typing_wpm: results.wpm, typing_accuracy: results.accuracy, typing_test_completed: true }))
    await sendMessage('TYPING_TEST_DONE')
  }

  const handleResumeUploaded = (url, filename) => {
    addMessage('user', `📎 Resume uploaded: ${filename}`)
    setCollectedData(prev => ({ ...prev, resume_url: url, resume_filename: filename }))
    sendMessage('RESUME_UPLOADED')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isInputDisabled = isLoading || showTypingTest || showResumeUpload || isComplete ||
    currentStep === 'resume_upload' || currentStep === 'typing_test'

  if (!started) {
    return <LandingScreen onStart={startInterview} />
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4361ee] to-[#7b5ea7] flex items-center justify-center">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <div>
            <h1 className="text-sm font-600 text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>TalentScreen AI</h1>
            <p className="text-xs text-slate-500">Interview Assistant</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span className="text-xs text-slate-500">Live Session</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-message flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4361ee] to-[#7b5ea7] flex-shrink-0 flex items-center justify-center mr-2 mt-1">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed chat-text ${
                  msg.role === 'user'
                    ? 'bg-[#4361ee] text-white rounded-tr-sm'
                    : 'bg-white border border-slate-100 shadow-sm text-slate-800 rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant'
                  ? msg.content.split('\n').map((line, i) => (
                      <div key={i} className={line === '' ? 'h-2' : ''}>
                        {renderText(line)}
                      </div>
                    ))
                  : msg.content
                }
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="chat-message flex justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4361ee] to-[#7b5ea7] flex-shrink-0 flex items-center justify-center mr-2 mt-1">
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

          {/* Resume Upload Widget */}
          {showResumeUpload && candidateId && (
            <div className="chat-message flex justify-start">
              <div className="w-full ml-9">
                <ResumeUpload candidateId={candidateId} onUploaded={handleResumeUploaded} />
              </div>
            </div>
          )}

          {/* Typing Test Widget */}
          {showTypingTest && (
            <div className="chat-message flex justify-start">
              <div className="w-full ml-9">
                <TypingTest onComplete={handleTypingComplete} />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input bar */}
      <footer className="bg-white border-t border-slate-100 flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isInputDisabled}
              placeholder={
                isComplete ? 'Interview complete!' :
                showTypingTest ? 'Complete the typing test above...' :
                showResumeUpload ? 'Upload your resume above...' :
                'Type your answer...'
              }
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#4361ee] focus:ring-2 focus:ring-[#4361ee]/10 disabled:bg-slate-50 disabled:cursor-not-allowed transition-all"
              style={{ maxHeight: '120px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isInputDisabled}
              className="w-11 h-11 rounded-xl bg-[#4361ee] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3451d1] transition-colors flex-shrink-0"
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
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4361ee] to-[#f72585] flex items-center justify-center mx-auto mb-8 shadow-2xl">
          <span className="text-white text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>AI</span>
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          Welcome to Your Interview
        </h1>
        <p className="text-slate-400 text-lg mb-2">
          Powered by AI · Takes about 15–20 minutes
        </p>
        <p className="text-slate-500 text-sm mb-10">
          Answer honestly. Our system is fair, structured and judgment-free.
        </p>

        {/* What to expect */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { icon: '💬', label: 'Structured Chat' },
            { icon: '📄', label: 'Resume Upload' },
            { icon: '⌨️', label: 'Typing Test' },
          ].map(item => (
            <div key={item.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-white text-xs">{item.label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#4361ee] to-[#7b5ea7] text-white font-600 text-lg hover:opacity-90 active:scale-98 transition-all shadow-xl shadow-[#4361ee]/30"
        >
          Start Interview →
        </button>
        <p className="text-slate-600 text-xs mt-4">Your responses are securely stored and reviewed by HR only</p>
      </div>
    </div>
  )
}
