import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProactiveMonitoringPage from "@/app/proactive-monitoring/page";
import { MockDataProvider } from "@/lib/mock-data/store";

describe("ProactiveMonitoringPage", () => {
  it("renders the proactive monitoring screen and dispatches the intervention plan", () => {
    render(
      <MockDataProvider>
        <ProactiveMonitoringPage />
      </MockDataProvider>,
    );

    expect(screen.getByRole("heading", { name: /urgent action required/i })).toBeInTheDocument();
    expect(screen.getAllByText(/intervention package/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/customer comms/i)).toBeInTheDocument();
    expect(screen.getByText(/relay recommendation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review queue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /execute plan/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /review queue/i }));

    expect(screen.queryAllByText(/plan dispatched/i)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /execute plan/i }));

    expect(screen.getAllByText(/plan dispatched/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/handled/i).length).toBeGreaterThan(0);
  });
});
