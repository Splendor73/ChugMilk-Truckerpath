import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";

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
    expect(screen.getByRole("button", { name: /go live/i })).toBeInTheDocument();
    expect(screen.getByText("Screen Body")).toBeInTheDocument();
  });
});
