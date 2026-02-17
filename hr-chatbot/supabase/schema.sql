-- ============================================================
-- HR CHATBOT MVP - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CANDIDATES TABLE
-- ============================================================
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Personal Info
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  dob TEXT,
  location TEXT,

  -- Education
  highest_qualification TEXT,
  institution TEXT,
  graduation_year TEXT,
  field_of_study TEXT,

  -- Work Experience
  total_experience_years NUMERIC DEFAULT 0,
  current_company TEXT,
  current_role TEXT,
  experience_details JSONB DEFAULT '[]',

  -- Compensation
  last_ctc TEXT,
  inhand_salary TEXT,
  expected_ctc TEXT,
  notice_period TEXT,

  -- Career Info
  reason_for_leaving TEXT,
  job_switches INTEGER DEFAULT 0,
  career_changes TEXT,

  -- Applied Role
  applied_role TEXT,

  -- Resume
  resume_url TEXT,
  resume_filename TEXT,

  -- Typing Test
  typing_wpm INTEGER DEFAULT 0,
  typing_accuracy NUMERIC DEFAULT 0,
  typing_test_completed BOOLEAN DEFAULT FALSE,

  -- AI Analysis
  ai_observations TEXT,
  strengths JSONB DEFAULT '[]',
  concerns JSONB DEFAULT '[]',

  -- Scoring
  score_experience NUMERIC DEFAULT 0,
  score_skills NUMERIC DEFAULT 0,
  score_stability NUMERIC DEFAULT 0,
  score_communication NUMERIC DEFAULT 0,
  score_role_fit NUMERIC DEFAULT 0,
  score_typing NUMERIC DEFAULT 0,
  total_score NUMERIC DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'in_progress',  -- in_progress, completed, shortlisted, rejected
  is_shortlisted BOOLEAN DEFAULT FALSE,
  hr_notes TEXT,
  hr_score_override NUMERIC,

  -- Interview
  interview_scheduled BOOLEAN DEFAULT FALSE,
  interview_datetime TIMESTAMPTZ,
  calendly_event_url TEXT,

  -- Chat session
  chat_history JSONB DEFAULT '[]',
  interview_completed BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- INTERVIEW SESSIONS (for tracking chat state)
-- ============================================================
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_data JSONB DEFAULT '{}',
  current_step TEXT DEFAULT 'welcome',
  is_complete BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- ROLES TABLE (configurable roles)
-- ============================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  required_skills JSONB DEFAULT '[]',
  min_experience_years NUMERIC DEFAULT 0,
  specific_questions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, description, required_skills, min_experience_years, specific_questions) VALUES
(
  'Software Engineer',
  'Full-stack or backend software development',
  '["JavaScript", "Python", "React", "Node.js", "SQL"]',
  2,
  '[
    {"id": "q1", "question": "What programming languages are you most proficient in?"},
    {"id": "q2", "question": "Describe a challenging technical problem you solved recently."},
    {"id": "q3", "question": "What is your experience with cloud platforms (AWS, GCP, Azure)?"},
    {"id": "q4", "question": "How do you approach code reviews and testing?"}
  ]'
),
(
  'Data Analyst',
  'Data analysis, visualization and reporting',
  '["SQL", "Python", "Excel", "Tableau", "Power BI"]',
  1,
  '[
    {"id": "q1", "question": "What tools do you use for data analysis and visualization?"},
    {"id": "q2", "question": "Describe a data project where your insights drove business decisions."},
    {"id": "q3", "question": "How comfortable are you with SQL and writing complex queries?"}
  ]'
),
(
  'HR Executive',
  'Human resources and talent acquisition',
  '["Recruitment", "Employee Relations", "HRMS", "Communication"]',
  1,
  '[
    {"id": "q1", "question": "How many positions have you hired for in your last role?"},
    {"id": "q2", "question": "What ATS or HRMS tools have you used?"},
    {"id": "q3", "question": "How do you handle a difficult employee situation?"}
  ]'
),
(
  'Sales Executive',
  'B2B or B2C sales and business development',
  '["Communication", "Negotiation", "CRM", "Lead Generation"]',
  1,
  '[
    {"id": "q1", "question": "What was your sales target and achievement in your last role?"},
    {"id": "q2", "question": "How do you handle rejection and maintain motivation?"},
    {"id": "q3", "question": "Describe your experience with CRM tools like Salesforce or HubSpot."}
  ]'
),
(
  'Customer Support',
  'Customer service and support operations',
  '["Communication", "Problem-solving", "CRM", "Patience"]',
  0,
  '[
    {"id": "q1", "question": "How do you handle an angry or frustrated customer?"},
    {"id": "q2", "question": "What is your average ticket resolution time in previous roles?"},
    {"id": "q3", "question": "Are you comfortable working in rotational shifts?"}
  ]'
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_role ON candidates(applied_role);
CREATE INDEX idx_candidates_score ON candidates(total_score DESC);
CREATE INDEX idx_candidates_shortlisted ON candidates(is_shortlisted);
CREATE INDEX idx_candidates_email ON candidates(email);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Allow public insert for new candidates (applicants don't login)
CREATE POLICY "Allow public insert candidates" ON candidates
  FOR INSERT TO anon WITH CHECK (true);

-- Allow public update for ongoing sessions (by candidate id)
CREATE POLICY "Allow public update own candidate" ON candidates
  FOR UPDATE TO anon USING (true);

-- Allow public read for session management
CREATE POLICY "Allow public read candidates" ON candidates
  FOR SELECT TO anon USING (true);

-- Session policies
CREATE POLICY "Allow public all on sessions" ON interview_sessions
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Roles are public readable
CREATE POLICY "Allow public read roles" ON roles
  FOR SELECT TO anon USING (true);

-- ============================================================
-- AUTO UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SUPABASE STORAGE - Resume bucket
-- Run this too:
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
-- CREATE POLICY "Allow anon upload resumes" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'resumes');
-- CREATE POLICY "Allow auth read resumes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes');
