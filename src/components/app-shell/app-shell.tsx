import type { ReactNode } from "react";

import { type WorkflowId } from "@/lib/navigation/workflows";

import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

type AppShellProps = {
  currentWorkflow: WorkflowId;
  children: ReactNode;
};

export function AppShell({ currentWorkflow, children }: AppShellProps) {
  return (
    <div className="bg-shell min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar currentWorkflow={currentWorkflow} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar currentWorkflow={currentWorkflow} />

          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
