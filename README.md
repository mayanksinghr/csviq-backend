\# CSVIQ — AI-Powered CSV Lead Importer



CSVIQ is an AI-powered CSV importer built for \*\*GrowEasy CRM\*\*. It lets users upload leads from \*any\* CSV format — Facebook Lead Ads, Google Ads exports, spreadsheets, other CRMs — and intelligently maps inconsistent column names into a fixed CRM schema using an LLM, without requiring a specific file layout.



\*\*Live demo:\*\*

\- Frontend: https://csviq-frontend.onrender.com

\- Backend API: https://csviq-backend.onrender.com



> ⚠️ Hosted on Render's free tier — the backend may take 30–50 seconds to wake up on the first request after inactivity.



\---



\## Features



\- \*\*Drag \& drop or file picker\*\* CSV upload

\- \*\*CSV preview\*\* before any AI processing — parses and displays the first rows in a scrollable, sticky-header table

\- \*\*Confirm-to-process flow\*\* — AI extraction only starts after explicit user confirmation

\- \*\*AI-powered field mapping\*\* using Groq (`llama-3.3-70b-versatile`), with automatic fallback to `llama-3.1-8b-instant` on rate limits

\- \*\*Batch processing\*\* (25 rows/batch) with Zod schema validation on every AI response

\- \*\*Real-time progress\*\* via Server-Sent Events (SSE)

\- \*\*Retry mechanism\*\* — exponential backoff + model fallback for rate-limited/failed batches

\- \*\*Cancellation support\*\* for in-flight imports

\- \*\*Cleared vs. On Hold results\*\* — successfully mapped records vs. skipped/invalid records, with reasons

\- \*\*Dark themed UI\*\* ("customs manifest" aesthetic) built with Tailwind v4



\---



\## Tech Stack



| Layer      | Technology |

|------------|------------|

| Frontend   | Next.js (App Router), TypeScript, Tailwind CSS v4 |

| Backend    | Node.js, Express, TypeScript |

| AI         | Groq API (Llama 3.3-70b-versatile, with Llama 3.1-8b-instant fallback) |

| Validation | Zod |

| Realtime   | Server-Sent Events (SSE) |

| File Upload| Multer |

| Deployment | Render (both frontend \& backend) |



\---



\## Project Structure



```

csviq/

├── backend/

│   ├── src/

│   │   ├── config/         # env config

│   │   ├── controllers/    # route handlers

│   │   ├── jobs/           # in-memory job store + batch processor

│   │   ├── middleware/     # upload validation, error handling

│   │   ├── routes/         # Express routes

│   │   ├── services/       # CSV parsing, AI extraction (Groq)

│   │   ├── sse/            # SSE connection manager

│   │   ├── utils/          # batch chunker, retry helper

│   │   ├── validators/     # Zod schemas

│   │   └── server.ts

│   ├── package.json

│   └── tsconfig.json

└── frontend/

&#x20;   ├── app/

&#x20;   │   ├── page.tsx         # main import flow UI

&#x20;   │   └── layout.tsx

&#x20;   ├── components/          # CsvDropzone, StampBadge, StepTicker

&#x20;   ├── lib/

&#x20;   │   └── api.ts           # API client + SSE hook

&#x20;   ├── package.json

&#x20;   └── tsconfig.json

```



\---



\## Setup Instructions



\### Prerequisites

\- Node.js 20+

\- A \[Groq API key](https://console.groq.com) (free tier available)



\### 1. Clone the repo



```bash

git clone https://github.com/mayanksinghr/csviq-backend.git backend

git clone https://github.com/mayanksinghr/csviq-frontend.git frontend

```



\### 2. Backend setup



```bash

cd backend

npm install

```



Create a `.env` file in `backend/`:



```env

GROQ\_API\_KEY=your\_groq\_api\_key\_here

FRONTEND\_ORIGIN=http://localhost:3000

NODE\_ENV=development

```



Run the backend:



```bash

npm run dev

```



Backend runs on `http://localhost:4000` by default.



\### 3. Frontend setup



```bash

cd frontend

npm install

```



Create a `.env.local` file in `frontend/`:



```env

NEXT\_PUBLIC\_API\_BASE=http://localhost:4000/api/import

```



Run the frontend:



```bash

npm run dev

```



Frontend runs on `http://localhost:3000`.



\### 4. Try it out



1\. Open `http://localhost:3000`

2\. Upload a CSV (or download the sample template from the upload modal)

3\. Preview the parsed rows

4\. Click \*\*Confirm \& Process\*\* — this triggers AI extraction

5\. View \*\*Cleared\*\* (successfully mapped) and \*\*On Hold\*\* (skipped) records



\---



\## How the AI Mapping Works



1\. CSV is parsed into raw rows (headers preserved as-is, whatever they are).

2\. Rows are split into batches of 25.

3\. Each batch is sent to Groq with a system prompt describing the fixed CRM schema (`created\_at`, `name`, `email`, `crm\_status`, etc.), the allowed enum values for `crm\_status` and `data\_source`, and rules for handling multiple emails/phone numbers, missing dates, and invalid rows.

4\. The model returns strict JSON (`response\_format: json\_object`), which is validated against a Zod schema before being accepted.

5\. If the primary model hits a rate limit, the system automatically retries with a smaller fallback model. If both are exhausted, the job is marked `rate\_limited` and the user is shown exactly when limits reset.

6\. Rows with neither an email nor a phone number are skipped and shown under \*\*On Hold\*\* with a reason.



\---



\## API Endpoints



| Method | Endpoint | Description |

|--------|----------|--------------|

| `POST` | `/api/import/upload` | Upload and preview a CSV (no AI processing) |

| `POST` | `/api/import` | Start an AI-powered import job |

| `GET`  | `/api/import/:jobId/progress` | SSE stream of job progress |

| `POST` | `/api/import/:jobId/cancel` | Cancel an in-flight job |

| `GET`  | `/api/health` | Health check |



\---



\## Known Limitations



\- Job state is stored in-memory (no database) — jobs are lost on server restart.

\- Free-tier hosting means the backend cold-starts after inactivity.

\- Groq's free tier has daily/per-minute rate limits, which the app surfaces gracefully rather than silently failing.



\---



\## Author



\*\*Mayank Singh\*\*

GitHub: \[mayanksinghr](https://github.com/mayanksinghr)



