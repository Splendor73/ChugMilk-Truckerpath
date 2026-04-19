"use client";

import { useMemo, useState } from "react";

import { backhaul } from "@/lib/mock-data/backhaul";
import { drivers } from "@/lib/mock-data/drivers";
import { loads } from "@/lib/mock-data/loads";
import { monitoring } from "@/lib/mock-data/monitoring";
import { useMockData } from "@/lib/mock-data/store";

import { ActionBar } from "@/components/ui/action-bar";
import { MapCard } from "@/components/ui/map-card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PanelCard } from "@/components/ui/panel-card";
import { StatusPill } from "@/components/ui/status-pill";
import { InterventionPackageCard } from "./intervention-package-card";

function formatHours(hours: number) {
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

export function ProactiveMonitoringScreen() {
  const { assignedDriverId, selectedBackhaulId } = useMockData();
  const [queueReviewed, setQueueReviewed] = useState(false);
  const [planDispatched, setPlanDispatched] = useState(false);

  const viewModel = useMemo(() => {
    const criticalAlert = monitoring.find((item) => item.severity === "Critical") ?? monitoring[0];
    const warningAlerts = monitoring.filter((item) => item.severity === "Warning");
    const watchAlerts = monitoring.filter((item) => item.severity === "Watch");
    const selectedDriver = drivers.find((driver) => driver.id === assignedDriverId) ?? drivers[0];
    const criticalDriver = drivers.find((driver) => driver.id === criticalAlert.driverId) ?? selectedDriver;
    const criticalLoad = loads.find((load) => load.id === criticalAlert.loadId) ?? loads[0];
    const relayDriver =
      drivers.find((driver) => driver.id !== criticalDriver.id && driver.hoursRemaining >= 8) ?? selectedDriver;
    const selectedBackhaul = backhaul.find((item) => item.id === selectedBackhaulId) ?? backhaul[0];
    const readinessHours = selectedDriver.hoursRemaining >= 8 ? "Ready" : "Tight";

    return {
      criticalAlert,
      warningAlerts,
      watchAlerts,
      selectedDriver,
      criticalDriver,
      criticalLoad,
      relayDriver,
      selectedBackhaul,
      readinessHours,
    };
  }, [assignedDriverId, selectedBackhaulId]);

  const interventionSteps = [
    {
      label: "Relay support",
      detail: viewModel.criticalAlert.recommendedAction,
    },
    {
      label: "Driver briefing",
      detail: `${viewModel.criticalDriver.name} gets the deviation summary and next checkpoint before the next weigh station.`,
    },
    {
      label: "Customer update",
      detail: `Keep ${viewModel.criticalAlert.customer} posted if the ETA slip grows beyond ${viewModel.criticalAlert.eta}.`,
    },
  ];

  const supportingStats = [
    {
      label: "ETA risk",
      value: viewModel.criticalAlert.eta,
      detail: "Current slip is large enough to trigger an intervention package.",
    },
    {
      label: "Driver",
      value: viewModel.criticalDriver.name,
      detail: `${viewModel.criticalDriver.unit} • ${viewModel.criticalDriver.availability}`,
    },
    {
      label: "Load",
      value: viewModel.criticalLoad.reference,
      detail: `${viewModel.criticalLoad.origin} to ${viewModel.criticalLoad.destination}`,
    },
    {
      label: "Backhaul watch",
      value: viewModel.selectedBackhaul.lane,
      detail: "The shared mock store keeps the return lane visible while the alert is being handled.",
    },
  ];

  const planStatus = planDispatched ? (
    <StatusPill tone="success">Plan dispatched</StatusPill>
  ) : (
    <StatusPill tone="critical">Urgent action required</StatusPill>
  );

  const dispatchPlan = () => {
    setPlanDispatched(true);
  };

  const reviewQueue = () => {
    setQueueReviewed(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monitoring desk"
        meta={`Shared mock store • ${viewModel.readinessHours} roster`}
        title="Urgent Action Required"
        description="Proactive monitoring has surfaced one critical lane that needs an intervention package before the next commitment window slips, so the desk can stay ahead of the delay instead of reacting to it."
        actions={
          <>
            {planStatus}
            <button
              type="button"
              onClick={reviewQueue}
              className="rounded-full bg-[color:var(--color-shell-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              {queueReviewed ? "Queue reviewed" : "Review queue"}
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-6">
          <PanelCard
            title="Live risk board"
            description="The desk is watching the critical lane and the wider alert queue together so the team can act before the exception turns into a missed appointment."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Critical alerts"
                value="1"
                detail="The lane that needs immediate action is isolated and ready to dispatch."
                delta={planDispatched ? "Handled" : "Active"}
                tone="rose"
              />
              <MetricCard
                label="Warning alerts"
                value={`${viewModel.warningAlerts.length}`}
                detail="Secondary items are watched, but they do not need a call right now."
                delta="Monitored"
                tone="amber"
              />
              <MetricCard
                label="Watch items"
                value={`${viewModel.watchAlerts.length}`}
                detail="Lower priority items stay visible while the critical lane is handled."
                delta="Steady"
                tone="teal"
              />
              <MetricCard
                label="Shift state"
                value={planDispatched ? "Cleared" : "Open"}
                detail="The main action will flip the screen from staging to executed."
                delta={planDispatched ? "Done" : "Waiting"}
                tone="blue"
              />
            </div>

            <div className="mt-5">
              <MapCard
                title="Critical corridor"
                description="The route map anchors the intervention package to the exact lane that is drifting off plan."
                status={viewModel.criticalAlert.severity}
                route={viewModel.criticalAlert.route}
                summary={viewModel.criticalAlert.detail}
                mapId="proactive-critical-corridor"
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
          </PanelCard>

          <PanelCard
            title="Fleet context"
            description="A quick look at the current roster context that surrounds the alert, including the live driver assignment and the backhaul lane we want to protect."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                  Focus driver
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--color-shell-text)]">
                  {viewModel.selectedDriver.name}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                  {viewModel.selectedDriver.unit} • {viewModel.selectedDriver.location}
                </p>
                <p className="mt-3 text-sm font-semibold text-[color:var(--color-shell-text)]">
                  {formatHours(viewModel.selectedDriver.hoursRemaining)} remaining
                </p>
              </div>

              <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                  Intervention load
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--color-shell-text)]">
                  {viewModel.criticalLoad.reference}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                  {viewModel.criticalLoad.origin} to {viewModel.criticalLoad.destination}
                </p>
                <p className="mt-3 text-sm font-semibold text-[color:var(--color-shell-text)]">
                  {viewModel.criticalAlert.status}
                </p>
              </div>

              <div className="rounded-[24px] border border-[color:var(--color-shell-border)] bg-[color:var(--color-shell-surface-muted)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-shell-text-muted)]">
                  Backhaul watch
                </p>
                <p className="mt-3 text-lg font-semibold text-[color:var(--color-shell-text)]">
                  {viewModel.selectedBackhaul.lane}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
                  {viewModel.selectedBackhaul.pickupWindow}
                </p>
                <p className="mt-3 text-sm font-semibold text-[color:var(--color-shell-text)]">
                  {viewModel.selectedBackhaul.status}
                </p>
              </div>
            </div>
          </PanelCard>
        </div>

        <div className="space-y-6">
          <InterventionPackageCard
            eyebrow="Intervention package"
            title="Intervention Package"
            description="Bundle the relay, driver, and customer actions into one clear execution package so the dispatcher can move once and keep the day on track."
            status={planStatus}
            summaryLabel="Package summary"
            summary={`The current exception is ${viewModel.criticalAlert.title.toLowerCase()} on ${viewModel.criticalAlert.route}. The shared mock store keeps the critical load, driver, and backhaul visible so the response stays coordinated.`}
            supportingStats={supportingStats}
            steps={interventionSteps}
          />

          <ActionBar
            eyebrow="Execute plan"
            title="Dispatch the intervention sequence"
            description="Confirm the package, notify the team, and flip the workflow into a success state once the plan is out the door."
            status={planStatus}
            primaryAction={
              <button
                type="button"
                onClick={dispatchPlan}
                className="rounded-full bg-[color:var(--color-shell-brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Execute Plan
              </button>
            }
            feedback={
              planDispatched ? (
                <span>
                  Plan dispatched. Relay support, driver coaching, and customer outreach are now queued.
                </span>
              ) : (
                <span>Waiting for approval to send the intervention package.</span>
              )
            }
          />

          <PanelCard
            title="Customer Comms"
            description="Draft the update the customer team can send as soon as the intervention package is approved."
          >
            <div className="space-y-3 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
              <p>
                {viewModel.criticalAlert.customer} should hear that the team has isolated the exception on{" "}
                {viewModel.criticalLoad.reference} and already has a recovery package in motion.
              </p>
              <p>
                The outbound lane remains visible alongside the watched backhaul so the service note can mention both
                the current ETA risk and the protected recovery plan.
              </p>
            </div>
          </PanelCard>

          <PanelCard
            title="Relay Recommendation"
            description="The best nearby support option stays visible so the dispatcher can turn the package into a concrete handoff."
          >
            <div className="space-y-3 text-sm leading-6 text-[color:var(--color-shell-text-muted)]">
              <p>
                {viewModel.relayDriver.name} is the strongest relay candidate because they have{" "}
                {formatHours(viewModel.relayDriver.hoursRemaining)} available and can absorb the final leg if the ETA
                slip worsens.
              </p>
              <p>
                Pairing the relay option with {viewModel.selectedBackhaul.lane} keeps both the service recovery and the
                downstream plan aligned.
              </p>
            </div>
          </PanelCard>
        </div>
      </div>
    </div>
  );
}
