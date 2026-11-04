# Setting up email, Google, Notion and Google sign-in

AgentForge works without any of these. Each one switches on a feature. Add the environment
variables in **Vercel → Project → Settings → Environment Variables**, then **Redeploy**.

| Feature | Env vars | Time |
|---|---|---|
| Email: invites, approval notifications, "Send email" tool | `RESEND_API_KEY`, `EMAIL_FROM` | 5 min |
| Gmail + Google Sheets tools | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 10 min |
| Notion tools | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` | 5 min |
| "Continue with Google" sign-in | Supabase dashboard + `NEXT_PUBLIC_AUTH_GOOGLE=true` | 5 min |
| Token encryption key (recommended) | `ENCRYPTION_KEY` (any 32+ random characters) | 1 min |
| Stable links in emails | `NEXT_PUBLIC_SITE_URL=https://agentforge-nu-seven.vercel.app` | 1 min |

---

## 1. Email with Resend

1. Create an account at https://resend.com and go to **API Keys → Create API key**.
2. Go to **Domains → Add domain** and add the DNS records it shows. Until a domain is verified,
   Resend only delivers to your own address.
3. Set:
   - `RESEND_API_KEY=re_…`
   - `EMAIL_FROM=AgentForge <noreply@yourdomain.com>`

### Also send Supabase auth emails through Resend

This removes the free-tier limit of about 2 emails per hour.

Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:

| Setting | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| User | `resend` |
| Password | your Resend API key |
| Sender | the address from `EMAIL_FROM` |

## 2. Google (Gmail + Sheets)

1. Open https://console.cloud.google.com, then create or select a project.
2. Go to **APIs & Services → Library** and enable the **Gmail API** and the **Google Sheets API**.
3. Go to **OAuth consent screen**:
   - **User type:** External
   - **App name:** AgentForge
   - **Support email:** your email
   - **Scopes:** add `gmail.send`, `gmail.readonly` and `spreadsheets`
   - **Test users:** add your Google account. While the app is in "Testing", only test users
     can connect, and Google shows an "unverified app" screen. That's expected for a portfolio
     app.
4. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
   Under **Authorized redirect URIs**, add:
   `https://agentforge-nu-seven.vercel.app/api/integrations/callback/google`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then redeploy.
6. In the app, go to **Integrations → Connect Google**.

## 3. Notion

1. Open https://www.notion.so/profile/integrations, click **New integration**, and choose type
   **Public**.
2. Set the redirect URI to
   `https://agentforge-nu-seven.vercel.app/api/integrations/callback/notion`.
3. Copy the **OAuth client ID** and **secret** into `NOTION_CLIENT_ID` and
   `NOTION_CLIENT_SECRET`, then redeploy.
4. In the app, go to **Integrations → Connect Notion**. Pick the pages to share with
   AgentForge; agents can only see pages you share.

## 4. "Continue with Google" sign-in

This is separate from the Gmail integration and uses Supabase Auth.

1. In Google Cloud **Credentials**, create another **OAuth client ID (Web application)**.
   Under **Authorized redirect URIs**, add:
   `https://jjqvvreeurbarauyeysa.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Sign In / Providers → Google** → enable it and paste the
   client ID and secret.
3. Set `NEXT_PUBLIC_AUTH_GOOGLE=true` in Vercel and redeploy. The Google button then appears on
   the sign-in and sign-up pages.

## 5. Gemini paid tier (recommended for real use)

The free tier has low rate limits, and Google may use free-tier data to improve its models.
In https://aistudio.google.com → **Settings → Billing**, link a billing account. The same
`GOOGLE_GENERATIVE_AI_API_KEY` then uses paid limits. No code changes are needed. When the
chosen model is overloaded, AgentForge retries once on Gemini Flash-Lite automatically.
