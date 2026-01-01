# 🏥 CareFlow Analytics - EPIC FHIR B2B Healthcare Platform

A comprehensive B2B healthcare analytics platform that integrates with EPIC FHIR APIs to help healthcare organizations identify, analyze, and engage patients for targeted care plans.

## 🌟 Features

### Core Functionality
- **EPIC FHIR Integration**: Secure OAuth2 connection to EPIC Sandbox/Production
- **Patient Data Analytics**: AI-powered analysis of patient populations
- **Care Plan Matching**: ICD-10 code-based care plan recommendations
- **Automated Outreach**: AI-generated personalized mail campaigns
- **Multi-Tenant B2B**: White-label solution for healthcare partners

### AI Capabilities
- **Dual AI Analysis**: Compare OpenAI GPT-4 and Claude responses
- **Risk Stratification**: Identify high-risk patients
- **Care Gap Detection**: Find patients missing preventive care
- **Content Generation**: Personalized outreach letters
- **Predictive Analytics**: Treatment outcome predictions

### Use Cases
1. **Chronic Disease Management**: Identify diabetic patients needing care plan enrollment
2. **Preventive Care Campaigns**: Target patients overdue for screenings
3. **Post-Discharge Follow-up**: Automate 30-day follow-up outreach
4. **Medication Adherence**: Flag patients with adherence gaps
5. **High-Risk Patient Identification**: AI-powered risk scoring
6. **Care Transition Management**: Coordinate care between facilities
7. **Population Health Insights**: Aggregate analytics dashboards
8. **Quality Measure Tracking**: HEDIS/CMS quality metrics

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (GitHub Pages)                   │
│  React + Tailwind CSS + Chart.js + React Query              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Render.com)                      │
│  Node.js + Express + PostgreSQL + Redis                      │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   EPIC FHIR     │  │   OpenAI API    │  │   Claude API    │
│   Sandbox       │  │   GPT-4/4o      │  │   Claude 3.5    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 14+
- EPIC Sandbox Account
- OpenAI API Key
- Anthropic (Claude) API Key
- GitHub Account
- Render.com Account

## 🚀 Quick Start

### 1. EPIC Sandbox Setup

