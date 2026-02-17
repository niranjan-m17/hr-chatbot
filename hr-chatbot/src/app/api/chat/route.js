import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServiceSupabase } from '@/lib/supabase'
import { scoreCandidate } from '@/lib/scoring'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request) {
  try {
    const { message, candidateId, currentStep, collectedData, roleQuestions, roleQIndex } = await request.json()
    const supabase = getServiceSupabase()

    const result = await processStep(
      currentStep, message, collectedData,
      roleQuestions || [], roleQIndex || 0, supabase
    )

    // Save extracted data to DB immediately after every step
    if (candidateId && result.extractedData && Object.keys(result.extractedData).length > 0) {
      const { error } = await supabase.from('candidates')
        .update({ ...result.extractedData, updated_at: new Date().toISOString() })
        .eq('id', candidateId)
      if (error) console.error('DB update error:', error)
    }

    // Finalize if complete
    if (result.nextStep === 'complete' && candidateId) {
      await finalizeCandidate(candidateId, { ...collectedData, ...result.extractedData }, supabase)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Parse years of experience from any text
function parseYears(text) {
  const lower = text.toLowerCase().trim()
  if (lower.includes('fresher') || lower === '0' || lower.includes('no experience') || lower.includes('just graduated')) return 0
  const match = text.match(/(\d+\.?\d*)/)
  return match ? parseFloat(match[1]) : null
}

async function processStep(currentStep, userMessage, collectedData, roleQuestions, roleQIndex, supabase) {
  const name = collectedData.full_name || ''

  switch (currentStep) {

    case 'welcome':
      return {
        nextStep: 'personal_name',
        extractedData: {},
        botResponse: `Great! Let's get started. 😊\n\n**What is your full name?**`,
      }

    case 'personal_name': {
      const fullName = userMessage.trim()
      return {
        nextStep: 'personal_email',
        extractedData: { full_name: fullName },
        botResponse: `Nice to meet you, **${fullName}**! 🙌 Happy to connect with you today.\n\n**What is your email address?**\n*(We'll use this to keep you updated)*`,
      }
    }

    case 'personal_email': {
      const email = userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
      if (!email) {
        return {
          nextStep: 'personal_email',
          extractedData: {},
          botResponse: `Hmm, that doesn't look like a valid email. Could you re-enter it?\n*(Example: yourname@gmail.com)*`,
        }
      }
      return {
        nextStep: 'personal_phone',
        extractedData: { email },
        botResponse: `Got it! ✅\n\n**What is your mobile number?**`,
      }
    }

    case 'personal_phone':
      return {
        nextStep: 'personal_dob',
        extractedData: { phone: userMessage.trim() },
        botResponse: `**What is your date of birth?**\n*(Format: DD/MM/YYYY)*`,
      }

    case 'personal_dob':
      return {
        nextStep: 'personal_location',
        extractedData: { dob: userMessage.trim() },
        botResponse: `**Which city are you currently based in?**`,
      }

    case 'personal_location':
      return {
        nextStep: 'applied_role',
        extractedData: { location: userMessage.trim() },
        botResponse: `Great! 🌍\n\n**Which role are you applying for?**\n\nCurrent openings:\n1. Software Engineer\n2. Data Analyst\n3. HR Executive\n4. Sales Executive\n5. Customer Support\n\nType the number or role name.`,
      }

    case 'applied_role': {
      const roleMap = {
        '1': 'Software Engineer', '2': 'Data Analyst',
        '3': 'HR Executive', '4': 'Sales Executive', '5': 'Customer Support'
      }
      const roleNames = Object.values(roleMap)
      const trimmed = userMessage.trim()
      const role = roleMap[trimmed] ||
        roleNames.find(r => r.toLowerCase().includes(trimmed.toLowerCase())) ||
        trimmed
      return {
        nextStep: 'education_qualification',
        extractedData: { applied_role: role },
        botResponse: `**${role}** — great choice! 🎯\n\nNow let's talk about your education.\n\n**What is your highest educational qualification?**\n*(e.g., B.Tech, MBA, B.Com, Diploma, 12th Pass)*`,
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
        botResponse: `**What was your field or stream of study?**\n*(e.g., Computer Science, Commerce, Marketing)*`,
      }

    case 'education_field':
      return {
        nextStep: 'experience_check',
        extractedData: { field_of_study: userMessage.trim() },
        botResponse: `Got it! 📚\n\n**Are you a fresher (fresh graduate) or do you have work experience?**\n\nType:\n• **Fresher** — if you just graduated\n• **Experienced** — if you have work experience`,
      }

    // NEW STEP: Ask fresher or experienced first
    case 'experience_check': {
      const lower = userMessage.toLowerCase().trim()
      const isFresher = lower.includes('fresher') || lower === 'f' || lower === '1' || lower.includes('fresh') || lower.includes('no exp') || lower.includes('just grad')

      if (isFresher) {
        return {
          nextStep: 'compensation_expected',
          extractedData: {
            total_experience_years: 0,
            current_company: 'N/A',
            current_job_role: 'Fresher',
            last_ctc: 'N/A',
            inhand_salary: 'N/A',
          },
          botResponse: `Welcome, fresh graduate! 🎓 That's perfectly fine — everyone starts somewhere!\n\n**What is your expected salary for this role?**\n*(e.g., 3 LPA, 4.5 LPA)*`,
        }
      }

      return {
        nextStep: 'experience_years',
        extractedData: {},
        botResponse: `Great! Let's learn more about your experience. 💼\n\n**How many total years of work experience do you have?**\n*(e.g., 1, 2.5, 5)*`,
      }
    }

    case 'experience_years': {
      const years = parseYears(userMessage)
      if (years === null) {
        return {
          nextStep: 'experience_years',
          extractedData: {},
          botResponse: `Could you enter just the number of years?\n*(e.g., type "2" for 2 years, "0.5" for 6 months)*`,
        }
      }
      return {
        nextStep: 'experience_current_company',
        extractedData: { total_experience_years: years },
        botResponse: `${years} year${years !== 1 ? 's' : ''} — impressive! 💼\n\n**What is the name of your current or most recent company?**`,
      }
    }

    case 'experience_current_company':
      return {
        nextStep: 'experience_current_job_role',
        extractedData: { current_company: userMessage.trim() },
        botResponse: `**What is your current or most recent job title?**`,
      }

    case 'experience_current_job_role':
      return {
        nextStep: 'experience_responsibilities',
        extractedData: { current_job_role: userMessage.trim() },
        botResponse: `**Briefly describe your key responsibilities there.**\n*(2-3 sentences is perfect)*`,
      }

    case 'experience_responsibilities':
      return {
        nextStep: 'compensation_last_ctc',
        extractedData: { experience_details: [{ responsibilities: userMessage.trim() }] },
        botResponse: `Sounds like great experience! 👍\n\n**What was your last or current annual CTC?**\n*(e.g., 4.5 LPA)*`,
      }

    case 'compensation_last_ctc':
      return {
        nextStep: 'compensation_inhand',
        extractedData: { last_ctc: userMessage.trim() },
        botResponse: `**What is your current take-home salary per month?**`,
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
        botResponse: `**What is your notice period?**\n*(e.g., Immediate joiner, 15 days, 30 days, 60 days)*`,
      }

    case 'compensation_notice':
      return {
        nextStep: 'career_reason_leaving',
        extractedData: { notice_period: userMessage.trim() },
        botResponse: `**Why are you looking for a new opportunity?**\n*(Be honest — there are no wrong answers! 😊)*`,
      }

    case 'career_reason_leaving':
      return {
        nextStep: 'career_switches',
        extractedData: { reason_for_leaving: userMessage.trim() },
        botResponse: `I understand, makes complete sense! 🤝\n\n**How many job switches have you made in your career so far?**\n*(Type a number, e.g. 0, 1, 2)*`,
      }

    case 'career_switches': {
      const switches = parseInt(userMessage) || 0
      // Fetch role-specific questions
      let fetchedQuestions = []
      const role = collectedData.applied_role
      if (supabase && role) {
        const { data: roleData } = await supabase
          .from('roles').select('specific_questions')
          .eq('name', role).single()
        fetchedQuestions = roleData?.specific_questions || []
      }

      if (!fetchedQuestions.length) {
        return {
          nextStep: 'resume_upload',
          extractedData: { job_switches: switches },
          botResponse: `Got it! 📝\n\nAlmost done! 🎉\n\nPlease upload your resume below 👇\n*(PDF, DOC, DOCX — Max 5MB)*`,
          showResumeUpload: true,
        }
      }

      return {
        nextStep: 'role_specific_questions',
        extractedData: { job_switches: switches },
        botResponse: `Perfect! Now I have **${fetchedQuestions.length} quick questions** specific to the **${role}** role. 🎯\n\n**Q1: ${fetchedQuestions[0].question}**`,
        roleQuestions: fetchedQuestions,
        roleQIndex: 0,
      }
    }

    case 'role_specific_questions': {
      const currentQ = roleQuestions[roleQIndex]
      const answers = collectedData.role_answers || []
      const updatedAnswers = [...answers, {
        question: currentQ?.question,
        answer: userMessage.trim()
      }]
      const nextIndex = roleQIndex + 1

      if (nextIndex < roleQuestions.length) {
        return {
          nextStep: 'role_specific_questions',
          extractedData: { role_answers: updatedAnswers },
          botResponse: `Great answer! 👍\n\n**Q${nextIndex + 1}: ${roleQuestions[nextIndex].question}**`,
          roleQuestions,
          roleQIndex: nextIndex,
        }
      }

      return {
        nextStep: 'resume_upload',
        extractedData: { role_answers: updatedAnswers },
        botResponse: `Excellent! You did really well on those questions! 🌟\n\nAlmost done!\n\nPlease upload your resume below 👇\n*(PDF, DOC, DOCX — Max 5MB)*`,
        showResumeUpload: true,
      }
    }

    case 'resume_upload':
      return {
        nextStep: 'typing_test',
        extractedData: {},
        botResponse: `Resume received! ✅\n\nOne last step — a **60-second Typing Speed Test** ⌨️\n\nClick **"Start Typing Test"** below when ready!`,
        showTypingTest: true,
      }

    case 'typing_test': {
      const finalName = collectedData.full_name || 'there'
      return {
        nextStep: 'complete',
        extractedData: {},
        botResponse: `🎊 **Interview Complete, ${finalName}!**\n\nThank you so much for your time today. It was great connecting with you!\n\n✅ Your responses have been recorded and are being reviewed by our AI.\n\n📧 Our HR team will get back to you within **2–3 business days**.\n\nIf shortlisted, you'll receive an **email with a scheduling link** to book your next round interview.\n\nAll the best! 🍀 Have a wonderful day!`,
        isComplete: true,
      }
    }

    default:
      return {
        nextStep: 'complete',
        extractedData: {},
        botResponse: `Thank you for completing the interview! Our team will be in touch soon. 🙏`,
        isComplete: true,
      }
  }
}

async function finalizeCandidate(candidateId, data, supabase) {
  try {
    const aiAnalysis = await generateAIAnalysis(data)
    const scores = scoreCandidate({ ...data, ...aiAnalysis })

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `You are a senior HR analyst. Analyze this candidate and respond ONLY with valid JSON.

Candidate Profile:
- Name: ${data.full_name}
- Role Applied: ${data.applied_role}
- Experience: ${data.total_experience_years} years
- Current Role: ${data.current_job_role} at ${data.current_company}
- Education: ${data.highest_qualification} in ${data.field_of_study} from ${data.institution}
- Reason for leaving: ${data.reason_for_leaving}
- Job switches: ${data.job_switches}
- Expected CTC: ${data.expected_ctc}
- Notice Period: ${data.notice_period}

Respond ONLY with this JSON:
{
  "ai_observations": "2-3 sentence professional summary for HR review",
  "strengths": ["strength1", "strength2", "strength3"],
  "concerns": ["concern1", "concern2"]
}`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    })
    return JSON.parse(response.choices[0].message.content)
  } catch (err) {
    return {
      ai_observations: 'Candidate completed the screening interview.',
      strengths: [], concerns: [],
    }
  }
}
