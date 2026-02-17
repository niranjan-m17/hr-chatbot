# TalentScreen AI — HR Interview Chatbot

AI-powered candidate screening system. Applicants chat with an AI interviewer, complete a typing test, and upload their resume. HR admins view ranked profiles on a dashboard.

---

## How It Works

- Applicant opens the link → chats with AI → uploads resume → does typing test → done
- HR opens `/admin` → logs in → sees all candidates ranked by score → shortlists top 10 → schedules interview via Calendly

---

## Setup (One Time Only)

### 1. Supabase — Create Your Database

1. Go to [supabase.com](https://supabase.com) → Sign up → New Project
2. Once created, go to **SQL Editor** → paste the contents of `supabase/schema.sql` → click **Run**
3. Go to **Storage** → New Bucket → name it `resumes` → set to **Private**
4. Go to **Authentication → Users** → Add User → enter your admin email and password (this is your dashboard login)
5. Go to **Settings → API** → copy these 3 values:
   - Project URL
   - Anon public key
   - Service role key

### 2. OpenAI — Get Your API Key

1. Go to [platform.openai.com](https://platform.openai.com) → Sign up
2. Go to **API Keys** → Create new key → copy it

### 3. Calendly — Get Your Scheduling Link

1. Go to [calendly.com](https://calendly.com) → Sign up
2. Create an event type called "HR Interview"
3. Copy your event link (looks like `https://calendly.com/your-name/hr-interview`)

### 4. GitHub — Upload the Code

1. Go to [github.com](https://github.com) → New Repository → name it `hr-chatbot` → Create
2. On the empty repo page click **"uploading an existing file"**
3. Drag and drop the project ZIP → GitHub extracts everything automatically

### 5. Vercel — Deploy the App

1. Go to [vercel.com](https://vercel.com) → Add New Project → Import from GitHub → select `hr-chatbot`
2. Before deploying, go to **Environment Variables** and add these:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Service Role Key |
| `OPENAI_API_KEY` | Your OpenAI API Key |
| `NEXT_PUBLIC_CALENDLY_URL` | Your Calendly event link |

3. Click **Deploy** → wait ~2 minutes → your app is live ✅

---

## Your App Links

Once deployed, your Vercel URL will be something like `hr-chatbot.vercel.app`

| Link | Who uses it |
|------|-------------|
| `hr-chatbot.vercel.app` | Applicants — share this link with candidates |
| `hr-chatbot.vercel.app/admin` | HR Admin login |
| `hr-chatbot.vercel.app/admin/dashboard` | HR Dashboard (after login) |

---

## Important Notes

- **Never put API keys in the code** — always use Vercel Environment Variables only
- The `schema.sql` file is only for pasting into Supabase once — the app does not use it automatically
- Admin password is set in Supabase Authentication, not in this code
- Resumes are stored privately in Supabase Storage — only logged-in admins can view them
