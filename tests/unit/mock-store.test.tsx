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

    act(() => {
      result.current.assignDriver("driver-sarah");
      result.current.selectBackhaul("backhaul-stl");
    });

    expect(result.current.assignedDriverId).toBe("driver-sarah");
    expect(result.current.selectedBackhaulId).toBe("backhaul-stl");
  });
});
