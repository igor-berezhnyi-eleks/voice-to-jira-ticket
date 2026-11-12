# Build context: the repository root (the image needs both web/ and src/).

FROM node:24.21.0-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json web/.npmrc ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0.403 AS api
WORKDIR /src
COPY global.json Directory.Build.props ./
COPY src/VoiceToTicket.Api/VoiceToTicket.Api.csproj src/VoiceToTicket.Api/
RUN dotnet restore src/VoiceToTicket.Api/VoiceToTicket.Api.csproj
COPY src/VoiceToTicket.Api/ src/VoiceToTicket.Api/
RUN dotnet publish src/VoiceToTicket.Api/VoiceToTicket.Api.csproj -c Release -o /app --no-restore -p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0.14 AS runtime
WORKDIR /app
COPY --from=api /app ./
COPY --from=web /src/web/dist ./wwwroot
# Data Protection keys (Jira session cookie). A new named volume copies this directory's owner, so the
# non-root user can write to it.
RUN mkdir /keys && chown $APP_UID /keys
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "VoiceToTicket.Api.dll"]
