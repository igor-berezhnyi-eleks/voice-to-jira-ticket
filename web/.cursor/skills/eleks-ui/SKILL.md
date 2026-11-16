---
name: eleks-ui-design-system
description: Default design system for this project. Use whenever creating, editing, or refactoring any React component, page, form, layout, or view — even if the user does not explicitly mention ELEKS UI. All UI code in this project must follow ELEKS UI conventions.
---

# ELEKS UI — Default Design System

This project uses **ELEKS UI** as its design system. Every React component must be built on top of it. These rules apply by default whenever you write or modify UI code — you do not need to be asked to use ELEKS UI.

## Import Rules (CRITICAL)

```ts
import { Button, TextField, Alert } from "@eleks-ui/components";
import { EleksUIThemeProvider, useEleksUITheme } from "@eleks-ui/theme";
import AcUnitIcon from "@mui/icons-material/AcUnit";
```

- UI components → `@eleks-ui/components`
- Theme utilities (provider, hook, tokens) → `@eleks-ui/theme`
- Icons → `@mui/icons-material`

**NEVER** import from `@mui/material`, `@material-ui/core`, relative paths to ELEKS UI internals, or other third-party UI libraries (antd, react-bootstrap, chakra, etc.) for components available in ELEKS UI.

## Component Discovery

Before writing any UI, check what ELEKS UI already provides. Always prefer an existing ELEKS UI component over building a custom one from scratch.

If the **eleks-ui MCP server** is configured, use it as the primary discovery and documentation source — it has its own detailed instructions for tool usage, Figma workflows, and component lookup. Follow those MCP instructions for discovery and docs, then return here for local override and styling rules.

If the MCP is **not** available, browse the local component files at `src/components/eleks-ui/components`:

| Category | Path | Examples |
|---|---|---|
| Core | `core/` | Button, TextField, Alert, Dialog, Select, Table, Tabs, Accordion, Autocomplete |
| Custom | `custom/` | EmptyState, FileUpload, Heading, TransferList |
| X-Components | `x-components/` | DataGrid, Charts, DateTime pickers, TreeView |

Each component directory contains an `index.tsx` with TypeScript interfaces and props. The barrel export at `src/components/eleks-ui/components/index.tsx` lists everything available.

## Local Customizations

Users may modify standard ELEKS UI components or create entirely new ones. The local source files always have the final say:

- **Modified component** — if a component's `index.tsx` under `src/components/eleks-ui/components` differs from the MCP docs (extended props, changed behavior), treat the local file as the source of truth for that component.
- **User-created component** — components that don't exist in the standard ELEKS UI set won't appear in MCP results. Discover them by reading `src/components/eleks-ui/components` directly.
- **When both sources exist** — use MCP docs for canonical usage patterns, then check the local `index.tsx` to see if the component was customized. Local overrides MCP where they conflict.

## Styling

- Use the `sx` prop for component-level styles.
- Use design-system tokens from `@eleks-ui/theme` for colors, typography, and spacing.
- Follow the styling patterns already adopted in the codebase.

## Workflow

1. **Discover** — if the MCP is available, follow its instructions to find and get docs for components. Otherwise browse `src/components/eleks-ui/components` and read `index.tsx` files directly.
2. **Check for local overrides** — read the component's `index.tsx` under `src/components/eleks-ui/components` to see if it was customized or if the component is user-created. Local files override MCP docs where they conflict.
3. **Implement** — write code using `@eleks-ui/components` and `@eleks-ui/theme` imports.
4. **Missing component** — if a component doesn't exist in MCP results or local files, inform the user before reaching for alternatives.
