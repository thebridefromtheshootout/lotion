### What changes to make
Read tasks.txt and do any task that is not below the Complex tasks line.

### Instructions on making changes
- follow engineering patterns in the repo.
- write clean, DRY code.
- test all changes for a fix with `npm run compile`.
    - if it says npm not found, try running `nvm use v20.14.0`
- before committing, mark the task as done with a green check mark emoji in tasks.txt
- commit all atomic fixes one by one as you make them.
- implement intent, not surface-level shortcuts:
    - if a task asks for a command/feature, implement meaningful runtime behavior end-to-end, not only command visibility/wiring.
    - do not satisfy behavior tasks with UI gating alone (for example, showing `/copy` only in code context is not enough unless copying behavior is also improved).
    - if wording can be interpreted as either UI-only or behavior change, prefer behavior; if behavior could be risky, ask a concise clarification before coding.
