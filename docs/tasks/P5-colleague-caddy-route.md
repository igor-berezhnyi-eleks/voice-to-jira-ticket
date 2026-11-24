# P5 — The colleague's Caddyfile route (colleague-led, on `main`)

- **Milestone:** M9 (revision 3)
- **Status:** done (2026-11-24)
- **Depends on:** gate "Deployment plan revision 3 approved"; the colleague agrees (deployment-plan section 8)
- **Plan sections:** `docs/deployment-plan.md` 3, 4.4, 7
- **Parallel-safe with:** P4

## Goal

The colleague's Caddy on `main` serves their app at `/` and forwards `/alt/*` to `alt-api:8080`, and `/alt` redirects to `/alt/`.

## Files

- The colleague's `deploy/Caddyfile` on `main` (their PR, not on this branch)
- `docs/tasks/P5-*.md`, `docs/status.md` (this branch: the log only)

## Out of scope

- Any other file on `main`: their compose file and workflow stay as they are.
- Merging anything from this branch into `main`.

## Acceptance criteria

- [x] The colleague agrees: the route, both apps on the VM at once, both using the Anthropic key.
- [x] Their PR with the section 4.4 Caddyfile is merged to `main`, and their deploy succeeds.
- [x] Their site at `/` still works. Before P4 is deployed, `/alt/` answers 502 (no upstream) and does not break their site.

## Verification

Manual (human and colleague): the PR's deploy run on `main` succeeds; open `https://10.17.89.14/` and `https://10.17.89.14/alt/`.

## Gate

None.

## Notes

- The agent may draft the Caddyfile text and the PR description for the human to pass on. The agent does not open a PR on `main` and does not push to it.
- ⚠ VERIFY: Caddy resolves `alt-api` when a request comes in, not at startup.

## Log

### Plan

The agent's part is text only. No code, no PR and no push to `main`.

1. Read the colleague's current `deploy/Caddyfile`, `docker-compose.prod.yml` and `.github/workflows/deploy.yml` on `origin/main` (fetched 2026-11-24; tip `fc98cd6`, 2026-11-19).
2. Check the ⚠ VERIFY (when Caddy resolves `alt-api`) and how the section 4.4 block matches paths.
3. Draft the full new Caddyfile and a PR description below, for the human to pass on.
4. The colleague's agreement, their PR, the merge and the deploy are the human's and colleague's work (acceptance criteria 1–3).

### Decisions

- **⚠ VERIFY: when Caddy resolves `alt-api`. Result: when a request is dialed, not at startup.** Source: `modules/caddyhttp/reverseproxy/httptransport.go` on caddy `master` (read 2026-11-24). `Provision`/`NewTransport` only build a `net.Dialer`. They do no lookup unless `resolvers` is set. `dialContext` calls `dialer.DialContext(ctx, network, address)` with the `host:port` string on each connection, and wraps a failure as `DialError`. Not read in full: `fillHost` in `reverseproxy.go` (the file was truncated). The default status for a proxy error (`http.StatusBadGateway`) comes from a summary of that file, not a verbatim read. **So the claims "Caddy starts with `alt-api` missing" and "`/alt/` gives 502" are strongly supported but not proven. P5 criterion 3 checks them on the VM.** Local check not run: Docker Desktop was not running.
- Path matching (caddyserver.com/docs/caddyfile/matchers): "Path matching is an exact match by default, not a prefix match". So `redir /alt /alt/ 308` catches only `/alt`, and `/alt/*` catches `/alt/` and `/alt/...` but not `/alt` or `/altx`. A query string is not part of the path match, and, per known Caddy behaviour (not checked against the redir docs), `redir` keeps no query unless the target contains `{query}` (`/alt?x=1` → `/alt/`). That is acceptable: nothing links to `/alt?…`.
- Directive order (caddyserver.com/docs/caddyfile/directives): `redir` comes before `handle`, so the redirect wins whatever order the lines are written in. Plain `handle` (unlike `handle_path`) keeps the `/alt` prefix, which D28 requires.
- The colleague's workflow already runs `up -d --force-recreate`, so a Caddyfile change reaches Caddy on the next push to `main` with no workflow change. Their health check (`/api/health`) is unchanged and still checks their own app.
- Other paths (`/altx`, `/foo`) still go to the colleague's app, as today.

### Draft for the colleague: `deploy/Caddyfile` (whole file)

