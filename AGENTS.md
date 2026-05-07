1. Purpose
This document defines how Codex agents must operate while building the IRIS platform.

The system must be built strictly based on the provided spec files, with no assumptions, shortcuts, or invented behavior.

2. Core Rules (Non-Negotiable)
2.1 Follow Specs, Not Imagination
ALWAYS refer to:
architecture/ARCHITECTURE.md → system design decisions
design/DESIGN.md → UI/UX consistency
db/SCHEMA.md → database structure
api/* → API contracts
ui/* → UI specifications
NEVER invent:
fields
endpoints
workflows
UI components
If something is missing → log it, don’t guess.

2.2 Build Order (Strict Sequence)
Follow build-plan/BUILD_PLAN.md

Foundation (auth, layout, base infra)
Core modules (dashboard, worklist)
Underwriting
Claims
Compliance
Admin
No jumping ahead because you’re “feeling productive.”

2.3 Tracker Awareness (Reality Check Layer)
Before building anything:

Read trackers/TRACKER.md
Identify:
✅ Completed
🧪 Mocked
❌ Not started
Behavior:

If mock → implement stub/mock logic
If real → implement full logic
If done → DO NOT rebuild
2.4 UI Must Match Screenshots
Always check:
ui-screens/
ui/CORRECTIONS_FROM_SCREENSHOTS.md
If mismatch between spec and screenshot:
→ Screenshot wins
→ Log the correction

2.5 One Unit at a Time
Build one UI + corresponding API at a time
Fully complete before moving to next
No partial scattered implementations
3. Execution Workflow
For EVERY task:

Step 1: Context Loading
Read relevant:
UI spec
API spec
DB schema
Architecture constraints
Step 2: Dependency Check
Is auth required?
Is data mocked?
Is API already built?
Step 3: Implementation
Backend
Follow:
Proper layering (router → service → repository)
Schema validation
Error handling
Frontend
Follow:
design/DESIGN.md
Global layout rules
Component consistency
Step 4: Logging (Mandatory)
Every service must include:

logger.info("Meaningful business step")
logger.debug("Detailed internal state")
logger.error("Error context with data")
No logging = incomplete code.

Step 5: Validation
Match API response with spec
Match UI with screenshots
Ensure DB usage aligns with schema
Step 6: Update Tracker
Update trackers/TRACKER.md:

Mark completed items
Mark mocks vs real
Step 7: Log the Session
Append to:

codex_logger.md
4. codex_logger.md Format
Every prompt + result must be recorded.

## [Timestamp]

### Prompt
<exact prompt given to Codex>

### Context Used
- Files referred:
  - ui/03-worklist/WORKLIST.md
  - api/worklist/WORKLIST.md

### Actions Taken
- Created API endpoints
- Built UI components
- Connected frontend with backend

### Files Modified
- backend/worklist/routes.py
- frontend/worklist/page.tsx

### Issues / Deviations
- Missing field in API spec
- Screenshot mismatch

### Status
✅ Completed / 🧪 Mocked / ⚠️ Blocked
5. Coding Standards
Backend
Clean separation:
Router
Service
Repository
Typed schemas (Pydantic / DTOs)
Centralized error handling
Frontend
Reusable components
No inline chaos styling
Follow layout system
General
No hardcoded values (unless explicitly marked mock)
No silent failures
Explicit error messages
6. Mock vs Real Handling
Scenario

Action

Data not available

Use mock-data/MOCK_DATA.md

External system missing

Stub API

Complex logic TBD

Return deterministic mock

Clearly mark:

# MOCK IMPLEMENTATION
7. Error Handling Rules
Never swallow errors
Always:
log error
return structured response
Example:

{
  "error": "Invalid contract ID",
  "details": "Contract not found in DB"
}
8. When Blocked
If any of the below happens:

Spec missing
Conflicting instructions
Screenshot mismatch
Then:

STOP implementation
Log in codex_logger.md
Mark as ⚠️ Blocked
9. Definition of Done
A feature is complete only if:

✅ Matches spec
✅ Matches screenshot
✅ API works
✅ UI connected
✅ Logging added
✅ Tracker updated
✅ Logger entry added
10. Behavioral Constraints for Codex
Do not assume
Do not skip steps
Do not over-engineer
Do not under-implement
Be boring. Boring code ships.

11. Final Note
This is not a prototype playground.

This is a controlled build system:

Specs define truth
Tracker defines reality
Logger defines history
If Codex drifts from this, the output becomes unreliable.