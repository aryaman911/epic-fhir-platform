# 🚀 CareFlow Analytics - Complete Deployment Guide

This guide walks you through deploying CareFlow Analytics with:
- **Backend** on Render.com
- **Frontend** on GitHub Pages
- **EPIC FHIR** Sandbox integration

## Prerequisites

- Node.js 18+ installed locally
- Git installed
- GitHub account
- Render.com account (free tier works)
- EPIC Sandbox developer account

---

## Step 1: EPIC Sandbox Setup

### 1.1 Create EPIC Developer Account
1. Go to https://fhir.epic.com/
2. Click "Developer Portal" → "Register"
3. Complete registration and verify email

### 1.2 Create a New Application
1. Log into the developer portal
2. Navigate to "Build Apps" → "Create"
3. Fill in application details:
   - **App Name**: CareFlow Analytics
   - **Application Type**: Confidential Client (Backend)
   - **Redirect URI**: `http://localhost:3000/callback` (update after deployment)

### 1.3 Configure OAuth Scopes
Request these scopes:
```
openid
fhirUser
launch
patient/*.read
user/*.read
```

### 1.4 Save Credentials
Note down:
- **Client ID**: Will look like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Client Secret**: Keep this secure!
- **Non-Production Client ID** (for sandbox testing)

---

## Step 2: Local Development Setup

### 2.1 Clone & Setup Backend
```bash
# Clone your repository
git clone https://github.com/yourusername/careflow-analytics.git
cd careflow-analytics

# Backend setup
cd backend
npm install

# Create environment file
cp .env.example .env
```

### 2.2 Configure Backend .env
Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/careflow_dev

# EPIC Sandbox
EPIC_CLIENT_ID=your_sandbox_client_id
EPIC_CLIENT_SECRET=your_sandbox_secret
EPIC_FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
EPIC_AUTH_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize
EPIC_TOKEN_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
EPIC_REDIRECT_URI=http://localhost:3000/callback

# AI APIs
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Auth
JWT_SECRET=your-development-secret-key
JWT_EXPIRES_IN=7d

# Email (optional for dev)
SENDGRID_API_KEY=SG.your-key

FRONTEND_URL=http://localhost:3000
```

### 2.3 Setup Local PostgreSQL
```bash
# macOS
brew install postgresql
brew services start postgresql
createdb careflow_dev

# Ubuntu/Debian
sudo apt install postgresql
sudo service postgresql start
sudo -u postgres createdb careflow_dev
```

### 2.4 Run Database Migrations & Seed
```bash
cd backend
npm run seed
```

### 2.5 Setup Frontend
```bash
cd ../frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_EPIC_CLIENT_ID=your_sandbox_client_id
```

### 2.6 Start Development Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### 2.7 Test EPIC Connection
1. Open http://localhost:3000
2. Login with: `demo@careflow.com` / `demo123!`
3. Go to Settings → Connect EPIC
4. You'll be redirected to EPIC's sandbox login
5. Use sandbox test credentials to authorize

---

## Step 3: Deploy Backend to Render.com

### 3.1 Prepare Repository
```bash
# Ensure all changes are committed
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 3.2 Create Render Account
1. Go to https://render.com
2. Sign up with GitHub
3. Connect your repository

### 3.3 Create PostgreSQL Database
1. Dashboard → New → PostgreSQL
2. Name: `careflow-db`
3. Region: Choose closest to your users
4. Plan: Free (for testing) or Starter ($7/mo for production)
5. Create Database
6. Copy the **Internal Database URL**

### 3.4 Create Web Service
1. Dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Name**: `careflow-api`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (testing) or Starter (production)

### 3.5 Add Environment Variables
In the Render dashboard, add these environment variables:

```
NODE_ENV=production
DATABASE_URL=<paste internal database URL>
EPIC_CLIENT_ID=your_epic_client_id
EPIC_CLIENT_SECRET=your_epic_client_secret
EPIC_FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
EPIC_AUTH_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize
EPIC_TOKEN_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token
EPIC_REDIRECT_URI=https://yourusername.github.io/careflow-analytics/callback
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key
JWT_SECRET=generate-a-strong-secret-key
JWT_EXPIRES_IN=7d
SENDGRID_API_KEY=SG.your-key
FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://yourusername.github.io/careflow-analytics
```

