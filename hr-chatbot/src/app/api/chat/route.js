import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServiceSupabase } from '@/lib/supabase'
import { ROLE_MAP, ROLE_NAMES } from '@/lib/interviewFlow'
import { scoreCandidate } from '@/lib/scoring'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request) {
  try {
    const { message, sessionId, candidateId, currentStep, collectedData } = await request.json()
    const supabase = getServiceSupabase()

    const { nextStep, extractedData, botResponse } = await processStep(currentStep, message, collectedData, supabase)

    const updatedData = { ...collectedData, ...extractedData }

    if (candidateId) {
      await supabase.from('candidates').update({
        ...updatedData,
        updated_at: new Date().toISOString(),
      }).eq('id', candidateId)
    }

    let roleQuestions = []
    if (nextStep === 'role_specific_questions') {
      const role = updatedData.applied_role
      const { data: roleData } = await supabase
        .from('roles').select('specific_questions').eq('name', role).single()
      roleQuestions = roleData?.specific_questions || []
    }

    if (nextStep === 'complete') {
      await finalizeCandidate(candidateId, updatedData, supabase)
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
  const name = collectedData.full_name || ''
  const firstName = name.split(' ')[0] || ''

  switch (currentStep) {
    case 'welcome':
      return {
        nextStep: 'personal_name',
        extractedData: {},
        botResponse: `Wonderful! Let's get started. 😊\n\n**What is your full name?**`,
      }

    case 'personal_name': {
      const fullName = userMessage.trim()
      const first = fullName.split(' ')[0]
      return {
        nextStep: 'personal_email',
        extractedData: { full_name: fullName },
        botResponse: `Happy to meet you, ${first}! 👋\n\nI'll be guiding you through this screening process today.\n\n**What is your email address?**\n*(We'll use this to send you updates about your application)*`,
      }
    }

    case 'personal_email': {
      const email = extractEmail(userMessage)
      if (!email) {
        return {
          nextStep: 'personal_email',
          extractedData: {},
          botResponse: `Hmm, that doesn't look like a valid email address. Could you please double-check and enter a valid email? *(e.g., yourname@gmail.com)*`,
        }
      }
      return {
        nextStep: 'personal_phone',
        extractedData: { email },
        botResponse: `Got it! ✅\n\n**What is your mobile number?**\n*(Please include country code if you're outside India, e.g. +1 for US)*`,
      }
    }

    case 'personal_phone':
      return {
        nextStep: 'personal_dob',
        extractedData: { phone: userMessage.trim() },
        botResponse: `Thank you.\n\n**What is your date of birth?**\n*(Format: DD/MM/YYYY)*`,
      }

    case 'personal_dob':
      return {
        nextStep: 'personal_location',
        extractedData: { dob: userMessage.trim() },
        botResponse: `**Which city or location are you currently based in?**`,
      }

    case 'personal_location':
      return {
        nextStep: 'applied_role',
        extractedData: { location: userMessage.trim() },
        botResponse: `Great, noted! 📍\n\n**Which role are you applying for?**\n\nHere are our current openings:\n1. Software Engineer\n2. Data Analyst\n3. HR Executive\n4. Sales Executive\n5. Customer Support\n\nPlease type the role name or its number.`,
      }

    case 'applied_role': {
      const role = ROLE_MAP[userMessage.trim()] ||
        ROLE_NAMES.find(r => r.toLowerCase().includes(userMessage.toLowerCase().split(' ')[0])) ||
        userMessage.trim()
      return {
        nextStep: 'education_qualification',
        extractedData: { applied_role: role },
        botResponse: `Excellent choice! You're applying for **${role}**. 🎯\n\nLet's move on to your educational background.\n\n**What is your highest educational qualification?**\n*(e.g., B.Tech, MBA, B.Com, MCA, Diploma, 12th Pass)*`,
      }
    }

    case 'education_qualification':
      return {
        nextStep: 'education_institution',
        extractedData: { highest_qualification: userMessage.trim() },
        botResponse: `**Which college or university did you attend?**`,
      }

    case 'education_institution':
      return {
        nextStep: 'education_year',
        extractedData: { institution: userMessage.trim() },
        botResponse: `**What year did you graduate or pass out?**`,
      }

    case 'education_year':
      return {
        nextStep: 'education_field',
        extractedData: { graduation_year: userMessage.trim() },
        botResponse: `**What was your field or stream of study?**\n*(e.g., Computer Science, Finance, Marketing, Commerce)*`,
      }

    case 'education_field': {
      return {
        nextStep: 'experience_years',
        extractedData: { field_of_study: userMessage.trim() },
        botResponse: `Perfect! Now let's talk about your work experience.\n\n**How many years of total work experience do you have?**\n*(Type "0" or "Fresher" if you're a fresh graduate)*`,
      }
    }

    case 'experience_years': {
      const isFresher = userMessage.toLowerCase().includes('fresher') || userMessage.trim() === '0'
      const years = parseFloat(userMessage) || 0
      if (isFresher || years === 0) {
        return {
          nextStep: 'compensation_last_ctc',
          extractedData: {
            total_experience_years: 0,
            current_company: 'N/A',
            current_job_role: 'Fresher',
            experience_details: [],
          },
          botResponse: `No worries at all! Fresh graduates bring great energy and potential. 🌟\n\nLet's talk about compensation.\n\n**What was your last stipend or CTC? If not applicable, just type "Not Applicable".**`,
        }
      }
      return {
        nextStep: 'experience_current_company',
        extractedData: { total_experience_years: years },
        botResponse: `${years} year${years !== 1 ? 's' : ''} of experience — that's great! 💼\n\n**What is the name of your current or most recent company?**`,
      }
    }

    case 'experience_current_company':
      return {
        nextStep: 'experience_current_role',
        extractedData: { current_company: userMessage.trim() },
        botResponse: `**What is your current or most recent job title or designation?**`,
      }

    case 'experience_current_role':
      return {
        nextStep: 'experience_responsibilities',
        extractedData: { current_job_role: userMessage.trim() },
        botResponse: `Interesting! **Can you briefly describe your key responsibilities in that role?**\n*(2–3 sentences is perfect)*`,
      }

    case 'experience_responsibilities':
      return {
        nextStep: 'compensation_last_ctc',
        extractedData: { experience_details: [{ responsibilities: userMessage.trim() }] },
        botResponse: `Thank you for sharing that. Now let's discuss compensation — these are completely confidential.\n\n**What was your last or current annual CTC (Cost to Company)?**\n*(e.g., 4.5 LPA, ₹45,000/month)*`,
      }

    case 'compensation_last_ctc':
      return {
        nextStep: 'compensation_inhand',
        extractedData: { last_ctc: userMessage.trim() },
        botResponse: `**What is your current monthly in-hand or take-home salary?**`,
      }

    case 'compensation_inhand':
      return {
        nextStep: 'compensation_expected',
        extractedData: { inhand_salary: userMessage.trim() },
        botResponse: `**What is your expected CTC for this new role?**`,
      }

    case 'compensation_expected':
      return {
        nextStep: 'compensation_notice',
        extractedData: { expected_ctc: userMessage.trim() },
        botResponse: `**What is your notice period at your current company?**\n*(e.g., Immediate joiner, 15 days, 30 days, 60 days, 90 days)*`,
      }

    case 'compensation_notice':
      return {
        nextStep: 'career_reason_leaving',
        extractedData: { notice_period: userMessage.trim() },
        botResponse: `Understood. Almost through the main questions now! ${firstName ? `You're doing great, ${firstName}. ` : ''}😊\n\n**Why are you looking for a new opportunity?**\n*(Be honest — there are no wrong answers here!)*`,
      }

    case 'career_reason_leaving':
      return {
        nextStep: 'career_switches',
        extractedData: { reason_for_leaving: userMessage.trim() },
        botResponse: `I appreciate your honesty. **How many job switches have you made so far in your career?**`,
      }

    case 'career_switches':
      return {
        nextStep: 'role_specific_questions',
        extractedData: { job_switches: parseInt(userMessage) || 0 },
        botResponse: `Thank you! Now I have a few questions specific to the **${collectedData.applied_role}** role. Please answer each one thoughtfully — there are no trick questions! 🙂`,
      }

    case 'role_specific_questions':
      return {
        nextStep: 'resume_upload',
        extractedData: {},
        botResponse: `Great answers! 🎉\n\n**Please upload your resume.**\n*(PDF, DOC, DOCX — Max 5MB)*\n\nUse the upload area below 👇`,
      }

    case 'resume_upload':
      return {
        nextStep: 'typing_test',
        extractedData: {},
        botResponse: `Resume received! ✅\n\n**Last step — Typing Speed Test** ⌨️\n\nType the paragraph shown as fast and accurately as you can. You have **60 seconds**.\n\nClick "Start Typing Test" below when ready!`,
      }

    case 'typing_test':
      return {
        nextStep: 'complete',
        extractedData: {},
        botResponse: `🎊 **Interview Complete!**\n\nThank you${firstName ? `, ${firstName}` : ''}! You've done a fantastic job completing the screening interview.\n\n📊 Your profile is being analyzed by our AI system right now.\n\nOur HR team will review everything and reach out within **2–3 business days**.\n\nIf shortlisted, you'll receive a link to schedule your next round.\n\nBest of luck! We'll be in touch soon. 🍀`,
      }

    default:
      return {
        nextStep: 'complete',
        extractedData: {},
        botResponse: `Thank you for completing the interview!`,
      }
  }
}

function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : null
}

async function finalizeCandidate(candidateId, data, supabase) {
  if (!candidateId) return
  try {
    const aiAnalysis = await generateAIAnalysis(data)
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
  } catch (err) {
    console.error('Finalize error:', err)
  }
}

async function generateAIAnalysis(data) {
  try {
    const prompt = `You are a senior HR analyst. Analyze this candidate and return JSON only.

Candidate:
- Name: ${data.full_name}
- Role Applied: ${data.applied_role}
- Experience: ${data.total_experience_years} years
- Current Job: ${data.current_job_role} at ${data.current_company}
- Education: ${data.highest_qualification} in ${data.field_of_study} from ${data.institution} (${data.graduation_year})
- Reason for leaving: ${data.reason_for_leaving}
- Job switches: ${data.job_switches}
- Expected CTC: ${data.expected_ctc}
- Notice Period: ${data.notice_period}
- Typing: ${data.typing_wpm} WPM, ${data.typing_accuracy}% accuracy

Return ONLY this JSON with no extra text:
{
  "ai_observations": "2-3 sentence professional HR summary of this candidate for the role",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "concerns": ["concern 1 if any", "concern 2 if any"]
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    })
    return JSON.parse(response.choices[0].message.content)
  } catch (err) {
    return {
      ai_observations: 'Candidate completed the full interview screening process.',
      strengths: [],
      concerns: [],
    }
  }
}
