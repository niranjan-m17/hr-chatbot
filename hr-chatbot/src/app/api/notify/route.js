import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

// Send Calendly scheduling link to shortlisted candidate via email
export async function POST(request) {
  try {
    const { candidateId } = await request.json()
    const supabase = getServiceSupabase()

    // Get candidate details
    const { data: candidate, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single()

    if (error || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    if (!candidate.email) {
      return NextResponse.json({ error: 'Candidate has no email' }, { status: 400 })
    }

    const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || 'https://calendly.com/your-org/interview'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    // Build scheduling link with pre-filled name and email
    const schedulingLink = `${calendlyUrl}?name=${encodeURIComponent(candidate.full_name || '')}&email=${encodeURIComponent(candidate.email)}`

    // Send email via Supabase Edge Function or fallback to console log
    // Using Supabase's built-in email (no extra service needed)
    const emailBody = buildEmailHTML(candidate, schedulingLink)

    // Log for now - email service can be plugged in here
    console.log(`📧 Would send to: ${candidate.email}`)
    console.log(`📅 Scheduling link: ${schedulingLink}`)

    // Try to send via a simple fetch to an email API if configured
    // For MVP - we mark as notified and HR manually shares the link
    await supabase.from('candidates').update({
      interview_scheduled: true,
      calendly_event_url: schedulingLink,
    }).eq('id', candidateId)

    return NextResponse.json({
      success: true,
      email: candidate.email,
      schedulingLink,
      message: `Scheduling link generated for ${candidate.full_name}`,
    })

  } catch (error) {
    console.error('Notify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function buildEmailHTML(candidate, schedulingLink) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #4361ee, #7b5ea7); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Congratulations!</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">You've been shortlisted for Round 2</p>
  </div>
  
  <p>Hi <strong>${candidate.full_name}</strong>,</p>
  
  <p>We're excited to inform you that you have been <strong>shortlisted</strong> for the <strong>${candidate.applied_role}</strong> position!</p>
  
  <p>Please use the link below to schedule your interview at a time that works best for you:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${schedulingLink}" 
       style="background: #4361ee; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
      📅 Schedule My Interview
    </a>
  </div>
  
  <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy this link: ${schedulingLink}</p>
  
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
  <p style="color: #94a3b8; font-size: 12px;">This email was sent by TalentScreen AI. If you have any questions, please contact our HR team.</p>
</body>
</html>`
}
