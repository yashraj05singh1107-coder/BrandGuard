# BrandGuard

BrandGuard is a demo brand-governance project for Northstar Workspace. The existing Python rule engine checks configured terminology, potential unsupported claims, and the required disclaimer. Findings are deterministic and work without an AI API key.

## Backend setup (PowerShell)

Run these commands from the project root:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

If the virtual environment already exists, skip the first command. Start the API from the project root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://127.0.0.1:8000`. Interactive API documentation is at `http://127.0.0.1:8000/docs`.

### API endpoints

- `GET /api/health` — API health.
- `GET /api/rules` — the configured Northstar Workspace rules and approved demo facts.
- `GET /api/reviews` — reviews and decisions currently held in server memory.
- `POST /api/review` — submit `{"text":"..."}` for a rule-based review. Text must contain non-whitespace characters and be at most 10,000 characters.
- `POST /api/reviews/{reviewId}/findings/{findingId}/decision` — submit `{"action":"accept"}`, `{"action":"edit","replacement":"..."}`, or `{"action":"dismiss"}`.

Review findings use the frontend's camelCase fields, including `id`, `ruleId`, `category`, `severity`, `matchedText`, `reason`, `source`, `suggestion`, and `replacement`. `suggestion` is the existing rule's guidance; `replacement` is populated only when the existing engine provides literal replacement text. An accept decision can be recorded without changing the draft when no literal replacement is configured. Edit requires replacement text; dismiss does not change it. Review history shows only decisions actually submitted to the API; reviews with pending findings are marked “In review,” not approved.

CORS allows the local Next.js development origin `http://localhost:3000`. To run the frontend, open a second PowerShell window:

```powershell
Set-Location .\frontend
npm run dev
```

Open `http://localhost:3000`. Content reviews, review decisions, configured guidelines, and review history use the FastAPI backend. Dashboard metrics and overview activity are fictional demo data.

The frontend defaults to `http://localhost:8000` for the API. To use a different API origin, create `frontend\.env.local` with:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Restart the Next.js server after changing this setting.

## Tests

From the project root:

```powershell
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

## Limitations

Review decisions are held in server memory and do not survive a server restart. Reviews are also in-memory and limited to the latest 500 submissions. There is no PostgreSQL database or LLM integration in this API. Potential unsupported claims are requests for human verification, not assertions that a statement is false. Findings and citations come only from the configured rules; no citations or evidence are fabricated.
