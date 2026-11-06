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
