# ELEKS UI

ELEKS UI is a React component library built on top of Material-UI (MUI) that provides
a comprehensive set of customizable components and icons for building modern web applications.
It offers a consistent design system, theming capabilities, and a wide range of components to
help developers create visually appealing and user-friendly interfaces.

## ELEKS UI CLI commands list:

| Command                  | Description                                   |
| ------------------------ | --------------------------------------------- |
| init-components          | Initialize ELEKS UI components in the project |
| download-theme [options] | Download ELEKS UI theme from Figma            |
| start-mcp [options]      | Start MCP server (stdio)                      |
| doctor                   | Check environment and ELEKS UI CLI setup      |
| mcp-setup-info           | Show MCP setup info                           |
| help [command]           | display help for command                      |

## ELEKS UI CLI installetion

> [NOTE]: You need to init project by [vite](https://vite.dev/guide/)  
> You will free to use any other build system, but guide explains how to make configuration for vite.

1. Install ["Node.js"](https://nodejs.org) with npm (please use version 22 or higher)
2. Install ELEKS UI globally via npm command:

```bash
npm install -g eleks-ui-0.0.0.tgz
```

**WARNING:** Replace `0.0.0` with the actual version of the package

3. Verify installation by running:

```bash
eleks-ui --version
```

Command returns version of installed ELEKS UI CLI, for example: `1.0.2`
and revision of MCP docs, for example: `05c26c`

### Step #1 Init ELEKS UI components in your project

Add ELEKS UI cmponents and theme to your project via command:

```bash
eleks-ui init-components
```

After succeedful command execution, your project structure may look like this:

```bash
src/
├── components/
│   └── eleks-ui/
│       ├── components/
│       │   ├── core/
│       │   ├── x-components/
│       │   └── custom/
│       └── theme/
│
```

### Step #2: Update "tsconfig.json" file

Add alias for "eleks-ui" components imports to "tsconsfig.json" in the the "paths" section:

```js
// tsconfig.json

"compilerOptions": {
  "baseUrl": ".",
  "verbatimModuleSyntax": false,
  "paths": {
    "@eleks-ui/components": [
      "./src/components/eleks-ui/components"
    ],
    "@eleks-ui/theme": [
      "./src/components/eleks-ui/theme"
    ]
  }
}
```

- IMPORTANT: Check that `verbatimModuleSyntax` has `false` value

### Step #3: Update build system config

Update alias in "vite.config.ts" file, or add alias to the config inside other
build system config file:

```js
// vite.config.ts

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@eleks-ui/components": path.resolve(
        dirname,
        "./src/components/eleks-ui/components",
      ),
      "@eleks-ui/theme": path.resolve(
        dirname,
        "./src/components/eleks-ui/theme",
      ),
    },
  },
});
```

### Step #4: Reload build system and test components usage:

```tsx
import { Avatar, Button } from "@eleks-ui/components";
import { ArrowDownward, AccessAlarmOutlined } from "@mui/icons-material";

function App() {
  return (
    <>
      <Avatar>AV</Avatar>
      <Button>Click me baybe!</Button>

      <ArrowDownward />
      <AccessAlarmOutlined />
    </>
  );
}

export default App;
```

### Step #5: Add ELEKS UI theme to your project

1. Add `EleksUIThemeProvider` to the root of your application:

```tsx
// main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EleksUIThemeProvider } from "@eleks-ui/theme";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EleksUIThemeProvider>
      <App />
    </EleksUIThemeProvider>
  </StrictMode>,
);
```

2. Add `ThemeSwitcher` component to toggle between light and dark themes:

```tsx
// ThemeSwitcher.tsx
import { useEleksUITheme } from "@eleks-ui/theme";

const ThemeSwitcher = () => {
  const { mode, toggleTheme } = useEleksUITheme();

  return (
    <button onClick={toggleTheme}>
      Switch to {mode === "dark" ? "light" : "dark"}
    </button>
  );
};
```

### Step #6 [OPTIONAL]: Download ELEKS UI theme

To download ELEKS UI theme to your project, run next command:

```bash
eleks-ui download-theme --figma-access-token=<your_figma_access_token> --figma-file-key=<your_figma_file_key>
```

After command execution, you will have a fresh copy of ELEKS UI theme
"eleks-theme.ts" file in the root of your project.
You need to move it to the theme folder in your project, for example: `src/components/eleks-ui/theme/`
