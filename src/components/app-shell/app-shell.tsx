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
    <div className="bg-shell min-h-screen overflow-x-hidden">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar currentWorkflow={currentWorkflow} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar currentWorkflow={currentWorkflow} />

          <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
