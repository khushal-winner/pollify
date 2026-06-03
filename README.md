# 📊 Pollify

Pollify is a modern, real-time community polling application built with a premium glassmorphic dark-mode design system. It allows users to create secure polls with custom expiration times, vote on active polls, and watch results dynamically update with visual percentage bars.

The project is architected with a hybrid approach, using **Next.js (App Router)** on the frontend/backend APIs and **Appwrite** as the backend-as-a-service (BaaS) database and authentication provider. 

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) (React 19 & TypeScript)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/) with a custom glassmorphism design system
- **Backend-as-a-Service (BaaS)**: [Appwrite Cloud](https://appwrite.io/)
  - **Authentication**: Email/Password login/registration and Anonymous Guest Sessions
  - **Database**: Appwrite Databases for real-time document storage
- **SDKs**:
  - `appwrite` (Client-side Web SDK) for browser operations
  - `node-appwrite` (Server-side Admin SDK) for Next.js API Routes

---

## 💾 Appwrite Database Schema

Pollify utilizes a relational document schema across three main Appwrite collections:

### 1. Polls (`polls` collection)
Stores the main poll configuration.
- **Attributes**:
  - `title` (String, size 256, Required)
  - `description` (String, size 1000, Optional)
  - `creatorId` (String, size 36, Required)
  - `createdAt` (String, size 36, Required)
  - `expiresAt` (String, size 36, Optional)
  - `isActive` (Boolean, Required, Default: `true`)
- **Indexes**:
  - `createdAt_idx` (Key, attribute: `createdAt`)
  - `creatorId_idx` (Key, attribute: `creatorId`)

### 2. Options (`options` collection)
Stores choices for each poll.
- **Attributes**:
  - `pollId` (String, size 36, Required)
  - `text` (String, size 256, Required)
  - `votesCount` (Integer, Required, Default: `0`)
- **Indexes**:
  - `pollId_idx` (Key, attribute: `pollId`)

### 3. Votes (`votes` collection)
Tracks individual cast votes to maintain integrity and prevent duplicate voting.
- **Attributes**:
  - `pollId` (String, size 36, Required)
  - `optionId` (String, size 36, Required)
  - `userId` (String, size 36, Required)
- **Indexes**:
  - `pollId_userId_idx` (**Unique Index**, attributes: `pollId`, `userId`) — This compound unique index ensures a user can only vote once per poll at the database level.

---

## 🔌 API Endpoints Reference

Pollify handles all actions securely through API routes in `app/api/*`:

| Route | Method | Description | Auth Required |
|---|---|---|---|
| `/api/init` | `POST` | Sets up the Appwrite database, collections, attributes, and indexes. | Admin Key |
| `/api/auth/register` | `POST` | Registers a new user with Email + Password. | No |
| `/api/auth/login` | `POST` | Logs in an existing user and sets a secure HTTP-Only cookie. | No |
| `/api/auth/logout` | `POST` | Invalidates the session and deletes the session cookie. | Yes |
| `/api/auth/anonymous` | `POST` | Starts an anonymous guest session for instant voting. | No |
| `/api/auth/me` | `GET` | Fetches the current active session user profile (if any). | No |
| `/api/polls` | `GET` | Lists all active/expired polls (with options & voting status). | No |
| `/api/polls` | `POST` | Creates a new poll. Options must contain at least 2 choices. | Yes |
| `/api/polls/[id]` | `GET` | Fetches details and options for a specific poll. | No |
| `/api/polls/[id]` | `DELETE` | Deletes a poll (allowed for the poll creator only). | Yes |
| `/api/polls/[id]/vote` | `POST` | Casts a vote on the specified option. | Yes |

---

## 🔄 Offline / Local Mock Fallback Mode

To enable friction-free development and instant environment preview without needing a live Appwrite cloud account, Pollify includes a **Mock Fallback Layer** in `lib/appwrite-server.ts`. 

- **How it triggers**: If any required Appwrite environment variables (`APPWRITE_API_KEY`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, or `APPWRITE_DATABASE_ID`) are missing, the server automatically switches to **Mock Mode**.
- **Mock Features**:
  - Simulates the database collections and documents using in-memory Javascript structures.
  - Mock state is **persisted across hot reloads** using Next.js global state.
  - Implements the exact same validation rules as real Appwrite (e.g., throwing a `409` conflict on duplicate emails, enforcing unique vote checks, validating credentials).

---

## ⚙️ Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Appwrite Configuration Settings
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id_here
APPWRITE_DATABASE_ID=your_database_id_here
APPWRITE_API_KEY=your_api_secret_key_here
```

*Note: If these variables are blank or omitted, Pollify automatically runs using the in-memory Mock Fallback Layer.*

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the app running.

### 3. Initialize the Database Schema (Only when using real Appwrite)
If you configure a live Appwrite backend, run the schema setup route to automatically configure database attributes and index rules:
```bash
curl -X POST http://localhost:3000/api/init
```

---

## 💎 Design Highlights

- **Vibrant Aesthetic**: Neon cyan & teal gradients combined with sleek dark backgrounds.
- **Glassmorphic Panels**: Clean layouts using backdrop filters, thin semi-transparent borders, and micro-shadows.
- **Micro-Animations**: Interactive hover effects, smooth transitions on voting progress bars, and clean fade-ins for modals.
- **Adaptive Voting Layout**: Live vote-count updating and progress percentages that adapt automatically.
- **Guest-Friendly Auth**: Let users jump in instantly with anonymous one-click voting or register to track their created polls.
