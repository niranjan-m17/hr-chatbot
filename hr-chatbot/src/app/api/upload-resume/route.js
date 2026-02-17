import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

export async function POST(request) {
  try {
    const supabase = getServiceSupabase()
    const formData = await request.formData()
    const file = formData.get('file')
    const candidateId = formData.get('candidateId')

    if (!file || !candidateId) {
      return NextResponse.json({ error: 'File and candidateId required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF and Word documents allowed' }, { status: 400 })
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${candidateId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) throw uploadError

    // Get signed URL
    const { data: urlData } = await supabase.storage
      .from('resumes')
      .createSignedUrl(filename, 60 * 60 * 24 * 7) // 7 days

    const resumeUrl = urlData?.signedUrl || uploadData.path

    // Update candidate record
    await supabase
      .from('candidates')
      .update({ resume_url: resumeUrl, resume_filename: file.name })
      .eq('id', candidateId)

    return NextResponse.json({ 
      success: true, 
      resumeUrl,
      filename: file.name 
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
