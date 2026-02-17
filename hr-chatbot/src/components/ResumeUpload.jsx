'use client'
import { useState, useCallback } from 'react'

export default function ResumeUpload({ candidateId, onUploaded }) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState('')
  const [filename, setFilename] = useState('')

  const uploadFile = async (file) => {
    if (!file) return
    
    const allowed = ['application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    
    if (!allowed.includes(file.type)) {
      setError('Please upload a PDF or Word document (.pdf, .doc, .docx)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB')
      return
    }

    setError('')
    setUploading(true)
    setFilename(file.name)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('candidateId', candidateId)

      const res = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      setUploaded(true)
      onUploaded(data.resumeUrl, file.name)
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    uploadFile(file)
  }, [candidateId])

  const handleChange = (e) => {
    const file = e.target.files[0]
    uploadFile(file)
  }

  if (uploaded) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-600 text-emerald-800">Resume uploaded successfully!</p>
          <p className="text-xs text-emerald-600 mt-0.5">{filename}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <label
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`block cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          isDragging
            ? 'border-[#4361ee] bg-[#4361ee]/5 scale-[1.02]'
            : 'border-slate-200 hover:border-[#4361ee]/50 hover:bg-slate-50'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleChange}
          className="hidden"
          disabled={uploading}
        />
        
        {uploading ? (
          <div>
            <div className="w-10 h-10 border-3 border-[#4361ee] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-600">Uploading {filename}...</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-[#4361ee]/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#4361ee]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-600 text-slate-700">Drop your resume here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX · Max 5MB</p>
          </>
        )}
      </label>

      {error && (
        <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
