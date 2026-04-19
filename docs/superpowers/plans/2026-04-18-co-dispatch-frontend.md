# Co-Dispatch Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-fidelity Next.js frontend for Co-Dispatch that reproduces the Figma app shell and the four workflow screens with connected mock interactions.

**Architecture:** Create a Next.js App Router app with a persistent shell, route-level workflow screens, shared mock state, and reusable UI primitives. Build the shell and tokens first, then the mocked data layer, then each workflow screen, then polish the transitions and interactions.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Vitest, React Testing Library, Playwright

---

## File Structure

### App and Config
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/package.json`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tsconfig.json`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/next.config.mjs`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/postcss.config.js`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tailwind.config.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/vitest.config.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/vitest.setup.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/playwright.config.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/.gitignore`

### App Routes
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/layout.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/globals.css`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/page.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/morning-triage/page.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/load-assignment/page.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/backhaul-pairing/page.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/proactive-monitoring/page.tsx`

### Shell and Shared Components
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/app-shell/app-shell.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/app-shell/sidebar.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/app-shell/top-bar.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/page-header.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/panel-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/metric-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/status-pill.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/action-bar.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/map-card.tsx`

### Workflow Screens
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/morning-triage-screen.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/load-assignment-screen.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/backhaul-pairing-screen.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/proactive-monitoring-screen.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/driver-rank-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/score-breakdown-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/trip-comparison-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/intervention-package-card.tsx`

### Mock Data and State
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/navigation/workflows.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/dispatcher.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/loads.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/drivers.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/monitoring.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/backhaul.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/store.tsx`

### Tests
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/app-shell.test.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/mock-store.test.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/load-assignment-screen.test.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/backhaul-pairing-screen.test.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/proactive-monitoring-screen.test.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/smoke/navigation.spec.ts`

---

### Task 1: Scaffold The App And Test Harness

**Files:**
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/package.json`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tsconfig.json`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/next.config.mjs`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/postcss.config.js`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tailwind.config.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/vitest.config.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/vitest.setup.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/playwright.config.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/.gitignore`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/layout.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/page.tsx`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/app-shell.test.tsx`

- [ ] **Step 1: Write the failing shell smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the Co-Dispatch shell entry point", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /co-dispatch/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /morning triage/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dispatch new load/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/unit/app-shell.test.tsx
```

Expected:
- `FAIL`
- Error indicating `@/app/page` or test environment is not configured yet

- [ ] **Step 3: Add the base project files and minimal app entry**

```json
{
  "name": "co-dispatch-frontend",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "playwright test"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.15.3",
    "@types/react": "^18.3.20",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^26.1.0",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "vitest": "^3.1.2"
  }
}
```

```tsx
// src/app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx
export default function HomePage() {
  return (
    <main>
      <h1>Co-Dispatch</h1>
      <nav>
        <a href="/morning-triage">Morning Triage</a>
      </nav>
      <button type="button">Dispatch New Load</button>
    </main>
  );
}
```

- [ ] **Step 4: Add minimal config for aliases and tests**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm install
npm test -- tests/unit/app-shell.test.tsx
```

Expected:
- `PASS`
- `1 passed`

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json next.config.mjs postcss.config.js tailwind.config.ts vitest.config.ts vitest.setup.ts playwright.config.ts .gitignore src/app/layout.tsx src/app/page.tsx tests/unit/app-shell.test.tsx
git commit -m "feat: scaffold co-dispatch frontend app"
```

---

### Task 2: Build Design Tokens And The Persistent App Shell

**Files:**
- Modify: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/globals.css`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/app-shell/app-shell.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/app-shell/sidebar.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/app-shell/top-bar.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/navigation/workflows.ts`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/app-shell.test.tsx`

- [ ] **Step 1: Expand the failing shell test to assert persistent navigation**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";

