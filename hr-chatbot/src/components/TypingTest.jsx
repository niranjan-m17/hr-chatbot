'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const TYPING_TEXTS = [
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump! The five boxing wizards jump quickly. Sphinx of black quartz, judge my vow.",
  "Communication is the most important skill in any professional environment. Clear and concise writing helps teams collaborate effectively and reduces misunderstandings. Practice makes perfect when it comes to typing speed.",
  "Technology has transformed the modern workplace in countless ways. Remote work, digital collaboration tools, and cloud computing have made it possible for teams to work together from anywhere in the world.",
]

export default function TypingTest({ onComplete }) {
  const [sampleText] = useState(() => TYPING_TEXTS[Math.floor(Math.random() * TYPING_TEXTS.length)])
  const [typed, setTyped] = useState('')
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [results, setResults] = useState(null)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)
  const typedAtFinishRef = useRef('')

  // Continuous 60-second countdown - runs regardless of typing
  useEffect(() => {
    if (!started || finished) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - calculate results with whatever was typed
          clearInterval(timerRef.current)
          const finalTyped = typedAtFinishRef.current
          calculateResults(finalTyped, 60)
          return 0
        }
        return prev - 1
      })
    }, 1000) // Runs every second continuously

    return () => clearInterval(timerRef.current)
  }, [started, finished])

  // Update ref whenever typed changes
  useEffect(() => {
    typedAtFinishRef.current = typed
  }, [typed])

  const calculateResults = useCallback((finalText, elapsedSeconds) => {
    setFinished(true)
    
    const words = finalText.trim().split(/\s+/).filter(Boolean).length
    const minutes = elapsedSeconds / 60
    const wpm = Math.round(words / minutes) || 0

    // Calculate accuracy
    let correct = 0
    const total = finalText.length
    for (let i = 0; i < finalText.length; i++) {
      if (finalText[i] === sampleText[i]) correct++
    }
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

    const res = { 
      wpm: Math.min(Math.max(wpm, 0), 200),
      accuracy: Math.min(Math.max(accuracy, 0), 100)
    }
    setResults(res)
    onComplete(res)
  }, [sampleText, onComplete])

  const handleStart = () => {
    setStarted(true)
    startTimeRef.current = Date.now()
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleInput = (e) => {
    if (!started || finished) return
    const value = e.target.value
    setTyped(value)
    
    // If user completes typing entire text before 60 seconds
    if (value.length >= sampleText.length) {
      clearInterval(timerRef.current)
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      calculateResults(value, elapsed)
    }
  }

  const timerColor = timeLeft <= 10 ? 'text-red-500' : timeLeft <= 20 ? 'text-amber-500' : 'text-emerald-500'

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden w-full max-w-2xl">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4361ee, #7b5ea7)' }} className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-sm">⌨️ Typing Speed Test</h3>
            <p className="text-white/70 text-xs mt-0.5">
              {started ? 'Type as fast and accurately as you can!' : 'Click Start when ready'}
            </p>
          </div>
          {started && !finished && (
            <div className={`text-2xl font-bold ${timerColor} tabular-nums`}>
              {timeLeft}s
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        {!finished ? (
          <>
            {/* Sample text display */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm leading-relaxed font-mono relative select-none">
              {sampleText.split('').map((char, i) => {
                let className = 'text-slate-400'
                if (i < typed.length) {
                  className = typed[i] === char ? 'text-slate-800' : 'text-red-500 bg-red-50'
                }
                if (i === typed.length) className += ' typing-caret border-l-2 border-[#4361ee]'
                return <span key={i} className={className}>{char}</span>
              })}
            </div>

            {/* Input */}
            <textarea
              ref={inputRef}
              value={typed}
              onChange={handleInput}
              disabled={!started || finished}
              placeholder={started ? "Start typing here..." : "Click 'Start Test' to begin"}
              className="w-full h-24 rounded-xl border border-slate-200 p-3 text-sm font-mono resize-none focus:outline-none focus:border-[#4361ee] focus:ring-2 focus:ring-[#4361ee]/10 disabled:bg-slate-50"
            />

            {/* Progress bar */}
            {started && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{typed.length} / {sampleText.length} chars</span>
                  <span>{Math.round((typed.length / sampleText.length) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ background: '#4361ee', width: `${Math.min((typed.length / sampleText.length) * 100, 100)}%` }}
                    className="h-full rounded-full transition-all"
                  />
                </div>
              </div>
            )}

            {!started && (
              <button
                onClick={handleStart}
                style={{ background: '#4361ee' }}
                className="mt-4 w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Start Typing Test →
              </button>
            )}
          </>
        ) : (
          /* Results */
          <div className="text-center py-4">
            <div className="flex justify-center gap-8 mb-6">
              <div>
                <div style={{ color: '#4361ee' }} className="text-4xl font-bold">{results.wpm}</div>
                <div className="text-xs text-slate-500 mt-1">Words per Minute</div>
              </div>
              <div className="w-px bg-slate-100" />
              <div>
                <div className="text-4xl font-bold text-emerald-500">{results.accuracy}%</div>
                <div className="text-xs text-slate-500 mt-1">Accuracy</div>
              </div>
            </div>
            <div className="text-sm text-slate-600">
              {results.wpm >= 60 ? '🚀 Outstanding typing speed!' :
               results.wpm >= 40 ? '✅ Good typing speed!' :
               results.wpm >= 25 ? '👍 Decent typing speed!' :
               '📈 Keep practicing to improve!'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
