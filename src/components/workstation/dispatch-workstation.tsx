"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import {
  routeDeskStatusOptions,
  type AgentStreamEvent,
  type BackhaulOption,
  type Driver,
  type DriverScore,
  type FleetAssignmentResponse,
  type FleetSnapshotResponse,
  type Load,
  type MonitorDraftView,
  type MonitorFeedResponse,
  type RouteDeskCreateRequest,
  type RouteDeskItem,
  type RouteDeskResponse,
  type RouteDeskUpdateRequest,
  type TripStatus
} from "@/shared/contracts";
import {
  buildWorkstationHref,
  normalizeWorkstationStage,
  workstationStageLabels,
  type WorkstationDeskPanel,
  type WorkstationStage
} from "@/lib/navigation/workstation";
import {
  InteractiveDispatchMap,
  type DispatchMapHandle
} from "@/components/workstation/interactive-dispatch-map";
import { buildMapPresentationModel } from "@/components/workstation/map-presentation";
import { clamp, haversineMiles } from "@/shared/utils/geo";

type DispatchWorkstationProps = {
  initialStage?: WorkstationStage;
  initialOperatorMode?: boolean;
  initialDeskPanel?: WorkstationDeskPanel | null;
};

type AgentFinalPayload = Extract<AgentStreamEvent, { type: "final" }>["payload"];
type DriverDeskFilter = "all" | "ready" | "active" | "rest" | "flagged";
type DeskPanelView = "drivers" | "routes";
type TopBarNavItem = WorkstationStage | DeskPanelView;
type DispatchConfirmation =
  | { mode: "outbound" }
  | { mode: "round_trip"; returnLoadId: string };

const PANEL_WIDTH_STORAGE_KEY = "co-dispatch-panel-width";
const DEFAULT_PANEL_WIDTH = 620;
const DEFAULT_PANEL_RATIO = 1 / 3;
const MIN_PANEL_WIDTH = 520;
const MAX_PANEL_WIDTH = 920;

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatHours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

// Translate a backhaul HOS buffer (driver minutes - required minutes) into a
// chip describing how the round-trip lines up against drive-time rules.
// Buffer >= 60 min: comfortable cushion, render as a green "fits HOS" chip.
// 0..60 min:        legal but tight, render amber so dispatch can warn driver.
// negative:         over the clock, render red with the deficit.
type HosFitChip = { label: string; tone: string };
function hosFitChip(option: { hosFeasible: boolean; hosBufferMin: number }): HosFitChip {
  if (!option.hosFeasible) {
    return {
      label: `HOS short ${formatHours(Math.abs(option.hosBufferMin))}`,
      tone: "bg-[#FCE8E8] text-[#A33939]"
    };
  }
  if (option.hosBufferMin < 60) {
    return {
      label: `HOS tight • ${formatHours(option.hosBufferMin)} cushion`,
      tone: "bg-[#FFF3D7] text-[#996B00]"
    };
  }
  return {
    label: `HOS fits • ${formatHours(option.hosBufferMin)} cushion`,
    tone: "bg-[#E6F6EE] text-[#0E8A5B]"
  };
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

async function readResponseError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? fallback;
  } catch {
    return fallback;
  }
}

function shouldAutoResetDemoOnPageLoad() {
  return process.env.NEXT_PUBLIC_AUTO_RESET_DEMO_ON_PAGE_LOAD === "true";
}

function getDriverDeskStatus(driver: Driver) {
  if (driver.hosStatus === "must_rest") {
    return {
      label: "Rest now",
      detail: `Reset in ${formatHours(driver.hosRemainingMin)}`,
      tone: "bg-[#FCE8E8] text-[#A33939]"
    };
  }

  if (driver.activeTripId) {
    return {
      label: "In transit",
      detail: `Trip ${driver.activeTripId}`,
      tone: "bg-[#E7F0FF] text-[#214CBA]"
    };
  }

  if (driver.complianceFlags.length > 0) {
    return {
      label: "Flagged",
      detail: `${driver.complianceFlags.length} compliance item${driver.complianceFlags.length === 1 ? "" : "s"}`,
      tone: "bg-[#FFF3D7] text-[#996B00]"
    };
  }

  if (driver.hosStatus === "low") {
    return {
      label: "Tight HOS",
      detail: `${formatHours(driver.hosRemainingMin)} left`,
      tone: "bg-[#FFF3D7] text-[#996B00]"
    };
  }

  return {
    label: "Ready",
    detail: `${formatHours(driver.hosRemainingMin)} left`,
    tone: "bg-[#E6F6EE] text-[#0E8A5B]"
  };
}

function toLocalDateTimeInputValue(ms: number) {
  if (!Number.isFinite(ms)) {
    return "";
  }
  const date = new Date(ms);
  const offsetMs = date.getTime() - date.getTimezoneOffset() * 60000;
  return new Date(offsetMs).toISOString().slice(0, 16);
}

function parseLocalDateTimeInputValue(value: string) {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

const routeDeskFilterOptions: ReadonlyArray<{ key: "all" | TripStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "on_track", label: "On track" },
  { key: "route_deviation", label: "Deviation" },
  { key: "long_idle", label: "Long idle" },
  { key: "hos_risk", label: "HOS risk" },
  { key: "eta_slip", label: "ETA slip" }
];

function getRouteStatusTone(status: RouteDeskItem["status"]) {
  switch (status) {
    case "route_deviation":
      return "bg-[#FFF3D7] text-[#996B00]";
    case "long_idle":
      return "bg-[#FFE4DA] text-[#A9441F]";
    case "hos_risk":
      return "bg-[#FCE8E8] text-[#A33939]";
    case "eta_slip":
      return "bg-[#F7E8FF] text-[#7A3DB8]";
    default:
      return "bg-[#E6F6EE] text-[#0E8A5B]";
  }
}

function matchesDriverDeskFilter(driver: Driver, filter: DriverDeskFilter) {
  switch (filter) {
    case "ready":
      return driver.hosStatus === "fresh" && !driver.activeTripId;
    case "active":
      return Boolean(driver.activeTripId);
    case "rest":
      return driver.hosStatus === "must_rest" || driver.hosStatus === "low";
    case "flagged":
      return driver.complianceFlags.length > 0;
    default:
      return true;
  }
}

function formatPerformanceDelta(actual: number, scheduled: number) {
  const delta = actual - scheduled;
  if (delta === 0) {
    return "On plan";
  }

  return `${delta > 0 ? "+" : ""}${formatNumber(delta)} mi`;
}

function formatRemainingDuration(etaMs: number, nowMs: number) {
  const deltaMin = Math.round((etaMs - nowMs) / 60000);
  if (Number.isNaN(deltaMin)) {
    return "ETA unavailable";
  }

  if (deltaMin <= 0) {
    const overdue = Math.abs(deltaMin);
    if (overdue < 60) {
      return `Overdue ${overdue}m`;
    }
    const overdueHours = Math.floor(overdue / 60);
    const overdueMinutes = overdue % 60;
    return `Overdue ${overdueHours}h ${overdueMinutes}m`;
  }

  if (deltaMin < 60) {
    return `${deltaMin}m to arrive`;
  }

  const hours = Math.floor(deltaMin / 60);
  const minutes = deltaMin % 60;
  return `${hours}h ${minutes}m to arrive`;
}

function getTripStatusBadge(status: TripStatus) {
  switch (status) {
    case "route_deviation":
      return { label: "Route deviation", tone: "bg-[#FFF3D7] text-[#996B00]" };
    case "long_idle":
      return { label: "Long idle", tone: "bg-[#FFE4DA] text-[#A9441F]" };
    case "hos_risk":
      return { label: "HOS risk", tone: "bg-[#FCE8E8] text-[#A33939]" };
    case "eta_slip":
      return { label: "ETA slip", tone: "bg-[#F7E8FF] text-[#7A3DB8]" };
    default:
      return { label: "On track", tone: "bg-[#E6F6EE] text-[#0E8A5B]" };
  }
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function cleanVoiceScriptForDisplay(script: string) {
  return script.replace(/\s*Say ['"].+?['"] to approve\.?$/i, "").trim();
}

const driverDeskFilters: Array<{ key: DriverDeskFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "active", label: "Active" },
  { key: "rest", label: "Rest" },
  { key: "flagged", label: "Flagged" }
];

async function readAgentStream(request: string) {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userMessage: request })
  });

  if (!response.ok || !response.body) {
    const message = await response.text();
    throw new Error(message || "Agent request failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary = "";
  let finalPayload: AgentFinalPayload | null = null;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part
        .split("\n")
        .find((entry) => entry.startsWith("data: "));
      if (!line) {
        continue;
      }
      const event = JSON.parse(line.slice(6)) as AgentStreamEvent;
      if (event.type === "token") {
        summary += event.payload.text;
      }
      if (event.type === "final") {
        finalPayload = event.payload;
      }
      if (event.type === "error") {
        throw new Error(event.payload.message);
      }
    }
  }

  return {
    summary: summary.trim(),
    finalPayload
  };
}

function Glyph({
  name,
  className = "",
  active = false
}: {
  name:
    | "dashboard"
    | "map"
    | "truck"
    | "drivers"
    | "analytics"
    | "help"
    | "logout"
    | "bell"
    | "settings"
    | "spark"
    | "warning"
    | "voice"
    | "relay"
    | "route";
  className?: string;
  active?: boolean;
}) {
  const stroke = active ? "currentColor" : "currentColor";

  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === "map") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20z" />
        <path d="M9 4v13.5M15 6.5V20" />
      </svg>
    );
  }

  if (name === "truck") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M3 7h11v8H3z" />
        <path d="M14 10h3.8L21 13v2h-7z" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    );
  }

  if (name === "drivers") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-3.2 3.2-5 7-5s6.2 1.8 7 5" />
      </svg>
    );
  }

  if (name === "analytics") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M5 19V9M12 19V5M19 19v-8" />
        <path d="M3 19h18" />
      </svg>
    );
  }

  if (name === "help") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2.1-2.5 4" />
        <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "logout") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M10 5H5v14h5" />
        <path d="M14 8l5 4-5 4" />
        <path d="M19 12H9" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M7 10a5 5 0 1 1 10 0v4l1.5 2H5.5L7 14z" />
        <path d="M10 18a2 2 0 0 0 4 0" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
      </svg>
    );
  }

  if (name === "spark") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      </svg>
    );
  }

  if (name === "warning") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M12 4 3.5 19h17z" />
        <path d="M12 9v4" />
        <circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "voice") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <rect x="9" y="4" width="6" height="10" rx="3" />
        <path d="M6.5 11.5a5.5 5.5 0 1 0 11 0M12 17v3M9 20h6" />
      </svg>
    );
  }

  if (name === "relay") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <path d="M7 7h10v10H7z" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
      <path d="M4 18c4-6 8-8 16-12" />
      <path d="m10 8 2-4 2 4" />
      <path d="m16 18 4-2-2-4" />
    </svg>
  );
}