```
{
	# Clients connecting by IP send no SNI, and inside Docker Caddy sees the container IP,
	# not 10.17.89.14, so it cannot pick a certificate on its own.
	default_sni 10.17.89.14
}

https://10.17.89.14 {
	tls internal

	# The alternative version (feature/poc-v2, Compose project voice-to-ticket-alt) lives under /alt/.
	# The prefix is not stripped: that app expects it (PathBase=/alt).
	# alt-api is looked up per request, so this site starts and serves / when that stack is down;
	# /alt/ then answers 502.
	redir /alt /alt/ 308
	handle /alt/* {
		reverse_proxy alt-api:8080
	}

	handle {
		reverse_proxy api:8080
	}
}
```

Diff against `main`: the global block and `tls internal` are unchanged. `reverse_proxy api:8080` moves into a `handle` block, and the `redir` line and the `/alt/*` block are new.

### Draft for the colleague: PR description

> **Title:** Caddy: route `/alt/` to the alternative version
>
> This adds one route to `deploy/Caddyfile`. Nothing else changes: the compose file and the workflow stay as they are.
>
> - `/alt` redirects to `/alt/` (308).
> - `/alt/*` goes to `alt-api:8080`. That is the alternative version from `feature/poc-v2`. It runs as its own Compose project, `voice-to-ticket-alt`, and joins `voice-to-jira_default`. The prefix is not stripped.
> - Everything else goes to `api:8080`, as today.
>
> Your site does not depend on the other app. Caddy looks up `alt-api` per request, so if that stack is down, only `/alt/` fails (502). Ports 80/443, the certificate and the `caddy_data` volume stay in this project. Your deploy (`--force-recreate --remove-orphans`) does not touch the other project's containers.
>
> **What this means for you** (deployment plan, sections 5 and 7):
>
> - Both apps use the Anthropic key in `/opt/voice-to-jira/.env`. It needs a spending limit sized for two apps.
> - While `alt-api` is attached to `voice-to-jira_default`, a `docker compose down` on your side cannot remove that network. Your `up` deploys are not affected.
> - Both apps share one origin. That means one `localStorage` (the `eleks-ui-theme-mode` light/dark choice carries over), one microphone permission, and your `jira_session` cookie is also sent to `/alt/`, where the other app ignores it.
> - Both apps share RAM and CPU. During a Ukrainian transcription on `/alt/`, your requests and builds get slower. P6 measures this once.
>
> **Check after the deploy:** `https://10.17.89.14/` works as before, and `https://10.17.89.14/alt/` answers 502 until the alternative version is deployed.

### Verified

- `origin/main` files read (Caddyfile, prod compose, workflow); the draft keeps their global block and site block.
- ⚠ VERIFY on Caddy name resolution: see Decisions (source read, partial).
- No build or test: this branch changes only `docs/` (`node scripts/check.mjs`: nothing to check).
- Human (2026-11-24): "PR merged, deploy done, / works and /alt/ gives 502." That covers criteria 2 and 3, as reported by the human. It also confirms on the VM what the source read suggested: Caddy starts with no `alt-api` and answers 502 on `/alt/`.

### Not verified

- By the agent: the merge, the deploy run and the two URLs. Those are the human's reports. A local `caddy:2` run and `caddy validate` were never done (Docker Desktop off); the VM deploy replaced them.

### PR (2026-11-24)

- Human: "The colleague agrees." This covers criterion 1, as reported by the human. The human asked the agent to make the change in worktree `C:\Source\voice-to-ticket-alt-route` (branch `alt-route`, from `main` at `fc98cd6`) and open a PR into `main`. That replaces this task's note "the agent does not open a PR on `main`" and, for this branch, CLAUDE.md's "never push".
- Commit `7dd4233` on `alt-route` changes only `deploy/Caddyfile`: the draft above, CRLF as before. The branch is pushed to `origin/alt-route`. The PR is https://github.com/igor-berezhnyi-eleks/voice-to-jira-ticket/pull/21 with the draft description. It is not merged; the merge is for the colleague or the human.

### Reviews

- Round 1 (reviewer subagent): **APPROVE** for the agent's part. Criteria 1–3 are human and colleague steps. Four minor findings, all fixed: a stray `**` and the outdated "Next: P5" in `status.md`; the PR draft lacked the section 5 and 7 risks for the colleague ("What this means for you" added); "Unknown hosts" changed to "Other paths"; the `redir`-query claim is now labelled as unchecked.

### Notes for the study

- At first the agent read "colleague-led" as "text only" and stopped at drafts. The human then asked for the real file change and the PR from a separate worktree. That overrode the task note and CLAUDE.md's "never push" for one branch, and is recorded under PR.
- The docs pages did not answer the ⚠ VERIFY, so the agent read Caddy's source. It labelled the parts it had not read, and the VM later confirmed the claim. With Docker off, the harness had no local check for a Caddyfile.
- The reviewer approved with 4 minor findings. The useful one: the PR text lacked the risks the colleague was agreeing to (section 7).
