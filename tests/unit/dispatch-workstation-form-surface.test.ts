// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, forwardRef } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DispatchWorkstation } from "@/components/workstation/dispatch-workstation";
import { GET as getFleetSnapshotRoute } from "@/app/api/fleet/snapshot/route";
import { GET as getMonitorFeedRoute } from "@/app/api/monitor/feed/route";
import { POST as monitorTickRoute } from "@/app/api/monitor/tick/route";
import { GET as getRoutesRoute } from "@/app/api/routes/route";
import { POST as simulateRoute } from "@/app/api/dev/simulate/route";
import { getDb } from "@/server/db/client";

import { bootstrapBackendTests, closeDatabase } from "../helpers/backend";

vi.mock("@/components/workstation/interactive-dispatch-map", () => ({
  InteractiveDispatchMap: forwardRef(function InteractiveDispatchMapStub(_, ref) {
    return createElement("div", { "data-testid": "dispatch-map", ref });
  })
}));

describe.sequential("dispatch workstation form surface", () => {
  beforeAll(async () => {
    await bootstrapBackendTests();
  });

  beforeEach(async () => {
    await bootstrapBackendTests();

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      configurable: true
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();
      const method =
        init?.method ??
        (typeof input === "string"
          ? "GET"
          : input instanceof Request
            ? input.method
            : "GET") ??
        "GET";

      if (url.endsWith("/api/fleet/snapshot") && method === "GET") {
        return getFleetSnapshotRoute();
      }

      if (url.endsWith("/api/monitor/feed") && method === "GET") {
        return getMonitorFeedRoute();
      }

      if (url.endsWith("/api/monitor/tick") && method === "POST") {
        return monitorTickRoute();
      }

      if (url.endsWith("/api/routes") && method === "GET") {
        return getRoutesRoute();
      }

      throw new Error(`Unhandled fetch in test: ${method} ${url}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("removes local-only morning triage form controls while keeping db-backed route creation controls", async () => {
    render(createElement(DispatchWorkstation, { initialStage: "morning_triage" }));

    await screen.findByText("Operations desk");
    expect(screen.queryByText("Fleet brief")).not.toBeInTheDocument();
    expect(screen.queryByText("Priority queue")).not.toBeInTheDocument();

    expect(screen.queryByPlaceholderText("Search driver, unit, city, or phone")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Routes" }));

    await screen.findByText("Create route");
    await waitFor(() => {
      expect(screen.getAllByRole("combobox")).toHaveLength(3);
    });
    expect(screen.getByRole("button", { name: "Create route in DB" })).toBeInTheDocument();
  });

  it("shows all live monitor alerts, removes say-to-execute copy, and supports minimizing the popup", async () => {
    await simulateRoute(
      new Request("http://localhost/api/dev/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: "TRIP-ACT3",
          scenario: "breakdown"
        })
      })
    );
    await monitorTickRoute();
    await getDb().interventionDraft.create({
      data: {
        tripId: "TRIP-SECOND",
        trigger: "eta_slip",
        customerSms: "Second alert message for a delayed trip.",
        relayDriverId: 103,
        relayDriverName: "Kevin Walsh",
        relayDistanceMi: 18,
        rerouteNeeded: true,
        voiceScript: "Second voice alert for the delayed trip.",
        status: "drafted"
      }
    });

    render(createElement(DispatchWorkstation, { initialStage: "trip_monitoring" }));

    expect(await screen.findByText("Second alert message for a delayed trip.")).toBeInTheDocument();
    expect(screen.getByText("Truck 14 has been delayed near Barstow. Revised ETA is approximately 3 hours later than planned. We are dispatching a relay and will keep you updated.")).toBeInTheDocument();
    expect(screen.queryByText(/Say .*execute/i)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Execute now" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit voice script")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit customer SMS")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Play voice" })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Minimize alert popup" }));
    expect(screen.getByRole("button", { name: "Expand alert popup" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Play voice" })).toHaveLength(1);
  });
});
