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

    // Save extracted data to DB immediately
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
        botResponse: `Hi there! 👋 I'm **Zara**, your AI Interview Assistant.\n\nI'm here to guide you through a smooth and structured screening interview. Don't worry — it's conversational, fair, and takes just **15–20 minutes**.\n\n✨ Here's what we'll cover together:\n📋 Getting to know you (personal details)\n🎓 Your educational background\n💼 Work experience & journey\n💰 Compensation expectations\n🎯 Role-specific insights\n📄 Resume upload\n⌨️ Quick typing speed check\n\nReady to begin this journey? Just type **"Yes!"** or **"Let's start!"** and we'll dive right in! 🚀`,
      }

    case 'personal_name': {
      const fullName = userMessage.trim()
      return {
        nextStep: 'personal_email',
        extractedData: { full_name: fullName },
        botResponse: `Wonderful to meet you, **${fullName}**! 🙌\n\nI'm genuinely excited to learn more about you today. Let's make this process as easy as possible.\n\n**What is your email address?**\n*(This is how we'll keep you updated throughout the process)*`,
      }
    }

    case 'personal_email': {
      const email = userMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
      if (!email) {
        return {
          nextStep: 'personal_email',
          extractedData: {},
          botResponse: `Hmm, that doesn't quite look like a valid email address. Could you please re-enter it?\n\n*(Example: yourname@example.com)*`,
        }
      }
      return {
        nextStep: 'personal_phone',
        extractedData: { email },
        botResponse: `Perfect! Got it. ✅\n\n**What is your mobile number?**\n*(Include country code if you're outside India)*`,
      }
    }

    case 'personal_phone':
      return {
        nextStep: 'personal_dob',
        extractedData: { phone: userMessage.trim() },
        botResponse: `Thank you! 📝\n\n**What is your date of birth?**\n*(Please use the format: DD/MM/YYYY)*`,
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
        botResponse: `Great! ${userMessage.trim()} is a wonderful place! 🌍\n\n**Which position are you applying for today?**\n\nWe have the following exciting opportunities:\n1️⃣ Software Engineer\n2️⃣ Data Analyst\n3️⃣ HR Executive\n4️⃣ Sales Executive\n5️⃣ Customer Support\n\nJust type the number or the full role name!`,
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
        botResponse: `**${role}** — fantastic choice! 🎯 This is an excellent opportunity.\n\nNow let's talk about your educational background.\n\n**What is your highest educational qualification?**\n*(For example: B.Tech, MBA, B.Com, Diploma, 12th Pass, etc.)*`,
      }
    }

    case 'education_qualification':
      return {
        nextStep: 'education_institution',
        extractedData: { highest_qualification: userMessage.trim() },
        botResponse: `**Which college, university, or institution did you attend?**`,
      }

    case 'education_institution':
      return {
        nextStep: 'education_year',
        extractedData: { institution: userMessage.trim() },
        botResponse: `**What year did you graduate or complete your studies?**`,
      }

    case 'education_year':
      return {
        nextStep: 'education_field',
        extractedData: { graduation_year: userMessage.trim() },
        botResponse: `**What was your field or specialization?**\n*(For example: Computer Science, Commerce, Marketing, Finance, etc.)*`,
      }

    case 'education_field':
      return {
        nextStep: 'experience_check',
        extractedData: { field_of_study: userMessage.trim() },
        botResponse: `Excellent! 📚 Your educational background looks solid.\n\nNow, let's discuss your professional experience.\n\n**Are you a fresh graduate (Fresher) or do you have work experience?**\n\nPlease type:\n• **"Fresher"** if you just graduated and haven't worked yet\n• **"Experienced"** if you have professional work experience`,
      }

    // Experience check - determines flow
    case 'experience_check': {
      const lower = userMessage.toLowerCase().trim()
      const isFresher = lower.includes('fresher') || lower === 'f' || lower === '1' || 
        lower.includes('fresh') || lower.includes('no exp') || lower.includes('just grad') ||
        lower.includes('graduate')

      if (isFresher) {
        // FRESHER FLOW - skip directly to expected CTC, then role questions
        const role = collectedData.applied_role
        let fetchedQuestions = []
        if (supabase && role) {
          const { data: roleData } = await supabase
            .from('roles').select('specific_questions')
            .eq('name', role).single()
          fetchedQuestions = roleData?.specific_questions || []
        }

        if (!fetchedQuestions.length) {
          return {
            nextStep: 'resume_upload',
            extractedData: {
              total_experience_years: 0,
              current_company: 'N/A',
              current_job_role: 'Fresher',
              last_ctc: 'N/A',
              inhand_salary: 'N/A',
              notice_period: 'Immediate',
              reason_for_leaving: 'N/A',
              job_switches: 0,
            },
            botResponse: `Welcome, fresh graduate! 🎓 That's perfectly fine — we all start somewhere!\n\nLet me ask you this:\n\n**What is your expected salary for this role?**\n*(For example: 3 LPA, 4.5 LPA, ₹25,000/month, etc.)*`,
            skipToResume: true,
          }
        }

        return {
          nextStep: 'compensation_expected_fresher',
          extractedData: {
            total_experience_years: 0,
            current_company: 'N/A',
            current_job_role: 'Fresher',
            last_ctc: 'N/A',
            inhand_salary: 'N/A',
            notice_period: 'Immediate',
            reason_for_leaving: 'N/A',
            job_switches: 0,
          },
          botResponse: `Welcome, fresh graduate! 🎓 Everyone starts their journey here!\n\n**What is your expected salary for this role?**\n*(For example: 3 LPA, 4.5 LPA, ₹25,000/month)*`,
        }
      }

      return {
        nextStep: 'experience_years',
        extractedData: {},
        botResponse: `Great! Let's dive into your professional experience. 💼\n\n**How many total years of work experience do you have?**\n*(Please enter a number: e.g., 1, 2.5, 5)*`,
      }
    }

    // Fresher expected CTC
    case 'compensation_expected_fresher': {
      const role = collectedData.applied_role
      let fetchedQuestions = []
      if (supabase && role) {
        const { data: roleData } = await supabase
          .from('roles').select('specific_questions')
          .eq('name', role).single()
        fetchedQuestions = roleData?.specific_questions || []
      }

      if (!fetchedQuestions.length) {
        return {
          nextStep: 'resume_upload',
          extractedData: { expected_ctc: userMessage.trim() },
          botResponse: `Perfect! 📝 I've noted that down.\n\nAlmost done! 🎉\n\n**Please upload your resume below.**\n*(Accepted formats: PDF, DOC, DOCX — Maximum size: 5MB)*`,
          showResumeUpload: true,
        }
      }

      return {
        nextStep: 'role_specific_questions',
        extractedData: { expected_ctc: userMessage.trim() },
        botResponse: `Perfect! Now I have **${fetchedQuestions.length} quick questions** specific to the **${role}** role. 🎯\n\nThese help us understand your perspective and fit for the position.\n\n**Q1: ${fetchedQuestions[0].question}**`,
        roleQuestions: fetchedQuestions,
        roleQIndex: 0,
      }
    }

    case 'experience_years': {
      const years = parseYears(userMessage)
      if (years === null) {
        return {
          nextStep: 'experience_years',
          extractedData: {},
          botResponse: `Could you please enter just the number of years?\n*(For example: type "2" for 2 years, or "0.5" for 6 months)*`,
        }
      }
      return {
        nextStep: 'experience_current_company',
        extractedData: { total_experience_years: years },
        botResponse: `${years} year${years !== 1 ? 's' : ''} of experience — impressive! 💼\n\n**What is the name of your current or most recent company?**`,
      }
    }

    case 'experience_current_company':
      return {
        nextStep: 'experience_current_job_role',
        extractedData: { current_company: userMessage.trim() },
        botResponse: `**What is your current or most recent job title/designation?**`,
      }

    case 'experience_current_job_role':
      return {
        nextStep: 'experience_responsibilities',
        extractedData: { current_job_role: userMessage.trim() },
        botResponse: `**Could you briefly describe your key responsibilities in that role?**\n\n*(Just 2-3 sentences highlighting your main duties — quality over quantity!)*`,
      }

    case 'experience_responsibilities':
      return {
        nextStep: 'compensation_last_ctc',
        extractedData: { experience_details: [{ responsibilities: userMessage.trim() }] },
        botResponse: `That sounds like valuable experience! 👍\n\nNow, a few questions about compensation.\n\n**What was your last or current annual CTC (Cost to Company)?**\n*(For example: 4.5 LPA, ₹50,000/month)*`,
      }

    case 'compensation_last_ctc':
      return {
        nextStep: 'compensation_inhand',
        extractedData: { last_ctc: userMessage.trim() },
        botResponse: `**What is your current in-hand or take-home salary per month?**`,
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
        botResponse: `Got it! 📝\n\n**What is your notice period at your current company?**\n*(For example: Immediate joiner, 15 days, 30 days, 60 days, 90 days)*`,
      }

    case 'compensation_notice':
      return {
        nextStep: 'career_reason_leaving',
        extractedData: { notice_period: userMessage.trim() },
        botResponse: `**Why are you looking for a new opportunity?**\n\n*(Please be honest — there are truly no wrong answers here! This helps us understand your career goals better.)*`,
      }

    case 'career_reason_leaving':
      return {
        nextStep: 'career_switches',
        extractedData: { reason_for_leaving: userMessage.trim() },
        botResponse: `I completely understand — that makes perfect sense! 🤝\n\n**How many job switches have you made so far in your career?**\n*(Just enter a number: 0, 1, 2, 3, etc.)*`,
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
          botResponse: `Noted! 📝\n\nWe're almost at the finish line! 🎉\n\n**Please upload your resume using the button below.**\n*(Accepted: PDF, DOC, DOCX — Max 5MB)*`,
          showResumeUpload: true,
        }
      }

      return {
        nextStep: 'role_specific_questions',
        extractedData: { job_switches: switches },
        botResponse: `Perfect! Now I have **${fetchedQuestions.length} specialized questions** for the **${role}** position. 🎯\n\nThese will help us understand your unique perspective and fit for this role.\n\n**Q1: ${fetchedQuestions[0].question}**`,
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
          botResponse: `Excellent answer! 👏 I can see you've thought about this.\n\n**Q${nextIndex + 1}: ${roleQuestions[nextIndex].question}**`,
          roleQuestions,
          roleQIndex: nextIndex,
        }
      }

      return {
        nextStep: 'resume_upload',
        extractedData: { role_answers: updatedAnswers },
        botResponse: `Outstanding! 🌟 You did remarkably well on those questions!\n\nWe're in the home stretch now!\n\n**Please upload your resume using the button below.**\n*(Accepted formats: PDF, DOC, DOCX — Maximum size: 5MB)*`,
        showResumeUpload: true,
      }
    }

    case 'resume_upload':
      return {
        nextStep: 'typing_test',
        extractedData: {},
        botResponse: `Resume received! ✅ Thank you!\n\nOne final step — a quick **60-Second Typing Speed Test!** ⌨️\n\nThis helps us gauge your written communication speed. You'll type a given paragraph for exactly 60 seconds.\n\n**Ready?** Click **"Start Typing Test"** below whenever you're ready!`,
        showTypingTest: true,
      }

    case 'typing_test': {
      const finalName = collectedData.full_name || 'there'
      return {
        nextStep: 'complete',
        extractedData: {},
        botResponse: `🎊 **Congratulations, ${finalName}! Your interview is complete!**\n\nThank you so much for your time and thoughtful responses today. It was genuinely wonderful getting to know you and learning about your journey!\n\n✅ **What happens next?**\n• Your responses have been carefully recorded and analyzed by our AI system\n• Our HR team will thoroughly review your complete profile\n• You'll hear back from us within **2–3 business days**\n\n📧 **If you're shortlisted:**\nYou'll receive an email with a personalized scheduling link to book your next round interview at a time that works best for you.\n\nWishing you all the very best! 🍀✨\n\nHave a wonderful day ahead!`,
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
        content: `You are a senior HR analyst. Analyze this candidate comprehensively and respond ONLY with valid JSON.

Candidate Profile:
- Name: ${data.full_name}
- Role Applied: ${data.applied_role}
- Experience: ${data.total_experience_years} years
- Current Role: ${data.current_job_role} at ${data.current_company}
- Education: ${data.highest_qualification} in ${data.field_of_study} from ${data.institution}
- Graduation Year: ${data.graduation_year}
- Reason for leaving: ${data.reason_for_leaving}
- Job switches: ${data.job_switches}
- Last CTC: ${data.last_ctc}
- Expected CTC: ${data.expected_ctc}
- Notice Period: ${data.notice_period}
- Location: ${data.location}
- Typing: ${data.typing_wpm} WPM, ${data.typing_accuracy}% accuracy

Respond ONLY with this exact JSON structure:
{
  "ai_observations": "Professional 2-3 sentence summary highlighting key strengths and overall fit",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "concerns": ["specific concern 1 if any", "specific concern 2 if any"]
}`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    })
    return JSON.parse(response.choices[0].message.content)
  } catch (err) {
    return {
      ai_observations: 'Candidate completed the screening interview successfully.',
      strengths: ['Completed all interview stages'],
      concerns: [],
    }
  }
}
