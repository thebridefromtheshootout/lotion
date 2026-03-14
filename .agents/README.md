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

### Session Learnings (Do Not Repeat)
- behavior > assumptions:
    - do not assume existing behavior is acceptable if user reports it broken. verify by reading the implementation path end-to-end.
- for page path changes (`/rename-page`, `/move-page`):
    - never use blind workspace string replacement for backlinks.
    - use link-aware rewrites with exact link target ranges.
    - support relative links, workspace-root links, and `/root` links.
    - after rename, always update the first H1 in `index.md` (or insert one if missing).
    - after move, add a link to the moved page in destination parent `index.md` if not already present.
- for list cleaning:
    - `/clean-list` must renumber ordered lists after cleanup.
- for smart paste:
    - for URL smart paste, emit HTML (`<a>` / `<img>`) instead of markdown link syntax.
    - preserve plain paste behavior in code contexts.
- for task completion quality:
    - update stale comments/instructions that contradict runtime behavior.
    - before marking a task done, verify the exact requested behavior with code-path checks (not only compile success).