describe("AppShell", () => {
  it("renders the persistent sidebar and top bar actions", () => {
    render(
      <AppShell currentWorkflow="load-assignment">
        <div>Screen Body</div>
      </AppShell>,
    );

    expect(screen.getByText(/fleet operations/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /morning triage/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /backhaul pairing/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search loads, drivers/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go live/i })).toBeInTheDocument();
    expect(screen.getByText("Screen Body")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/unit/app-shell.test.tsx
```

Expected:
- `FAIL`
- Error showing `AppShell` module missing

- [ ] **Step 3: Add the workflow config and shell components**

```ts
// src/lib/navigation/workflows.ts
export const workflows = [
  { id: "morning-triage", label: "Morning Triage", href: "/morning-triage" },
  { id: "load-assignment", label: "Load Assignment", href: "/load-assignment" },
  { id: "backhaul-pairing", label: "Backhaul Pairing", href: "/backhaul-pairing" },
  { id: "proactive-monitoring", label: "Proactive Monitoring", href: "/proactive-monitoring" },
] as const;

export type WorkflowId = (typeof workflows)[number]["id"];
```

```tsx
// src/components/app-shell/app-shell.tsx
import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import type { WorkflowId } from "@/lib/navigation/workflows";

export function AppShell({
  currentWorkflow,
  children,
}: {
  currentWorkflow: WorkflowId;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-shell text-slate-900">
      <div className="grid min-h-screen grid-cols-[256px_1fr]">
        <Sidebar currentWorkflow={currentWorkflow} />
        <div className="flex min-h-screen flex-col">
          <TopBar />
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// src/components/app-shell/top-bar.tsx
export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/90 px-6 backdrop-blur">
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-bold text-brand-600">Fleet Command</h2>
        <nav className="flex items-center gap-6 text-sm text-slate-600">
          <a href="/morning-triage">Fleet</a>
          <a href="/load-assignment" className="border-b-2 border-brand-500 pb-1 text-brand-600">Drivers</a>
          <a href="/backhaul-pairing">Rates</a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <input
          aria-label="Search"
          placeholder="Search loads, drivers..."
          className="h-10 w-80 rounded-xl border border-slate-200 px-4 text-sm"
        />
        <button type="button" className="rounded-lg bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700">Go Live</button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Add the base shell tokens**

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --shell-bg: 248 249 255;
  --brand-50: 239 244 255;
  --brand-100: 211 228 255;
  --brand-500: 22 136 202;
  --brand-600: 0 97 147;
}

@layer base {
  body {
    @apply m-0 bg-[rgb(var(--shell-bg))] font-sans text-slate-900;
  }
}

@layer utilities {
  .bg-shell {
    background: linear-gradient(90deg, rgb(248 249 255) 0%, rgb(248 249 255) 100%);
  }
}
```

- [ ] **Step 5: Run the shell test to verify it passes**

Run:

```bash
npm test -- tests/unit/app-shell.test.tsx
```

Expected:
- `PASS`
- Assertions for sidebar, search, and go-live button all succeed

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/app-shell/app-shell.tsx src/components/app-shell/sidebar.tsx src/components/app-shell/top-bar.tsx src/lib/navigation/workflows.ts tests/unit/app-shell.test.tsx
git commit -m "feat: add co-dispatch app shell"
```

---

### Task 3: Add Shared Mock Store And Cross-Screen State

**Files:**
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/dispatcher.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/loads.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/drivers.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/backhaul.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/monitoring.ts`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/lib/mock-data/store.tsx`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/mock-store.test.tsx`

- [ ] **Step 1: Write the failing shared-state test**

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MockDataProvider, useMockData } from "@/lib/mock-data/store";

describe("mock store", () => {
  it("updates assignment and selected backhaul across screens", () => {
    const { result } = renderHook(() => useMockData(), {
      wrapper: MockDataProvider,
    });

    act(() => {
      result.current.assignDriver("driver-marcus");
      result.current.selectBackhaul("backhaul-stl");
    });

    expect(result.current.assignedDriverId).toBe("driver-marcus");
    expect(result.current.selectedBackhaulId).toBe("backhaul-stl");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/unit/mock-store.test.tsx
```

Expected:
- `FAIL`
- Missing provider/store module

- [ ] **Step 3: Create the fixture modules and provider**

```ts
// src/lib/mock-data/drivers.ts
export const drivers = [
  { id: "driver-marcus", name: "Marcus Johnson", unit: "#302", equipment: "Reefer", availability: "Available Now", score: 98 },
  { id: "driver-sarah", name: "Sarah Jenkins", unit: "#118", equipment: "Reefer", availability: "In Transit", score: 84 },
];
```

```tsx
// src/lib/mock-data/store.tsx
"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type StoreValue = {
  assignedDriverId: string | null;
  selectedBackhaulId: string | null;
  assignDriver: (driverId: string) => void;
  selectBackhaul: (backhaulId: string) => void;
};

const MockDataContext = createContext<StoreValue | null>(null);

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [assignedDriverId, setAssignedDriverId] = useState<string | null>("driver-marcus");
  const [selectedBackhaulId, setSelectedBackhaulId] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      assignedDriverId,
      selectedBackhaulId,
      assignDriver: setAssignedDriverId,
      selectBackhaul: setSelectedBackhaulId,
    }),
    [assignedDriverId, selectedBackhaulId],
  );

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>;
}

export function useMockData() {
  const value = useContext(MockDataContext);
  if (!value) throw new Error("useMockData must be used within MockDataProvider");
  return value;
}
```

- [ ] **Step 4: Wrap the root layout in the provider**

```tsx
// src/app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import { MockDataProvider } from "@/lib/mock-data/store";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MockDataProvider>{children}</MockDataProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm test -- tests/unit/mock-store.test.tsx
```

Expected:
- `PASS`
- Store state updates are preserved

- [ ] **Step 6: Commit**

```bash
git add src/lib/mock-data/dispatcher.ts src/lib/mock-data/loads.ts src/lib/mock-data/drivers.ts src/lib/mock-data/backhaul.ts src/lib/mock-data/monitoring.ts src/lib/mock-data/store.tsx src/app/layout.tsx tests/unit/mock-store.test.tsx
git commit -m "feat: add shared mock state for frontend flows"
```

---

### Task 4: Build The Morning Triage Screen

**Files:**
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/page-header.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/panel-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/metric-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/map-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/morning-triage-screen.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/morning-triage/page.tsx`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/app-shell.test.tsx`

- [ ] **Step 1: Write the failing morning triage route test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MorningTriagePage from "@/app/morning-triage/page";

describe("MorningTriagePage", () => {
  it("renders the morning metrics and fleet roster", () => {
    render(<MorningTriagePage />);

    expect(screen.getByRole("heading", { name: /morning triage/i })).toBeInTheDocument();
    expect(screen.getByText(/daily synthesis/i)).toBeInTheDocument();
    expect(screen.getByText(/fleet readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/driver roster/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/unit/app-shell.test.tsx
```

Expected:
- `FAIL`
- Missing route or screen component

- [ ] **Step 3: Implement the route and screen composition**

```tsx
// src/app/morning-triage/page.tsx
import { AppShell } from "@/components/app-shell/app-shell";
import { MorningTriageScreen } from "@/components/screens/morning-triage-screen";

export default function MorningTriagePage() {
  return (
    <AppShell currentWorkflow="morning-triage">
      <MorningTriageScreen />
    </AppShell>
  );
}
```

```tsx
// src/components/screens/morning-triage-screen.tsx
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard } from "@/components/ui/panel-card";

export function MorningTriageScreen() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="7:00 AM snapshot"
        title="Morning Triage"
        description="Daily synthesis. Immediate view of fleet readiness and operational bottlenecks."
      />
      <div className="grid grid-cols-3 gap-6">
        <MetricCard label="Drivers Ready" value="14" delta="+2 vs yesterday" />
        <MetricCard label="Resting Soon" value="3" delta="Within 2 hours" />
        <MetricCard label="Flags" value="2" delta="Action required" />
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <PanelCard title="Fleet Readiness Map">Live fleet status map with active corridor markers.</PanelCard>
        <PanelCard title="Driver Roster">Roster with readiness, equipment, and availability summaries.</PanelCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/unit/app-shell.test.tsx
```

Expected:
- `PASS`
- Morning Triage route content present

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/page-header.tsx src/components/ui/panel-card.tsx src/components/ui/metric-card.tsx src/components/ui/map-card.tsx src/components/screens/morning-triage-screen.tsx src/app/morning-triage/page.tsx tests/unit/app-shell.test.tsx
git commit -m "feat: add morning triage workflow screen"
```

---

### Task 5: Build The Load Assignment Screen

**Files:**
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/load-assignment-screen.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/driver-rank-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/score-breakdown-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/status-pill.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/ui/action-bar.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/load-assignment/page.tsx`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/load-assignment-screen.test.tsx`

- [ ] **Step 1: Write the failing load assignment test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import LoadAssignmentPage from "@/app/load-assignment/page";

describe("LoadAssignmentPage", () => {
  it("renders ranked drivers and updates the assign action", async () => {
    const user = userEvent.setup();
    render(<LoadAssignmentPage />);

    expect(screen.getByRole("heading", { name: /top recommended drivers/i })).toBeInTheDocument();
    expect(screen.getByText(/marcus johnson/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /assign to marcus j/i }));

    expect(screen.getByText(/assigned/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/unit/load-assignment-screen.test.tsx
```

Expected:
- `FAIL`
- Page or action text missing

- [ ] **Step 3: Implement the screen with driver cards and assignment action**

```tsx
// src/app/load-assignment/page.tsx
import { AppShell } from "@/components/app-shell/app-shell";
import { LoadAssignmentScreen } from "@/components/screens/load-assignment-screen";

export default function LoadAssignmentPage() {
  return (
    <AppShell currentWorkflow="load-assignment">
      <LoadAssignmentScreen />
    </AppShell>
  );
}
```

```tsx
// src/components/screens/load-assignment-screen.tsx
"use client";

import { useState } from "react";
import { useMockData } from "@/lib/mock-data/store";

export function LoadAssignmentScreen() {
  const { assignDriver } = useMockData();
  const [assigned, setAssigned] = useState(false);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-slate-500">Pending Assignment</p>
        <h1 className="text-5xl font-bold tracking-tight text-slate-950">Chicago, IL → Dallas, TX</h1>
        <p className="text-xl text-slate-600">Pickup: Today, 14:00 CST • Refrigerated • 42,000 lbs</p>
      </section>
      <section className="grid grid-cols-[2fr_320px] gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-3xl font-bold">Top Recommended Drivers</h2>
          <button type="button" onClick={() => { assignDriver("driver-marcus"); setAssigned(true); }}>
            Assign to Marcus J.
          </button>
          <div>Marcus Johnson</div>
        </div>
        <aside className="rounded-xl border border-brand-200 bg-brand-50 p-6">
          <h3 className="text-2xl font-bold">AI Score Math</h3>
          <p>Total Score 98</p>
        </aside>
      </section>
      {assigned ? <div>Assigned</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/unit/load-assignment-screen.test.tsx
```

Expected:
- `PASS`
- User click reveals assigned state

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/load-assignment-screen.tsx src/components/screens/driver-rank-card.tsx src/components/screens/score-breakdown-card.tsx src/components/ui/status-pill.tsx src/components/ui/action-bar.tsx src/app/load-assignment/page.tsx tests/unit/load-assignment-screen.test.tsx
git commit -m "feat: add load assignment workflow screen"
```

---

### Task 6: Build The Backhaul Pairing Screen

**Files:**
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/backhaul-pairing-screen.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/trip-comparison-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/backhaul-pairing/page.tsx`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/backhaul-pairing-screen.test.tsx`

- [ ] **Step 1: Write the failing backhaul screen test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import BackhaulPairingPage from "@/app/backhaul-pairing/page";

describe("BackhaulPairingPage", () => {
  it("shows standard versus optimized economics and lets the user pick a backhaul", async () => {
    const user = userEvent.setup();
    render(<BackhaulPairingPage />);

    expect(screen.getByRole("heading", { name: /ai backhaul optimizer/i })).toBeInTheDocument();
    expect(screen.getByText(/\$2,100/)).toBeInTheDocument();
    expect(screen.getByText(/\$4,800/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /activate marketplace/i }));

    expect(screen.getByText(/marketplace activated/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/unit/backhaul-pairing-screen.test.tsx
```

Expected:
- `FAIL`
- Route or values not found

- [ ] **Step 3: Implement the backhaul screen**

```tsx
// src/app/backhaul-pairing/page.tsx
import { AppShell } from "@/components/app-shell/app-shell";
import { BackhaulPairingScreen } from "@/components/screens/backhaul-pairing-screen";

export default function BackhaulPairingPage() {
  return (
    <AppShell currentWorkflow="backhaul-pairing">
      <BackhaulPairingScreen />
    </AppShell>
  );
}
```

```tsx
// src/components/screens/backhaul-pairing-screen.tsx
"use client";

import { useState } from "react";

export function BackhaulPairingScreen() {
  const [activated, setActivated] = useState(false);

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Backhaul Pairing</p>
            <h1 className="text-4xl font-bold">AI Backhaul Optimizer</h1>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-6">
          <article className="rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold">Route Comparison</h2>
            <p className="mt-8 text-4xl font-extrabold">$2,100</p>
          </article>
          <article className="rounded-xl border border-brand-200 bg-brand-50 p-6">
            <h2 className="text-xl font-semibold">Optimized Trip</h2>
            <p className="mt-8 text-4xl font-extrabold text-brand-700">$4,800</p>
          </article>
        </div>
      </section>
      <aside className="rounded-2xl bg-slate-900 p-6 text-white">
        <h2 className="text-2xl font-bold">Unlock the Full TruckLoads Marketplace</h2>
        <button type="button" className="mt-6 rounded-lg bg-white px-4 py-2 text-slate-900" onClick={() => setActivated(true)}>
          Activate Marketplace
        </button>
        {activated ? <p className="mt-4">Marketplace activated</p> : null}
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/unit/backhaul-pairing-screen.test.tsx
```

Expected:
- `PASS`
- Economics and activation state present

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/backhaul-pairing-screen.tsx src/components/screens/trip-comparison-card.tsx src/app/backhaul-pairing/page.tsx tests/unit/backhaul-pairing-screen.test.tsx
git commit -m "feat: add backhaul pairing workflow screen"
```

---

### Task 7: Build The Proactive Monitoring Screen

**Files:**
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/proactive-monitoring-screen.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/intervention-package-card.tsx`
- Create: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/app/proactive-monitoring/page.tsx`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/proactive-monitoring-screen.test.tsx`

- [ ] **Step 1: Write the failing monitoring screen test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import ProactiveMonitoringPage from "@/app/proactive-monitoring/page";

describe("ProactiveMonitoringPage", () => {
  it("renders the intervention package and lets the dispatcher execute it", async () => {
    const user = userEvent.setup();
    render(<ProactiveMonitoringPage />);

    expect(screen.getByRole("heading", { name: /urgent action required/i })).toBeInTheDocument();
    expect(screen.getByText(/intervention package/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /execute plan/i }));

    expect(screen.getByText(/plan dispatched/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/unit/proactive-monitoring-screen.test.tsx
```

Expected:
- `FAIL`
- Page or button missing

- [ ] **Step 3: Implement the monitoring screen**

```tsx
// src/app/proactive-monitoring/page.tsx
import { AppShell } from "@/components/app-shell/app-shell";
import { ProactiveMonitoringScreen } from "@/components/screens/proactive-monitoring-screen";

export default function ProactiveMonitoringPage() {
  return (
    <AppShell currentWorkflow="proactive-monitoring">
      <ProactiveMonitoringScreen />
    </AppShell>
  );
}
```

```tsx
// src/components/screens/proactive-monitoring-screen.tsx
"use client";

import { useState } from "react";

export function ProactiveMonitoringScreen() {
  const [executed, setExecuted] = useState(false);

  return (
    <div className="grid grid-cols-[2fr_1fr] gap-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-600">Urgent Action Required</p>
        <h1 className="mt-2 text-4xl font-bold">Intervention Package</h1>
        <p className="mt-4 text-slate-600">Load #TRK-8492 · Route deviation detected · ETA risk rising</p>
        <button type="button" className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-white" onClick={() => setExecuted(true)}>
          Execute Plan
        </button>
        {executed ? <p className="mt-4 font-semibold text-brand-700">Plan dispatched</p> : null}
      </section>
      <aside className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Customer Comms</h2>
          <p className="mt-3 text-sm text-slate-600">Draft SMS and service recovery note.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Relay Recommendation</h2>
          <p className="mt-3 text-sm text-slate-600">Kevin Walsh is 17 miles away and can absorb the final leg.</p>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- tests/unit/proactive-monitoring-screen.test.tsx
```

Expected:
- `PASS`
- Execute interaction shows success state

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/proactive-monitoring-screen.tsx src/components/screens/intervention-package-card.tsx src/app/proactive-monitoring/page.tsx tests/unit/proactive-monitoring-screen.test.tsx
git commit -m "feat: add proactive monitoring workflow screen"
```

---

### Task 8: Refine Fidelity, Navigation, And Cross-Screen Behavior

**Files:**
- Modify: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/app-shell/sidebar.tsx`
- Modify: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/app-shell/top-bar.tsx`
- Modify: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/components/screens/*.tsx`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/smoke/navigation.spec.ts`

- [ ] **Step 1: Write the failing navigation smoke test**

```ts
import { test, expect } from "@playwright/test";

test("workflow navigation keeps the shell stable while switching screens", async ({ page }) => {
  await page.goto("http://127.0.0.1:3000/morning-triage");

  await expect(page.getByText("Co-Dispatch")).toBeVisible();
  await page.getByRole("link", { name: "Load Assignment" }).click();
  await expect(page.getByRole("heading", { name: /top recommended drivers/i })).toBeVisible();

  await page.getByRole("link", { name: "Backhaul Pairing" }).click();
  await expect(page.getByRole("heading", { name: /ai backhaul optimizer/i })).toBeVisible();

  await page.getByRole("link", { name: "Proactive Monitoring" }).click();
  await expect(page.getByRole("heading", { name: /intervention package/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run:

```bash
npm run dev
npm run test:smoke -- tests/smoke/navigation.spec.ts
```

Expected:
- `FAIL`
- One or more screens missing route links or shell persistence

- [ ] **Step 3: Replace the rough layout with Figma-aligned composition**

```tsx
// Example refinement targets
// - move shell to exact 256px sidebar
// - add active nav border-right treatment
// - add page-specific right-rail panels
// - align heading sizes and spacing to Figma
// - keep action bars pinned to the bottom edge of the content composition
```

```css
/* Example token refinement */
.panel-card {
  @apply rounded-xl border border-slate-200/70 bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.05)];
}

.nav-active {
  @apply border-r-4 border-brand-500 bg-brand-50 text-brand-500;
}
```

- [ ] **Step 4: Run unit tests and smoke test to verify everything passes**

Run:

```bash
npm test
npm run test:smoke -- tests/smoke/navigation.spec.ts
```

Expected:
- All unit tests pass
- Playwright navigation smoke test passes

- [ ] **Step 5: Commit**

```bash
git add src/components/app-shell/sidebar.tsx src/components/app-shell/top-bar.tsx src/components/screens src/app/globals.css tests/smoke/navigation.spec.ts
git commit -m "feat: refine figma fidelity and workflow navigation"
```

---

### Task 9: Final Verification And Delivery

**Files:**
- Modify: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/src/**/*`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/unit/*.test.tsx`
- Test: `/Users/anishk/Documents/coding_docs/TruckerPath-hack/tests/smoke/navigation.spec.ts`

- [ ] **Step 1: Build the app locally**

Run:

```bash
npm run build
```

Expected:
- `Compiled successfully`
- exit code `0`

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
npm run test:smoke
```

Expected:
- unit tests green
- smoke tests green

- [ ] **Step 3: Manually verify the four routes**

Run:

```bash
npm run dev
```

Check in browser:
- `/morning-triage`
- `/load-assignment`
- `/backhaul-pairing`
- `/proactive-monitoring`

Expected:
- persistent shell
- Figma-like hierarchy and spacing
- connected mock state
- navigation feels continuous

- [ ] **Step 4: Commit**

```bash
git add src tests
git commit -m "feat: complete co-dispatch frontend implementation"
```

---

## Self-Review

### Spec Coverage
- App shell: covered by Tasks 1-2
- Shared state and interactions: covered by Task 3
- Morning Triage: covered by Task 4
- Load Assignment: covered by Task 5
- Backhaul Pairing: covered by Task 6
- Proactive Monitoring: covered by Task 7
- Polish and transitions: covered by Task 8
- Verification: covered by Task 9

### Placeholder Scan
- No `TODO` or `TBD` placeholders remain
- All tasks contain concrete files, commands, and code examples

### Type Consistency
- `WorkflowId` values match route names
- `MockDataProvider` and `useMockData` are referenced consistently
- Route file names and component names align across tasks
