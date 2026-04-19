import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BackhaulPairingPage from "@/app/backhaul-pairing/page";
import { MockDataProvider } from "@/lib/mock-data/store";

describe("BackhaulPairingPage", () => {
  it("renders the AI Backhaul Optimizer and confirms marketplace activation", () => {
    render(
      <MockDataProvider>
        <BackhaulPairingPage />
      </MockDataProvider>,
    );

    expect(screen.getByRole("heading", { name: /ai backhaul optimizer/i })).toBeInTheDocument();
    expect(screen.getByText(/standard vs optimized economics/i)).toBeInTheDocument();
    expect(screen.getByText(/available backhauls/i)).toBeInTheDocument();
    expect(screen.getByText("$2,100", { selector: "div" })).toBeInTheDocument();
    expect(screen.getByText("$4,800", { selector: "div" })).toBeInTheDocument();
    expect(screen.getAllByText(/awaiting pick/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /activate marketplace/i })[0]);

    expect(screen.getByRole("heading", { name: /activated backhaul/i })).toBeInTheDocument();
    expect(screen.getByText(/marketplace activated/i)).toBeInTheDocument();
    expect(screen.getByText(/st\. louis, mo -> indianapolis, in\./i, { selector: "p" })).toBeInTheDocument();
  });
});
