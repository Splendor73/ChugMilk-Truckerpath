import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MockDataProvider, useMockData } from "@/lib/mock-data/store";

describe("mock store", () => {
  it("updates assignment and selected backhaul across screens", () => {
    const { result } = renderHook(() => useMockData(), {
      wrapper: MockDataProvider,
    });

    expect(result.current.assignedDriverId).toBe("driver-marcus");
    expect(result.current.selectedBackhaulId).toBeNull();
    expect(result.current.loadAssignmentsById["load-chi-dal-7841"]).toBe("driver-marcus");
    expect(result.current.loadAssignmentsById["load-atl-mco-3382"]).toBeNull();

    act(() => {
      result.current.assignDriver("driver-sarah");
      result.current.assignLoad("load-atl-mco-3382", "driver-omar");
      result.current.selectBackhaul("backhaul-stl");
    });

    expect(result.current.assignedDriverId).toBe("driver-sarah");
    expect(result.current.selectedBackhaulId).toBe("backhaul-stl");
    expect(result.current.loadAssignmentsById["load-atl-mco-3382"]).toBe("driver-omar");
  });

  it("clears a driver's previous load when reassigning them to a new load", () => {
    const { result } = renderHook(() => useMockData(), {
      wrapper: MockDataProvider,
    });

    expect(result.current.loadAssignmentsById["load-chi-dal-7841"]).toBe("driver-marcus");

    act(() => {
      result.current.assignLoad("load-atl-mco-3382", "driver-marcus");
    });

    expect(result.current.loadAssignmentsById["load-chi-dal-7841"]).toBeNull();
    expect(result.current.loadAssignmentsById["load-atl-mco-3382"]).toBe("driver-marcus");
  });
});
