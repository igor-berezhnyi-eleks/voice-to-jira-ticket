# Project: Voice-to-Jira-Ticket

## Overview
Browser-based tool that converts spoken bug reports and feature requests into structured, board-ready ticket content. The PoC is designed to validate the quality and practicality of the voice-to-ticket flow, not to deliver a production-ready application.
 
## Objective
Prove that a developer can describe a bug or feature request by voice and receive a sufficiently accurate, structured ticket that can be reviewed and pasted into Jira or another tracking system with materially less manual writing.

## Scope
**Committed scope**
- Browser-based audio recording. 
- Speech-to-text conversion. 
- Visible transcript for quality inspection. 
- LLM-based Bug versus Feature classification. 
- Structured Bug and Feature ticket generation. 
- Explicit identification of missing information. 
- Protection against intentional invention of absent details through prompt rules and review. 
- Board-ready preview and copy-to-clipboard output. 
- End-to-end execution for representative Bug and Feature scenarios. 
- Evaluation against a predefined dataset and a Go / Conditional Go / No-Go recommendation. 
**Stretch scope**
- Edit generated ticket fields before copying. 
- Regenerate from the same transcript. 
- Edit transcript before generation. 
- Direct Jira or other tracker integration.
**Explicitly out of scope**
- Production authentication or SSO. 
- Persistent user history or database. 
- Production-grade observability, scalability, security hardening, or support model. 
- Offline transcription. 
- Attachments, screenshots, duplicate detection, analytics, or configurable enterprise templates. 
- Polished design-system implementation. 
- Mobile application or desktop packaging.

## Output Contract
**Bug ticket**
- Type 
- Title 
- Description 
- Steps to reproduce 
- Actual result 
- Expected result 
- Environment / platform 
- Missing information
**Feature ticket**
- Type 
- Title 
- Description 
- User or business need 
- Proposed behavior 
- Acceptance criteria 
- Missing information

## User/Application Workflow
Page with voice report input and transcription result within one text field that can be edited -> one call to Anthropic Claude API that should parse the input text, detect if it's a bug or feature and make a	structured output -> page with structure appropriate fields filled with LLM output result data, user can edit each field, two buttons with this form: "Save as Json" and "Connect to Jira board", the second one will require user authentication to our company's Jira server and on the next page -> provide form where issue can be linked to the Jira board and/or exact Jira parent issue.

## Tech Stack
- **Frontend**: React + TypeScript
- **Backend Runtime & Language:** .NET 10, C# 14
- **API Framework:** ASP.NET Core Web API (using OpenAPI and Swagger)
- **Testing:** xUnit, FluentAssertions, and Moq
- **Running:** solution should be packed in containers and run in Docker

## Core Architecture & Patterns
- **Architecture:** Domain, Application, Infrastructure, API layers. Vertical Slice Architecture (VSA). Everything organized by feature folders. CQRS with MediatR for command/query separation.
- **Time Handling:** Always use and inject `TimeProvider` instead of relying on `DateTime.Now`.

## C# Coding Standards & Guidelines
- **Syntax:** Always use **Primary Constructors** for Dependency Injection.
- **Namespaces:** Always use **File-scoped namespaces**.
- **Async Code:** Pass a `CancellationToken` to every single asynchronous operation and database call.
- **Validation:** Use `FluentValidation` integrated into the endpoint pipeline.
- **Responses:** Always wrap feature endpoint returns in explicit `IResult` and `TypedResults`.

## Build & Test Commands
Always use these explicit CLI workflows. Do not invent custom build scripts unless told otherwise.
- **Build Solution:** `dotnet build`
- **Run API Project:** `dotnet run --project src/VoiceToJira.Api/VoiceToJira.Api.csproj`
- **Execute All Tests:** `dotnet test`
- **Run Specific Test Block:** `dotnet test --filter "FullyQualifiedName~MyFeatureTests"`

## Conventions
- File-scoped namespaces
- Primary constructors for services with injected dependencies
- ILogger<T> for all logging
- IOptions<T> for all configuration sections
- TimeProvider (injected) for all date/time operations (not DateTime.Now)
- Nullable reference types enabled project-wide
- Implicit usings enabled
- No regions (#region)
- IExceptionHandler for cross-cutting error handling

## Libraries
- EF Core 10 (fluent API only, no data annotations)
- MediatR for CQRS
- FluentValidation for input validation
- Mapster for object mapping
- Polly for resilience policies
- xUnit, Moq, FluentAssertions for testing

## Rules
- All API endpoints return ActionResult<T>
- All async methods accept CancellationToken
- Repository methods return domain entities, never DTOs
- Mapping to DTOs happens in MediatR handlers

## Do not
- Use DateTime.Now or DateTime.UtcNow (use TimeProvider)
- Use static HttpClient (use IHttpClientFactory)
- Use ConfigurationManager (use IConfiguration)
- Use Thread.Sleep (use await Task.Delay)
- Add #region blocks

# Scope Guard

Complete the task with the smallest sufficient change.
Explicit user instructions for this task override the defaults below.

## Before editing

- Read relevant code, call paths, and project conventions. Do not explore
  the entire repository before a small change.
- Make clear, small fixes directly. Write a short plan when the approach
  is unclear or the impact is substantial.
- Decide routine details yourself. Ask when different interpretations
  would lead to materially different work.
- Load only relevant Skills, not an entire workflow for a matching keyword.

## While editing

- Before adding code, check in this order:
  1. Existing code and patterns in the project
  2. Standard library and built-in platform capabilities
  3. Dependencies already installed
  4. Only then, new code required for the current task
- Fix the root cause. Do not add abstractions, configuration, or
  compatibility layers for hypothetical future needs.
- Justify new dependencies or frameworks: why are existing options not enough?
- Fix nearby issues only if they block the task. Otherwise, flag them
  for follow-up.
- Prefer precise edits for small changes. Avoid unrelated refactoring
  or whole-file rewrites.
- Remove replaced implementations. Keep old paths only when compatibility
  is explicitly required.
- Preserve necessary validation, error handling, security, and accessibility.

## When to ask

- Keep implementing, verifying, and fixing within the authorized scope.
  Do not repeatedly ask whether to continue.
- Confirm material scope expansion, unapproved costs or permissions,
  and unauthorized irreversible actions before proceeding.
- If asked only to analyze or review, report findings. Do not edit code.

## Testing

- Verify the change and its impact. Complete required project checks.
- Reuse existing tests first. Add tests for real behavior and regression
  risks, not tests that mechanically repeat the implementation.
- Temporary verification scripts need not become permanent test files.
- Once checks pass, broaden or repeat them only for new changes,
  failures, or specific unresolved concerns.

## If the plan grows

If you find future-only layers, unrelated refactoring, extra features,
or unjustified repeat checks, return to the current requirement.
Drop the excess work and finish within the existing authorization.

## Done means

- The requested behavior works and necessary verification is complete.
  Do not stop at a plan or an initial implementation.
- Every change serves the task. Remove obsolete code and temporary files
  introduced by this work.
- Briefly report the result, verification evidence, and anything
  unresolved or unverified.
  