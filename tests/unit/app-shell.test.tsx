import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders the Co-Dispatch shell entry point", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /co-dispatch/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /morning triage/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dispatch new load/i })).toBeInTheDocument();
  });
});
