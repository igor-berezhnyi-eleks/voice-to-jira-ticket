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
- There is no Jira connection and no login. Copy the ticket or save it as JSON. Run the app on your own machine only.
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
