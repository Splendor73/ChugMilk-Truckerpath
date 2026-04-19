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
import { resetDemoRuntimeForTests } from "@/server/runtime/demo-runtime";

import { bootstrapBackendTests, closeDatabase } from "../helpers/backend";

vi.mock("@/components/workstation/interactive-dispatch-map", () => ({
  InteractiveDispatchMap: forwardRef(function InteractiveDispatchMapStub(_, ref) {
    return createElement("div", { "data-testid": "dispatch-map", ref });
  })
}));

describe.sequential("dispatch workstation form surface", () => {
  let fetchCalls: Array<{ url: string; method: string; body?: string }>;

  beforeAll(async () => {
    await bootstrapBackendTests();
  });

  beforeEach(async () => {
    await bootstrapBackendTests();
    // Clear the cached `ensureDemoRuntimeReady` flag so each test re-runs
    // the full synthetic seed (all 5 baseline trips). Without this the DB
    // gets wiped but the synthetic layer thinks it already seeded and
    // only TRIP-ACT3 gets back-filled via `simulateRoute`'s inner upsert.
    resetDemoRuntimeForTests();

    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      configurable: true
    });

    delete process.env.NEXT_PUBLIC_AUTO_RESET_DEMO_ON_PAGE_LOAD;

    fetchCalls = [];

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
      const body =
        typeof init?.body === "string"
          ? init.body
          : input instanceof Request
            ? await input.clone().text()
            : undefined;

      fetchCalls.push({ url, method, body });

      if (url.endsWith("/api/fleet/snapshot") && method === "GET") {
        return getFleetSnapshotRoute();
      }

      if (url.endsWith("/api/dev/simulate") && method === "POST") {
        if (body?.includes('"action":"reset"')) {
          return Response.json({ ok: true });
        }
        return simulateRoute(
          new Request("http://localhost/api/dev/simulate", {
            method,
            headers: { "Content-Type": "application/json" },
            body
          })
        );
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
    process.env.NEXT_PUBLIC_AUTO_RESET_DEMO_ON_PAGE_LOAD = "true";

    render(createElement(DispatchWorkstation, { initialStage: "morning_triage" }));

    await screen.findByText("Operations desk");
    expect(
      fetchCalls.some(
        (call) => call.url.endsWith("/api/dev/simulate") && call.method === "POST" && call.body?.includes('"reset"')
      )
    ).toBe(true);
    expect(screen.queryByText("Fleet brief")).not.toBeInTheDocument();
    expect(screen.queryByText("Priority queue")).not.toBeInTheDocument();

    expect(screen.queryByPlaceholderText("Search driver, unit, city, or phone")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Routes" }));

    const newTripButton = await screen.findByRole("button", { name: "+ New trip" });
    fireEvent.click(newTripButton);

    await screen.findByRole("dialog", { name: "Create new trip" });
    await waitFor(() => {
      expect(screen.getAllByRole("combobox")).toHaveLength(3);
    });
    expect(screen.getByRole("button", { name: "Create trip" })).toBeInTheDocument();
  });

  it("does not auto-reset the shared demo on non-local hosts", async () => {
    render(createElement(DispatchWorkstation, { initialStage: "morning_triage" }));

    await screen.findByText("Operations desk");
    expect(
      fetchCalls.some(
        (call) => call.url.endsWith("/api/dev/simulate") && call.method === "POST" && call.body?.includes('"reset"')
      )
    ).toBe(false);
  });

  it("shows the backend message when execute now fails", async () => {
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

    const realFetch = globalThis.fetch;

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

      if (url.endsWith("/api/monitor/interventions/execute") && method === "POST") {
        return Response.json({ message: "Intervention draft was reset." }, { status: 404 });
      }

      return realFetch(input as RequestInfo | URL, init);
    });

    render(createElement(DispatchWorkstation, { initialStage: "trip_monitoring" }));

    fireEvent.click(await screen.findByRole("button", { name: "Execute now" }));

    expect(await screen.findByText(/Intervention draft was reset\./)).toBeInTheDocument();
    expect(screen.queryByText(/Intervention executed, trip recovered/i)).not.toBeInTheDocument();
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
    await simulateRoute(
      new Request("http://localhost/api/dev/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: "TRIP-ACT5",
          scenario: "eta_slip"
        })
      })
    );
    await monitorTickRoute();
    // Baseline demo seed ships two non-on_track trips (TRIP-ACT3
    // long_idle + TRIP-ACT5 eta_slip), so the monitor tick above already
    // produced two drafts with distinct copy styles. We used to inject a
    // second draft here by hand; the baseline dataset makes that
    // unnecessary and lets this test exercise the real `draftIntervention`
    // templates.
    const drafts = await getDb().interventionDraft.findMany();
    expect(drafts.some((draft) => draft.tripId === "TRIP-ACT5")).toBe(true);

    render(createElement(DispatchWorkstation, { initialStage: "trip_monitoring" }));

    // Style A — ops / factual voice (breakdown).
    expect(
      await screen.findByText(
        "Truck 14 has been delayed near Barstow. Revised ETA is approximately 3 hours later than planned. We are dispatching a relay and will keep you updated."
      )
    ).toBeInTheDocument();
    // Style B — customer-care / conversational voice (ETA slip). Assert
    // on a stable substring so the test doesn't depend on exact delay
    // minutes that drift with `nowMs()`. The monitoring surface renders
    // the same draft body in more than one place (popup + drawer), so
    // we use `getAllByText` and just confirm at least one match.
    expect(
      screen.getAllByText(/We're watching it closely and will call the moment the ETA firms up\./).length
    ).toBeGreaterThan(0);
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
