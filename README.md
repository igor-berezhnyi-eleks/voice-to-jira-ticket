# Voice to Ticket

A proof of concept: a browser tool that turns a spoken bug report or feature request into a structured ticket (Bug or Feature) that a developer reviews and copies into Jira.

The scope, decisions and task list are in the [implementation plan](docs/implementation-plan.md). Current progress is in [docs/status.md](docs/status.md).

**Evaluation:** [docs/evaluation-report.md](docs/evaluation-report.md) (not yet written; it comes with task T5.4). Until then this README makes no claim about how good the tickets are.

## Prerequisites

- Docker Desktop, running (on Windows it uses WSL2). About 1.4 GB of disk for the speech model, downloaded on first start.
- Chrome or Edge, and a microphone, for voice input. Typing the report works in any browser.
- An Anthropic API key, only to use the real ticket generator (`Claude`). Without it the app uses a fake generator that produces placeholder tickets.
- For development: the .NET SDK from `global.json` and Node.js 24.

## Quick start with Docker (fake generator)

```
docker compose up --build
```

The app is at http://localhost:5080. Without a `.env` file it uses the fake generator, which needs no API key. Tickets from the fake are not real, and the app shows a banner saying so once it has generated one.

The first start also downloads the speech model; voice input works once `docker compose ps` shows the `stt` service as `healthy` (about 2.5 minutes the first time, seconds later). Typing a report works straight away.

Stop it with `docker compose down`.

## Using the real generator (Claude)

1. Copy `.env.example` to `.env`.
2. Set `TicketGenerator__Provider=Claude` and `Claude__ApiKey` to your key. Never commit `.env`.
3. `docker compose up --build` again.
4. Generate a ticket. The "Fake generator active" banner must not appear. If you see "The ticket service is not available right now", the key is missing, wrong or rejected.

With `Claude` selected, the **transcript text** is sent to the Anthropic API to produce the ticket. Audio is not: it goes only to the local `stt` container and is not stored.

## Demo script (about 5 minutes)

Use Chrome or Edge on http://localhost:5080 with the stack running.

1. Press **Record** and say: "When I tap the login button in the iPhone app, it crashes straight away. It started after the last update. I expected to land on the home screen." Press **Stop**. The transcript appears in the box.
2. Fix any misheard word in the box by hand. Dictating again appends more text.
3. Press **Generate ticket**. Page 2 shows the review view: a type (Bug), title, description and detail fields.
4. Fields the speaker did not mention say "Not provided" and are tinted **Needs content**. The **Missing information** panel lists questions for the reporter; selecting one jumps to its field.
5. Edit a field, for example fill in the steps to reproduce.
6. Change **Type** to Feature. The ticket is converted in your browser and a notice offers **Regenerate as Feature**. Switch back to Bug: your earlier edits are restored.
7. Choose the format (**Plain** or **Jira wiki**), then **Copy** and paste into Jira, or **Save as JSON**.
8. **Regenerate** produces a new ticket from the same transcript; **Back to transcript** returns to Page 1. Both ask before discarding edits.

If something goes wrong, see Troubleshooting below.

## Known limits

