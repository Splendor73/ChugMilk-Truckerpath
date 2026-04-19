"use client";

import { useMemo } from "react";

import { backhaul, type BackhaulRecord } from "@/lib/mock-data/backhaul";
import { drivers } from "@/lib/mock-data/drivers";
import { loads } from "@/lib/mock-data/loads";
import { useMockData } from "@/lib/mock-data/store";

import { ActionBar } from "@/components/ui/action-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard } from "@/components/ui/panel-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TripComparisonCard } from "./trip-comparison-card";

function parseMoney(value: string) {
  return Number(value.replace(/[$,]/g, ""));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMiles(value: number) {
  return `${value.toLocaleString("en-US")} mi`;
}

function getAssignedLoadIdForDriver(driverId: string, loadAssignmentsById: Record<string, string | null>) {
  return Object.entries(loadAssignmentsById).find(([, assignedDriverId]) => assignedDriverId === driverId)?.[0] ?? null;
}

const BASELINE_REVENUE = 4300;
const BASELINE_MARGIN = 1240;
const BASELINE_EMPTY_MILES = 182;
const STANDARD_ECONOMICS_USD = 2100;
const OPTIMIZED_ECONOMICS_USD = 4800;

export function BackhaulPairingScreen() {
  const { assignedDriverId, loadAssignmentsById, selectedBackhaulId, selectBackhaul } = useMockData();

  const viewModel = useMemo(() => {
    const sortedBackhauls = [...backhaul].sort((left, right) => right.matchScore - left.matchScore);
    const recommendedBackhaul = sortedBackhauls[0] ?? null;
    const activeDriver = drivers.find((driver) => driver.id === assignedDriverId) ?? drivers[0];
    const assignedLoadId = getAssignedLoadIdForDriver(activeDriver.id, loadAssignmentsById);
    const assignedLoad = loads.find((load) => load.id === assignedLoadId) ?? null;
    const selectedBackhaul = backhaul.find((item) => item.id === selectedBackhaulId) ?? null;
    const activationState = selectedBackhaul
      ? selectedBackhaul.id === recommendedBackhaul?.id
        ? "Marketplace activated"
        : "Backhaul selected"
      : "Awaiting pick";

    return {
      activeDriver,
      assignedLoad,
      sortedBackhauls,
      recommendedBackhaul,
      selectedBackhaul,
      activationState,
    };
  }, [assignedDriverId, loadAssignmentsById, selectedBackhaulId]);

  const activateBackhaul = (backhaulRecord: BackhaulRecord) => {
    selectBackhaul(backhaulRecord.id);
  };

  const activateMarketplace = () => {
    if (viewModel.recommendedBackhaul) {
      activateBackhaul(viewModel.recommendedBackhaul);
    }
  };

  const selectedBackhaul = viewModel.selectedBackhaul ?? null;

  const economicsCards = [
    {
      label: "Standard economics",
      value: formatMoney(STANDARD_ECONOMICS_USD),
      detail: "One-way profit before the return load is paired.",
      delta: "Unselected",
      tone: "amber" as const,
    },
    {
      label: "Optimized economics",
      value: formatMoney(OPTIMIZED_ECONOMICS_USD),
      detail: selectedBackhaul
        ? `Activated return leg for ${selectedBackhaul.lane}.`
        : `Projected round-trip profit from ${viewModel.recommendedBackhaul?.lane ?? "the best corridor"}. Nothing activated yet.`,
      delta: selectedBackhaul ? (selectedBackhaul.id === viewModel.recommendedBackhaul?.id ? "Activated" : "Selected") : "Awaiting pick",
      tone: "teal" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Backhaul desk"
        meta={`Shared mock store • ${selectedBackhaul ? "activated" : "awaiting pick"}`}
        title="AI Backhaul Optimizer"
        description="Compare the outbound-only baseline against the optimized round trip, then activate the best backhaul or let the marketplace do it for you."
        actions={
          <>
            <StatusPill tone={selectedBackhaul ? "success" : "warning"}>
              {selectedBackhaul ? "Activated" : "Awaiting pick"}
            </StatusPill>
            <button
              type="button"
              onClick={activateMarketplace}
              className="rounded-full bg-[color:var(--color-shell-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              Activate marketplace
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <PanelCard
            title="Standard vs optimized economics"
            description="The pair is easy to defend when the baseline and the optimized return are shown side by side."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {economicsCards.map((card) => (
                <MetricCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  detail={card.detail}
                  delta={card.delta}
                  tone={card.tone}
                />
              ))}
            </div>
          </PanelCard>

          <PanelCard
            title="Activation status"
            description="Either click the marketplace button or pick an individual backhaul to mark the pairing as activated."
          >
            <ActionBar
              eyebrow="Marketplace"
              title="Lock the best return load"
              description="A single activation updates the shared mock store and makes the selected backhaul visible everywhere else."
              status={
                selectedBackhaul ? (
                  <StatusPill tone="success">Activated</StatusPill>
                ) : (
                  <StatusPill tone="warning">Awaiting pick</StatusPill>
                )
              }
              primaryAction={
                <button
                  type="button"
                  onClick={activateMarketplace}
                  className="rounded-full bg-[color:var(--color-shell-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  Activate marketplace
                </button>
              }
              feedback={
                selectedBackhaul ? (
                  <span className="inline-flex items-center gap-2">
                    <StatusPill tone="success">{viewModel.activationState}</StatusPill>
                    {selectedBackhaul.lane} is now mirrored through the shared mock store.
                  </span>
                ) : (
                  <span className="text-[color:var(--color-shell-text-muted)]">
                    Pick a corridor below to confirm the activated state.
                  </span>
                )
              }
            />
          </PanelCard>
        </div>

        <div className="space-y-6">
          <PanelCard
            title="Dispatch anchor"
            description="The current outbound assignment gives the backhaul search a concrete trip to pair against."
            action={<StatusPill tone={selectedBackhaul ? "success" : "info"}>{selectedBackhaul ? "Paired" : "Ready"}</StatusPill>}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                label="Driver"
                value={viewModel.activeDriver.name}
                detail={`${viewModel.activeDriver.unit} • ${viewModel.activeDriver.location}`}
                delta={viewModel.activeDriver.availability}
                tone="blue"
              />
              <MetricCard
                label="Current load"
                value={viewModel.assignedLoad?.reference ?? "No load"}
                detail={viewModel.assignedLoad ? `${viewModel.assignedLoad.origin} to ${viewModel.assignedLoad.destination}` : "No load is assigned in the shared store."}
                delta={viewModel.assignedLoad ? "Outbound anchor" : "Standby"}
                tone="teal"
              />
            </div>
          </PanelCard>

          {selectedBackhaul ? (
            <PanelCard
              title="Activated backhaul"
              description="This selection is now mirrored through the shared mock store and can be read by adjacent screens."
              action={<StatusPill tone="success">Activated</StatusPill>}
            >
              <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] p-5">
                <p className="text-sm font-semibold text-[color:var(--color-shell-text)]">{selectedBackhaul.lane}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                  {selectedBackhaul.origin} to {selectedBackhaul.destination} • {selectedBackhaul.pickupWindow}
                </p>
                <p className="mt-3 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                  This lane is now mirrored through the shared mock store.
                </p>
              </div>
            </PanelCard>
          ) : (
            <PanelCard
              title="Selection preview"
              description="The recommendation will move here once a backhaul is activated."
              action={<StatusPill tone="warning">No selection yet</StatusPill>}
            >
              <p className="text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                Use the marketplace action or pick a backhaul from the list to activate the confirmation state.
              </p>
            </PanelCard>
          )}
        </div>
      </div>

      <PanelCard
        title="Available backhauls"
        description="Ranked by corridor fit, deadhead, and margin so the dispatcher can pick with confidence."
        action={<StatusPill tone="info">{viewModel.sortedBackhauls.length} corridors</StatusPill>}
      >
        <div className="space-y-4">
          {viewModel.sortedBackhauls.map((backhaulRecord) => (
            <TripComparisonCard
              key={backhaulRecord.id}
              backhaul={backhaulRecord}
              selected={selectedBackhaul?.id === backhaulRecord.id}
              standard={{
                label: "Standard economics",
                revenue: formatMoney(BASELINE_REVENUE),
                deadheadMiles: formatMiles(BASELINE_EMPTY_MILES),
                margin: formatMoney(BASELINE_MARGIN),
                note: "Outbound freight moves first, but the truck returns without a paying lane.",
              }}
              optimized={{
                label: "Optimized economics",
                revenue: formatMoney(BASELINE_REVENUE + parseMoney(backhaulRecord.revenue)),
                deadheadMiles: formatMiles(backhaulRecord.deadheadMiles),
                margin: formatMoney(BASELINE_MARGIN + parseMoney(backhaulRecord.estimatedMargin)),
                note: "The paired return leg converts the same tractor into a higher-margin round trip.",
              }}
              lift={formatMoney(parseMoney(backhaulRecord.estimatedMargin))}
              onPick={() => activateBackhaul(backhaulRecord)}
            />
          ))}
        </div>
      </PanelCard>
    </div>
  );
}
