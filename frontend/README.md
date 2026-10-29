# BrandGuard frontend

BrandGuard is a responsive brand-governance dashboard built with Next.js, React, TypeScript, and Tailwind CSS.

## Run locally

Start the backend from the project root in one PowerShell window:

```bash
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Then start the frontend from the `frontend` directory in another PowerShell window:

```powershell
Set-Location .\frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The frontend uses `http://localhost:8000` as its default API origin. To override it, set `NEXT_PUBLIC_API_BASE_URL` in `frontend\.env.local` and restart Next.js.

## Integrated features

- Content reviews and Accept, Edit, and Dismiss decisions call the FastAPI service.
- Brand guidelines load from the configured Python rules API.
- Review history lists decisions currently held by the backend.
- The overview dashboard metrics and its sample activity remain fictional demo data.

Review records and decisions are in server memory and are cleared on API restart. No database or AI provider is connected. A flagged claim is a prompt for human verification, not proof that the claim is false. A clean result only means the configured checks did not match.
