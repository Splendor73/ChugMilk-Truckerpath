"use client";

import { useMemo } from "react";

import { dispatcher } from "@/lib/mock-data/dispatcher";
import { backhaul } from "@/lib/mock-data/backhaul";
import { drivers } from "@/lib/mock-data/drivers";
import { loads } from "@/lib/mock-data/loads";
import { monitoring } from "@/lib/mock-data/monitoring";
import { useMockData } from "@/lib/mock-data/store";

import { MapCard } from "@/components/ui/map-card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard } from "@/components/ui/panel-card";

function formatHours(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

export function MorningTriageScreen() {
  const { assignedDriverId } = useMockData();

  const viewModel = useMemo(() => {
    const selectedDriver = drivers.find((driver) => driver.id === assignedDriverId) ?? drivers[0];
    const selectedLoad = selectedDriver.currentLoadId
      ? loads.find((load) => load.id === selectedDriver.currentLoadId) ?? null
      : null;
    const criticalAlert = monitoring.find((item) => item.severity === "Critical") ?? monitoring[0];
    const watchAlert = monitoring.find((item) => item.severity === "Warning") ?? monitoring[1];
    const criticalDriver = drivers.find((driver) => driver.id === criticalAlert.driverId) ?? selectedDriver;
    const criticalLoad = loads.find((load) => load.id === criticalAlert.loadId) ?? selectedLoad ?? loads[0];
    const recommendedBackhaul = backhaul[0];
    const activeLoads = loads.filter((load) => load.assignedDriverId !== null);
    const readyDrivers = drivers.filter((driver) => driver.hoursRemaining >= 8);
    const openRiskCount = monitoring.filter((item) => item.severity !== "Watch").length;
    const averageScore = Math.round(
      drivers.reduce((total, driver) => total + driver.score, 0) / drivers.length,
    );
    const averageHours = (
      drivers.reduce((total, driver) => total + driver.hoursRemaining, 0) / drivers.length
    ).toFixed(1);

    return {
      selectedDriver,
      selectedLoad,
      criticalAlert,
      watchAlert,
      criticalDriver,
      criticalLoad,
      recommendedBackhaul,
      activeLoads,
      readyDrivers,
      openRiskCount,
      averageScore,
      averageHours,
    };
  }, [assignedDriverId]);

  const fleetReadinessMetrics = [
    {
      label: "Drivers on deck",
      value: `${viewModel.readyDrivers.length}`,
      detail: "Drivers with enough hours to take a live assignment or rescue move.",
      delta: `${drivers.length} rostered`,
      tone: "teal" as const,
    },
    {
      label: "Loads covered",
      value: `${viewModel.activeLoads.length}/${loads.length}`,
      detail: "Assigned freight already matched to the morning roster.",
      delta: "75% secured",
      tone: "blue" as const,
    },
    {
      label: "Open risks",
      value: `${viewModel.openRiskCount}`,
      detail: "Items that need direct attention before the first pickup wave.",
      delta: "2 active",
      tone: "rose" as const,
    },
    {
      label: "Avg. safety score",
      value: `${viewModel.averageScore}`,
      detail: `Across the active roster with ${viewModel.averageHours} average hours remaining.`,
      delta: "Stable",
      tone: "amber" as const,
    },
  ];

  const roster = [...drivers].sort((left, right) => right.score - left.score);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Morning operations"
        meta={`${dispatcher.lastSyncedAt} • ${dispatcher.hub}`}
        title="Morning Triage"
        description="A calm start to the day: clear the critical corridor, confirm the ready roster, and stage the best next move before the first pickup windows open."
        actions={
          <>
            <button
              type="button"
              className="rounded-full border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--color-shell-text)] transition-colors hover:bg-[color:var(--color-shell-surface-muted)]"
            >
              Review risk queue
            </button>
            <button
              type="button"
              className="rounded-full bg-[color:var(--color-shell-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Start dispatch sweep
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <PanelCard
            title="Daily Synthesis"
            description="The dispatcher’s morning read on what deserves attention first."
            className="bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.92))]"
          >
            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="space-y-4">
                <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                    Dispatcher note
                  </p>
                  <p className="mt-3 text-lg font-medium leading-7 text-[color:var(--color-shell-text)]">
                    {dispatcher.name} is monitoring {dispatcher.status.toLowerCase()} and tracking{" "}
                    {viewModel.activeLoads.length} live loads, with one critical lane that needs action before wheels
                    start turning.
                  </p>
                </div>

                <ol className="space-y-3">
                  {[
                    {
                      title: viewModel.criticalAlert.title,
                      detail: viewModel.criticalAlert.recommendedAction,
                      meta: viewModel.criticalAlert.status,
                    },
                    {
                      title: viewModel.watchAlert.title,
                      detail: viewModel.watchAlert.recommendedAction,
                      meta: viewModel.watchAlert.eta,
                    },
                    {
                      title: "Late-day backhaul to stage",
                      detail: `${viewModel.recommendedBackhaul.lane} is the strongest return option once the morning freight is covered.`,
                      meta: `${viewModel.recommendedBackhaul.matchScore}% match`,
                    },
                  ].map((item, index) => (
                    <li
                      key={item.title}
                      className="flex gap-4 rounded-[22px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface)] p-4"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-shell-brand-soft)] font-semibold text-[color:var(--color-shell-brand)]">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[color:var(--color-shell-text)]">{item.title}</p>
                          <span className="rounded-full bg-[color:var(--color-shell-surface-muted)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-shell-text-muted)]">
                            {item.meta}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                    Focus driver
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[color:var(--color-shell-text)]">
                        {viewModel.selectedDriver.name}
                      </p>
                      <p className="text-sm text-[color:var(--color-shell-text-muted)]">
                        {viewModel.selectedDriver.unit} • {viewModel.selectedDriver.equipment}
                      </p>
                    </div>
                    <span className="rounded-full bg-[color:var(--color-shell-brand-soft)] px-3 py-1 text-sm font-semibold text-[color:var(--color-shell-brand)]">
                      {viewModel.selectedDriver.availability}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                    <p>
                      Location: <span className="font-semibold text-[color:var(--color-shell-text)]">{viewModel.selectedDriver.location}</span>
                    </p>
                    <p>
                      Hours remaining:{" "}
                      <span className="font-semibold text-[color:var(--color-shell-text)]">
                        {formatHours(viewModel.selectedDriver.hoursRemaining)}
                      </span>
                    </p>
                    <p>
                      Score:{" "}
                      <span className="font-semibold text-[color:var(--color-shell-text)]">
                        {viewModel.selectedDriver.score}
                      </span>
                    </p>
                  </div>
                </div>

                {viewModel.selectedLoad ? (
                  <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                      Current load
                    </p>
                    <p className="mt-3 text-base font-semibold text-[color:var(--color-shell-text)]">
                      {viewModel.selectedLoad.reference}
                    </p>
                    <p className="text-sm text-[color:var(--color-shell-text-muted)]">{viewModel.selectedLoad.customer}</p>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                      {viewModel.selectedLoad.origin} to {viewModel.selectedLoad.destination}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </PanelCard>

          <MapCard
            title="Morning map"
            description="The highest-priority corridor is the one with the most visible risk, so the desk can decide where to intervene first."
            status={viewModel.criticalAlert.severity}
            route={viewModel.criticalAlert.route}
            summary={viewModel.criticalAlert.detail}
            mapId="morning-critical-corridor"
            origin={{
              label: viewModel.criticalLoad.origin,
              detail: `${viewModel.criticalDriver.name} departure point`,
            }}
            destination={{
              label: viewModel.criticalLoad.destination,
              detail: `${viewModel.criticalLoad.customer} delivery`,
            }}
            stats={[
              { label: "ETA risk", value: viewModel.criticalAlert.eta },
              { label: "Driver", value: viewModel.criticalDriver.name },
              { label: "Load", value: viewModel.criticalLoad.reference },
              { label: "Action", value: viewModel.criticalAlert.recommendedAction },
            ]}
          />
        </div>

        <div className="space-y-6">
          <PanelCard
            title="Fleet Readiness"
            description="A quick view of how much of the roster is ready to absorb the morning workload."
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              {fleetReadinessMetrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  detail={metric.detail}
                  delta={metric.delta}
                  tone={metric.tone}
                />
              ))}
            </div>
          </PanelCard>

          <PanelCard
            title="Driver Roster"
            description="Ordered by readiness so the first call is easy to make."
            action={
              <span className="rounded-full bg-[color:var(--color-shell-brand-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-shell-brand)]">
                {roster.length} drivers
              </span>
            }
          >
            <div className="space-y-3">
              {roster.map((driver) => {
                const currentLoad = driver.currentLoadId
                  ? loads.find((load) => load.id === driver.currentLoadId) ?? null
                  : null;
                const isSelected = driver.id === viewModel.selectedDriver.id;

                return (
                  <article
                    key={driver.id}
                    className={[
                      "rounded-[24px] border p-4 transition-colors",
                      isSelected
                        ? "border-[color:var(--color-shell-brand)] bg-[color:var(--color-shell-brand-soft)]/40"
                        : "border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-[color:var(--color-shell-text)]">{driver.name}</p>
                          {isSelected ? (
                            <span className="rounded-full bg-[color:var(--color-shell-brand-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-shell-brand)]">
                              Focus
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-[color:var(--color-shell-text-muted)]">
                          {driver.unit} • {driver.equipment}
                        </p>
                      </div>

                      <span className="rounded-full bg-[color:var(--color-shell-surface)] px-3 py-1 text-xs font-semibold text-[color:var(--color-shell-text)]">
                        {driver.availability}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-[color:var(--color-shell-text-muted)] sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em]">Location</p>
                        <p className="mt-1 font-medium text-[color:var(--color-shell-text)]">{driver.location}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em]">Hours left</p>
                        <p className="mt-1 font-medium text-[color:var(--color-shell-text)]">
                          {formatHours(driver.hoursRemaining)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em]">Safety score</p>
                        <p className="mt-1 font-medium text-[color:var(--color-shell-text)]">{driver.score}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em]">Current load</p>
                        <p className="mt-1 font-medium text-[color:var(--color-shell-text)]">
                          {currentLoad ? currentLoad.reference : "Open for assignment"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
