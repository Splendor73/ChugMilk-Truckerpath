"use client";

import { useMemo, useState } from "react";

import { drivers, type DriverRecord } from "@/lib/mock-data/drivers";
import { loads, type LoadRecord } from "@/lib/mock-data/loads";
import { useMockData } from "@/lib/mock-data/store";

import { ActionBar } from "@/components/ui/action-bar";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard } from "@/components/ui/panel-card";
import { StatusPill } from "@/components/ui/status-pill";
import { DriverRankCard } from "./driver-rank-card";
import { ScoreBreakdownCard } from "./score-breakdown-card";

type DriverFitRow = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "negative";
};

type RankedDriver = {
  driver: DriverRecord;
  fitScore: number;
  breakdown: DriverFitRow[];
};

function formatHours(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function getCity(value: string) {
  return value.split(",")[0]?.trim() ?? value;
}

function getAssignedLoadIdForDriver(driverId: string, loadAssignmentsById: Record<string, string | null>) {
  return Object.entries(loadAssignmentsById).find(([, assignedDriverId]) => assignedDriverId === driverId)?.[0] ?? null;
}

function getLoadReference(loadId: string | null) {
  if (!loadId) {
    return null;
  }

  return loads.find((item) => item.id === loadId)?.reference ?? null;
}

function scoreDriver(
  driver: DriverRecord,
  load: LoadRecord,
  loadAssignmentsById: Record<string, string | null>,
): RankedDriver {
  const breakdown: DriverFitRow[] = [];
  let fitScore = driver.score;
  const assignedLoadId = getAssignedLoadIdForDriver(driver.id, loadAssignmentsById);
  const assignedLoadReference = getLoadReference(assignedLoadId);
  const isBusyOnOtherLoad = assignedLoadId !== null && assignedLoadId !== load.id;

  breakdown.push({
    label: "Roster baseline",
    value: `+${driver.score}`,
    detail: "Starting safety and reliability score from the shared roster.",
    tone: "neutral",
  });

  if (driver.equipment === load.equipment) {
    fitScore += 14;
    breakdown.push({
      label: "Equipment match",
      value: "+14",
      detail: `Uses ${driver.equipment.toLowerCase()} equipment, so no trailer swap is needed.`,
      tone: "positive",
    });
  } else {
    fitScore -= 16;
    breakdown.push({
      label: "Equipment match",
      value: "-16",
      detail: `Would require a ${load.equipment.toLowerCase()} swap before dispatch.`,
      tone: "negative",
    });
  }

  if (getCity(driver.location) === getCity(load.origin)) {
    fitScore += 10;
    breakdown.push({
      label: "Origin proximity",
      value: "+10",
      detail: `Driver is already staged in ${getCity(load.origin)}.`,
      tone: "positive",
    });
  } else {
    breakdown.push({
      label: "Origin proximity",
      value: "+0",
      detail: `Driver is not in the pickup city yet.`,
      tone: "neutral",
    });
  }

  if (driver.id === load.recommendedDriverId) {
    fitScore += 18;
    breakdown.push({
      label: "Planner recommendation",
      value: "+18",
      detail: "Matches the current recommended driver for this lane.",
      tone: "positive",
    });
  }

  if (driver.hoursRemaining >= 8) {
    fitScore += 8;
    breakdown.push({
      label: "Hours remaining",
      value: "+8",
      detail: `${formatHours(driver.hoursRemaining)} left gives this driver room for the run.`,
      tone: "positive",
    });
  } else {
    fitScore -= 8;
    breakdown.push({
      label: "Hours remaining",
      value: "-8",
      detail: `${formatHours(driver.hoursRemaining)} remaining is tight for this pickup window.`,
      tone: "negative",
    });
  }

  if (isBusyOnOtherLoad) {
    fitScore -= 20;
    breakdown.push({
      label: "Current load",
      value: "-20",
      detail: `Already assigned to ${assignedLoadReference ?? "another load"}, so this option is less efficient.`,
      tone: "negative",
    });
  }

  return { driver, fitScore, breakdown };
}

export function LoadAssignmentScreen() {
  const { assignedDriverId, assignLoad, loadAssignmentsById } = useMockData();
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);

  const viewModel = useMemo(() => {
    const load =
      loads.find((item) => item.id === "load-atl-mco-3382") ??
      loads.find((item) => item.assignedDriverId === null) ??
      loads[0];
    const currentAssignedDriver = drivers.find((driver) => driver.id === assignedDriverId) ?? null;
    const currentLoadAssigneeId = loadAssignmentsById[load.id] ?? null;
    const currentLoadAssignee = drivers.find((driver) => driver.id === currentLoadAssigneeId) ?? null;

    const rankedDrivers = [...drivers]
      .map((driver) => scoreDriver(driver, load, loadAssignmentsById))
      .sort((left, right) => right.fitScore - left.fitScore || left.driver.name.localeCompare(right.driver.name));

    const topCandidate = rankedDrivers[0];

    return {
      load,
      currentAssignedDriver,
      currentLoadAssignee,
      rankedDrivers,
      topCandidate,
    };
  }, [assignedDriverId, loadAssignmentsById]);

  const handleAssign = () => {
    assignLoad(viewModel.load.id, viewModel.topCandidate.driver.id);
    setAssignmentMessage(`Assigned ${viewModel.topCandidate.driver.name} to ${viewModel.load.reference}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Load desk"
        meta="Shared mock store • live ranking"
        title="Load Assignment"
        description="Pair the best available driver to the open load, confirm the fit score, and commit the assignment from a single screen."
        actions={
          <>
            <StatusPill tone="info">{viewModel.rankedDrivers.length} drivers ranked</StatusPill>
            <StatusPill tone={viewModel.currentAssignedDriver ? "neutral" : "warning"}>
              {viewModel.currentAssignedDriver ? `Current: ${viewModel.currentAssignedDriver.name}` : "No assignment"}
            </StatusPill>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <div className="space-y-6">
          <PanelCard
            title="Load Focus"
            description="This open load is the one we want to pair with the strongest candidate before the day starts moving."
          >
            <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                      Active load
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--color-shell-text)]">
                      {viewModel.load.reference}
                    </h2>
                    <p className="text-sm text-[color:var(--color-shell-text-muted)]">{viewModel.load.customer}</p>
                  </div>
                  <StatusPill tone={viewModel.currentLoadAssignee ? "success" : "warning"}>
                    {viewModel.currentLoadAssignee ? `Assigned to ${viewModel.currentLoadAssignee.name}` : "Open"}
                  </StatusPill>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-shell-text-muted)]">
                      Lane
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--color-shell-text)]">
                      {viewModel.load.origin} to {viewModel.load.destination}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-shell-text-muted)]">
                      Pickup window
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--color-shell-text)]">
                      {viewModel.load.pickupWindow}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-shell-text-muted)]">
                      Equipment
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--color-shell-text)]">
                      {viewModel.load.equipment}
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-shell-text-muted)]">
                      Margin
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--color-shell-text)]">
                      {viewModel.load.margin}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                  Shared mock state
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--color-shell-text)]">Current assignment</p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                      {viewModel.currentLoadAssignee
                        ? `${viewModel.currentLoadAssignee.name} is assigned to ${viewModel.load.reference}.`
                        : "No driver is currently assigned to this load in the mock store."}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--color-shell-text)]">Assignment goal</p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                      Confirm the top-ranked driver for {viewModel.load.reference} and push the selection back into the
                      shared store.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <ActionBar
                eyebrow="Dispatch action"
                title="Assign the recommended driver"
                description={`The ranking model favors ${viewModel.topCandidate.driver.name} for ${viewModel.load.reference}.`}
                status={<StatusPill tone="info">Top fit</StatusPill>}
                primaryAction={
                  <button
                    type="button"
                    onClick={handleAssign}
                    className="rounded-full bg-[color:var(--color-shell-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={viewModel.currentLoadAssignee?.id === viewModel.topCandidate.driver.id}
                  >
                    {viewModel.currentLoadAssignee?.id === viewModel.topCandidate.driver.id
                      ? `Assigned ${viewModel.topCandidate.driver.name}`
                      : `Assign ${viewModel.topCandidate.driver.name}`}
                  </button>
                }
                secondaryAction={
                  <div className="rounded-full border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-4 py-2 text-sm font-medium text-[color:var(--color-shell-text-muted)]">
                    Next best after {viewModel.topCandidate.driver.name}:{" "}
                    {viewModel.rankedDrivers[1]?.driver.name ?? "No alternate candidate"}
                  </div>
                }
                feedback={
                  assignmentMessage ? (
                    <span className="inline-flex items-center gap-2">
                      <StatusPill tone="success">Assigned</StatusPill>
                      {assignmentMessage}
                    </span>
                  ) : (
                    <span className="text-[color:var(--color-shell-text-muted)]">
                      The button will update the mock assignment and confirm the new driver below.
                    </span>
                  )
                }
              />
            </div>
          </PanelCard>

          <PanelCard
            title="Ranked Drivers"
            description="Sorted by the combined fit score so the first call is obvious."
            action={<StatusPill tone="info">{viewModel.rankedDrivers.length} candidates</StatusPill>}
          >
            <div className="space-y-3">
              {viewModel.rankedDrivers.map((candidate, index) => {
                const assignedLoadId = getAssignedLoadIdForDriver(candidate.driver.id, loadAssignmentsById);
                const assignedLoadReference = getLoadReference(assignedLoadId);

                return (
                  <DriverRankCard
                    key={candidate.driver.id}
                    rank={index + 1}
                    driver={candidate.driver}
                    fitScore={candidate.fitScore}
                    focusLoadReference={viewModel.load.reference}
                    assignmentLoadReference={assignedLoadReference}
                    isRecommended={index === 0}
                  />
                );
              })}
            </div>
          </PanelCard>
        </div>

        <div className="space-y-6">
          <ScoreBreakdownCard
            title="Score Breakdown"
            driverName={viewModel.topCandidate.driver.name}
            loadReference={viewModel.load.reference}
            score={viewModel.topCandidate.fitScore}
            breakdown={viewModel.topCandidate.breakdown}
          />

          <PanelCard
            title="Why this candidate"
            description="The score tells the story, but the context makes the dispatch decision easier to defend."
          >
            <div className="space-y-4 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
              <p>
                {viewModel.topCandidate.driver.name} is the best fit because they are already in {getCity(viewModel.load.origin)},
                match the required {viewModel.load.equipment.toLowerCase()} equipment, and are the recommended driver for this lane.
              </p>
              <p>
                Once assigned, the shared mock store will update the active driver for the rest of the workflow.
              </p>
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
