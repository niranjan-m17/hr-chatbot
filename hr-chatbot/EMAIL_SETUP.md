# 📧 Professional Email Setup for TalentScreen

This guide shows you how to set up **professional, domain-based email** for sending Calendly links to shortlisted candidates.

---

## Option 1: Resend (Recommended - Easiest) ⭐

**Why Resend?**
- Purpose-built for transactional emails
- 3,000 emails/month FREE
- Beautiful email templates
- No credit card needed for free tier
- Takes 5 minutes to set up

### Setup Steps:

**1. Sign up at [resend.com](https://resend.com)**

**2. Get your API key**
- Dashboard → API Keys → Create API Key
- Copy the key (starts with `re_...`)

**3. Add to Vercel Environment Variables:**
```
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourcompany.com
```

**4. Install Resend in your project:**
```bash
npm install resend
```

**5. Update the notify API route (`src/app/api/notify/route.js`):**

```javascript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Inside the POST function, replace the console.log with:
await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL,
  to: candidate.email,
  subject: `🎉 You're Shortlisted! Schedule Your Interview`,
  html: emailBody,
})
```

**6. Verify your domain (OPTIONAL but recommended):**
- Go to Resend Dashboard → Domains → Add Domain
- Add the DNS records they provide to your domain
- Once verified, you can send from `noreply@yourdomain.com`

✅ **Done!** Emails will now be sent automatically when you click "Send Link" in the dashboard.

---

## Option 2: SendGrid (Google Cloud Alternative)

**Why SendGrid?**
- Industry standard
- 100 emails/day FREE forever
- Used by Uber, Spotify, Airbnb
- Google Cloud Partner

### Setup Steps:

**1. Sign up at [sendgrid.com](https://sendgrid.com)**

**2. Get API Key:**
- Settings → API Keys → Create API Key → Full Access
- Copy the key (starts with `SG.`)

**3. Add to Vercel:**
```
SENDGRID_API_KEY=SG.your_api_key
SENDGRID_FROM_EMAIL=noreply@yourcompany.com
```

**4. Install SendGrid:**
```bash
npm install @sendgrid/mail
```

**5. Update notify route:**
```javascript
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

await sgMail.send({
  from: process.env.SENDGRID_FROM_EMAIL,
  to: candidate.email,
  subject: `🎉 You're Shortlisted! Schedule Your Interview`,
  html: emailBody,
})
```

---

## Option 3: Google Cloud (Gmail API) - Most Complex

**Only use if you MUST send from your actual Gmail account**

This requires:
1. Google Cloud Project setup
2. OAuth 2.0 credentials
3. Gmail API enablement
4. Token management

**Not recommended for MVP** — use Resend or SendGrid instead.

---

## Option 4: Simple SMTP (Gmail/Outlook)

**⚠️ WARNING:** This works but:
- Gmail blocks you after ~50 emails/day
- Requires "Less Secure Apps" enabled
- Not production-ready
- Emails may go to spam

**Only for testing, NOT production!**

If you still want it:

**1. Install nodemailer:**
```bash
npm install nodemailer
```

**2. Add to Vercel:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**3. Update notify route:**
```javascript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

await transporter.sendMail({
  from: process.env.SMTP_USER,
  to: candidate.email,
  subject: `🎉 You're Shortlisted!`,
  html: emailBody,
})
```

---

## 🏆 Our Recommendation

**For your MVP, use Resend:**
1. ✅ Free 3,000 emails/month
2. ✅ 5-minute setup
3. ✅ Professional & reliable
4. ✅ No credit card needed
5. ✅ Built for exactly this use case

**After MVP scales, upgrade to:**
- SendGrid (if you need 100+ emails/day)
- Your own custom email server (if you're enterprise-scale)

---

## Testing Your Email Setup

After setup, test it:

1. Go to your admin dashboard
2. Shortlist a test candidate (use your own email)
3. Click "📅 Send Link"
4. Check your inbox!

If emails don't arrive:
- Check spam folder
- Verify API key is correct in Vercel
- Check Resend/SendGrid dashboard for delivery logs

---

## Need Help?

If you face issues:
1. Check the service's delivery logs (Resend/SendGrid dashboard)
2. Verify environment variables are set in Vercel
3. Check that `RESEND_FROM_EMAIL` matches your verified domain
4. Ensure the notify API route is updated with the send code

✅ Once set up correctly, emails send in < 1 second!
