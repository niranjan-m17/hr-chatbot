# 🤖 TalentScreen AI — HR Chatbot MVP

An AI-powered HR interview and screening system built with Next.js, Supabase, and OpenAI.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| AI | OpenAI GPT-4o-mini |
| Scheduling | Calendly embed |
| Deployment | Vercel |

---

## 📁 Project Structure

```
hr-chatbot/
├── src/
│   ├── app/
│   │   ├── page.js                    # Applicant chat interface (public)
│   │   ├── layout.js                  # Root layout
│   │   ├── globals.css                # Global styles
│   │   ├── admin/
│   │   │   ├── page.js               # Admin login
│   │   │   └── dashboard/page.js     # Admin dashboard
│   │   └── api/
│   │       ├── chat/route.js         # AI chat + interview flow
│   │       ├── candidates/route.js   # CRUD for candidates
│   │       ├── upload-resume/route.js # File upload
│   │       └── shortlist/route.js    # Auto-shortlist top 10
│   ├── components/
│   │   ├── TypingTest.jsx            # 60-second typing speed test
│   │   ├── ResumeUpload.jsx          # Drag-and-drop resume upload
│   │   └── CandidateModal.jsx        # Full profile view (admin)
│   └── lib/
│       ├── supabase.js               # DB client
│       ├── scoring.js                # Scoring engine (out of 100)
│       └── interviewFlow.js          # Interview step messages
├── supabase/
│   └── schema.sql                    # Full DB schema (run this!)
└── .env.example                      # Environment variables template
```

---

## 🚀 Setup Guide

### Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to **SQL Editor** → paste the contents of `supabase/schema.sql` → Run
3. Go to **Storage** → Create bucket named `resumes` (private)
4. Run these storage policies in SQL Editor:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
CREATE POLICY "Allow anon upload resumes" ON storage.objects 
  FOR INSERT TO anon WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "Allow auth read resumes" ON storage.objects 
  FOR SELECT TO authenticated USING (bucket_id = 'resumes');
```
5. Go to **Authentication** → Users → Create a user (this is your admin login)
6. Copy your **Project URL** and **Anon Key** from Settings → API

### Step 2: Vercel Deployment

1. Push this project to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Add these **Environment Variables** in Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/your-org/interview
```

4. Deploy! ✅

### Step 3: Run Locally

```bash
npm install
cp .env.example .env.local
# Fill in .env.local with your keys
npm run dev
```

---

## 🔗 URLs

| URL | Description |
|-----|-------------|
| `your-app.vercel.app` | Public interview chat (share with applicants) |
| `your-app.vercel.app/admin` | Admin login |
| `your-app.vercel.app/admin/dashboard` | HR Dashboard |

---

## ✨ Features

### For Applicants
- 💬 Conversational AI interview (no login required)
- 📋 Structured questions: personal, education, experience, compensation
- 📄 Resume upload (PDF/DOC, drag-and-drop)
- ⌨️ 60-second typing speed test (WPM + accuracy)
- 🎯 Role-specific questions per job opening

### For HR Admins
- 🔐 Secure admin login via Supabase Auth
- 📊 Dashboard with all candidates, scores, rankings
- 🔍 Filter by role, status, search by name/email
- ⭐ Auto-shortlist top 10 candidates per role (1 click)
- 👁️ Full candidate profile modal with AI analysis
- ✏️ Manual score override capability
- 📝 HR notes per candidate
- 📅 Calendly scheduling integration
- ⬇️ Export candidate profile as JSON
- 🏷️ Status management (in_progress → completed → shortlisted/rejected)

### AI Scoring (out of 100)
| Factor | Weight |
|--------|--------|
| Experience | 25% |
| Skills | 20% |
| Career Stability | 15% |
| Communication | 15% |
| Role Fit | 15% |
| Typing | 10% |

---

## 🗃️ Database Tables

- **candidates** — All applicant data, scores, status
- **interview_sessions** — Chat session state
- **roles** — Configurable job roles with specific questions

---

## 📝 Next Steps (Post-MVP)

- [ ] Email notifications to shortlisted candidates
- [ ] CSV/PDF export from dashboard
- [ ] Multi-admin support with role-based access
- [ ] Video recording during interview
- [ ] Advanced analytics charts
- [ ] WhatsApp/SMS integration
- [ ] Google Calendar API instead of Calendly
