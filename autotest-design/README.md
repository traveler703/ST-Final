# AutoTestDesign

AI-driven test design workbench for the Software Testing final project.

## Stack

- Frontend: Next.js + TypeScript, App Router
- Backend: Spring Boot + JDBC + MySQL
- AI: OpenAI-compatible chat completions API
- Data model: project-scoped artifacts for requirements, risks, coverage, strategies, test cases, white-box models, suite variants, prompt logs, review revisions, and exports

## Required Environment

Backend defaults expect MySQL on `localhost:3306` with `root / 123456`.

```powershell
$env:AUTOTEST_DB_URL="jdbc:mysql://localhost:3306/autotest_design_db?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true"
$env:AUTOTEST_DB_USER="root"
$env:AUTOTEST_DB_PASSWORD="123456"
$env:LLM_BASE_URL="https://api.deepseek.com"
$env:LLM_API_KEY="your-deepseek-key"
$env:LLM_MODEL="deepseek-v4-flash"
```

If `LLM_API_KEY` is missing, the backend uses a deterministic demo fallback and records that in Prompt Log. Configure the key for the final demonstration.
The frontend can switch generation calls between `deepseek-v4-flash` and `deepseek-v4-pro`; the selected model is sent with each AI pipeline request.

## Run

Backend:

```powershell
cd E:\College\3down\ST\FINAL\autotest-design\backend
mvn spring-boot:run
```

Frontend:

```powershell
cd E:\College\3down\ST\FINAL\autotest-design\frontend
npm install
npm run dev
```

Open:

- Frontend: http://localhost:28111
- Backend health: http://localhost:28110/api/health

## Demonstration Flow

1. Create project `newbee-mall`.
2. Import `E:\College\3down\ST\FINAL\newbee-mall\NewBeeMall_Testable_Areas.xlsx`.
3. Run Structure, Risk, Coverage, Strategies, Test Cases, White-box, Optimize.
4. Edit at least two generated review items.
5. Export JSON, CSV, and Excel.

## Key API Endpoints

- `POST /api/projects`
- `GET /api/projects/{id}`
- `POST /api/projects/{id}/requirements/import`
- `POST /api/projects/{id}/requirements/structure`
- `POST /api/projects/{id}/risk/analyze`
- `POST /api/projects/{id}/coverage/generate`
- `POST /api/projects/{id}/strategies/generate`
- `POST /api/projects/{id}/test-cases/generate`
- `POST /api/projects/{id}/white-box/model`
- `POST /api/projects/{id}/suite/optimize`
- `PATCH /api/review-items/{id}`
- `POST /api/projects/{id}/exports/{format}`
