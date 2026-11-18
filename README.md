# SpendSmart — Smart Money Management for Students

> **Tagline:** *Your Money. Your Choices.*  
> **Brand Message:** *Track better. Save smarter. Enjoy more.*

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v4.21+-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v6.0+-brightgreen.svg)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 1. Project Overview

**SpendSmart** is a student-focused personal finance management platform engineered from the ground up for college and university students. Unlike generic SaaS tools or basic CRUD projects, SpendSmart addresses the exact financial struggles faced by students living on monthly allowances, pocket money, hostel budgets, or part-time gig earnings.

Every feature, chart, formula, and guardrail is connected to a live **Node.js/Express REST API** and **MongoDB** database, delivering genuine fintech product architecture.

---

## 2. Technology Stack

- **Frontend:**
  - HTML5 & CSS3 with CSS Custom Properties (Theme tokens)
  - Vanilla JavaScript (Modular ES6 architecture, zero React/Angular/Vue bloat)
  - [Chart.js](https://www.chartjs.org/) for financial charts and trend visualizations
  - [Lucide Icons](https://lucide.dev/) for crisp, modern iconography
  - Google Fonts: **Manrope** (headings, monetary values) & **Inter** (body, forms)

- **Backend:**
  - [Node.js](https://nodejs.org/) runtime
  - [Express.js](https://expressjs.com/) REST API framework
  - Modular Controllers, Services, Models, and Middleware

- **Database:**
  - [MongoDB](https://www.mongodb.com/)
  - [Mongoose](https://mongoosejs.com/) ODM with indexes and aggregation pipelines

- **Security & Authentication:**
  - JWT (JSON Web Tokens) with 7-day expiration
  - `bcryptjs` password hashing (salt rounds: 10)
  - Protected API routes and ownership-based record isolation
  - Rate-limit and input validation middleware
  - Email OTP verification flow

- **Reporting & Utilities:**
  - Browser Print-to-PDF financial statements
  - CSV transaction exports
  - Full JSON student financial archive export
  - Nodemailer email verification & transactional alerts

---

## 3. Brand Identity & Design System

SpendSmart uses a **Student Lifestyle Fintech** aesthetic: modern, youthful, friendly, minimalist, and trustworthy.

### Exact Brand Palette
- **Pine Green:** `#294C3A` (Primary brand & light theme sidebar)
- **Sage Green:** `#6B9B7B` (Accents, surplus indicators, success states)
- **Soft Olive:** `#B6C99B` (Subtle highlights and badges)
- **Warm Cream:** `#F7F4EA` (Light theme page background)
- **Charcoal:** `#25342B` (High-contrast typography)
- **Soft Peach:** `#E8B49A` (Warm accents)
- **Mint:** `#DCE9D9` (Need badges, success backdrops)
- **Butter Yellow:** `#F2DDA4` (Warning indicators, goal accents)
- **Muted Coral:** `#CE8276` (Wants, expenses, danger alerts)
- **Lavender:** `#A99ACD` (Secondary category accents)
- **White:** `#FFFFFF` (Surface cards in light mode)

### Light & Dark Themes
SpendSmart provides three themes: **Light**, **Dark**, and **System Default**. The selection persists in `localStorage` across page reloads and responds dynamically to OS dark mode preferences.

---

## 4. The 10 Advanced Fintech Features

### Feature 1: AI Smart Saving Assistant
A financial intelligence engine that analyzes live income, expenses, monthly budget, safe allowance, and upcoming obligations. Students can query:
- *"Can I afford a purchase worth ₹2,500?"*
- *"How much should I save this month?"*
- *"Which category consumes most of my money?"*
- *"How can I reduce my monthly expenses?"*
- *"How much money can I spend this week?"*

### Feature 2: Needs vs Wants Analyzer
Applies the student 50/30/20 guideline. Auto-classifies transactions into **Needs** (Mess food, books, hostel rent, medicine, metro) and **Wants** (Shopping, dining out, streaming, gaming) with manual override support, monthly trend charts, and impulse reduction tips.

### Feature 3: Smart Purchase Decision Calculator
Tests affordability *before* buying an item. Rather than looking only at available balance, it factors in upcoming bill obligations and a safety buffer, calculating an exact **Safe Waiting Period** (e.g. *"Wait 14 days until your next allowance"*).

### Feature 4: Expense Anomaly Detection
Uses statistical checks against historical 30-day category averages to detect sudden spending spikes (e.g. *"Food expenses surged by 100% vs last month"*) and large single outlier transactions without false alarms when transaction history is new.

### Feature 5: Transparent Financial Health Score (0–100)
Calculated via an explainable, 5-pillar weighted formula:
1. **Savings Consistency (25 pts):** Savings rate relative to monthly inflow
2. **Budget Adherence (25 pts):** Discipline staying within monthly spending cap
3. **Expense Pacing (20 pts):** Daily burn rate vs days elapsed in month
4. **Needs vs Wants Ratio (15 pts):** Discretionary wants maintained below 35%
5. **Goal Progress (15 pts):** Active funding toward savings targets

### Feature 6: What-If Savings Simulator
Interactive controls with sliders for daily extra savings (₹10–₹500/day), weekly cuts, and subscription cutbacks. Renders a dynamic **Chart.js trajectory** projecting growth over 3 to 12 months.

### Feature 7: Gamified No-Spend Challenges & Badges
Student challenges with streak counters and daily check-ins:
- *No-Spend Weekend* (48h zero non-essentials)
- *Save ₹500 This Week*
- *7-Day Saving Streak*
- *Avoid Food Delivery for 5 Days*
- *Save ₹100 Every Day*
- *30-Day Money Master*  
Unlocks four badge tiers: **Bronze Saver**, **Silver Saver**, **Gold Saver**, and **Money Master**.

### Feature 8: Split Bill with Friends
Hostel room & cafeteria group billing:
- Create groups (e.g. *"Flat 402 Roommates"*, *"Goa Trip"*)
- Split equally or custom
- Real-time balance sheet: shows who paid, who owes, and net balances
- Record and log settlement payments
- Strict privacy: a student's personal private transactions are never exposed to group members.

### Feature 9: Smart Daily Spending Limit
$$ \text{Daily Spending Limit} = \frac{\text{Remaining Monthly Budget} - \text{Upcoming Committed Bills}}{\text{Remaining Days in Month}} $$
Updates in real-time as transactions are recorded and warns immediately if today's spending crosses the safe allowance.

### Feature 10: Financial Calendar & Reminders
A monthly & weekly visual calendar with color-coded event indicators:
- 🟢 Green: Income deposits
- 🔴 Coral: Daily expense entries
- 🟡 Yellow: Upcoming bills and subscription renewals (Spotify, hostel fees, mobile data)  
Clicking any date opens that day's financial breakdown with one-click paid/unpaid toggles.

---

## 5. Database Schema & Data Models

| Model | Collection | Description |
|---|---|---|
| `User` | `users` | Student profile, credentials, hashed password, preferences, onboarding state |
| `Transaction` | `transactions` | Income/expense entries, category, needs/wants classification, payment mode |
| `Budget` | `budgets` | Monthly overall limit and category spending caps (e.g., Food: ₹4,000) |
| `SavingsGoal` | `savingsgoals` | Savings targets, deadlines, target amounts, contribution history |
| `Reminder` | `reminders` | Due bills, subscriptions, frequencies (monthly/weekly), payment status |
| `Challenge` | `challenges` | Catalog of pre-configured student challenges and badge tiers |
| `ChallengeProgress` | `challengeprogresses` | User participation, streaks, check-in history, completion status |
| `Badge` | `badges` | Unlocked achievement badges and award timestamps |
| `SplitBillGroup` | `splitbillgroups` | Group details, members, invite codes |
| `SplitBillExpense` | `splitbillexpenses` | Shared group expenses, payer, equal/custom share breakdowns |
| `SplitBillSettlement` | `splitbillsettlements`| Recorded settlements between group members |
| `Notification` | `notifications` | In-app notification alerts for budget thresholds, bills, badges |

---

## 6. REST API Endpoints

### Authentication (`/api/auth`)
- `POST /register`: Register student, sends 6-digit OTP
- `POST /verify-email`: Confirm registration with OTP code
- `POST /login`: Authenticate and receive JWT
- `POST /forgot-password`: Request password reset token
- `POST /reset-password`: Reset password using token
- `GET /profile`: Get logged-in student profile (Protected)
- `PUT /profile`: Update name, college, budget defaults (Protected)
- `POST /onboarding`: Save initial 6-step onboarding setup (Protected)
- `GET /export-data`: Download complete personal financial archive (JSON) (Protected)
- `DELETE /delete-account`: Permanently delete account and all data (Protected)

### Transactions (`/api/transactions`)
- `GET /`: List transactions with search, category, type, date filters (Protected)
- `POST /`: Record income or expense (Protected)
- `GET /export/csv`: Export transactions to CSV spreadsheet (Protected)
- `GET /:id`: Fetch single transaction record (Protected)
- `PUT /:id`: Update transaction details (Protected)
- `DELETE /:id`: Delete transaction (Protected)

### Budgets (`/api/budgets`)
- `GET /current`: Current month's overall and category budget usage (Protected)
- `POST /`: Set or update overall and category caps (Protected)
- `DELETE /:id`: Delete budget record (Protected)

### Savings Goals (`/api/goals`)
- `GET /`: List student savings goals and progress (Protected)
- `POST /`: Create new savings goal (Protected)
- `POST /:id/contributions`: Record deposit toward goal (Protected)
- `DELETE /:id`: Remove goal (Protected)

### Smart Features (`/api/smart`)
- `GET /overview`: Full dashboard dataset (balances, limits, health, recent records)
- `GET /assistant`: Proactive recommendations & overview stats
- `POST /assistant/query`: Ask financial questions to rule-based engine
- `POST /purchase-check`: Evaluate impulse item affordability
- `GET /needs-wants`: 50/30/20 breakdown & 6-month trend
- `GET /anomalies`: Anomaly detection alerts vs historical average
- `GET /health-score`: 100-point transparent score and 5-pillar breakdown
- `POST /simulate`: What-If savings compounding simulator
- `GET /daily-limit`: Real-time daily spending limit and burn warning

### Challenges & Badges (`/api/challenges`)
- `GET /`: List challenges, active user progress, and badges
- `POST /join`: Join challenge
- `POST /check-in`: Record daily check-in (prevents duplicate dates)

### Split Bills (`/api/splits`)
- `GET /groups`: List groups user created or joined
- `POST /groups`: Create new split group
- `GET /groups/:id`: Group details, expenses, settlements, and member balance sheet
- `POST /groups/:id/expenses`: Add shared bill with equal or custom split
- `POST /settlements`: Record settlement payment

### Financial Calendar (`/api/calendar`)
- `GET /`: Month calendar map (transactions, income, due bills)
- `POST /reminders`: Create reminder or subscription
- `PUT /reminders/:id`: Update reminder or toggle paid status
- `DELETE /reminders/:id`: Delete reminder

---

## 7. Local Setup & Execution Guide

### Prerequisites
1. **Node.js**: v18.0.0 or higher
2. **MongoDB**: Local MongoDB instance (port 27017) or a free MongoDB Atlas connection string

### Step 1: Clone or Navigate to Directory
```bash
cd c:\SpendSmart
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env` (already created for you):
```ini
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/spendsmart
JWT_SECRET=spendsmart_student_fintech_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d
```

### Step 4: Seed Realistic Student Demo Data
Populate the database with realistic student transactions, budgets, goals, split bills, and challenges:
```bash
npm run seed
```

### Step 5: Start the Server
```bash
npm start
```
The server will start at: **`http://localhost:5000`**

### Step 6: Explore the Application
Open your browser and navigate to:
- Landing Page: **`http://localhost:5000/`**
- Login: **`http://localhost:5000/login.html`**
- Click **"Try Demo Student"** on the login page, or log in with:
  - **Email:** `demo@spendsmart.com`
  - **Password:** `password123`

---

## 8. Automated Test Suite

SpendSmart includes a test suite verifying all 18 requirements:
```bash
npm test
```
**Verification Results:**
- 18 Passed, 0 Failed
- Tests include: Health check, demo login, protected routes, OTP registration, dashboard overview, transactions CRUD, monthly budgets, assistant queries, needs vs wants, purchase check, anomaly detection, health score, savings simulator, challenges, split bills, daily limits, financial calendar, and personal data export.

---

## 9. Deployment Instructions

### Production Deployment on Render / Railway / Heroku
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: SpendSmart Full-Stack Student Fintech"
   git remote add origin https://github.com/<your-username>/spendsmart.git
   git push -u origin main
   ```
2. Create a free **MongoDB Atlas** cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
3. Connect your repository on [Render](https://render.com) or [Railway](https://railway.app):
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add Environment Variables in the hosting dashboard:
   - `NODE_ENV=production`
   - `MONGODB_URI=<your-mongodb-atlas-uri>`
   - `JWT_SECRET=<your-secure-secret-key>`
   - `PORT=5000`

---

## 10. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

**SpendSmart — Smart Money Management for Students**  
*Your Money. Your Choices.*
