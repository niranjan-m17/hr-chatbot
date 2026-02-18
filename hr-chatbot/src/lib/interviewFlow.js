/**
 * Interview Flow Steps
 * Each step defines what data to collect
 */

export const INTERVIEW_STEPS = [
  'welcome',
  'personal_name',
  'personal_email',
  'personal_phone',
  'personal_dob',
  'personal_location',
  'applied_role',
  'education_qualification',
  'education_institution',
  'education_year',
  'education_field',
  'experience_years',
  'experience_current_company',
  'experience_current_role',
  'experience_responsibilities',
  'compensation_last_ctc',
  'compensation_inhand',
  'compensation_expected',
  'compensation_notice',
  'career_reason_leaving',
  'career_switches',
  'role_specific_questions',
  'resume_upload',
  'typing_test',
  'wrap_up',
  'complete',
]

export const STEP_MESSAGES = {
  welcome: `👋 Welcome to the Interview Portal!

I'm your AI Interview Assistant. I'll guide you through a structured screening interview — it takes about **15-20 minutes**.

Here's what we'll cover:
📋 Personal details
🎓 Education background  
💼 Work experience
💰 Compensation details
🎯 Role-specific questions
📄 Resume upload
⌨️ Typing speed test

Ready to get started? Type **"Yes, let's go!"** to begin.`,

  personal_name: `Great! Let's start with the basics.

**What is your full name?**`,

  personal_email: `Nice to meet you, {name}! 

**What is your email address?** *(We'll use this to send you updates)*`,

  personal_phone: `**What is your mobile number?** *(Include country code if outside India)*`,

  personal_dob: `**What is your date of birth?** *(Format: DD/MM/YYYY)*`,

  personal_location: `**What city/location are you currently based in?**`,

  applied_role: `**Which role are you applying for?**

Here are our current openings:
1. Software Engineer
2. Data Analyst  
3. HR Executive
4. Sales Executive
5. Customer Support

Please type the role name or number.`,

  education_qualification: `**What is your highest educational qualification?**

*(e.g., B.Tech, MBA, B.Com, MCA, 12th Pass, Diploma, etc.)*`,

  education_institution: `**Which college/university did you attend?**`,

  education_year: `**What year did you graduate/pass out?**`,

  education_field: `**What was your field/stream of study?**

*(e.g., Computer Science, Finance, Marketing, Commerce, etc.)*`,

  experience_years: `**How many years of total work experience do you have?**

*(Type "0" or "Fresher" if you're a fresh graduate)*`,

  experience_current_company: `**What is the name of your current or most recent company?**`,

  experience_current_role: `**What is/was your designation (job title) there?**`,

  experience_responsibilities: `**Briefly describe your key responsibilities in that role.**

*(2-3 sentences is fine — quality over quantity!)*`,

  compensation_last_ctc: `**What was your last/current annual CTC (Cost to Company)?**

*(e.g., 4.5 LPA, ₹45,000/month, or "Not Applicable" if fresher)*`,

  compensation_inhand: `**What is your current in-hand/take-home salary per month?**`,

  compensation_expected: `**What is your expected CTC for this new role?**`,

  compensation_notice: `**What is your notice period?**

*(e.g., Immediate joiner, 15 days, 30 days, 60 days, 90 days)*`,

  career_reason_leaving: `**Why are you looking for a new opportunity?**

*(Be honest — there are no wrong answers here!)*`,

  career_switches: `**How many job switches have you made so far in your career?**`,

  resume_upload: `Almost done with the questions! 🎉

**Please upload your resume.**

*(Accepted formats: PDF, DOC, DOCX — Max size: 5MB)*

Click the upload button below 👇`,

  typing_test: `📊 One final step — a quick **Typing Speed Test!**

This helps us assess your written communication speed.

**Instructions:**
- You'll see a paragraph of text
- Type it as **fast and accurately** as you can
- You have **60 seconds**

Click **"Start Typing Test"** when you're ready!`,

  wrap_up: `🎊 **Interview Complete!**

Thank you, {name}! You've successfully completed the screening interview.

📊 **Your responses are being analyzed...**

Our HR team will review your profile and reach out within **2-3 business days**.

If shortlisted, you'll receive an email with a link to schedule your next round interview.

Best of luck! 🍀`,
}

export const ROLE_NAMES = [
  'Software Engineer',
  'Data Analyst',
  'HR Executive',
  'Sales Executive',
  'Customer Support',
]

export const ROLE_MAP = {
  '1': 'Software Engineer',
  '2': 'Data Analyst',
  '3': 'HR Executive',
  '4': 'Sales Executive',
  '5': 'Customer Support',
}
