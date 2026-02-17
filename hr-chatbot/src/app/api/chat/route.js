import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServiceSupabase } from '@/lib/supabase'
import { INTERVIEW_STEPS, STEP_MESSAGES, ROLE_MAP, ROLE_NAMES } from '@/lib/interviewFlow'
import { scoreCandidate } from '@/lib/scoring'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request) {
  try {
    const { message, sessionId, candidateId, currentStep, collectedData } = await request.json()
    const supabase = getServiceSupabase()

    // Determine next step and extract data from user's message
    const { nextStep, extractedData, botResponse } = await processStep(
      currentStep,
      message,
      collectedData
    )

    // Merge extracted data
    const updatedData = { ...collectedData, ...extractedData }

    // If candidate exists, update in DB
    if (candidateId) {
      await supabase.from('candidates').update({
        ...updatedData,
        updated_at: new Date().toISOString(),
      }).eq('id', candidateId)
    }

    // If interview complete, generate score + AI analysis
    if (nextStep === 'complete') {
      await finalizeCandidate(candidateId, updatedData, supabase)
    }

    // Get role-specific questions if at that step
    let roleQuestions = []
    if (nextStep === 'role_specific_questions') {
      const role = updatedData.applied_role
      const { data: roleData } = await supabase
        .from('roles')
        .select('specific_questions')
        .eq('name', role)
        .single()
      roleQuestions = roleData?.specific_questions || []
    }

    return NextResponse.json({
      botResponse,
      nextStep,
      updatedData,
      roleQuestions,
      isComplete: nextStep === 'complete',
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function processStep(currentStep, userMessage, collectedData) {
  const stepIndex = INTERVIEW_STEPS.indexOf(currentStep)
  const nextStepName = INTERVIEW_STEPS[stepIndex + 1] || 'complete'

  let extractedData = {}
  let botResponse = ''
  let nextStep = nextStepName

  switch (currentStep) {
    case 'welcome':
      extractedData = {}
      botResponse = formatMessage(STEP_MESSAGES.personal_name, collectedData)
      nextStep = 'personal_name'
      break

    case 'personal_name':
      extractedData = { full_name: userMessage.trim() }
      botResponse = formatMessage(STEP_MESSAGES.personal_email, { name: userMessage.trim() })
      nextStep = 'personal_email'
      break

    case 'personal_email':
      const email = extractEmail(userMessage)
      if (!email) {
        return {
          nextStep: currentStep,
          extractedData: {},
          botResponse: '⚠️ That doesn\'t look like a valid email. Please enter a valid email address (e.g., name@example.com)',
        }
      }
      extractedData = { email }
      botResponse = formatMessage(STEP_MESSAGES.personal_phone, collectedData)
      nextStep = 'personal_phone'
      break

    case 'personal_phone':
      extractedData = { phone: userMessage.trim() }
      botResponse = STEP_MESSAGES.personal_dob
      nextStep = 'personal_dob'
      break

    case 'personal_dob':
      extractedData = { dob: userMessage.trim() }
      botResponse = STEP_MESSAGES.personal_location
      nextStep = 'personal_location'
      break

    case 'personal_location':
      extractedData = { location: userMessage.trim() }
      botResponse = STEP_MESSAGES.applied_role
      nextStep = 'applied_role'
      break

    case 'applied_role':
      const role = ROLE_MAP[userMessage.trim()] || 
        ROLE_NAMES.find(r => r.toLowerCase().includes(userMessage.toLowerCase().split(' ')[0])) ||
        userMessage.trim()
      extractedData = { applied_role: role }
      botResponse = `Great! You're applying for **${role}**.\n\n` + STEP_MESSAGES.education_qualification
      nextStep = 'education_qualification'
      break

    case 'education_qualification':
      extractedData = { highest_qualification: userMessage.trim() }
      botResponse = STEP_MESSAGES.education_institution
      nextStep = 'education_institution'
      break

    case 'education_institution':
      extractedData = { institution: userMessage.trim() }
      botResponse = STEP_MESSAGES.education_year
      nextStep = 'education_year'
      break

    case 'education_year':
      extractedData = { graduation_year: userMessage.trim() }
      botResponse = STEP_MESSAGES.education_field
      nextStep = 'education_field'
      break

    case 'education_field':
      extractedData = { field_of_study: userMessage.trim() }
      botResponse = STEP_MESSAGES.experience_years
      nextStep = 'experience_years'
      break

    case 'experience_years':
      const isFresher = userMessage.toLowerCase().includes('fresher') || userMessage.trim() === '0'
      const years = parseFloat(userMessage) || 0
      extractedData = { total_experience_years: years }
      if (isFresher || years === 0) {
        botResponse = `Welcome, fresh graduate! 🎓\n\nSkipping work experience section.\n\n` + STEP_MESSAGES.compensation_last_ctc
        nextStep = 'compensation_last_ctc'
        extractedData.current_company = 'N/A'
        extractedData.current_role = 'Fresher'
        extractedData.experience_responsibilities = 'N/A'
      } else {
        botResponse = STEP_MESSAGES.experience_current_company
        nextStep = 'experience_current_company'
      }
      break

    case 'experience_current_company':
      extractedData = { current_company: userMessage.trim() }
      botResponse = STEP_MESSAGES.experience_current_role
      nextStep = 'experience_current_role'
      break

    case 'experience_current_role':
      extractedData = { current_role: userMessage.trim() }
      botResponse = STEP_MESSAGES.experience_responsibilities
      nextStep = 'experience_responsibilities'
      break

    case 'experience_responsibilities':
      extractedData = { experience_details: [{ responsibilities: userMessage.trim() }] }
      botResponse = STEP_MESSAGES.compensation_last_ctc
      nextStep = 'compensation_last_ctc'
      break

    case 'compensation_last_ctc':
      extractedData = { last_ctc: userMessage.trim() }
      botResponse = STEP_MESSAGES.compensation_inhand
      nextStep = 'compensation_inhand'
      break

    case 'compensation_inhand':
      extractedData = { inhand_salary: userMessage.trim() }
      botResponse = STEP_MESSAGES.compensation_expected
      nextStep = 'compensation_expected'
      break

    case 'compensation_expected':
      extractedData = { expected_ctc: userMessage.trim() }
      botResponse = STEP_MESSAGES.compensation_notice
      nextStep = 'compensation_notice'
      break

    case 'compensation_notice':
      extractedData = { notice_period: userMessage.trim() }
      botResponse = STEP_MESSAGES.career_reason_leaving
      nextStep = 'career_reason_leaving'
      break

    case 'career_reason_leaving':
      extractedData = { reason_for_leaving: userMessage.trim() }
      botResponse = STEP_MESSAGES.career_switches
      nextStep = 'career_switches'
      break

    case 'career_switches':
      extractedData = { job_switches: parseInt(userMessage) || 0 }
      // Role specific handled by frontend + separate questions
      botResponse = `📋 **Role-Specific Questions**\n\nNow I have a few questions specific to the **${collectedData.applied_role}** role. Please answer them thoughtfully.\n\n`
      nextStep = 'role_specific_questions'
      break

    case 'role_specific_questions':
      // After role questions, go to resume upload
      extractedData = {}
      botResponse = STEP_MESSAGES.resume_upload
      nextStep = 'resume_upload'
      break

    case 'resume_upload':
      // This step is handled via the upload API - frontend triggers next
      extractedData = {}
      botResponse = STEP_MESSAGES.typing_test
      nextStep = 'typing_test'
      break

    case 'typing_test':
      // Typing test handled by frontend component
      extractedData = {}
      botResponse = formatMessage(STEP_MESSAGES.wrap_up, { ...collectedData })
      nextStep = 'complete'
      break

    default:
      botResponse = 'Thank you for completing the interview!'
      nextStep = 'complete'
  }

  return { nextStep, extractedData, botResponse }
}

function formatMessage(template, data) {
  return template.replace(/{(\w+)}/g, (match, key) => data[key] || match)
}

function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

async function finalizeCandidate(candidateId, data, supabase) {
  if (!candidateId) return

  // Generate AI observations
  const aiAnalysis = await generateAIAnalysis(data)
  
  // Calculate scores
  const mergedData = { ...data, ...aiAnalysis }
  const scores = scoreCandidate(mergedData)

  await supabase.from('candidates').update({
    ai_observations: aiAnalysis.ai_observations,
    strengths: aiAnalysis.strengths,
    concerns: aiAnalysis.concerns,
    score_experience: scores.experience,
    score_skills: scores.skills,
    score_stability: scores.stability,
    score_communication: scores.communication,
    score_role_fit: scores.roleFit,
    score_typing: scores.typing,
    total_score: scores.total,
    status: 'completed',
    interview_completed: true,
  }).eq('id', candidateId)
}

async function generateAIAnalysis(data) {
  try {
    const prompt = `You are an HR analyst. Analyze this candidate profile and provide a JSON response.

Candidate Data:
- Name: ${data.full_name}
- Applied Role: ${data.applied_role}
- Experience: ${data.total_experience_years} years
- Current Role: ${data.current_role} at ${data.current_company}
- Education: ${data.highest_qualification} in ${data.field_of_study} from ${data.institution}
- Reason for leaving: ${data.reason_for_leaving}
- Job switches: ${data.job_switches}
- Expected CTC: ${data.expected_ctc}
- Notice Period: ${data.notice_period}
- Responsibilities: ${data.experience_details?.[0]?.responsibilities}

Respond ONLY with valid JSON in this format:
{
  "ai_observations": "2-3 sentence professional summary of this candidate",
  "strengths": ["strength1", "strength2", "strength3"],
  "concerns": ["concern1", "concern2"]
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    })

    return JSON.parse(response.choices[0].message.content)
  } catch (err) {
    console.error('AI analysis error:', err)
    return {
      ai_observations: 'Candidate completed the interview screening process.',
      strengths: [],
      concerns: [],
    }
  }
}
