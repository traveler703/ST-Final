# AutoTestDesign Delivery Status

This checklist is aligned with `tmp/pdfs/assignment2_updated.pdf`, Section 1.2 Project Artifact and Section 4 Submission.

## Required Submission Package

### A. Project Artifact Package - 20%

Submit as a compressed file.

Ready:
- AutoTestDesign source code: `E:\College\3down\ST\FINAL\autotest-design`
- Tool README/setup instructions: `E:\College\3down\ST\FINAL\README.md` and `E:\College\3down\ST\FINAL\autotest-design\README.md`
- Prompt/design trace evidence: `prompt_runs` in JSON/XLSX export
- Generated artifacts:
  - `E:\College\3down\ST\FINAL\tmp\autotest-export-final.json`
  - `E:\College\3down\ST\FINAL\tmp\autotest-export-final.csv`
  - `E:\College\3down\ST\FINAL\tmp\autotest-export-final.xlsx`
- Target application and demo input:
  - `E:\College\3down\ST\FINAL\newbee-mall`
  - `E:\College\3down\ST\FINAL\newbee-mall\NewBeeMall_Testable_Areas.xlsx`
- Implementation notes:
  - `E:\College\3down\ST\FINAL\CODE_WIKI.md`
  - `E:\College\3down\ST\FINAL\PROJECT_STATUS.md`

Still needed:
- Cover page with team ID, full names, and student IDs.
- Video demonstration of the tool.
- Final compressed archive containing source code, README/setup, prompts/evidence, demo exports, and video.

### B. Risk Analysis Report - 10%

Submit as PDF. This report must analyze the self-chosen target application, not the AutoTestDesign tool.

Partially ready:
- Risk data exists in `Risk Matrix` worksheet and JSON `riskAssessments`.
- Target app is `newbee-mall`.

Still needed:
- Formal PDF report with cover page.
- Risk scoring method, risk table, high-risk modules, and rationale.
- Summary of how risk priority influenced test design and FR 7.0 suite optimization.

### C. Test Plan - 40%

Submit as PDF.

Partially ready:
- Raw material exists in README, CODE_WIKI, PROJECT_STATUS, and generated exports.

Still needed:
- Formal PDF test plan covering:
  - Project scope and objectives for testing `newbee-mall`
  - Test items: functional and non-functional features
  - Target application architecture and main components
  - High-level test suite design and selected test techniques
  - Schedule or checklist with test levels and objectives
  - Organization chart and member responsibilities
  - Chosen testing framework and rationale
  - Cost estimation using AutoTestDesign, optionally compared with manual testing

### D. Detailed Test Design and Execution Document - 30%

Submit as PDF. Choose one major feature/module of `newbee-mall`.

Partially ready:
- Generated test cases, coverage items, strategies, and traceability exist in final JSON/XLSX export.
- White-box state model exists in the export.

Still needed:
- Pick one major module, recommended: shopping cart + order/payment flow.
- Formal PDF with:
  - Detailed test case design from AutoTestDesign
  - Coverage explanation mapped to coverage items and strategies
  - Multiple black-box techniques
  - White-box technique/model coverage
  - Test tool implementation using Selenium, JUnit, PyTest, or another selected framework
  - Test scripts or script excerpts
  - Test result analysis
  - Evidence of human designer review and improvement

### E. Final Presentation PPT

Submit the PPT separately. The first slide must include team ID, full names, and student IDs.

Still needed:
- Final presentation deck.
- Export deck to PDF if requested by TA/course.
- 15-minute presentation flow plus Q&A preparation.

## Verified Technical Status

- Backend: `mvn test`
- Frontend: `npm run lint`
- Frontend: `npm run typecheck`
- Frontend: `npm run build`
- Runtime verified:
  - MySQL: `localhost:3306`
  - Backend: `http://localhost:28110/api/health`
  - Frontend: `http://localhost:28111`
- Final export check:
  - JSON has 70 requirements, 241 test cases, and 3 suite variants.
  - JSON includes `optimization_summary`.
  - Excel includes `Requirements`, `Risk Matrix`, `Coverage Matrix`, `Strategies`, `Test Cases`, `Optimized Suites`, `Prompt Runs`, and `Review Changes`.

## Highest Priority Gaps

1. Create the three required PDF reports: Risk Analysis Report, Test Plan, Detailed Test Design and Execution Document.
2. Create the final presentation PPT.
3. Record the tool video demonstration.
4. Add cover pages with team ID, names, and student IDs.
5. Package the tool materials into a compressed archive.
