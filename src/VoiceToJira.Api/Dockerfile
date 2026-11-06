# Build context is the repository root (see docker-compose.yml).

FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
# Install scripts only fetch onnxruntime-node binaries, which the browser build never uses.
RUN npm ci --ignore-scripts
COPY web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/VoiceToJira.Api/VoiceToJira.Api.csproj src/VoiceToJira.Api/
RUN dotnet restore src/VoiceToJira.Api/VoiceToJira.Api.csproj
COPY src/VoiceToJira.Api/ src/VoiceToJira.Api/
RUN dotnet publish src/VoiceToJira.Api/VoiceToJira.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./
COPY --from=web /web/dist ./wwwroot
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "VoiceToJira.Api.dll"]
