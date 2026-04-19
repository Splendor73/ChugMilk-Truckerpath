import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";
import MorningTriagePage from "@/app/morning-triage/page";
import { MockDataProvider } from "@/lib/mock-data/store";

describe("AppShell", () => {
  it("renders the persistent shell around the current workflow", () => {
    render(
      <AppShell currentWorkflow="load-assignment">
        <div>Screen Body</div>
      </AppShell>,
    );

    expect(screen.getByText(/fleet operations/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /morning triage/i })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /backhaul pairing/i })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /dispatch new load/i })).toHaveAttribute("href", "/load-assignment");
    expect(screen.getByPlaceholderText(/search loads, drivers/i)).toBeInTheDocument();
    expect(screen.getByText("Search loads, drivers")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go live/i })).toHaveAttribute("href", "/proactive-monitoring");
    expect(screen.getByText("Screen Body")).toBeInTheDocument();
  });

  it("renders the morning triage route content inside the shell", () => {
    render(
      <MockDataProvider>
        <MorningTriagePage />
      </MockDataProvider>,
    );

    expect(screen.getByRole("heading", { name: /morning triage/i })).toBeInTheDocument();
    expect(screen.getByText(/daily synthesis/i)).toBeInTheDocument();
    expect(screen.getByText(/fleet readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/driver roster/i)).toBeInTheDocument();

    const mapHeading = screen.getByRole("heading", { name: /phoenix, az -> las vegas, nv/i });
    const mapCard = mapHeading.closest("section");

    expect(mapCard).not.toBeNull();
    expect(within(mapCard as HTMLElement).getByText("PHX-LAS-9014")).toBeInTheDocument();
    expect(within(mapCard as HTMLElement).getByText("Lexi Carter")).toBeInTheDocument();
  });
});