### 3.6 Deploy
1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes)
3. Note your API URL: `https://careflow-api.onrender.com`

### 3.7 Seed Production Database
In Render dashboard:
1. Go to your web service
2. Click "Shell" tab
3. Run: `npm run seed`

---

## Step 4: Deploy Frontend to GitHub Pages

### 4.1 Update Frontend Configuration
Edit `frontend/package.json`:
```json
{
  "homepage": "https://yourusername.github.io/careflow-analytics",
  ...
}
```

Edit `frontend/.env`:
```env
REACT_APP_API_URL=https://careflow-api.onrender.com/api
REACT_APP_EPIC_CLIENT_ID=your_epic_client_id
```

### 4.2 Build and Deploy
```bash
cd frontend
npm run build
npm run deploy
```

### 4.3 Configure GitHub Pages
1. Go to your GitHub repository
2. Settings → Pages
3. Source: `gh-pages` branch
4. Save

### 4.4 Wait for Deployment
GitHub Pages deployment takes 2-5 minutes. Your site will be at:
`https://yourusername.github.io/careflow-analytics`

---

## Step 5: Update EPIC Redirect URI

### 5.1 Update EPIC App
1. Go to EPIC Developer Portal
2. Edit your application
3. Update Redirect URI to: `https://yourusername.github.io/careflow-analytics/callback`
4. Save changes

### 5.2 Update Render Environment
1. Go to Render dashboard
2. Update `EPIC_REDIRECT_URI` environment variable
3. Trigger a redeploy

---

## Step 6: Testing Production Deployment

### 6.1 Test Authentication
1. Go to `https://yourusername.github.io/careflow-analytics`
2. Register a new account or login with demo credentials
3. Verify you can access the dashboard

### 6.2 Test EPIC Integration
1. Go to Settings
2. Click "Connect to EPIC"
3. Authorize with EPIC sandbox credentials
4. Verify connection status shows "Connected"

### 6.3 Test Patient Data
1. Go to Patients page
2. Verify you can see sandbox patients
3. Click on a patient to see details

### 6.4 Test AI Features
1. Go to AI Playground
2. Enter a test prompt
3. Verify both OpenAI and Claude responses appear

---

## Troubleshooting

### Backend Not Responding
- Check Render logs for errors
- Verify all environment variables are set
- Ensure database connection is working

### CORS Errors
- Verify `FRONTEND_URL` in backend matches your GitHub Pages URL
- Check browser console for specific CORS messages

### EPIC OAuth Failing
- Verify redirect URI matches exactly in EPIC portal
- Check that client ID/secret are correct
- Ensure you're using sandbox credentials for sandbox testing

### Database Connection Issues
- Use the **Internal** database URL in Render
- Verify PostgreSQL instance is running

---

## Production Checklist

- [ ] All environment variables set in Render
- [ ] Database seeded with initial data
- [ ] EPIC redirect URI updated for production
- [ ] SSL enabled (automatic on Render and GitHub Pages)
- [ ] Custom domain configured (optional)
- [ ] Error monitoring setup (Sentry recommended)
- [ ] Backup strategy for database

---

## Custom Domain Setup (Optional)

### For GitHub Pages
1. Add CNAME file to `frontend/public/CNAME` with your domain
2. Configure DNS with your domain provider
3. Enable HTTPS in GitHub Pages settings

### For Render
1. Add custom domain in Render dashboard
2. Configure DNS records as instructed
3. SSL is automatically provisioned

---

## Monitoring & Maintenance

### Recommended Tools
- **Sentry**: Error tracking
- **Datadog**: Performance monitoring
- **PagerDuty**: Alerting

### Regular Tasks
- Monitor error logs weekly
- Review API usage monthly
- Update dependencies quarterly
- Rotate API keys annually

---

## Support

For issues or questions:
- Check GitHub Issues
- Review EPIC FHIR documentation: https://fhir.epic.com/Documentation
- Anthropic API docs: https://docs.anthropic.com
- OpenAI API docs: https://platform.openai.com/docs

---

Happy deploying! 🎉