function Avatar({
  name,
  tone = "blue"
}: {
  name: string;
  tone?: "blue" | "teal" | "violet" | "amber";
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    blue: "bg-[#DCE1FF] text-[#214CBA]",
    teal: "bg-[#CFE5FF] text-[#00598F]",
    violet: "bg-[#E8EAFF] text-[#485CC7]",
    amber: "bg-[#FFF0CF] text-[#8A5A00]"
  };

  return <div className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${toneClasses[tone]}`}>{initials}</div>;
}

type CandidateMetricKey = "deadhead" | "hos" | "fuel" | "eta" | "ripple";

export function DispatchWorkstation({
  initialStage = "morning_triage",
  initialOperatorMode = false,
  initialDeskPanel = null
}: DispatchWorkstationProps) {
  const [activeStage, setActiveStage] = useState<WorkstationStage>(
    initialDeskPanel ? "morning_triage" : normalizeWorkstationStage(initialStage)
  );
  const [operatorMode] = useState(initialOperatorMode);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [viewportWidth, setViewportWidth] = useState(1600);
  const [snapshot, setSnapshot] = useState<FleetSnapshotResponse | null>(null);
  const [monitorFeed, setMonitorFeed] = useState<MonitorFeedResponse | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [pasteInput, setPasteInput] = useState("");
  const [copilotSummary, setCopilotSummary] = useState("");
  const [parsedLoad, setParsedLoad] = useState<Load | null>(null);
  const [scores, setScores] = useState<DriverScore[]>([]);
  const [backhauls, setBackhauls] = useState<BackhaulOption[]>([]);
  const [backhaulDriverId, setBackhaulDriverId] = useState<number | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedDeskDriverId, setSelectedDeskDriverId] = useState<number | null>(null);
  const [selectedReturnLoadId, setSelectedReturnLoadId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isOpeningBackhaul, setIsOpeningBackhaul] = useState(false);
  const [isTriggeringMonitor, setIsTriggeringMonitor] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [backhaulOpen, setBackhaulOpen] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<string | null>(null);
  const [isOperatorRunning, setIsOperatorRunning] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState<CandidateMetricKey>("deadhead");
  const [driverDeskFilter, setDriverDeskFilter] = useState<DriverDeskFilter>("all");
  const [deskPanelView, setDeskPanelView] = useState<DeskPanelView>(initialDeskPanel ?? "drivers");
  const [activeTopBarNav, setActiveTopBarNav] = useState<TopBarNavItem>(
    initialDeskPanel ?? normalizeWorkstationStage(initialStage)
  );
  const [routeDesk, setRouteDesk] = useState<RouteDeskResponse | null>(null);
  const [routeDeskError, setRouteDeskError] = useState<string | null>(null);
  const [routeDeskMessage, setRouteDeskMessage] = useState<string | null>(null);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [deletingRouteTripId, setDeletingRouteTripId] = useState<string | null>(null);
  const [updatingTripField, setUpdatingTripField] = useState<"status" | "eta" | "currentLoc" | "driver" | null>(null);
  const [selectedRouteTripId, setSelectedRouteTripId] = useState<string | null>(null);
  const [routeDeskFilter, setRouteDeskFilter] = useState<"all" | TripStatus>("all");
  const [routeDeskSearch, setRouteDeskSearch] = useState("");
  const [isCreateRouteModalOpen, setIsCreateRouteModalOpen] = useState(false);
  const [routeEtaDraft, setRouteEtaDraft] = useState("");
  const [routeLatDraft, setRouteLatDraft] = useState("");
  const [routeLngDraft, setRouteLngDraft] = useState("");
  const [routeDriverDraft, setRouteDriverDraft] = useState("");
  const [routeCreateForm, setRouteCreateForm] = useState<{
    driverId: string;
    loadId: string;
    status: NonNullable<RouteDeskCreateRequest["status"]>;
  }>({
    driverId: "",
    loadId: "",
    status: "on_track"
  });
  const [pendingDispatchConfirmation, setPendingDispatchConfirmation] = useState<DispatchConfirmation | null>(null);
  const [selectedAlertDraftId, setSelectedAlertDraftId] = useState<string | null>(null);
  const [isAlertPopupMinimized, setIsAlertPopupMinimized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mapRef = useRef<DispatchMapHandle | null>(null);
  const panelResizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const leftPanelRef = useRef<HTMLElement | null>(null);

  // When the dispatcher taps a collapsed row (driver or route) the newly
  // selected detail card swaps in at the top of the left panel. Without this
  // scroll nudge the panel stays parked down in the list, forcing a manual
  // scroll to actually see the info they just opened.
  function scrollLeftPanelToTop() {
    const node = leftPanelRef.current;
    if (!node) return;
    if (typeof node.scrollTo === "function") {
      node.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      node.scrollTop = 0;
    }
  }

  useEffect(() => {
    const panelForUrl: WorkstationDeskPanel | null =
      activeTopBarNav === "drivers" || activeTopBarNav === "routes" ? activeTopBarNav : null;
    const nextHref = buildWorkstationHref(activeStage, operatorMode, panelForUrl);
    window.history.replaceState({}, "", nextHref);
  }, [activeStage, operatorMode, activeTopBarNav]);

  useEffect(() => {
    if (activeTopBarNav === "drivers" || activeTopBarNav === "routes") {
      if (activeStage !== "morning_triage") {
        setActiveTopBarNav(activeStage);
      }
      return;
    }

    if (activeTopBarNav !== activeStage) {
      setActiveTopBarNav(activeStage);
    }
  }, [activeStage, activeTopBarNav]);

  function handleTopBarStageChange(stage: WorkstationStage) {
    setActiveTopBarNav(stage);
    setActiveStage(stage);
    if (stage === "morning_triage") {
      setDeskPanelView("drivers");
      setSelectedRouteTripId(null);
      setIsCreateRouteModalOpen(false);
    }
  }

  function handleTopBarDeskPanelChange(panel: DeskPanelView) {
    setActiveStage("morning_triage");
    setDeskPanelView(panel);
    setActiveTopBarNav(panel);
  }

  useEffect(() => {
    function syncViewportWidth() {
      setViewportWidth(window.innerWidth);
    }

    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);

    return () => {
      window.removeEventListener("resize", syncViewportWidth);
    };
  }, []);

  useEffect(() => {
    const availableWidth = Math.max(viewportWidth, 900);
    const savedWidth = window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (!savedWidth) {
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.round(availableWidth * DEFAULT_PANEL_RATIO))));
      return;
    }

    const numericWidth = Number(savedWidth);
    if (Number.isFinite(numericWidth)) {
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, numericWidth)));
    }
  }, [viewportWidth]);

  useEffect(() => {
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const start = panelResizeStartRef.current;
      if (!start) {
        return;
      }

      const nextWidth = start.width + (event.clientX - start.x);
      setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, nextWidth)));
    }

    function handlePointerUp() {
      panelResizeStartRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  async function loadSnapshot(showRefresh = false) {
    try {
      if (showRefresh) {
        setIsRefreshing(true);
      }
      const response = await fetch("/api/fleet/snapshot", { cache: "no-store" });
      const payload = (await response.json()) as FleetSnapshotResponse;
      setSnapshot(payload);
      setSnapshotError(null);
    } catch (error) {
      setSnapshotError(error instanceof Error ? error.message : "Unable to load fleet snapshot.");
    } finally {
      if (showRefresh) {
        setIsRefreshing(false);
      }
    }
  }

  async function loadMonitorFeed() {
    try {
      const response = await fetch("/api/monitor/feed", { cache: "no-store" });
      const payload = (await response.json()) as MonitorFeedResponse;
      setMonitorFeed(payload);
      setMonitorError(null);
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : "Unable to load monitoring feed.");
    }
  }

  async function loadRouteDesk() {
    try {
      const response = await fetch("/api/routes", { cache: "no-store" });
      const payload = (await response.json()) as RouteDeskResponse;
      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? "Unable to load routes.");
      }
      setRouteDesk(payload);
      setRouteDeskError(null);
    } catch (error) {
      setRouteDeskError(error instanceof Error ? error.message : "Unable to load routes.");
    }
  }

  async function refreshAll(showRefresh = false) {
    await Promise.all([loadSnapshot(showRefresh), loadMonitorFeed(), loadRouteDesk()]);
  }

  // Shared hosted environments use one database for every browser session, so
  // auto-reset must stay opt-in. Otherwise one page load can invalidate the
  // live alert ids another user is still acting on.
  useEffect(() => {
    void (async () => {
      if (shouldAutoResetDemoOnPageLoad()) {
        try {
          await fetch("/api/dev/simulate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset" })
          });
        } catch {
          // A failed reset shouldn't block the rest of the UI from loading.
        }
      }
      await refreshAll();
    })();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          await fetch("/api/monitor/tick", { method: "POST" });
        } catch {
          return;
        }
        await loadMonitorFeed();
      })();
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const selectedScore =
    scores.find((score) => score.driverId === selectedDriverId) ??
    scores.find((score) => !score.eliminated) ??
    scores[0] ??
    null;
  const selectedBackhaul =
    backhauls.find((option) => option.returnLoad.loadId === selectedReturnLoadId) ?? backhauls[0] ?? null;

  const driverById = useMemo(() => {
    return new Map((snapshot?.drivers ?? []).map((driver) => [driver.driverId, driver]));
  }, [snapshot]);

  const driverDeskRows = useMemo(() => {
    return (snapshot?.drivers ?? []).filter((driver) => matchesDriverDeskFilter(driver, driverDeskFilter));
  }, [driverDeskFilter, snapshot]);

  const selectedDeskDriver =
    driverDeskRows.find((driver) => driver.driverId === selectedDeskDriverId) ??
    driverById.get(selectedDeskDriverId ?? -1) ??
    driverDeskRows[0] ??
    snapshot?.drivers?.[0] ??
    null;
  const visibleDriverDeskRows = driverDeskRows.filter((driver) => driver.driverId !== selectedDeskDriver?.driverId);

  const selectedDeskDriverTrip = useMemo(() => {
    if (!selectedDeskDriver?.activeTripId || !snapshot) {
      return null;
    }
    return (
      snapshot.activeTrips.find((trip) => trip.tripId === selectedDeskDriver.activeTripId) ??
      snapshot.activeTrips.find((trip) => trip.driverId === selectedDeskDriver.driverId) ??
      null
    );
  }, [selectedDeskDriver, snapshot]);

  const routeDeskRows = useMemo(() => {
    return (routeDesk?.routes ?? []).map((route) => ({
      ...route,
      driverName: driverById.get(route.driverId)?.name ?? `Driver ${route.driverId}`
    }));
  }, [driverById, routeDesk]);

  const routeStatusSeverity: Record<TripStatus, number> = {
    hos_risk: 0,
    long_idle: 1,
    route_deviation: 2,
    eta_slip: 3,
    on_track: 4
  };

  const filteredRouteDeskRows = useMemo(() => {
    const search = routeDeskSearch.trim().toLowerCase();
    return routeDeskRows
      .filter((route) => routeDeskFilter === "all" || route.status === routeDeskFilter)
      .filter((route) => {
        if (!search) {
          return true;
        }
        const haystack = [
          route.tripId,
          route.driverName,
          route.loadId,
          route.customer,
          route.routeContext,
          route.origin?.city,
          route.destination?.city
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
      .sort((left, right) => {
        const severity = routeStatusSeverity[left.status] - routeStatusSeverity[right.status];
        if (severity !== 0) {
          return severity;
        }
        return left.etaMs - right.etaMs;
      });
  }, [routeDeskRows, routeDeskFilter, routeDeskSearch, routeStatusSeverity]);

  const selectedRouteTrip =
    routeDeskRows.find((route) => route.tripId === selectedRouteTripId) ?? routeDeskRows[0] ?? null;
  const selectedRouteDriver = selectedRouteTrip ? driverById.get(selectedRouteTrip.driverId) ?? null : null;

  const selectedRouteLoad =
    snapshot?.pendingLoads?.find((load) => load.loadId === routeCreateForm.loadId) ?? null;

  const visibleDrafts = useMemo(() => {
    return monitorFeed?.drafts ?? [];
  }, [monitorFeed]);

  const openDraft =
    visibleDrafts.find((draft) => draft.id === selectedAlertDraftId) ??
    visibleDrafts[0] ??
    null;

  const activeTrip = useMemo(() => {
    if (!snapshot) {
      return null;
    }
    if (openDraft) {
      return snapshot.activeTrips?.find((trip) => trip.tripId === openDraft.tripId) ?? null;
    }
    return snapshot.activeTrips?.find((trip) => trip.status !== "on_track") ?? snapshot.activeTrips?.[0] ?? null;
  }, [openDraft, snapshot]);

  const restRiskDrivers = (snapshot?.drivers ?? [])
    .filter((driver) => driver.hosRemainingMin < 120);

  const complianceItems = (snapshot?.drivers ?? [])
    .flatMap((driver) =>
      driver.complianceFlags.map((flag) => ({
        driver,
        flag
      }))
    );

  const maintenanceTrips = (snapshot?.activeTrips ?? [])
    .filter((trip) => trip.status === "long_idle");

  const priorityQueueRows = useMemo(() => {
    return [
      ...complianceItems.map(({ driver, flag }) => ({
        type: "compliance" as const,
        key: `${driver.driverId}-${flag.kind}`,
        driver,
        flag
      })),
      ...restRiskDrivers.map((driver) => ({
        type: "rest" as const,
        key: `rest-${driver.driverId}`,
        driver
      })),
      ...maintenanceTrips.map((trip) => ({
        type: "maintenance" as const,
        key: `maintenance-${trip.tripId}`,
        trip,
        driver: driverById.get(trip.driverId) ?? null
      }))
    ];
  }, [complianceItems, driverById, maintenanceTrips, restRiskDrivers]);

  const monitoringRows = monitorFeed?.decisionLog?.slice(0, 6) ?? [];

  useEffect(() => {
    if (driverDeskRows.length === 0) {
      if (selectedDeskDriverId !== null) {
        setSelectedDeskDriverId(null);
      }
      return;
    }

    if (!selectedDeskDriverId || !driverDeskRows.some((driver) => driver.driverId === selectedDeskDriverId)) {
      setSelectedDeskDriverId(driverDeskRows[0].driverId);
    }
  }, [driverDeskRows, selectedDeskDriverId]);

  useEffect(() => {
    if (visibleDrafts.length === 0) {
      setSelectedAlertDraftId(null);
      setIsAlertPopupMinimized(false);
      return;
    }

    if (!selectedAlertDraftId || !visibleDrafts.some((draft) => draft.id === selectedAlertDraftId)) {
      setSelectedAlertDraftId(visibleDrafts[0].id);
    }
  }, [selectedAlertDraftId, visibleDrafts]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const firstDriver = snapshot.drivers?.[0];
    const firstPendingLoad = snapshot.pendingLoads?.[0];

    setRouteCreateForm((current) => ({
      driverId: current.driverId || String(firstDriver?.driverId ?? ""),
      loadId: current.loadId || String(firstPendingLoad?.loadId ?? ""),
      status: current.status
    }));
  }, [snapshot]);

  useEffect(() => {
    const routes = routeDesk?.routes ?? [];
    if (routes.length === 0) {
      if (selectedRouteTripId !== null) {
        setSelectedRouteTripId(null);
      }
      return;
    }

    if (!selectedRouteTripId || !routes.some((trip) => trip.tripId === selectedRouteTripId)) {
      setSelectedRouteTripId(routes[0].tripId);
    }
  }, [routeDesk, selectedRouteTripId]);

  useEffect(() => {
    const trip = (routeDesk?.routes ?? []).find((row) => row.tripId === selectedRouteTripId) ?? null;
    if (!trip) {
      setRouteEtaDraft("");
      setRouteLatDraft("");
      setRouteLngDraft("");
      setRouteDriverDraft("");
      return;
    }

    setRouteEtaDraft(toLocalDateTimeInputValue(trip.etaMs));
    setRouteLatDraft(trip.currentLoc.lat.toFixed(4));
    setRouteLngDraft(trip.currentLoc.lng.toFixed(4));
    setRouteDriverDraft(String(trip.driverId));
  }, [routeDesk, selectedRouteTripId]);

  async function handleCreateRoute() {
    if (!routeCreateForm.driverId || !routeCreateForm.loadId) {
      setRouteDeskMessage("Pick a driver and a load before creating a route.");
      return;
    }

    setIsSavingRoute(true);
    setRouteDeskMessage(null);

    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: Number(routeCreateForm.driverId),
          loadId: routeCreateForm.loadId,
          status: routeCreateForm.status
        } satisfies RouteDeskCreateRequest)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? "Unable to create route.");
      }

      const created = payload as RouteDeskItem;
      setRouteDeskMessage(`Route ${created.tripId} created and saved.`);
      setIsCreateRouteModalOpen(false);
      setSelectedRouteTripId(created.tripId);
      await refreshAll(true);
    } catch (error) {
      setRouteDeskMessage(error instanceof Error ? error.message : "Unable to create route.");
    } finally {
      setIsSavingRoute(false);
    }
  }

  async function handleDeleteRoute(tripId: string) {
    setDeletingRouteTripId(tripId);
    setRouteDeskMessage(null);

    try {
      const response = await fetch(`/api/routes/${encodeURIComponent(tripId)}`, {
        method: "DELETE"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? "Unable to delete route.");
      }

      setRouteDeskMessage(`Route ${tripId} removed from the database.`);
      if (selectedRouteTripId === tripId) {
        setSelectedRouteTripId(null);
      }
      await refreshAll(true);
    } catch (error) {
      setRouteDeskMessage(error instanceof Error ? error.message : "Unable to delete route.");
    } finally {
      setDeletingRouteTripId(null);
    }
  }

  async function handleUpdateRoute(
    tripId: string,
    field: "status" | "eta" | "currentLoc" | "driver",
    body: RouteDeskUpdateRequest
  ) {
    setUpdatingTripField(field);
    setRouteDeskMessage(null);

    try {
      const response = await fetch(`/api/routes/${encodeURIComponent(tripId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? "Unable to update route.");
      }

      const updatedTrip = payload as RouteDeskItem;
      setRouteDesk((current) => {
        if (!current) {
          return current;
        }
        const next = current.routes.map((trip) => (trip.tripId === updatedTrip.tripId ? updatedTrip : trip));
        return { ...current, routes: next };
      });
      setRouteDeskMessage(`Trip ${tripId} updated and saved to DB.`);
      await loadSnapshot(false);
    } catch (error) {
      setRouteDeskMessage(error instanceof Error ? error.message : "Unable to update route.");
    } finally {
      setUpdatingTripField(null);
    }
  }

  async function handleAnalyzeLoad() {
    setIsAnalyzing(true);
    setAssignmentFeedback(null);
    setPendingDispatchConfirmation(null);
    setBackhaulOpen(false);
    try {
      const result = await readAgentStream(pasteInput);
      setCopilotSummary(result.finalPayload?.text ?? result.summary);
      setParsedLoad(result.finalPayload?.parsedLoad ?? null);
      setScores(result.finalPayload?.scores ?? []);
      setBackhauls(result.finalPayload?.backhauls ?? []);
      const topScore =
        result.finalPayload?.scores?.find((score) => !score.eliminated) ?? result.finalPayload?.scores?.[0] ?? null;
      setSelectedDriverId(topScore?.driverId ?? null);
      setBackhaulDriverId(topScore?.driverId ?? null);
      const topBackhaul = result.finalPayload?.backhauls?.[0] ?? null;
      setSelectedReturnLoadId(topBackhaul?.returnLoad.loadId ?? null);
      setActiveStage("load_assignment");
    } catch (error) {
      setCopilotSummary("");
      setParsedLoad(null);
      setScores([]);
      setBackhauls([]);
      setBackhaulDriverId(null);
      setSelectedDriverId(null);
      setSelectedReturnLoadId(null);
      setAssignmentFeedback(error instanceof Error ? error.message : "Load analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleOpenBackhaul() {
    if (!parsedLoad || !selectedScore) {
      return;
    }

    setIsOpeningBackhaul(true);
    setPendingDispatchConfirmation(null);
    try {
      if (backhauls.length === 0 || backhaulDriverId !== selectedScore.driverId) {
        const response = await fetch("/api/agent/backhaul", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            outboundLoadId: parsedLoad.loadId,
            outboundLoad: parsedLoad,
            driverId: selectedScore.driverId
          })
        });
        const payload = (await response.json()) as BackhaulOption[];
        setBackhauls(payload);
        setBackhaulDriverId(selectedScore.driverId);
        setSelectedReturnLoadId(payload[0]?.returnLoad.loadId ?? null);
      }

      setBackhaulOpen(true);
      setActiveStage("backhaul_review");
      setAssignmentFeedback(`Backhaul review ready for ${selectedScore.driverName}. Confirm the pairing before assigning.`);
    } catch (error) {
      setAssignmentFeedback(error instanceof Error ? error.message : "Backhaul lookup failed.");
    } finally {
      setIsOpeningBackhaul(false);
    }
  }

  async function handleDispatch(returnLoadId?: string) {
    if (!parsedLoad || !selectedScore) {
      return;
    }

    setIsDispatching(true);
    try {
      const response = await fetch("/api/fleet/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: selectedScore.driverId,
          loadId: parsedLoad.loadId,
          load: parsedLoad,
          ...(returnLoadId ? { returnLoadId } : {})
        })
      });
      const payload = (await response.json()) as FleetAssignmentResponse;
      setAssignmentFeedback(
        returnLoadId
          ? `Round trip dispatched. Outbound ${payload.tripId}${payload.returnTripId ? ` and return ${payload.returnTripId}` : ""}.`
          : `Outbound trip ${payload.tripId} dispatched.`
      );
      setPendingDispatchConfirmation(null);
      setBackhaulOpen(false);
      setActiveStage("trip_monitoring");
      await refreshAll(true);
    } catch (error) {
      setAssignmentFeedback(error instanceof Error ? error.message : "Dispatch failed.");
    } finally {
      setIsDispatching(false);
    }
  }

  function queueDispatchConfirmation(mode: DispatchConfirmation["mode"], returnLoadId?: string) {
    if (mode === "round_trip") {
      const resolvedReturnLoadId = returnLoadId ?? selectedBackhaul?.returnLoad.loadId;
      if (!resolvedReturnLoadId) {
        return;
      }

      setPendingDispatchConfirmation({ mode, returnLoadId: resolvedReturnLoadId });
      return;
    }

    setPendingDispatchConfirmation({ mode });
  }

  async function handleConfirmDispatch() {
    if (!pendingDispatchConfirmation) {
      return;
    }

    await handleDispatch(
      pendingDispatchConfirmation.mode === "round_trip" ? pendingDispatchConfirmation.returnLoadId : undefined
    );
  }

  async function handleTriggerMonitoring() {
    setIsTriggeringMonitor(true);
    try {
      await fetch("/api/monitor/tick", { method: "POST" });
      await loadMonitorFeed();
      setActiveStage("trip_monitoring");
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : "Monitoring refresh failed.");
    } finally {
      setIsTriggeringMonitor(false);
    }
  }

  async function handlePlayVoice(draft: MonitorDraftView) {
    try {
      setAudioStatus("Preparing voice alert...");
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.voiceScript, draftId: draft.id })
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Voice playback failed."));
      }
      const source = response.headers.get("X-Audio-Source") ?? "fallback";
      const blob = await response.blob();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setAudioStatus(`Voice alert played from ${source}.`);
      };
      await audio.play();
      await loadMonitorFeed();
      setAudioStatus(`Voice alert playing from ${source}...`);
    } catch (error) {
      setAudioStatus(error instanceof Error ? error.message : "Voice playback failed.");
    }
  }

  async function handleExecuteIntervention(draftId: string) {
    setIsExecuting(true);
    try {
      const response = await fetch("/api/monitor/interventions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          matchedCommand: "execute"
        })
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Execution failed."));
      }
      await refreshAll(true);
      setAssignmentFeedback("Intervention executed, trip recovered, and decision log updated.");
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : "Execution failed.");
    } finally {
      setIsExecuting(false);
    }
  }

  async function runOperatorAction(body: Record<string, unknown>, nextStage?: WorkstationStage) {
    setIsOperatorRunning(true);
    try {
      await fetch("/api/dev/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (body.action === "reset") {
        setParsedLoad(null);
        setScores([]);
        setBackhauls([]);
        setBackhaulDriverId(null);
        setSelectedDriverId(null);
        setSelectedDeskDriverId(null);
        setSelectedReturnLoadId(null);
        setBackhaulOpen(false);
        setPendingDispatchConfirmation(null);
      }

      if (nextStage) {
        setActiveStage(nextStage);
      }

      await refreshAll(true);
      setAssignmentFeedback(
        body.action === "reset"
          ? "Operator reset complete."
          : body.action === "trigger_trip"
            ? "Scenario triggered and map refreshed."
            : "Operator scenario updated."
      );
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : "Scenario update failed.");
    } finally {
      setIsOperatorRunning(false);
    }
  }

  const mapPresentation = useMemo(
    () =>
      buildMapPresentationModel({
        activeStage,
        snapshot,
        activeTrip,
        openDraft,
        parsedLoad,
        selectedScore,
        selectedBackhaul,
        backhaulOpen,
        driverById,
        selectedDeskDriverId: activeTopBarNav === "drivers" ? selectedDeskDriverId : null,
        isDriversView: activeTopBarNav === "drivers",
        isRoutesView: activeTopBarNav === "routes",
        selectedTripId: activeTopBarNav === "routes" ? selectedRouteTripId : null
      }),
    [
      activeStage,
      snapshot,
      activeTrip,
      openDraft,
      parsedLoad,
      selectedScore,
      selectedBackhaul,
      backhaulOpen,
      driverById,
      activeTopBarNav,
      selectedDeskDriverId,
      selectedRouteTripId
    ]
  );

  const monitoringHeadline = openDraft
    ? `Urgent: ${openDraft.trigger.replace(/_/g, " ")} on ${openDraft.tripId}`
    : "No open intervention drafts";
  const canAnalyzeLoad = pasteInput.trim().length > 0;

  const topCandidate = scores.find((score) => !score.eliminated) ?? null;
  const selectedCandidate = selectedScore ?? topCandidate;
  const selectedCandidateRank = selectedCandidate
    ? scores.findIndex((score) => score.driverId === selectedCandidate.driverId) + 1
    : null;
  const alternateCandidates = scores
    .filter((score) => score.driverId !== selectedCandidate?.driverId && !score.eliminated)
    .slice(0, 4);
  const selectedMetricExplanation = selectedCandidate
    ? {
        deadhead: {
          label: "Deadhead",
          value: `${selectedCandidate.deadheadMiles} mi`,
          detail: "Current GPS-to-pickup distance. Lower deadhead reduces empty cost before the revenue leg starts."
        },
        hos: {
          label: "HOS",
          value: `${formatHours(selectedCandidate.hosCheck.availableMin)} available vs ${formatHours(selectedCandidate.hosCheck.requiredMin)} needed`,
          detail: `This leaves ${formatHours(Math.max(selectedCandidate.hosCheck.availableMin - selectedCandidate.hosCheck.requiredMin, 0))} of legal drive-time cushion after the lane.`
        },
        fuel: {
          label: "Fuel",
          value: formatMoney(selectedCandidate.fuelCostUsd),
          detail: "Estimated fuel spend for deadhead plus loaded miles using the backend route-cost model."
        },
        eta: {
          label: "ETA confidence",
          value: formatPercent(selectedCandidate.etaConfidence),
          detail: "Confidence blends deadhead, pickup buffer, and route exposure. Higher is safer against missed pickup."
        },
        ripple: {
          label: "Ripple impact",
          value: `${selectedCandidate.rippleImpact.affectedLoads} nearby loads • ${formatMoney(selectedCandidate.rippleImpact.deltaUsd)}`,
          detail: "Opportunity cost of pulling this driver away from nearby freight already in the network."
        }
      }[selectedMetricKey]
    : null;
  const liveSummary = snapshot
    ? `Fleet sync ${formatTime(snapshot.fetchedAtMs)} • ${formatCountLabel(snapshot.drivers.length, "driver")} • ${formatCountLabel(routeDesk?.routes.length ?? 0, "route")} in DB`
    : "Syncing fleet data";

  function handlePanelResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    panelResizeStartRef.current = {
      x: event.clientX,
      width: panelWidth
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <AppShell
      currentStage={activeStage}
      currentDeskPanel={deskPanelView}
      activeNavItem={activeTopBarNav}
      liveSummary={liveSummary}
      isRefreshing={isRefreshing}
      onRefresh={() => void refreshAll(true)}
      onDeskPanelChange={handleTopBarDeskPanelChange}
      onStageChange={handleTopBarStageChange}
    >
      <div className="flex h-full min-h-0 flex-col gap-6 xl:flex-row">
        <section
          ref={leftPanelRef}
          className="navpro-scrollbar relative overflow-y-auto rounded-[28px] border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-panel)] shadow-[0_24px_70px_rgba(16,32,51,0.08)] xl:h-full xl:min-h-0 xl:shrink-0"
          style={viewportWidth >= 1280 ? { width: panelWidth } : undefined}
        >
          <button
            type="button"
            aria-label="Resize left panel"
            onPointerDown={handlePanelResizeStart}
            className="absolute right-0 top-0 z-20 hidden h-full w-3 translate-x-1/2 cursor-col-resize items-center justify-center xl:flex"
          >
            <span className="h-20 w-[3px] rounded-full bg-[color:var(--navpro-border-soft)] shadow-[0_0_0_1px_rgba(255,255,255,0.7)] transition-colors hover:bg-[#214cba]" />
          </button>

          <div className="space-y-5 px-6 py-5 text-[13px]">
            {activeStage === "morning_triage" ? (
              <>
                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                        Operations desk
                      </div>
                      <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                        {deskPanelView === "drivers"
                          ? "Inspect the live roster and selected seat before dispatch."
                          : "Manage every active trip — pick one to inspect ETA, HOS, GPS, and edit it live in the database."}
                      </div>
                    </div>
                    <div className="rounded-full bg-[color:var(--navpro-bg-muted)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                      {deskPanelView === "drivers" ? `${driverDeskRows.length} shown` : `${routeDeskRows.length} routes`}
                    </div>
                  </div>

                  {routeDeskMessage ? (
                    <div className="mt-4 rounded-xl border border-[#c7d7ff] bg-[#f7faff] px-4 py-3 text-[12px] text-[#214cba]">
                      {routeDeskMessage}
                    </div>
                  ) : (
                    routeDeskError && deskPanelView === "routes" ? (
                      <div className="mt-4 rounded-xl border border-[#ffe1e1] bg-[#fff7f7] px-4 py-3 text-[12px] text-[#a33939]">
                        {routeDeskError}
                      </div>
                    ) : null
                  )}

                  {deskPanelView === "drivers" ? (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {driverDeskFilters.map((filter) => {
                          const count =
                            filter.key === "all"
                              ? snapshot?.drivers.length ?? 0
                              : (snapshot?.drivers ?? []).filter((driver) => matchesDriverDeskFilter(driver, filter.key)).length;
                          const isActive = driverDeskFilter === filter.key;

                          return (
                            <button
                              key={filter.key}
                              type="button"
                              onClick={() => setDriverDeskFilter(filter.key)}
                              className={[
                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                                isActive
                                  ? "border-[#214cba] bg-[#E7F0FF] text-[#214cba]"
                                  : "border-[color:var(--navpro-border-soft)] bg-white text-[color:var(--navpro-text-muted)]"
                              ].join(" ")}
                            >
                              {filter.label} {count}
                            </button>
                          );
                        })}
                      </div>

                      {selectedDeskDriver ? (
                        <div className="mt-4 rounded-xl border border-[#c7d7ff] bg-[#f7faff] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={selectedDeskDriver.name} tone="blue" />
                              <div>
                                <div className="text-base font-bold text-[color:var(--navpro-text-strong)]">{selectedDeskDriver.name}</div>
                                <div className="mt-1 text-xs text-[color:var(--navpro-text-muted)]">
                                  Unit #{selectedDeskDriver.driverId} • {selectedDeskDriver.homeBase.city} • {selectedDeskDriver.phone}
                                </div>
                              </div>
                            </div>
                            <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${getDriverDeskStatus(selectedDeskDriver).tone}`}>
                              {getDriverDeskStatus(selectedDeskDriver).label}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] xl:grid-cols-4">
                            <div className="rounded-lg bg-white px-3 py-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">HOS</div>
                              <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">{formatHours(selectedDeskDriver.hosRemainingMin)}</div>
                              <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">{getDriverDeskStatus(selectedDeskDriver).detail}</div>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">GPS ping</div>
                              <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">{formatTime(selectedDeskDriver.currentLocation.updatedAtMs)}</div>
                              <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">
                                {selectedDeskDriver.currentLocation.lat.toFixed(2)}, {selectedDeskDriver.currentLocation.lng.toFixed(2)}
                              </div>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Trip</div>
                              <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">{selectedDeskDriver.activeTripId ?? "Available"}</div>
                              <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">
                                {selectedDeskDriver.complianceFlags.length} flag{selectedDeskDriver.complianceFlags.length === 1 ? "" : "s"}
                              </div>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Miles delta</div>
                              <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                {selectedDeskDriver.performance
                                  ? formatPerformanceDelta(selectedDeskDriver.performance.actualMiles, selectedDeskDriver.performance.scheduleMiles)
                                  : "No trip history"}
                              </div>
                              <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">
                                {selectedDeskDriver.performance
                                  ? `${formatNumber(selectedDeskDriver.performance.actualMiles)} actual • ${formatNumber(selectedDeskDriver.performance.scheduleMiles)} planned`
                                  : "Performance feed not loaded"}
                              </div>
                            </div>
                          </div>

                          {selectedDeskDriverTrip ? (
                            (() => {
                              const trip = selectedDeskDriverTrip;
                              const statusBadge = getTripStatusBadge(trip.status);
                              const referenceMs = snapshot?.fetchedAtMs ?? Date.now();
                              const remainingMiles = trip.remainingMiles ?? null;
                              const originLabel = trip.origin
                                ? `${trip.origin.city}, ${trip.origin.state}`
                                : "Origin pending";
                              const destinationLabel = trip.destination
                                ? `${trip.destination.city}, ${trip.destination.state}`
                                : "Destination pending";

                              return (
                                <div className="mt-3 rounded-xl border border-[#c7d7ff] bg-white p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Glyph name="route" className="h-4 w-4 text-[#214cba]" />
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                                        Live trip
                                      </div>
                                      <div className="text-[12px] font-bold text-[color:var(--navpro-text-strong)]">
                                        {trip.tripId}
                                      </div>
                                    </div>
                                    <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${statusBadge.tone}`}>
                                      {statusBadge.label}
                                    </div>
                                  </div>

                                  <div className="mt-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-bold text-[color:var(--navpro-text-strong)]">{originLabel}</div>
                                      <div className="text-[11px] text-[color:var(--navpro-text-muted)]">Pickup</div>
                                    </div>
                                    <Glyph name="route" className="h-4 w-4 text-[color:var(--navpro-text-muted)]" />
                                    <div className="min-w-0 text-right">
                                      <div className="truncate text-sm font-bold text-[color:var(--navpro-text-strong)]">{destinationLabel}</div>
                                      <div className="text-[11px] text-[color:var(--navpro-text-muted)]">Drop</div>
                                    </div>
                                  </div>

                                  <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] xl:grid-cols-4">
                                    <div className="rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-3">
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">ETA</div>
                                      <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                        {formatTime(trip.etaMs)}
                                      </div>
                                      <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">{formatDateTime(trip.etaMs)}</div>
                                    </div>
                                    <div className="rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-3">
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Time left</div>
                                      <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                        {formatRemainingDuration(trip.etaMs, referenceMs)}
                                      </div>
                                      <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">vs sync {formatTime(referenceMs)}</div>
                                    </div>
                                    <div className="rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-3">
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Distance left</div>
                                      <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                        {remainingMiles != null ? `${formatNumber(remainingMiles)} mi` : "Unavailable"}
                                      </div>
                                      <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">
                                        {trip.plannedRoute.length} route pts
                                      </div>
                                    </div>
                                    <div className="rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-3">
                                      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Current GPS</div>
                                      <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                        {trip.currentLoc.lat.toFixed(2)}, {trip.currentLoc.lng.toFixed(2)}
                                      </div>
                                      <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">
                                        {trip.routeContext ?? "Live ping"}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#f7faff] px-3 py-2 text-[11px] text-[#214cba]">
                                    <Glyph name="map" className="h-4 w-4" />
                                    Route highlighted on the fleet map.
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="mt-3 rounded-xl border border-dashed border-[color:var(--navpro-border-soft)] bg-white p-4">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Glyph name="truck" className="h-4 w-4 text-[color:var(--navpro-text-muted)]" />
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                                    No active trip
                                  </div>
                                </div>
                                <div className="rounded-full bg-[#E6F6EE] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#0E8A5B]">
                                  Available
                                </div>
                              </div>
                              <div className="mt-2 text-[12px] text-[color:var(--navpro-text-muted)]">
                                {selectedDeskDriver.name.split(" ")[0]} is idle near {selectedDeskDriver.homeBase.city}. GPS last pinged at {formatTime(selectedDeskDriver.currentLocation.updatedAtMs)} ({selectedDeskDriver.currentLocation.lat.toFixed(2)}, {selectedDeskDriver.currentLocation.lng.toFixed(2)}).
                              </div>
                            </div>
                          )}

                          {selectedDeskDriver.complianceFlags.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {selectedDeskDriver.complianceFlags.map((flag) => (
                                <div key={`${selectedDeskDriver.driverId}-${flag.kind}`} className="rounded-lg bg-[#fff5f4] px-3 py-3 text-[12px] text-[#7d3a32]">
                                  <span className="font-bold">{flag.kind.replace(/_/g, " ")}:</span> {flag.message}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-[color:var(--navpro-border-soft)] px-4 py-5 text-[12px] text-[color:var(--navpro-text-muted)]">
                          No driver records are available from the fleet snapshot.
                        </div>
                      )}

                      <div className="mt-4 space-y-2">
                        {visibleDriverDeskRows.map((driver) => {
                          const status = getDriverDeskStatus(driver);
                          const isActive = selectedDeskDriver?.driverId === driver.driverId;
                          return (
                            <button
                              key={driver.driverId}
                              type="button"
                              onClick={() => {
                                setSelectedDeskDriverId(driver.driverId);
                                scrollLeftPanelToTop();
                              }}
                              className={[
                                "w-full rounded-xl border p-4 text-left transition-colors",
                                isActive
                                  ? "border-[#214cba] bg-[#f7faff]"
                                  : "border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] hover:bg-white"
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={driver.name} tone={driver.activeTripId ? "teal" : "violet"} />
                                  <div>
                                    <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">{driver.name}</div>
                                    <div className="mt-1 text-xs text-[color:var(--navpro-text-muted)]">
                                      Unit #{driver.driverId} • {driver.homeBase.city} • GPS {formatTime(driver.currentLocation.updatedAtMs)}
                                    </div>
                                  </div>
                                </div>
                                <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${status.tone}`}>
                                  {status.label}
                                </div>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                                <div className="rounded-lg bg-white px-3 py-2 text-[color:var(--navpro-text-muted)]">
                                  <span className="font-semibold text-[color:var(--navpro-text-strong)]">HOS</span> {formatHours(driver.hosRemainingMin)}
                                </div>
                                <div className="rounded-lg bg-white px-3 py-2 text-[color:var(--navpro-text-muted)]">
                                  <span className="font-semibold text-[color:var(--navpro-text-strong)]">Flags</span> {driver.complianceFlags.length}
                                </div>
                                <div className="rounded-lg bg-white px-3 py-2 text-[color:var(--navpro-text-muted)]">
                                  <span className="font-semibold text-[color:var(--navpro-text-strong)]">Seat</span> {driver.activeTripId ? "Assigned" : "Open"}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <input
                          type="search"
                          value={routeDeskSearch}
                          onChange={(event) => setRouteDeskSearch(event.target.value)}
                          placeholder="Search by trip, driver, load, customer or city"
                          aria-label="Search active trips"
                          className="w-full rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none placeholder:text-[color:var(--navpro-text-muted)] sm:max-w-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setIsCreateRouteModalOpen(true)}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(33,76,186,0.25)]"
                        >
                          + New trip
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {routeDeskFilterOptions.map((filter) => {
                          const count =
                            filter.key === "all"
                              ? routeDeskRows.length
                              : routeDeskRows.filter((route) => route.status === filter.key).length;
                          const isActive = routeDeskFilter === filter.key;
                          return (
                            <button
                              key={filter.key}
                              type="button"
                              onClick={() => setRouteDeskFilter(filter.key)}
                              className={[
                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                                isActive
                                  ? "border-[#214cba] bg-[#E7F0FF] text-[#214cba]"
                                  : "border-[color:var(--navpro-border-soft)] bg-white text-[color:var(--navpro-text-muted)]"
                              ].join(" ")}
                            >
                              {filter.label} {count}
                            </button>
                          );
                        })}
                      </div>

                      {selectedRouteTrip ? (
                        (() => {
                          const trip = selectedRouteTrip;
                          const driver = selectedRouteDriver;
                          const statusBadge = getTripStatusBadge(trip.status);
                          const referenceMs = snapshot?.fetchedAtMs ?? Date.now();
                          const driverName = driver?.name ?? `Driver #${trip.driverId}`;
                          const driverHosLabel = driver
                            ? `${formatHours(driver.hosRemainingMin)} • ${driver.hosStatus.replace(/_/g, " ")}`
                            : "HOS unavailable";
                          const driverPerformanceLabel = driver?.performance
                            ? `${formatPerformanceDelta(driver.performance.actualMiles, driver.performance.scheduleMiles)} vs plan`
                            : "No performance feed";
                          const lastPing = driver
                            ? formatTime(driver.currentLocation.updatedAtMs)
                            : formatTime(trip.lastSeenAtMs);

                          const pickupAnchor = trip.origin ?? trip.currentLoc;
                          const rankedDriverOptions = (snapshot?.drivers ?? [])
                            .map((candidate) => {
                              const deadheadMiles = haversineMiles(
                                candidate.currentLocation.lat,
                                candidate.currentLocation.lng,
                                pickupAnchor.lat,
                                pickupAnchor.lng
                              );
                              const proximityScore = 35 * (1 - clamp(deadheadMiles / 300, 0, 1));
                              const hosScore = 20 * clamp(candidate.hosRemainingMin / 720, 0, 1);
                              const criticalPenalty = candidate.complianceFlags.some((flag) => flag.severity === "critical") ? 40 : 0;
                              const warnPenalty = candidate.complianceFlags.filter((flag) => flag.severity === "warn").length * 4;
                              const engineScore = proximityScore + hosScore - criticalPenalty - warnPenalty;
                              return { candidate, deadheadMiles, engineScore };
                            })
                            .sort((left, right) => right.engineScore - left.engineScore);

                          return (
                            <div className="rounded-xl border border-[#c7d7ff] bg-[#f7faff] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={driverName} tone="blue" />
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-base font-bold text-[color:var(--navpro-text-strong)]">{trip.tripId}</div>
                                      <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${statusBadge.tone}`}>
                                        {statusBadge.label}
                                      </div>
                                    </div>
                                    <div className="mt-1 text-xs text-[color:var(--navpro-text-muted)]">
                                      {driverName} • Unit #{trip.driverId}
                                      {driver?.phone ? ` • ${driver.phone}` : ""}
                                    </div>
                                    <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">{trip.routeContext}</div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (driver) {
                                      setSelectedDeskDriverId(driver.driverId);
                                      handleTopBarDeskPanelChange("drivers");
                                    }
                                  }}
                                  disabled={!driver}
                                  className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2 text-[11px] font-semibold text-[#214cba] disabled:opacity-50"
                                >
                                  Open driver desk
                                </button>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] xl:grid-cols-4">
                                <div className="rounded-lg bg-white px-3 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">ETA</div>
                                  <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">{formatTime(trip.etaMs)}</div>
                                  <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">{formatDateTime(trip.etaMs)}</div>
                                </div>
                                <div className="rounded-lg bg-white px-3 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Time left</div>
                                  <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                    {formatRemainingDuration(trip.etaMs, referenceMs)}
                                  </div>
                                  <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">vs sync {formatTime(referenceMs)}</div>
                                </div>
                                <div className="rounded-lg bg-white px-3 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Distance left</div>
                                  <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                    {trip.remainingMiles != null ? `${formatNumber(trip.remainingMiles)} mi` : "Unavailable"}
                                  </div>
                                  <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">{trip.routePointCount} route pts</div>
                                </div>
                                <div className="rounded-lg bg-white px-3 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">HOS</div>
                                  <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">{driverHosLabel}</div>
                                  <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">{driverPerformanceLabel}</div>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2">
                                <div className="rounded-lg bg-white px-3 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Pickup</div>
                                  <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                    {trip.origin ? `${trip.origin.city}, ${trip.origin.state}` : "Origin pending"}
                                  </div>
                                  {trip.pickupEndMs ? (
                                    <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">
                                      Pickup window ends {formatDateTime(trip.pickupEndMs)}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="rounded-lg bg-white px-3 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Drop</div>
                                  <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                    {trip.destination ? `${trip.destination.city}, ${trip.destination.state}` : "Destination pending"}
                                  </div>
                                  <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">
                                    Load {trip.loadId} • {trip.commodity ?? "General freight"}
                                    {trip.rateUsd != null ? ` • ${formatMoney(trip.rateUsd)}` : ""}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#eef3ff] px-3 py-2 text-[11px] text-[#214cba]">
                                <Glyph name="map" className="h-4 w-4" />
                                Trip path highlighted on the fleet map • last GPS ping {lastPing}
                              </div>

                              <div className="mt-4 rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                                    Manage trip
                                  </div>
                                  <div className="text-[11px] text-[color:var(--navpro-text-muted)]">
                                    Saved {formatDateTime(trip.lastSeenAtMs)}
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <label className="block">
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                                      Status
                                    </div>
                                    <select
                                      value={trip.status}
                                      disabled={updatingTripField === "status"}
                                      onChange={(event) =>
                                        void handleUpdateRoute(trip.tripId, "status", {
                                          status: event.target.value as TripStatus
                                        })
                                      }
                                      className="w-full rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none disabled:opacity-60"
                                    >
                                      {routeDeskStatusOptions.map((statusOption) => (
                                        <option key={statusOption.value} value={statusOption.value}>
                                          {statusOption.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="block">
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                                      ETA
                                    </div>
                                    <div className="flex items-stretch gap-2">
                                      <input
                                        type="datetime-local"
                                        value={routeEtaDraft}
                                        onChange={(event) => setRouteEtaDraft(event.target.value)}
                                        className="min-w-0 flex-1 rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const ms = parseLocalDateTimeInputValue(routeEtaDraft);
                                          if (ms === null) {
                                            setRouteDeskMessage("Pick a valid ETA before saving.");
                                            return;
                                          }
                                          void handleUpdateRoute(trip.tripId, "eta", { etaMs: ms });
                                        }}
                                        disabled={updatingTripField === "eta"}
                                        className="shrink-0 rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] px-3 py-2 text-[11px] font-semibold text-[#214cba] disabled:opacity-60"
                                      >
                                        {updatingTripField === "eta" ? "Saving..." : "Save"}
                                      </button>
                                    </div>
                                  </label>
                                </div>

                                <div className="mt-3">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                                      Driver
                                    </div>
                                    <div className="text-[10px] text-[color:var(--navpro-text-subtle)]">
                                      Ranked by dispatch engine
                                    </div>
                                  </div>
                                  <div className="flex items-stretch gap-2">
                                    <select
                                      value={routeDriverDraft}
                                      onChange={(event) => setRouteDriverDraft(event.target.value)}
                                      disabled={updatingTripField === "driver" || rankedDriverOptions.length === 0}
                                      aria-label="Assigned driver"
                                      className="min-w-0 flex-1 rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none disabled:opacity-60"
                                    >
                                      {rankedDriverOptions.length === 0 ? (
                                        <option value="">No drivers available</option>
                                      ) : (
                                        rankedDriverOptions.map(({ candidate, deadheadMiles, engineScore }) => {
                                          const isCurrent = candidate.driverId === trip.driverId;
                                          const miles = Math.round(deadheadMiles);
                                          const score = Math.round(engineScore);
                                          return (
                                            <option key={candidate.driverId} value={String(candidate.driverId)}>
                                              {`${candidate.name} • Unit #${candidate.driverId} • ${miles} mi • score ${score}${isCurrent ? " • current" : ""}`}
                                            </option>
                                          );
                                        })
                                      )}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextDriverId = Number(routeDriverDraft);
                                        if (!Number.isFinite(nextDriverId) || nextDriverId <= 0) {
                                          setRouteDeskMessage("Pick a driver before saving.");
                                          return;
                                        }
                                        if (nextDriverId === trip.driverId) {
                                          setRouteDeskMessage("Trip already assigned to that driver.");
                                          return;
                                        }
                                        void handleUpdateRoute(trip.tripId, "driver", { driverId: nextDriverId });
                                      }}
                                      disabled={updatingTripField === "driver" || !routeDriverDraft}
                                      className="shrink-0 rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] px-3 py-2 text-[11px] font-semibold text-[#214cba] disabled:opacity-60"
                                    >
                                      {updatingTripField === "driver" ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                                    Override current GPS
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="number"
                                      step="0.0001"
                                      value={routeLatDraft}
                                      onChange={(event) => setRouteLatDraft(event.target.value)}
                                      placeholder="Latitude"
                                      aria-label="Latitude override"
                                      className="w-32 rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none"
                                    />
                                    <input
                                      type="number"
                                      step="0.0001"
                                      value={routeLngDraft}
                                      onChange={(event) => setRouteLngDraft(event.target.value)}
                                      placeholder="Longitude"
                                      aria-label="Longitude override"
                                      className="w-32 rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const lat = Number(routeLatDraft);
                                        const lng = Number(routeLngDraft);
                                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                                          setRouteDeskMessage("Latitude and longitude must be numbers.");
                                          return;
                                        }
                                        void handleUpdateRoute(trip.tripId, "currentLoc", {
                                          currentLoc: { lat, lng }
                                        });
                                      }}
                                      disabled={updatingTripField === "currentLoc"}
                                      className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] px-3 py-2 text-[11px] font-semibold text-[#214cba] disabled:opacity-60"
                                    >
                                      {updatingTripField === "currentLoc" ? "Saving..." : "Save GPS"}
                                    </button>
                                    <span className="text-[11px] text-[color:var(--navpro-text-muted)]">
                                      Live GPS: {trip.currentLoc.lat.toFixed(2)}, {trip.currentLoc.lng.toFixed(2)}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[color:var(--navpro-border-soft)] pt-3">
                                  <div className="text-[11px] text-[color:var(--navpro-text-muted)]">
                                    Removing the trip clears it from the active trip mirror in the database.
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Delete trip ${trip.tripId}? This removes it from the database.`)) {
                                        void handleDeleteRoute(trip.tripId);
                                      }
                                    }}
                                    disabled={deletingRouteTripId === trip.tripId}
                                    className="rounded-lg border border-[#f1c7c7] bg-white px-3 py-2 text-[11px] font-semibold text-[#a33939] disabled:opacity-60"
                                  >
                                    {deletingRouteTripId === trip.tripId ? "Removing..." : "Delete trip"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : null}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                          <span>Active trips</span>
                          <span>{filteredRouteDeskRows.length} of {routeDeskRows.length}</span>
                        </div>

                        {routeDeskRows.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-[color:var(--navpro-border-soft)] px-4 py-5 text-[12px] text-[color:var(--navpro-text-muted)]">
                            No saved routes yet. Use <span className="font-semibold text-[#214cba]">+ New trip</span> to create the first one.
                          </div>
                        ) : filteredRouteDeskRows.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-[color:var(--navpro-border-soft)] px-4 py-5 text-[12px] text-[color:var(--navpro-text-muted)]">
                            No trips match this filter or search.
                          </div>
                        ) : (
                          filteredRouteDeskRows.map((route) => {
                            const isActive = route.tripId === selectedRouteTrip?.tripId;
                            const referenceMs = snapshot?.fetchedAtMs ?? Date.now();
                            const driverForRow = driverById.get(route.driverId);
                            return (
                              <button
                                key={route.tripId}
                                type="button"
                                onClick={() => {
                                  setSelectedRouteTripId(route.tripId);
                                  scrollLeftPanelToTop();
                                }}
                                className={[
                                  "w-full rounded-xl border p-4 text-left transition-colors",
                                  isActive
                                    ? "border-[#214cba] bg-[#f7faff]"
                                    : "border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] hover:bg-white"
                                ].join(" ")}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">{route.tripId}</div>
                                      <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${getRouteStatusTone(route.status)}`}>
                                        {route.status.replace(/_/g, " ")}
                                      </div>
                                    </div>
                                    <div className="mt-1 truncate text-[12px] text-[color:var(--navpro-text-muted)]">{route.routeContext}</div>
                                  </div>
                                  <div className="text-right text-[11px] text-[color:var(--navpro-text-muted)]">
                                    <div className="font-semibold text-[color:var(--navpro-text-strong)]">{formatTime(route.etaMs)}</div>
                                    <div>{formatRemainingDuration(route.etaMs, referenceMs)}</div>
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                                  <div className="rounded-lg bg-white px-3 py-2 text-[color:var(--navpro-text-muted)]">
                                    <span className="font-semibold text-[color:var(--navpro-text-strong)]">Driver</span> {route.driverName}
                                  </div>
                                  <div className="rounded-lg bg-white px-3 py-2 text-[color:var(--navpro-text-muted)]">
                                    <span className="font-semibold text-[color:var(--navpro-text-strong)]">HOS</span> {driverForRow ? formatHours(driverForRow.hosRemainingMin) : "—"}
                                  </div>
                                  <div className="rounded-lg bg-white px-3 py-2 text-[color:var(--navpro-text-muted)]">
                                    <span className="font-semibold text-[color:var(--navpro-text-strong)]">Miles</span> {route.remainingMiles != null ? `${formatNumber(route.remainingMiles)} mi` : "—"}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                    Next step
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-[color:var(--navpro-text-muted)]">
                    Refresh the board, clear the driver issues, then open the active lane.
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void refreshAll(true)}
                      className="flex items-center justify-center gap-2 rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#214cba]"
                    >
                      <Glyph name="spark" className="h-4 w-4" />
                      Sync fleet now
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStage("load_assignment");
                      }}
                      className="rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-3 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(33,76,186,0.25)]"
                    >
                      Open dispatch lane
                    </button>
                  </div>
                </section>
              </>
            ) : null}

            {(activeStage === "load_assignment" || activeStage === "backhaul_review") ? (
              <>
                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                      Load intake
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAnalyzeLoad()}
                      disabled={isAnalyzing || !canAnalyzeLoad}
                      className="rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(33,76,186,0.2)] disabled:opacity-60"
                    >
                      {isAnalyzing ? "Analyzing..." : "Re-run analysis"}
                    </button>
                  </div>
                  <textarea
                    value={pasteInput}
                    onChange={(event) => setPasteInput(event.target.value)}
                    rows={4}
                    aria-label="Load intake request"
                    className="w-full resize-none rounded-lg border border-[color:var(--navpro-border-input)] bg-[color:var(--navpro-bg-input)] px-3 py-3 text-[13px] leading-6 text-[color:var(--navpro-text)] outline-none"
                  />
                  <div className="mt-3 rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-2 text-[12px] text-[color:var(--navpro-text-muted)]">
                    Paste broker email, a rate confirmation, or a typed lane request to rank it against the live roster.
                  </div>
                </section>

                {parsedLoad ? (
                  <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                        Route details
                      </div>
                      <div className="text-sm font-bold text-[#00598F]">{formatMoney(parsedLoad.rateUsd)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-[color:var(--navpro-text-strong)]">{parsedLoad.origin.city}</div>
                        <div className="text-xs text-[color:var(--navpro-text-muted)]">{parsedLoad.origin.state}</div>
                      </div>
                      <Glyph name="route" className="h-5 w-5 text-[color:var(--navpro-text-muted)]" />
                      <div className="text-right">
                        <div className="text-lg font-bold text-[color:var(--navpro-text-strong)]">{parsedLoad.destination.city}</div>
                        <div className="text-xs text-[color:var(--navpro-text-muted)]">{parsedLoad.destination.state}</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[color:var(--navpro-border-soft)] pt-4 text-[12px]">
                      <div>
                        <div className="font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Pickup window</div>
                        <div className="mt-1 font-semibold text-[color:var(--navpro-text-strong)]">{formatDateTime(parsedLoad.pickupStartMs)}</div>
                      </div>
                      <div>
                        <div className="font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Weight</div>
                        <div className="mt-1 font-semibold text-[color:var(--navpro-text-strong)]">
                          {parsedLoad.weightLbs ? `${formatNumber(parsedLoad.weightLbs)} lbs` : "General freight"}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                      Driver ranking
                    </div>
                    {scores.length > 0 ? (
                      <div className="text-[12px] font-medium text-[#214cba]">Explainable scoring active</div>
                    ) : null}
                  </div>

                  {selectedCandidate ? (
                    <section className="rounded-xl border border-[#c7d7ff] bg-white p-4 shadow-[0_4px_16px_rgba(33,76,186,0.08)]">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={selectedCandidate.driverName} tone="blue" />
                          <div>
                            <div className="text-base font-bold leading-tight text-[color:var(--navpro-text-strong)]">
                              {selectedCandidate.driverName}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--navpro-text-muted)]">
                              {driverById.get(selectedCandidate.driverId)?.homeBase.city ?? "Unknown"} •{" "}
                              {selectedCandidate.driverId === topCandidate?.driverId ? "best positioned for pickup" : "selected for review"}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {selectedCandidate.driverId === topCandidate?.driverId ? (
                            <div className="rounded-full bg-[#214cba] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                              Recommended
                            </div>
                          ) : null}
                          {selectedCandidateRank ? (
                            <div className="rounded-full bg-[color:var(--navpro-bg-muted)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                              Rank {selectedCandidateRank}
                            </div>
                          ) : null}
                          <div className="rounded-full bg-[#214cba] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                            {selectedCandidate.score}% match
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[color:var(--navpro-bg-muted)] p-3 xl:grid-cols-5">
                        {(
                          [
                            { key: "deadhead", label: "Deadhead", value: `${selectedCandidate.deadheadMiles}mi` },
                            { key: "hos", label: "HOS", value: `${formatHours(selectedCandidate.hosCheck.availableMin)} left` },
                            { key: "fuel", label: "Fuel", value: formatMoney(selectedCandidate.fuelCostUsd) },
                            { key: "eta", label: "ETA", value: formatPercent(selectedCandidate.etaConfidence) },
                            { key: "ripple", label: "Ripple", value: `${selectedCandidate.rippleImpact.affectedLoads} loads` }
                          ] as Array<{ key: CandidateMetricKey; label: string; value: string }>
                        ).map((metric) => {
                          const active = metric.key === selectedMetricKey;

                          return (
                            <button
                              key={metric.key}
                              type="button"
                              onClick={() => setSelectedMetricKey(metric.key)}
                              className={[
                                "rounded-lg border px-3 py-2 text-left transition-colors",
                                active
                                  ? "border-[#214cba] bg-white shadow-[0_4px_12px_rgba(33,76,186,0.08)]"
                                  : "border-transparent bg-transparent"
                              ].join(" ")}
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">
                                {metric.label}
                              </div>
                              <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">{metric.value}</div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 rounded-lg bg-[#dce1ff]/40 px-3 py-3 text-[12px] leading-6 text-[color:var(--navpro-text-strong)]">
                        <span className="font-bold">Why this driver?</span> {selectedCandidate.rationale}
                      </div>

                      {selectedMetricExplanation ? (
                        <div className="mt-3 rounded-lg border border-[#c7d7ff] bg-[#f5f9ff] px-3 py-3 text-[12px] leading-6 text-[color:var(--navpro-text-muted)]">
                          <span className="font-semibold text-[color:var(--navpro-text-strong)]">
                            {selectedMetricExplanation.label}:
                          </span>{" "}
                          {selectedMetricExplanation.value}. {selectedMetricExplanation.detail}
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] xl:grid-cols-4">
                        <div className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Home base</div>
                          <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                            {driverById.get(selectedCandidate.driverId)?.homeBase.city ?? "Unknown"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">HOS cushion</div>
                          <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                            {formatHours(Math.max(selectedCandidate.hosCheck.availableMin - selectedCandidate.hosCheck.requiredMin, 0))}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Compliance</div>
                          <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                            {driverById.get(selectedCandidate.driverId)?.complianceFlags.length ?? 0} open
                          </div>
                        </div>
                        <div className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">Current seat</div>
                          <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                            {driverById.get(selectedCandidate.driverId)?.activeTripId ?? "Dispatchable"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleOpenBackhaul()}
                          disabled={!parsedLoad || isDispatching || isOpeningBackhaul}
                          className="flex-1 rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-3 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(33,76,186,0.24)] disabled:opacity-60"
                        >
                          {isOpeningBackhaul ? "Scanning backhauls..." : `Review backhaul for ${selectedCandidate.driverName.split(" ")[0]}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => queueDispatchConfirmation("outbound")}
                          disabled={!parsedLoad || isDispatching}
                          className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-4 py-3 text-[12px] font-semibold text-[color:var(--navpro-text-muted)] disabled:opacity-60"
                        >
                          Queue outbound
                        </button>
                      </div>
                    </section>
                  ) : null}

                  {pendingDispatchConfirmation && selectedCandidate ? (
                    <section className="rounded-xl border border-[#c7d7ff] bg-[#f7faff] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#214cba]">Assignment check</div>
                          <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                            {pendingDispatchConfirmation.mode === "round_trip" ? "Confirm round-trip assignment" : "Confirm outbound assignment"}
                          </div>
                          <div className="mt-1 text-[12px] leading-6 text-[color:var(--navpro-text-muted)]">
                            {selectedCandidate.driverName} will be assigned to {parsedLoad?.origin.city} → {parsedLoad?.destination.city}
                            {pendingDispatchConfirmation.mode === "round_trip" && selectedBackhaul
                              ? ` with return ${selectedBackhaul.returnLoad.origin.city} → ${selectedBackhaul.returnLoad.destination.city}.`
                              : "."}
                          </div>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#214cba]">
                          Final check
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleConfirmDispatch()}
                          disabled={isDispatching}
                          className="flex-1 rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-3 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(33,76,186,0.24)] disabled:opacity-60"
                        >
                          {isDispatching ? "Assigning..." : pendingDispatchConfirmation.mode === "round_trip" ? "Confirm round-trip" : "Confirm outbound"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDispatchConfirmation(null)}
                          className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-4 py-3 text-[12px] font-semibold text-[color:var(--navpro-text-muted)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </section>
                  ) : null}

                  {alternateCandidates.map((score) => (
                    <button
                      key={score.driverId}
                      type="button"
                      onClick={() => {
                        setSelectedDriverId(score.driverId);
                        setPendingDispatchConfirmation(null);
                      }}
                      className="w-full rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-4 text-left transition-colors hover:bg-[color:var(--navpro-bg-muted)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={score.driverName} tone="violet" />
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">{score.driverName}</div>
                              {score.driverId === topCandidate?.driverId ? (
                                <div className="rounded-full bg-[#E7F0FF] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#214cba]">
                                  Recommended
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--navpro-text-muted)]">
                              deadhead {score.deadheadMiles}mi • HOS {formatHours(score.hosCheck.availableMin)} • ripple {score.rippleImpact.affectedLoads} loads
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="rounded-sm bg-[color:var(--navpro-bg-muted)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                            {score.score}% match
                          </div>
                          <div className="mt-1 text-[11px] text-[color:var(--navpro-text-subtle)]">
                            Rank {scores.findIndex((item) => item.driverId === score.driverId) + 1}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}

                  {scores.some((score) => score.eliminated) ? (
                    <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                        Counterfactuals
                      </div>
                      <div className="mt-3 space-y-2">
                        {scores
                          .filter((score) => score.eliminated)
                          .slice(0, 2)
                          .map((score) => (
                            <div key={score.driverId} className="rounded-lg bg-[#fff5f4] px-3 py-3 text-[12px] text-[#7d3a32]">
                              <span className="font-bold">Why not {score.driverName.split(" ")[0]}?</span> {score.eliminationReason}
                            </div>
                          ))}
                      </div>
                    </section>
                  ) : null}
                </section>
              </>
            ) : null}

            {activeStage === "trip_monitoring" ? (
              <>
                <section className="rounded-xl border border-[#ffd9d6] bg-[#fff5f4] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#BA1A1A]">
                      <Glyph name="warning" className="h-4 w-4" />
                      Live alert
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleTriggerMonitoring()}
                      className="rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(33,76,186,0.2)]"
                    >
                      {isTriggeringMonitor ? "Checking..." : "Run live check"}
                    </button>
                  </div>
                  <div className="text-base font-bold text-[color:var(--navpro-text-strong)]">{monitoringHeadline}</div>
                  <div className="mt-3 space-y-2 text-[12px] leading-6 text-[color:var(--navpro-text-muted)]">
                    {visibleDrafts.length > 0 ? (
                      visibleDrafts.map((draft) => (
                        <button
                          key={draft.id}
                          type="button"
                          onClick={() => {
                            setSelectedAlertDraftId(draft.id);
                            setIsAlertPopupMinimized(false);
                          }}
                          className={[
                            "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                            openDraft?.id === draft.id
                              ? "border-[#f1b3ab] bg-white"
                              : "border-[#ffd9d6] bg-white/70 hover:bg-white"
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-[color:var(--navpro-text-strong)]">
                              {draft.tripId} • {draft.trigger.replace(/_/g, " ")}
                            </div>
                            <div className="text-[11px] text-[color:var(--navpro-text-subtle)]">
                              {formatDateTime(draft.createdAtMs)}
                            </div>
                          </div>
                          <div className="mt-1">{draft.customerSms}</div>
                        </button>
                      ))
                    ) : (
                      <div>No intervention package is open right now.</div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                      Action desk
                    </div>
                    {openDraft ? (
                      <div className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#214cba]">
                        Execute
                      </div>
                    ) : null}
                  </div>
                  {openDraft ? (
                    <div className="space-y-4">
                      {visibleDrafts.length > 1 ? (
                        <div className="flex flex-wrap gap-2">
                          {visibleDrafts.map((draft) => (
                            <button
                              key={draft.id}
                              type="button"
                              onClick={() => setSelectedAlertDraftId(draft.id)}
                              className={[
                                "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                                openDraft.id === draft.id
                                  ? "border-[#214cba] bg-[#E7F0FF] text-[#214cba]"
                                  : "border-[color:var(--navpro-border-soft)] bg-white text-[color:var(--navpro-text-muted)]"
                              ].join(" ")}
                            >
                              {draft.tripId}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handlePlayVoice(openDraft)}
                          className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-4 py-2.5 text-[12px] font-semibold text-[color:var(--navpro-text-muted)]"
                        >
                          Play voice
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleExecuteIntervention(openDraft.id)}
                          disabled={isExecuting}
                          className="rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(33,76,186,0.2)] disabled:opacity-60"
                        >
                          {isExecuting ? "Executing..." : "Execute now"}
                        </button>
                      </div>

                      <div className="rounded-xl bg-white p-4 shadow-[0_4px_12px_rgba(21,27,41,0.03)]">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--navpro-text-strong)]">
                          <Glyph name="voice" className="h-4 w-4 text-[#214cba]" />
                          Voice script
                        </div>
                        <div className="text-[12px] leading-6 text-[color:var(--navpro-text-muted)]">
                          {cleanVoiceScriptForDisplay(openDraft.voiceScript)}
                        </div>
                        {openDraft.audioSource ? (
                          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#214cba]">
                            Audio source: {openDraft.audioSource}
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-xl bg-white p-4 shadow-[0_4px_12px_rgba(21,27,41,0.03)]">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--navpro-text-strong)]">
                          <Glyph name="relay" className="h-4 w-4 text-[#00598F]" />
                          Relay plan
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={openDraft.relayDriverName ?? "Relay"} tone="teal" />
                            <div>
                              <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                {openDraft.relayDriverName ?? "Unassigned relay"}
                              </div>
                              <div className="text-xs text-[color:var(--navpro-text-muted)]">
                                {openDraft.relayDistanceMi ?? "--"} miles away
                              </div>
                            </div>
                          </div>
                          <div className="text-sm font-bold text-[#0E8A5B]">ETA +45m</div>
                        </div>
                      </div>
                      <div className="rounded-xl bg-white p-4 shadow-[0_4px_12px_rgba(21,27,41,0.03)]">
                        <div className="mb-2 text-sm font-semibold text-[color:var(--navpro-text-strong)]">Drafted SMS to customer</div>
                        <div className="rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-3 text-[12px] italic leading-6 text-[color:var(--navpro-text-muted)]">
                          “{openDraft.customerSms}”
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px] text-[color:var(--navpro-text-muted)]">No intervention drafts are open.</div>
                  )}
                </section>

                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white">
                  <div className="border-b border-[color:var(--navpro-border-soft)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                    Decision log
                  </div>
                  <div className="divide-y divide-[color:var(--navpro-border-soft)]">
                    {monitoringRows.length === 0 ? (
                      <div className="px-4 py-5 text-[12px] text-[color:var(--navpro-text-muted)]">No decision log entries yet.</div>
                    ) : (
                      monitoringRows.map((row) => (
                        <div key={row.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-[color:var(--navpro-text-strong)]">{row.summary}</div>
                            <div className="text-[11px] text-[color:var(--navpro-text-subtle)]">{formatDateTime(row.createdAtMs)}</div>
                          </div>
                          <div className="mt-1 text-[12px] leading-5 text-[color:var(--navpro-text-muted)]">
                            {row.mathSummary ?? row.outcome}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            ) : null}

            {(snapshotError || monitorError || assignmentFeedback || audioStatus) ? (
              <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-4 py-3 text-[12px] text-[color:var(--navpro-text-muted)]">
                {[snapshotError, monitorError, assignmentFeedback, audioStatus].filter(Boolean).join(" • ")}
              </section>
            ) : null}
          </div>
        </section>

        <section className="relative min-h-[620px] overflow-hidden rounded-[28px] border border-[color:var(--navpro-border-soft)] bg-[#dfe7f3] shadow-[0_24px_70px_rgba(16,32,51,0.08)] xl:h-full xl:min-h-0 xl:flex-1">
          <InteractiveDispatchMap
            ref={mapRef}
            viewport={mapPresentation.viewport}
            routes={mapPresentation.routes}
            markers={mapPresentation.markers}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(233,237,255,0.12)_0%,rgba(233,237,255,0.06)_18%,rgba(233,237,255,0.02)_36%,rgba(233,237,255,0.04)_100%)]" />

          <div className="pointer-events-auto absolute left-6 top-6 z-20 flex items-center gap-3">
            <div className="glass-panel rounded-lg border border-white/60 px-4 py-2 text-[14px] font-semibold text-[color:var(--navpro-text-strong)] shadow-[0_8px_32px_rgba(21,27,41,0.08)]">
              {activeStage === "morning_triage" &&
                (snapshot
                  ? snapshot.sourceMode === "live"
                    ? snapshot.morningBrief.headline
                    : "Synthetic mode: live fleet brief hidden"
                  : "Loading fleet data...")}
              {activeStage === "load_assignment" &&
                (parsedLoad ? `Live network view • ${parsedLoad.origin.city} → ${parsedLoad.destination.city}` : "Live network view")}
              {activeStage === "trip_monitoring" && monitoringHeadline}
            </div>
          </div>

          <div className="pointer-events-auto absolute right-6 top-6 z-20 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="glass-panel grid h-10 w-10 place-items-center rounded-lg border border-white/60 text-[color:var(--navpro-text-strong)] shadow-[0_8px_32px_rgba(21,27,41,0.08)]"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="glass-panel grid h-10 w-10 place-items-center rounded-lg border border-white/60 text-[color:var(--navpro-text-strong)] shadow-[0_8px_32px_rgba(21,27,41,0.08)]"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.resetView()}
              className="glass-panel mt-2 grid h-10 w-10 place-items-center rounded-lg border border-white/60 text-[#214cba] shadow-[0_8px_32px_rgba(21,27,41,0.08)]"
            >
              ◎
            </button>
          </div>

          {operatorMode ? (
            <div className="pointer-events-auto absolute bottom-8 right-6 z-30 w-[280px] rounded-xl border border-[color:var(--navpro-border-soft)] bg-white/95 p-4 shadow-[0_16px_40px_rgba(21,27,41,0.16)] backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                Operator mode
              </div>
              <div className="mt-1 text-[13px] leading-5 text-[color:var(--navpro-text-muted)]">
                Hidden rehearsal controls for stage, reset, and live-trip scenarios.
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <button
                  type="button"
                  disabled={isOperatorRunning}
                  onClick={() =>
                    void runOperatorAction(
                      { action: "set_stage", stage: "morning_triage" },
                      "morning_triage"
                    )
                  }
                  className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-input)] px-3 py-2 font-semibold text-[#214cba] disabled:opacity-60"
                >
                  Morning
                </button>
                <button
                  type="button"
                  disabled={isOperatorRunning}
                  onClick={() =>
                    void runOperatorAction(
                      { action: "set_stage", stage: "load_assignment" },
                      "load_assignment"
                    )
                  }
                  className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-input)] px-3 py-2 font-semibold text-[#214cba] disabled:opacity-60"
                >
                  Dispatch
                </button>
                <button
                  type="button"
                  disabled={isOperatorRunning}
                  onClick={() =>
                    void runOperatorAction(
                      { action: "trigger_trip", tripId: "TRIP-ACT3", scenario: "breakdown" },
                      "trip_monitoring"
                    )
                  }
                  className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-input)] px-3 py-2 font-semibold text-[#214cba] disabled:opacity-60"
                >
                  Breakdown
                </button>
                <button
                  type="button"
                  disabled={isOperatorRunning}
                  onClick={() => void runOperatorAction({ action: "reset" }, "morning_triage")}
                  className="rounded-lg border border-[#ffd9d6] bg-[#fff5f4] px-3 py-2 font-semibold text-[#BA1A1A] disabled:opacity-60"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}

          {activeStage === "load_assignment" && selectedCandidate ? (
            <div className="pointer-events-none absolute left-[28%] top-[52%] z-20 -translate-x-1/2 -translate-y-1/2">
              <div className="glass-panel rounded-lg border border-white/60 px-3 py-2 text-center shadow-[0_8px_32px_rgba(21,27,41,0.12)]">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#214cba]">Selected match</div>
                <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">{selectedCandidate.driverName}</div>
              </div>
            </div>
          ) : null}

          {activeStage === "morning_triage" ? (
            <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2">
              <div className="glass-panel flex items-center gap-4 rounded-full border border-white/60 px-6 py-3 text-sm shadow-[0_12px_40px_rgba(21,27,41,0.12)]">
                <div className="flex items-center gap-2 font-semibold text-[color:var(--navpro-text-strong)]">
                  <span className="h-2 w-2 rounded-full bg-[#214cba] animate-pulse" />
                  Optimizer active
                </div>
                <div className="h-4 w-px bg-[color:var(--navpro-border-soft)]" />
                <div className="text-[color:var(--navpro-text-muted)]">
                  {snapshot ? `${snapshot.activeTrips.length} live trips monitored` : "Syncing map"}
                </div>
              </div>
            </div>
          ) : null}

          {openDraft ? (
            isAlertPopupMinimized ? (
              <div className="pointer-events-auto absolute bottom-6 right-6 z-30 animate-[alert-dock-in_220ms_ease-out]">
                <button
                  type="button"
                  aria-label="Expand alert popup"
                  onClick={() => setIsAlertPopupMinimized(false)}
                  className="group flex items-center gap-3 rounded-full border border-[#ffd9d6] bg-white/95 py-2.5 pl-2.5 pr-4 text-left shadow-[0_18px_44px_rgba(186,26,26,0.22)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(186,26,26,0.28)]"
                >
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#fff0ee] text-[#BA1A1A]">
                    <span className="absolute inset-0 rounded-full bg-[#BA1A1A]/18 animate-ping" />
                    <Glyph name="warning" className="relative h-4 w-4" />
                    {visibleDrafts.length > 1 ? (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white bg-[#BA1A1A] px-1 text-[10px] font-bold text-white">
                        {visibleDrafts.length}
                      </span>
                    ) : null}
                  </span>
                  <div className="leading-tight">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#BA1A1A]">
                      {formatCountLabel(visibleDrafts.length, "live alert")}
                    </div>
                    <div className="text-[13px] font-bold text-[color:var(--navpro-text-strong)]">
                      {openDraft.tripId}
                    </div>
                  </div>
                  <span className="ml-1 rounded-full bg-[#fff5f4] px-2 py-1 text-[10px] font-semibold text-[#BA1A1A] opacity-0 transition-opacity group-hover:opacity-100">
                    Expand
                  </span>
                </button>
              </div>
            ) : (
              <div className="pointer-events-auto absolute right-6 top-24 z-30 w-[360px] rounded-xl border border-[#ffd9d6] bg-white shadow-[0_16px_40px_rgba(21,27,41,0.16)]">
                <div className="border-b border-[#ffd9d6] bg-[#fff5f4] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#BA1A1A]">
                        <Glyph name="warning" className="h-4 w-4" />
                        Live alert
                      </div>
                      <div className="mt-1 text-[18px] font-bold text-[color:var(--navpro-text-strong)]">Truck risk detected</div>
                      <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">
                        {formatCountLabel(visibleDrafts.length, "open alert")}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Minimize alert popup"
                      onClick={() => setIsAlertPopupMinimized(true)}
                      className="rounded-xl border border-[#f1d0cb] bg-white px-3 py-1.5 text-[16px] font-bold leading-none text-[color:var(--navpro-text-muted)]"
                    >
                      -
                    </button>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-4 text-[13px] leading-6 text-[color:var(--navpro-text-muted)]">
                  {visibleDrafts.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {visibleDrafts.map((draft) => (
                        <button
                          key={draft.id}
                          type="button"
                          onClick={() => setSelectedAlertDraftId(draft.id)}
                          className={[
                            "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
                            openDraft.id === draft.id
                              ? "border-[#BA1A1A] bg-[#fff5f4] text-[#BA1A1A]"
                              : "border-[color:var(--navpro-border-soft)] bg-white text-[color:var(--navpro-text-muted)]"
                          ].join(" ")}
                        >
                          {draft.tripId}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div>{cleanVoiceScriptForDisplay(openDraft.voiceScript)}</div>
                  <div className="rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-3">
                    Customer SMS: {openDraft.customerSms}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePlayVoice(openDraft)}
                      className="flex-1 rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-3 py-2 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(33,76,186,0.22)]"
                    >
                      Play voice
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAlertDraftId(openDraft.id);
                        setActiveStage("trip_monitoring");
                      }}
                      className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2 text-[12px] font-semibold text-[color:var(--navpro-text-muted)]"
                    >
                      Open action desk
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : null}

          {backhaulOpen && parsedLoad && selectedScore && selectedBackhaul ? (
            <div className="pointer-events-auto absolute inset-y-8 right-8 z-30 w-[430px] rounded-xl border border-[color:var(--navpro-border-soft)] bg-white shadow-[0_16px_40px_rgba(21,27,41,0.18)]">
              <div className="border-b border-[color:var(--navpro-border-soft)] px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                  Round-trip optimizer
                </div>
                <div className="mt-1 text-[22px] font-bold tracking-tight text-[color:var(--navpro-text-strong)]">
                  Backhaul pairing
                </div>
                <div className="mt-1 text-[13px] text-[color:var(--navpro-text-muted)]">
                  Found a winning return lane for {selectedScore.driverName}.
                </div>
              </div>

              <div className="navpro-scrollbar h-[calc(100%-96px)] overflow-y-auto px-5 py-5">
                <div className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#214cba]">Active leg</div>
                    <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">{formatMoney(parsedLoad.rateUsd)}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-[color:var(--navpro-text-strong)]">{parsedLoad.origin.city}</div>
                      <div className="text-xs text-[color:var(--navpro-text-muted)]">{parsedLoad.origin.state}</div>
                    </div>
                    <Glyph name="route" className="h-5 w-5 text-[color:var(--navpro-text-muted)]" />
                    <div className="text-right">
                      <div className="text-lg font-bold text-[color:var(--navpro-text-strong)]">{parsedLoad.destination.city}</div>
                      <div className="text-xs text-[color:var(--navpro-text-muted)]">{parsedLoad.destination.state}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#c7d7ff] bg-white p-4 shadow-[0_4px_12px_rgba(33,76,186,0.08)]">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#00598F]">Suggested backhaul</div>
                    <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">
                      {formatMoney(selectedBackhaul.returnLoad.rateUsd)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-[color:var(--navpro-text-strong)]">{selectedBackhaul.returnLoad.origin.city}</div>
                    </div>
                    <div className="flex-1 px-2">
                      <div className="h-px w-full bg-[color:var(--navpro-border-soft)]" />
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#214cba]">{selectedBackhaul.returnLoad.destination.city}</div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-2 text-[12px] text-[color:var(--navpro-text-muted)]">
                    {selectedBackhaul.narrative}
                  </div>
                  {(() => {
                    const chip = hosFitChip(selectedBackhaul);
                    return (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2 text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${chip.tone}`}>
                            {chip.label}
                          </span>
                          <span className="text-[color:var(--navpro-text-muted)]">
                            Round-trip needs {formatHours(selectedBackhaul.hosRequiredMin)} • driver has {formatHours(selectedBackhaul.hosAvailableMin)}
                          </span>
                        </div>
                        {!selectedBackhaul.hosFeasible ? (
                          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#A33939]">
                            Needs split / reset
                          </span>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                    Financial impact
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] p-4">
                      <div className="text-xs text-[color:var(--navpro-text-muted)]">Standalone profit</div>
                      <div className="mt-2 text-xl font-semibold text-[color:var(--navpro-text-strong)] opacity-70">
                        {formatMoney(selectedBackhaul.oneWayProfitUsd)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#c7d7ff] bg-white p-4 shadow-[0_4px_12px_rgba(33,76,186,0.08)]">
                      <div className="text-xs font-semibold text-[#214cba]">Optimized round-trip</div>
                      <div className="mt-2 text-2xl font-bold text-[#0E8A5B]">
                        {formatMoney(selectedBackhaul.roundTripProfitUsd)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                      Available backhauls
                    </div>
                    <div className="text-sm font-bold text-[#0E8A5B]">
                      +{formatMoney(selectedBackhaul.roundTripProfitUsd - selectedBackhaul.oneWayProfitUsd)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {backhauls.map((option) => {
                      const isActive = option.returnLoad.loadId === selectedBackhaul.returnLoad.loadId;
                      const chip = hosFitChip(option);
                      return (
                        <button
                          key={option.returnLoad.loadId}
                          type="button"
                          onClick={() => {
                            setSelectedReturnLoadId(option.returnLoad.loadId);
                            setPendingDispatchConfirmation(null);
                          }}
                          className={[
                            "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                            isActive
                              ? "border-[#214cba] bg-[#F5F9FF]"
                              : "border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)]",
                            !option.hosFeasible ? "opacity-90" : ""
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                {option.returnLoad.origin.city} → {option.returnLoad.destination.city}
                              </div>
                              <div className="mt-1 text-xs text-[color:var(--navpro-text-muted)]">
                                Revenue {formatMoney(option.returnLoad.rateUsd)} • deadhead {option.totalDeadheadMiles} mi
                              </div>
                            </div>
                            <div className="text-sm font-bold text-[#0E8A5B]">{formatMoney(option.roundTripProfitUsd)}</div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${chip.tone}`}>
                              {chip.label}
                            </span>
                            <span className="text-[10px] text-[color:var(--navpro-text-muted)]">
                              needs {formatHours(option.hosRequiredMin)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => queueDispatchConfirmation("round_trip", selectedBackhaul.returnLoad.loadId)}
                    disabled={isDispatching}
                    className="flex-1 rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-3 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(33,76,186,0.24)] disabled:opacity-60"
                  >
                    {pendingDispatchConfirmation?.mode === "round_trip" ? "Round-trip ready to confirm" : "Stage round-trip"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBackhaulOpen(false);
                      setPendingDispatchConfirmation(null);
                      setAssignmentFeedback("Backhaul review closed. Outbound assignment is still available from the dispatch desk.");
                    }}
                    disabled={isDispatching}
                    className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-4 py-3 text-[12px] font-semibold text-[color:var(--navpro-text-muted)] disabled:opacity-60"
                  >
                    Close review
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {isCreateRouteModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,32,51,0.45)] px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Create new trip"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsCreateRouteModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_24px_70px_rgba(16,32,51,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                  Create trip in DB
                </div>
                <div className="mt-1 text-lg font-bold text-[color:var(--navpro-text-strong)]">New active trip</div>
                <div className="mt-1 text-[12px] text-[color:var(--navpro-text-muted)]">
                  Pairs a driver with a load and writes the trip to the active-trip mirror.
                </div>
              </div>
              <button
                type="button"
                aria-label="Close create trip modal"
                onClick={() => setIsCreateRouteModalOpen(false)}
                className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-1.5 text-[16px] font-bold leading-none text-[color:var(--navpro-text-muted)]"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                  Driver
                </div>
                <select
                  value={routeCreateForm.driverId}
                  onChange={(event) =>
                    setRouteCreateForm((current) => ({
                      ...current,
                      driverId: event.target.value
                    }))
                  }
                  className="w-full rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none"
                >
                  {(snapshot?.drivers ?? []).map((driver) => (
                    <option key={driver.driverId} value={driver.driverId}>
                      {driver.name} • #{driver.driverId}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                  Load
                </div>
                <select
                  value={routeCreateForm.loadId}
                  onChange={(event) =>
                    setRouteCreateForm((current) => ({
                      ...current,
                      loadId: event.target.value
                    }))
                  }
                  className="w-full rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none"
                >
                  {(snapshot?.pendingLoads ?? []).map((load) => (
                    <option key={load.loadId} value={load.loadId}>
                      {load.loadId} • {load.origin.city} to {load.destination.city}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                  Initial status
                </div>
                <select
                  value={routeCreateForm.status}
                  onChange={(event) =>
                    setRouteCreateForm((current) => ({
                      ...current,
                      status: event.target.value as NonNullable<RouteDeskCreateRequest["status"]>
                    }))
                  }
                  className="w-full rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2.5 text-[13px] text-[color:var(--navpro-text-strong)] outline-none"
                >
                  {routeDeskStatusOptions.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>
                      {statusOption.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedRouteLoad ? (
              <div className="mt-4 rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] px-3 py-3 text-[12px] text-[color:var(--navpro-text-muted)]">
                <div className="font-semibold text-[color:var(--navpro-text-strong)]">
                  {selectedRouteLoad.origin.city}, {selectedRouteLoad.origin.state} to {selectedRouteLoad.destination.city}, {selectedRouteLoad.destination.state}
                </div>
                <div className="mt-1">{formatMoney(selectedRouteLoad.rateUsd)} • {selectedRouteLoad.customer ?? "Unassigned broker"}</div>
                <div className="mt-1">Pickup window ends {formatDateTime(selectedRouteLoad.pickupEndMs)}</div>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateRouteModalOpen(false)}
                className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-4 py-2.5 text-[12px] font-semibold text-[color:var(--navpro-text-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreateRoute()}
                disabled={isSavingRoute || !routeCreateForm.driverId || !routeCreateForm.loadId}
                className="rounded-xl bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(33,76,186,0.25)] disabled:opacity-60"
              >
                {isSavingRoute ? "Creating..." : "Create trip"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
