import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoadAssignmentPage from "@/app/load-assignment/page";
import { MockDataProvider } from "@/lib/mock-data/store";

describe("LoadAssignmentPage", () => {
  it("renders the load assignment workflow and confirms an assignment", () => {
    render(
      <MockDataProvider>
        <LoadAssignmentPage />
      </MockDataProvider>,
    );

    expect(screen.getByRole("heading", { name: /load assignment/i })).toBeInTheDocument();
    expect(screen.getByText(/ranked drivers/i)).toBeInTheDocument();
    expect(screen.getByText(/score breakdown/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /assign omar ruiz/i })).toBeInTheDocument();
    expect(screen.getByText(/busy with chi-dal-7841/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /assign omar ruiz/i }));

    expect(screen.getByText(/assigned omar ruiz to atl-mco-3382/i)).toBeInTheDocument();
    expect(screen.getByText(/assigned to omar ruiz/i)).toBeInTheDocument();
  });
});
