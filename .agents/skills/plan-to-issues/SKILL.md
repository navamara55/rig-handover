---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Use the issue shape below. Ask the human only for what it doesn't cover.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --body-file <tmp.md> --label "plan:<plan>"
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

## Issue shape

Every issue carries this, set by the human on 2026-10-31 (plan morning-digest):

- **Label:** `plan:<plan>`, where `<plan>` is the `plan:` value in `plan.md`'s frontmatter
  (e.g. `plan:morning-digest`). Create the label first if it doesn't exist. Reviewers sort by it.
- **Body**, in this order. The first line is exactly `Source: plan.md § <n>`, where `<n>` is the
  plan's section as headed (`1`, `2a`, …):

  ```md
  Source: plan.md § <n>

  Scope: <what this issue changes, and what it must not touch>
  Done when: <the plan's "Done when" for this part, checkable>
  Blocked by: <#n, or "none"; say if it blocks only the start or only "Done when">
  ```

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
