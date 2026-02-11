---
description: Agent startup protocol with scope-aware task claiming
---
You are agent $ARGUMENTS
## Identity Awareness
On startup, understand your scope:
- Check your agent profile via `mcp-agent-mail_whois` for your folder ownership and responsibilities
- Know which agents you coordinate with (from your contract messages)
## Startup Sequence (execute in order)
### 1. Check Mail First
- Fetch your inbox: recent messages, urgent-only=false, include_bodies=true
- Process ALL `ack_required` messages immediately and acknowledge them
- Read any team structure updates, contract messages, or reassignment directives
- Build context: who owns what, what's blocked, what's in progress
### 2. Scope Verification
For ANY task you consider:
- Verify it falls within your folder ownership (check your contract)
- Verify no other agent has an active claim on it
- If out-of-scope: route to correct owner via agent mail, do NOT start work
### 3. Claim Protocol
Before starting ANY task:
1. Run `br ready` to see unblocked, high-priority work
2. Cross-reference with mail: is anyone already working on this task?
3. Check file reservations: are the target paths reserved to someone else?
4. If unclaimed AND in-scope:
   - Reserve the target paths: `mcp-agent-mail_file_reservation_paths`
   - Send claim message to relevant owners: "CLAIM <thread-id> <paths> <eta>"
   - THEN start implementation
### 4. Execution Rules
- Work ONLY within your reserved file paths
- Coordinate before editing outside owned folders
- Update thread with progress at major milestones
- For cross-cutting changes, pre-agree with all affected owners
### 5. Completion Protocol
When done:
1. Post DONE message: "DONE <thread-id> <paths> <tests> <follow-ups>"
2. Include what changed, verification steps, risks
3. If follow-up needed: assign directly to the folder owner
4. Update beads: `br close <id>` with reason
5. Release file reservations when final
6. Git commit with clear message referencing issue
## Conflict Avoidance Rules
- NEVER duplicate work in progress
- If you see a conflicting claim, notify owner immediately
- Scope mismatch → hand off, do NOT implement
- Use `CLAIM` and `DONE` templates for consistency
## Contact Policy
- Respond to messages from your contacts
- Block or ignore messages from decommissioned agents
- Use agent mail for coordination, not direct file editing

## Required Output Format On Every Startup
ID: <agent-name>
SCOPE: <folder-ownership-summary>
ACTIVE: <thread-ids-you-own>
NEXT: <if-no-active-work-run-this-command>
Run this sequence on EVERY startup. Do NOT skip mail check.
---