- English only (model `faster-whisper-medium.en`).
- Voice recording works in Chrome and Edge only (no Safari). A recording stops after 5 minutes and may not exceed 25 MB. The transcript must be 20 to 20,000 characters.
- Speech-to-text runs on the CPU: about 3.5 seconds per 10 seconds of audio on the reference laptop, and a first start of about 2.5 minutes. The GPU compose file is untested. The image is a release candidate (`0.9.0-rc.3-cpu`).
- One ticket per report. The model is told not to invent: anything the speaker did not say is "Not provided" and appears as a question. Tickets are suggestions; a person must read and correct them before use.
- There is no app login. Copy the ticket, save it as JSON, or create it in Jira Cloud or Jira Server when Jira is set up (see [Jira](#jira)). Run the app on your own machine only.
- The recording is kept in the page only until it is closed or replaced.

## Troubleshooting

| What you see | Meaning | What to do |
|---|---|---|
| "The transcription service is not available" | The `stt` container is not running or still starting | `docker compose up -d stt`, wait for `healthy`, then **Try again** (the recording is kept; **Download recording** saves it) |
| "Transcription took too long" | The speech-to-text server did not answer in 120 s | **Try again**, or record a shorter report |
| "Could not reach the server" (also while recording) | The API is stopped or restarting | Start it (`docker compose up`), then **Try again** or **Retry** |
| "Microphone access was denied" | The browser blocked the microphone for this site | Allow the microphone in the site settings, press **Record** again |
| "No microphone was found" | No input device | Connect one, or type the report |
| "Recording is not supported in this browser" | Not Chrome or Edge | Switch browser, or type the report |
| "No speech was detected" | Silence | Record again, closer to the microphone |
| "The recording is too large" | Over 25 MB | Download it and record a shorter report |
| "The audio could not be read" | The file is corrupt or not audio (for example a renamed document) | Use a valid .wav, .mp3, .webm or .ogg file; Try again is not offered |
| "That file type is not supported" / "That recording is … long" | Upload of another format, or over 5:00 | Convert to .wav, .mp3, .webm or .ogg, or trim the file |
| "The ticket service is not available right now" | `Claude` is selected and the key is missing, wrong or rejected, or the service is down | Check `Claude__ApiKey` in `.env`, restart, **Retry** |
| "The ticket service took too long to answer" | No answer within 60 s | **Retry** |
| "The ticket service declined to process this report" | The model refused | Edit the transcript, then **Generate ticket** |
| "The ticket service returned a ticket that could not be used" | The model's answer failed the checks (retried once already) | **Retry**; reword the report if it keeps happening |
| "The field Transcript must be a string with a minimum length of 20 and a maximum length of 20000" | The text is too short or too long | Edit the transcript |
| Voice works, no ticket, banner says "Fake generator" | `.env` missing or `TicketGenerator__Provider` is `Fake` | See "Using the real generator" |

## Configuration

Docker reads these from `.env` (git-ignored; copy `.env.example`). For local development, use `appsettings.Development.json`, and `dotnet user-secrets` for secrets. Environment variables use `__` for nesting.

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `TicketGenerator__Provider` | `Fake`, `Claude` | `Fake` | Which ticket generator runs. Anything else stops the app at startup. |
| `Claude__ApiKey` | your Anthropic API key | none | Required with `Claude`. Never commit it. |
| `Claude__Model` | a Claude model id | `claude-sonnet-5-5` | Model used with `Claude`. |
| `Claude__Effort` | `low`, `medium`, `high`, `xhigh`, `max` | `medium` | Thinking effort. |
| `Claude__MaxTokens` | positive integer | `16000` | Output limit; too small gives a "cut off" error. |
| `Claude__TimeoutSeconds` | positive integer | `60` | Deadline for each attempt (one retry on an unusable ticket). |
| `Stt__BaseUrl` | URL | `http://stt:8000` (`http://localhost:8000` in Development) | Speech-to-text server. |
| `Stt__Model` | model id | `Systran/faster-whisper-medium.en` | Speech model. |
| `Stt__Language` | language code | `en` | Speech language. |
| `Stt__TimeoutSeconds` | positive integer | `120` | Deadline for one transcription; there is no retry. |

The `Claude__*` settings are checked at startup only when `Claude` is selected.

## Jira

On Page 2, **Connect to Jira board** opens the Connect panel, then Page 3 creates the issue in Jira. The app discovers each project's issue types, fields and link types; the details are in [docs/jira-plan.md](docs/jira-plan.md). Jira is off by default, and the button stays disabled with "Jira is not configured".

### Cloud or Server, chosen in the Connect panel

One running app serves Jira Cloud and Jira Server (or Data Center) users at the same time. Each user chooses in the Connect panel:

- **Jira address**: the site to use, for example `https://yourcompany.atlassian.net` or `https://jira.company.com`. It must be https and its host must be on `Jira:AllowedHosts`.
- **Jira type**: **Cloud** or **Server / Data Center**. The panel guesses from the address (`*.atlassian.net` is Cloud, anything else Server) until you pick one, and remembers your choice per address in this browser.
- **Sign in with** (Server only): **Token** (a personal access token, sent as `Bearer`) or **Username and password**. Cloud always uses your Atlassian email and a classic API token without scopes.

The address, type and sign-in are kept with the credential in an encrypted, HttpOnly session cookie for this app; **Disconnect** removes it. Switching from Cloud to Server needs no configuration change or restart: Disconnect, then connect with the other type.

### Jira Cloud: token, what is discovered, limits

- **Token.** Create a classic API token without scopes at <https://id.atlassian.com/manage-profile/security/api-tokens> and use it with your Atlassian email. Atlassian's documentation says scoped tokens need a different gateway address, so use a classic one. The token gives the app the same rights as you have in Jira.
- **Where it is kept.** Only in the encrypted, HttpOnly session cookie of this app, for `Jira__SessionHours` (8 by default). Nothing is stored on the server and nothing is logged.
- **Disconnect and revocation.** **Disconnect** deletes the cookie. It does not revoke the token: revoke it on the Atlassian token page when you no longer need it.
- **What is discovered from Jira.** When you pick a project, the app reads its issue types (with their hierarchy level), the fields of each type, the link types and, for the Parent and Add link pickers, matching issues. Nothing about a project is configured by hand: the type names and the link type in the settings are suggestions only, and you can change the type, edit the summary and description, fill fields, pick a parent and add links on Page 3.
- **Supported field kinds.** Text, long text, number, date, labels, a single option and multiple options. A required field of any other kind (for example a user picker or a cascading select) blocks Create with a notice that names the field; create the issue in Jira directly or ask for the field to be made optional.
- **A timeout on Create.** Jira may still have created the issue. The page then says so and does not retry: search Jira before you try again.
- **Local demos only.** The app has no login of its own and holds each user's Jira credential for the session, so run it on your own machine, not as a shared deployment.

### Settings

| Variable | Default | Purpose |
|---|---|---|
| `Jira__Enabled` | `false` | Turns the Jira button and endpoints on. |
| `Jira__AllowedHosts__0`, `Jira__AllowedHosts__1`, … | none | The hosts the app may call: exact (`jira.company.com`) or a leading wildcard (`*.atlassian.net`); no scheme, port or path. **List every host your users connect to, Cloud and Server.** A malformed entry stops the app at startup. |
| `Jira__BaseUrl` | none | The address the Connect panel starts with. With no `AllowedHosts`, its host is the only one allowed. |
| `Jira__Deployment` | `Cloud` | Only a default: the type the panel starts with when it has nothing remembered or guessed. The session's own type always wins. |
| `Jira__ServerAuthScheme` | `Bearer` | Only a default: the sign-in the panel starts with for Server (`Bearer` = token, `Basic` = username and password). |
| `Jira__DefaultProjectKey` | none | Preselected project. |
| `Jira__TimeoutSeconds` | `15` | Deadline for each Jira call; there is no retry. |
| `Jira__SessionHours` | `8` | How long a connection lasts. |

Example `.env` lines for a company Server next to Cloud (the host names are examples):

```
Jira__Enabled=true
Jira__BaseUrl=https://jira.company.com
Jira__AllowedHosts__0=jira.company.com
Jira__AllowedHosts__1=*.atlassian.net
```

For `dotnet run`, put the same keys in `appsettings.Development.json` or user-secrets (`Jira:AllowedHosts:0` and so on). None of them is a secret: each user types their own credential in the panel.

### Jira Server: network, certificate and passwords

- **VPN.** A company Jira Server is usually reachable only on the company network. Without the VPN the panel shows "Could not reach Jira" (`jira_unavailable`).
- **Token or password.** Prefer **Token**: create a personal access token in your Jira profile, or ask your Jira administrator. **Username and password** sends your real company password to Jira on every call and keeps it, encrypted, in the app's cookie between calls. Use it only for a local demo on the company network.
- **Too many failed logins.** Jira Server then asks for a CAPTCHA. Log in to Jira once in the browser, then connect again.
- **Company CA certificate in Docker.** `dotnet run` on a company Windows machine trusts the company's certificate authority through the Windows certificate store. The Docker image does not know it, so a server signed by a company CA fails with "Could not reach Jira" in Docker only. If that happens, give the container one CA bundle that contains the public roots and the company CA (the container runs as a non-root user, so it cannot install certificates itself):
  1. Get the company root CA as a PEM file (`company-ca.pem`) from your IT department or by exporting it from the Windows certificate store as "Base-64 encoded X.509".
  2. Build the bundle from the image's own roots plus the company CA, in PowerShell:
     ```powershell
     docker compose run --rm --no-deps --entrypoint cat api /etc/ssl/certs/ca-certificates.crt | Out-File -Encoding ascii ca-bundle.pem; Get-Content company-ca.pem | Add-Content -Encoding ascii ca-bundle.pem
     ```
  3. Create `docker-compose.ca.yml` next to `docker-compose.yml` (do not commit it or the PEM files):
     ```yaml
     services:
       api:
         environment:
           SSL_CERT_FILE: /certs/ca-bundle.pem
         volumes:
           - ./ca-bundle.pem:/certs/ca-bundle.pem:ro
     ```
  4. Start with `docker compose -f docker-compose.yml -f docker-compose.ca.yml up --build`.

  `SSL_CERT_FILE` makes OpenSSL, which .NET uses on Linux, read that bundle instead of the image's default one. Whether the company server needs this step is recorded in `docs/tasks/J8-jira-server-frontend-live.md`.

### Limits

- Jira Server 7.x/8.x has no issue hierarchy: the parent is the **Epic Link** (Jira Software only). Without Jira Software the Parent control is hidden.
- Sub-tasks, attachments and fields of unsupported kinds cannot be filled. A required field of an unsupported kind blocks Create with a notice.
- The app never deletes issues. Issues created by the live tests must be deleted by hand.

## Quick start for development

In one terminal, run the API on http://localhost:5080 (Swagger UI at `/swagger`):

```
dotnet run --project src/VoiceToTicket.Api/VoiceToTicket.Api.csproj
```

In another, install the web dependencies once and run the web app on http://localhost:5173. It proxies `/api` and `/health` to the API.

```
cd web
npm ci
npm run dev
```

For voice input also run `docker compose up -d stt` (listens on http://localhost:8000). `web/.npmrc` makes npm use the public registry for this project, whatever your global npm configuration says. Stop the API before building or testing: a running API locks its files.

## Speech-to-text container

Speech-to-text runs in a [Speaches](https://speaches.ai) container (`stt` in `docker-compose.yml`) with the English model `Systran/faster-whisper-medium.en`. The first start downloads the model (about 1.4 GB) into the `stt-models` volume.

```
docker compose up -d stt
```

Check it with a synthetic recording:

```
curl.exe -s http://localhost:8000/v1/audio/transcriptions -F "file=@tests/fixtures/audio/bug-login-crash.wav" -F "model=Systran/faster-whisper-medium.en" -F "language=en"
```

Use `curl.exe` in Windows PowerShell, where plain `curl` is an alias for `Invoke-WebRequest` and rejects `-F`. In Git Bash, macOS or Linux, `curl` works too. The fixtures are made by `scripts/generate-audio-fixtures.ps1` (Windows); see `tests/fixtures/audio/README.md`.

NVIDIA GPU (untested, no NVIDIA machine was available): `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up`.

The "onnxruntime ... CUDAExecutionProvider" errors in the CPU container's log are harmless: it falls back to the CPU and requests succeed.

### Transcription endpoint

`POST /api/transcriptions` takes `multipart/form-data` with one field, `audio` (`audio/webm`, `audio/ogg`, `audio/wav` or `audio/mpeg`, up to 25 MB) and returns `{ "text": "...", "durationMs": 3600 }`. Silence returns an empty or punctuation-only `text`. The audio is forwarded to the STT container and not stored.

| Status | `code` | When |
|---|---|---|
| 400 | `validation` | `audio` missing or empty, or an unsupported type |
| 413 | `payload_too_large` | over 25 MB |
| 415 | `unsupported_media_type` | the body is not `multipart/form-data` |
| 422 | `audio_unreadable` | the STT server could not decode the file (corrupt, or not audio despite its extension) |
| 503 | `stt_unavailable` | the STT container is down, answers with an error, or sends an unusable reply |
| 504 | `stt_timeout` | no answer within `Stt:TimeoutSeconds` |

```
curl.exe -s http://localhost:5080/api/transcriptions -F "audio=@tests/fixtures/audio/bug-login-crash.wav;type=audio/wav"
```

### Recording in the browser

On the Report page, **Record** starts the microphone and **Stop** (or the 5-minute limit) uploads the audio for transcription. The text is appended to the transcript box, so a report can be dictated in parts; the box can always be edited by hand.

- The microphone needs a secure context: `http://localhost` (Vite on 5173, Docker on 5080) works. Another host name over plain HTTP does not.
- The first time, the browser asks for permission. If it was denied, allow it in the site settings and press Record again.
- If transcription fails, the recording is kept in the page: **Try again** re-sends it and **Download recording** saves it.

### Uploading a recording

**Upload recording** transcribes an audio file from disk the same way. Accepted: `.wav`, `.mp3`, `.webm`, `.ogg`, up to 25 MB and 5 minutes. The file extension decides the type; other formats (for example `.m4a` from a phone) must be converted first. The STT model is English-only. A file that is too long, too large or of another type is refused in the browser with a message; a file whose length the browser cannot read is sent anyway.

## Tests and checks

```
dotnet test
```

```
cd web
npm test
```

`node scripts/check.mjs --all` builds, tests and lints everything. The default tests need no Docker, network or API key. Browser end-to-end smoke test (fake generator, starts its own servers): `npm run e2e` in `web/`.

Tests that need more are skipped unless an environment variable is set, for example `VTT_RUN_STT=1` (STT container running), `VTT_RUN_LIVE=1` (one real Claude call) and `VTT_RUN_EVALUATION=1` (the evaluation in `tests/VoiceToTicket.Evaluation`, which calls Claude many times and **costs money**; settings `VTT_EVAL_MODELS`, `VTT_EVAL_SCENARIOS`, `VTT_EVAL_AUDIO`). Results are written to `eval/results/`; the scenarios in `eval/scenarios/` are frozen.

The Jira Cloud live tests (`JiraLiveTests`) **write two issues and one link to the real Jira**. They run only with `VTT_RUN_LIVE=1` and `VTT_JIRA_LIVE=1` and read `VTT_JIRA_EMAIL`, `VTT_JIRA_API_TOKEN`, `VTT_JIRA_PROJECT` (default `SCRUM`) and `VTT_JIRA_SITE_URL`. A required field the app cannot fill skips the case and names the field. They print the created keys, never the email or the token. Delete the issues in Jira afterwards:

```powershell
$env:VTT_RUN_LIVE="1"; $env:VTT_JIRA_LIVE="1"; $env:VTT_JIRA_SITE_URL="https://yourcompany.atlassian.net"; $env:VTT_JIRA_EMAIL="you@example.com"; $env:VTT_JIRA_PROJECT="SCRUM"; $env:VTT_JIRA_API_TOKEN = Read-Host "Token"
```

```powershell
dotnet test --filter "Category=Live&FullyQualifiedName~JiraLiveTests" --logger "console;verbosity=detailed"
```

The Jira Server live tests (`JiraServerLiveTests`) **write two issues and one link to the real Jira**. They run only with `VTT_RUN_LIVE=1` and `VTT_JIRA_SERVER_LIVE=1`, on the VPN, and read `VTT_JIRA_SERVER_URL`, `VTT_JIRA_PROJECT`, `VTT_JIRA_SECRET`, `VTT_JIRA_AUTH_SCHEME` (`Bearer` by default, or `Basic`) and `VTT_JIRA_LOGIN` (Basic only). They print the created keys, never the secret or the login:

```powershell
$env:VTT_RUN_LIVE="1"; $env:VTT_JIRA_SERVER_LIVE="1"; $env:VTT_JIRA_SERVER_URL="https://jira.company.com"; $env:VTT_JIRA_PROJECT="KEY"; $env:VTT_JIRA_SECRET = Read-Host "Token"
```

```powershell
dotnet test --filter "Category=Live&FullyQualifiedName~JiraServer" --logger "console;verbosity=detailed"
```