1. Register at [EPIC FHIR Sandbox](https://fhir.epic.com/Developer/Apps)
2. Create a new application:
   - Application Name: CareFlow Analytics
   - Application Type: Confidential Client
   - Redirect URI: `http://localhost:3000/callback` (dev) / `https://your-app.github.io/callback` (prod)
3. Request these scopes:
   - `patient/*.read`
   - `user/*.read`
   - `launch`
   - `openid`
   - `fhirUser`
4. Note your Client ID and Client Secret

### 2. Local Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/epic-fhir-platform.git
cd epic-fhir-platform

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
cp .env.example .env
# Edit .env with your backend URL
npm start
```

### 3. Environment Variables

#### Backend (.env)
```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/careflow

# EPIC FHIR
EPIC_CLIENT_ID=your_epic_client_id
EPIC_CLIENT_SECRET=your_epic_client_secret
EPIC_FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
EPIC_AUTH_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize
EPIC_TOKEN_URL=https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token

# AI APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d

# Mail
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@careflow.com

# Redis (for rate limiting & caching)
REDIS_URL=redis://localhost:6379
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_EPIC_CLIENT_ID=your_epic_client_id
```

## 🧪 Testing with EPIC Sandbox

### Available Test Patients
EPIC Sandbox provides synthetic patient data:
- Camila Lopez (ID: Tbt3KuCY0B5PSrJvCu2j-PlK.aiHsu2xUjUM8bWpetXoB)
- Derrick Lin (ID: erXuFYUfucBZaryVksYEcMg3)
- And many more...

### Test OAuth Flow
1. Start backend: `npm run dev`
2. Navigate to: `http://localhost:5000/api/auth/epic/authorize`
3. Login with sandbox credentials
4. You'll be redirected back with patient data access

### API Testing
```bash
# Health check
curl http://localhost:5000/api/health

# Get patients (requires auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:5000/api/patients

# Analyze patient for care plans
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"patientId": "test123", "conditions": ["E11.9"]}' \
  http://localhost:5000/api/analytics/care-plan-match
```

## 📦 Deployment

### Backend Deployment (Render.com)

1. **Create Render Account**: https://render.com

2. **Create Web Service**:
   - Connect GitHub repository
   - Select `backend` directory
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Add Environment Variables** in Render dashboard

4. **Create PostgreSQL Database**:
   - Render Dashboard → New → PostgreSQL
   - Copy connection string to `DATABASE_URL`

5. **Deploy**: Push to main branch triggers auto-deploy

### Frontend Deployment (GitHub Pages)

1. **Update package.json**:
```json
{
  "homepage": "https://yourusername.github.io/careflow-analytics"
}
```

2. **Build and Deploy**:
```bash
cd frontend
npm run build
npm run deploy
```

3. **Configure GitHub Pages**:
   - Repository Settings → Pages
   - Source: gh-pages branch

### Custom Domain (Optional)
1. Add CNAME file to public folder
2. Configure DNS records
3. Enable HTTPS in GitHub Pages settings

## 🔐 Security Considerations

- All EPIC data transmitted over HTTPS
- OAuth2 tokens stored securely (HttpOnly cookies)
- Rate limiting on all API endpoints
- HIPAA compliance considerations documented
- Audit logging for all data access
- Role-based access control (Admin/User)

## 📊 Database Schema

```sql
-- Organizations (B2B tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  epic_client_id VARCHAR(255),
  subscription_tier VARCHAR(50),
  created_at TIMESTAMP
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  email VARCHAR(255),
  role VARCHAR(50),
  created_at TIMESTAMP
);

-- Care Plans
CREATE TABLE care_plans (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  icd10_codes TEXT[],
  eligibility_criteria JSONB
);

-- Patient Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  org_id UUID,
  care_plan_id UUID,
  status VARCHAR(50),
  patient_count INTEGER,
  created_at TIMESTAMP
);

-- Outreach History
CREATE TABLE outreach_history (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  patient_id VARCHAR(255),
  content TEXT,
  sent_at TIMESTAMP,
  status VARCHAR(50)
);
```

## 🤖 AI Model Fine-Tuning

### Dataset Preparation
1. Collect anonymized care plan outcomes
2. Format as JSONL for fine-tuning
3. Include ICD-10 to care plan mappings

### Fine-Tuning Steps
```bash
# Prepare dataset
python scripts/prepare_finetune_data.py

# Upload to OpenAI
openai api fine_tunes.create \
  -t "data/training.jsonl" \
  -m "gpt-3.5-turbo"

# Deploy fine-tuned model
# Update OPENAI_FINE_TUNED_MODEL in .env
```

### Self-Hosted Model (Optional)
For maximum privacy, deploy open-source models:
1. Use vLLM or text-generation-inference
2. Deploy on AWS/GCP/Azure
3. Update API endpoints in config

## 📚 API Documentation

Full API documentation available at:
- Swagger UI: `https://your-backend.onrender.com/api-docs`
- Postman Collection: `docs/postman_collection.json`

## 🧩 Integration Guide

### Connecting Your EPIC Instance

1. Contact your EPIC administrator
2. Register CareFlow as an approved application
3. Configure production OAuth credentials
4. Test with limited patient cohort
5. Go live with full population

### Webhook Setup
Configure EPIC Webhooks for real-time updates:
- Patient admit/discharge
- New diagnoses
- Care plan changes

## 📈 Additional Use Cases

1. **Annual Wellness Visit Outreach**: Identify Medicare patients due for AWV
2. **Transitional Care Management**: 7/14/21 day post-discharge contacts
3. **Chronic Care Management**: Monthly touchpoints for CCM patients
4. **Remote Patient Monitoring**: Identify candidates for RPM programs
5. **Behavioral Health Integration**: Screen for depression/anxiety
6. **Social Determinants**: Identify patients with SDOH needs
7. **Medication Therapy Management**: Pharmacy MTM candidates
8. **Cancer Screening**: Colorectal, breast, cervical screening gaps
9. **Immunization Campaigns**: Flu, COVID, pneumonia outreach
10. **Pediatric Well-Child**: Well-visit scheduling automation

## 🛠️ Tech Stack

- **Frontend**: React 18, Tailwind CSS, Chart.js, React Query
- **Backend**: Node.js, Express, PostgreSQL, Redis
- **AI**: OpenAI GPT-4, Anthropic Claude, Custom Fine-tuned Models
- **Infrastructure**: GitHub Pages, Render.com, AWS S3
- **Monitoring**: Sentry, Datadog

## 📄 License

MIT License - See LICENSE file

## 🤝 Support

- Documentation: https://docs.careflow.com
- Email: support@careflow.com
- Issues: GitHub Issues

---

Built with ❤️ for healthcare innovation
