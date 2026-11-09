# Voice to Ticket

A proof of concept: a browser tool that turns a spoken bug report or feature request into a structured ticket for a developer to review and copy into Jira.

The scope, decisions and task list are in the [implementation plan](docs/implementation-plan.md). Current progress is in [docs/status.md](docs/status.md).

## Prerequisites

- Docker Desktop, running (on Windows it uses WSL2), for the Docker quick start.
- For development: the .NET SDK from `global.json` and Node.js 24.

## Quick start with Docker

```
docker compose up --build
```

The app is at http://localhost:5080. Without a `.env` file it uses the fake generator, which needs no API key. Tickets from the fake are not real, and the app shows a banner saying so once it has generated one.

Stop it with `docker compose down`.

## Speech-to-text container

Speech-to-text runs in a [Speaches](https://speaches.ai) container (`stt` in `docker-compose.yml`, image pinned to `0.9.0-rc.3-cpu`, a release candidate) with the English model `Systran/faster-whisper-medium.en`. The API calls it through `POST /api/transcriptions` (below).

```
docker compose up -d stt
```

The first start downloads the model (about 1.4 GB) into the `stt-models` volume, which took about 2.5 minutes on the reference laptop; later starts take seconds. It is ready when `docker compose ps` shows `healthy`. It listens on http://localhost:8000.

Check it with a synthetic recording:

```
curl.exe -s http://localhost:8000/v1/audio/transcriptions -F "file=@tests/fixtures/audio/bug-login-crash.wav" -F "model=Systran/faster-whisper-medium.en" -F "language=en"
```

Use `curl.exe` in Windows PowerShell, where plain `curl` is an alias for `Invoke-WebRequest` and rejects `-F`. In Git Bash, macOS or Linux, `curl` works too.

The fixtures are made by `scripts/generate-audio-fixtures.ps1` (Windows); see `tests/fixtures/audio/README.md`.

NVIDIA GPU (untested, no NVIDIA machine was available): `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up`.

### Transcription endpoint

`POST /api/transcriptions` takes `multipart/form-data` with one field, `audio` (`audio/webm`, `audio/ogg`, `audio/wav` or `audio/mpeg`, up to 25 MB) and returns `{ "text": "...", "durationMs": 3600 }`. Silence returns an empty `text`. The audio is forwarded to the STT container and not stored.

| Status | `code` | When |
|---|---|---|
| 400 | `validation` | `audio` missing or empty, or an unsupported type |
| 413 | `payload_too_large` | over 25 MB |
| 415 | `unsupported_media_type` | the body is not `multipart/form-data` |
| 503 | `stt_unavailable` | the STT container is down, answers with an error, or sends an unusable reply |
| 504 | `stt_timeout` | no answer within `Stt:TimeoutSeconds` |

Try it (the API on http://localhost:5080 and the `stt` container running):

```
curl.exe -s http://localhost:5080/api/transcriptions -F "audio=@tests/fixtures/audio/bug-login-crash.wav;type=audio/wav"
```

Settings (section `Stt`; environment variables use `__`, for example `Stt__TimeoutSeconds`): `BaseUrl` (`http://stt:8000` in Docker, `http://localhost:8000` in Development), `Model` (`Systran/faster-whisper-medium.en`), `Language` (`en`), `TimeoutSeconds` (`120`). There is no retry.

Smoke test against the running container (skipped otherwise):

```
$env:VTT_RUN_STT = "1"; dotnet test --filter "Category=Stt"
```

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

`web/.npmrc` makes npm use the public registry for this project, whatever your global npm configuration says.

## Configuration

Docker reads these from `.env` (git-ignored; copy `.env.example`). For local development, use `appsettings.Development.json`, and `dotnet user-secrets` for secrets.

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `TicketGenerator__Provider` | `Fake` (`Claude` from task T3.2) | `Fake` (from `appsettings.json`) | Which ticket generator runs. An unknown value stops the app at startup. |
| `Claude__ApiKey` | your Anthropic API key | none | Needed only with `Claude`. Not used until the Claude generator exists (task T3.2). Never commit it. |

## Tests and checks

```
dotnet test
```

```
cd web
npm test
```

`node scripts/check.mjs --all` builds, tests and lints everything. The default tests need no Docker, network or API key.
