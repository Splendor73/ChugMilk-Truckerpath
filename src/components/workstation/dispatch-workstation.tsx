"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  DemoAdvancedRankingResponse,
  AgentStreamEvent,
  BackhaulOption,
  Driver,
  DriverScore,
  FleetAssignmentResponse,
  FleetSnapshotResponse,
  Load,
  MonitorDraftView,
  MonitorFeedResponse
} from "@/shared/contracts";
import {
  normalizeWorkstationStage,
  workstationStageLabels,
  workstationStageOrder,
  type WorkstationStage
} from "@/lib/navigation/workstation";
import {
  InteractiveDispatchMap,
  type DispatchMapHandle
} from "@/components/workstation/interactive-dispatch-map";
import { buildMapPresentationModel } from "@/components/workstation/map-presentation";

type DispatchWorkstationProps = {
  initialStage?: WorkstationStage;
  initialOperatorMode?: boolean;
};

type AgentFinalPayload = Extract<AgentStreamEvent, { type: "final" }>["payload"];
type DriverDeskFilter = "all" | "ready" | "active" | "rest" | "flagged";
type DispatchConfirmation =
  | { mode: "outbound" }
  | { mode: "round_trip"; returnLoadId: string };

const DEMO_LOAD_TEXT =
  "Phoenix to San Francisco dry van load. Pickup tomorrow 8am. Rate $3,200. Weight 38,000 lbs.";
const PANEL_WIDTH_STORAGE_KEY = "co-dispatch-panel-width";
const DEFAULT_PANEL_WIDTH = 620;
const DEFAULT_PANEL_RATIO = 1 / 3;
const MIN_PANEL_WIDTH = 520;
const MAX_PANEL_WIDTH = 920;
const RAIL_WIDTH = 72;

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

function stageHref(stage: WorkstationStage, operatorMode = false) {
  const params = new URLSearchParams();
  if (stage !== "morning_triage") {
    params.set("stage", stage);
  }
  if (operatorMode) {
    params.set("operator", "1");
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function driverStatusTone(driver: Driver) {
  if (driver.hosStatus === "must_rest") {
    return "bg-[#FCE8E8] text-[#A33939]";
  }
  if (driver.complianceFlags.length > 0) {
    return "bg-[#FFF3D7] text-[#996B00]";
  }
  return "bg-[#E7F0FF] text-[color:var(--navpro-text-primary)]";
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
    | "search"
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

  if (name === "search") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8">
        <circle cx="11" cy="11" r="5.5" />
        <path d="m16 16 4 4" />
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

function RailButton({
  active,
  label,
  glyph,
  onClick
}: {
  active?: boolean;
  label: string;
  glyph: Parameters<typeof Glyph>[0]["name"];
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex w-full flex-col items-center justify-center border-l-4 py-4 transition-all",
        active
          ? "border-[color:var(--navpro-text-primary)] bg-[#4066D4]/5 text-[#214cba]"
          : "border-transparent text-slate-400 hover:bg-white hover:text-[#4066D4]"
      ].join(" ")}
    >
      <Glyph name={glyph} className="mb-1 h-5 w-5" active={active} />
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em]">{label}</span>
    </button>
  );
}

function TopNavButton({
  active,
  label,
  onClick
}: {
  active?: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-11 items-center self-center px-4 text-[15px] font-medium leading-none transition-colors",
        active
          ? "border-b-2 border-[#214cba] text-[#214cba]"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      ].join(" ")}
    >
      {label}
    </button>
  );
}

const headerNavItems: Array<{
  label: string;
  stage: WorkstationStage;
}> = [
  { label: "Fleet", stage: "morning_triage" },
  { label: "Dispatch", stage: "load_assignment" },
  { label: "Monitor", stage: "trip_monitoring" }
];

type CandidateMetricKey = "deadhead" | "hos" | "fuel" | "eta" | "ripple";

const driverDeskFilters: Array<{ key: DriverDeskFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "active", label: "Active" },
  { key: "rest", label: "Rest" },
  { key: "flagged", label: "Flagged" }
];

export function DispatchWorkstation({
  initialStage = "morning_triage",
  initialOperatorMode = false
}: DispatchWorkstationProps) {
  const [activeStage, setActiveStage] = useState<WorkstationStage>(normalizeWorkstationStage(initialStage));
  const [operatorMode] = useState(initialOperatorMode);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [viewportWidth, setViewportWidth] = useState(1600);
  const [snapshot, setSnapshot] = useState<FleetSnapshotResponse | null>(null);
  const [monitorFeed, setMonitorFeed] = useState<MonitorFeedResponse | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [pasteInput, setPasteInput] = useState(DEMO_LOAD_TEXT);
  const [copilotSummary, setCopilotSummary] = useState("");
  const [parsedLoad, setParsedLoad] = useState<Load | null>(null);
  const [scores, setScores] = useState<DriverScore[]>([]);
  const [backhauls, setBackhauls] = useState<BackhaulOption[]>([]);
  const [backhaulDriverId, setBackhaulDriverId] = useState<number | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedDeskDriverId, setSelectedDeskDriverId] = useState<number | null>(null);
  const [selectedReturnLoadId, setSelectedReturnLoadId] = useState<string | null>(null);
  const [advancedShowcase, setAdvancedShowcase] = useState<DemoAdvancedRankingResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isOpeningBackhaul, setIsOpeningBackhaul] = useState(false);
  const [isTriggeringMonitor, setIsTriggeringMonitor] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingAdvancedShowcase, setIsLoadingAdvancedShowcase] = useState(false);
  const [backhaulOpen, setBackhaulOpen] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<string | null>(null);
  const [advancedShowcaseError, setAdvancedShowcaseError] = useState<string | null>(null);
  const [isOperatorRunning, setIsOperatorRunning] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState<CandidateMetricKey>("deadhead");
  const [driverSearch, setDriverSearch] = useState("");
  const [driverDeskFilter, setDriverDeskFilter] = useState<DriverDeskFilter>("all");
  const [pendingDispatchConfirmation, setPendingDispatchConfirmation] = useState<DispatchConfirmation | null>(null);
  const [dismissedDraftIds, setDismissedDraftIds] = useState<string[]>([]);
  const [draftOverrides, setDraftOverrides] = useState<Record<string, { voiceScript: string; customerSms: string }>>({});
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftEditor, setDraftEditor] = useState({ voiceScript: "", customerSms: "" });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mapRef = useRef<DispatchMapHandle | null>(null);
  const panelResizeStartRef = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    const nextHref = stageHref(activeStage, operatorMode);
    window.history.replaceState({}, "", nextHref);
  }, [activeStage, operatorMode]);

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
    const availableWidth = Math.max(viewportWidth - RAIL_WIDTH, 900);
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

  async function refreshAll(showRefresh = false) {
    await Promise.all([loadSnapshot(showRefresh), loadMonitorFeed()]);
  }

  useEffect(() => {
    void refreshAll();
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

  useEffect(() => {
    if (activeStage !== "load_assignment" || advancedShowcase || isLoadingAdvancedShowcase) {
      return;
    }

    void handleLoadAdvancedShowcase();
  }, [activeStage, advancedShowcase, isLoadingAdvancedShowcase]);

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
    const query = driverSearch.trim().toLowerCase();

    return (snapshot?.drivers ?? []).filter((driver) => {
      if (!matchesDriverDeskFilter(driver, driverDeskFilter)) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = `${driver.name} ${driver.driverId} ${driver.homeBase.city} ${driver.phone}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [driverDeskFilter, driverSearch, snapshot]);

  const selectedDeskDriver =
    driverDeskRows.find((driver) => driver.driverId === selectedDeskDriverId) ??
    driverById.get(selectedDeskDriverId ?? -1) ??
    driverDeskRows[0] ??
    snapshot?.drivers[0] ??
    null;

  const visibleDrafts = useMemo(() => {
    return (monitorFeed?.drafts ?? [])
      .filter((draft) => !dismissedDraftIds.includes(draft.id))
      .map((draft) => {
        const override = draftOverrides[draft.id];
        return override
          ? {
              ...draft,
              voiceScript: override.voiceScript,
              customerSms: override.customerSms
            }
          : draft;
      });
  }, [dismissedDraftIds, draftOverrides, monitorFeed]);

  const activeTrip = useMemo(() => {
    if (!snapshot) {
      return null;
    }
    if (visibleDrafts[0]) {
      return snapshot.activeTrips.find((trip) => trip.tripId === visibleDrafts[0].tripId) ?? null;
    }
    return snapshot.activeTrips.find((trip) => trip.status !== "on_track") ?? snapshot.activeTrips[0] ?? null;
  }, [snapshot, visibleDrafts]);

  const readyDrivers = (snapshot?.drivers ?? [])
    .filter((driver) => driver.hosStatus === "fresh" && !driver.activeTripId)
    .slice(0, 6);

  const restRiskDrivers = (snapshot?.drivers ?? [])
    .filter((driver) => driver.hosStatus === "must_rest" || driver.hosRemainingMin < 120)
    .slice(0, 4);

  const complianceItems = (snapshot?.drivers ?? [])
    .flatMap((driver) =>
      driver.complianceFlags.map((flag) => ({
        driver,
        flag
      }))
    )
    .slice(0, 4);

  const monitoringRows = monitorFeed?.decisionLog.slice(0, 6) ?? [];
  const openDraft = visibleDrafts[0] ?? null;

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
    if (!openDraft || isEditingDraft) {
      return;
    }

    const override = draftOverrides[openDraft.id];
    setDraftEditor({
      voiceScript: override?.voiceScript ?? openDraft.voiceScript,
      customerSms: override?.customerSms ?? openDraft.customerSms
    });
  }, [draftOverrides, isEditingDraft, openDraft]);

  async function handleAnalyzeLoad() {
    setIsAnalyzing(true);
    setAssignmentFeedback(null);
    setPendingDispatchConfirmation(null);
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

  async function handleLoadAdvancedShowcase() {
    setIsLoadingAdvancedShowcase(true);
    try {
      const response = await fetch("/api/demo/advanced-ranking", { cache: "no-store" });
      const payload = (await response.json()) as DemoAdvancedRankingResponse;
      setAdvancedShowcase(payload);
      setAdvancedShowcaseError(null);
    } catch (error) {
      setAdvancedShowcaseError(error instanceof Error ? error.message : "Advanced showcase failed to load.");
    } finally {
      setIsLoadingAdvancedShowcase(false);
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
      await fetch("/api/monitor/interventions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          matchedCommand: "execute"
        })
      });
      await refreshAll(true);
      setAssignmentFeedback("Intervention executed, trip recovered, and decision log updated.");
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : "Execution failed.");
    } finally {
      setIsExecuting(false);
    }
  }

  function handleStartDraftEdit() {
    if (!openDraft) {
      return;
    }

    setDraftEditor({
      voiceScript: openDraft.voiceScript,
      customerSms: openDraft.customerSms
    });
    setIsEditingDraft(true);
  }

  function handleSaveDraftEdit() {
    if (!openDraft) {
      return;
    }

    setDraftOverrides((current) => ({
      ...current,
      [openDraft.id]: {
        voiceScript: draftEditor.voiceScript.trim() || openDraft.voiceScript,
        customerSms: draftEditor.customerSms.trim() || openDraft.customerSms
      }
    }));
    setIsEditingDraft(false);
    setAssignmentFeedback("Draft edits saved in the workstation preview.");
  }

  function handleDismissDraft(draftId: string) {
    setDismissedDraftIds((current) => (current.includes(draftId) ? current : [...current, draftId]));
    setIsEditingDraft(false);
    setAssignmentFeedback("Alert dismissed from the desk. Refresh the feed to bring it back.");
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
        setAdvancedShowcase(null);
        setPendingDispatchConfirmation(null);
        setDismissedDraftIds([]);
        setDraftOverrides({});
        setIsEditingDraft(false);
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
        driverById
      }),
    [activeStage, snapshot, activeTrip, openDraft, parsedLoad, selectedScore, selectedBackhaul, backhaulOpen, driverById]
  );

  const activeStageTabs: Array<{ stage: WorkstationStage; description: string }> = [
    { stage: "morning_triage", description: "7:00 AM shift start" },
    { stage: "load_assignment", description: "9:00 AM assignment" },
    { stage: "trip_monitoring", description: "In-transit intervention" }
  ];

  const monitoringHeadline = openDraft
    ? `Urgent: ${openDraft.trigger.replace(/_/g, " ")} on ${openDraft.tripId}`
    : "No open intervention drafts";

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
  const workstationStyle = {
    "--workstation-panel-width": `${panelWidth}px`
  } as CSSProperties;

  function handlePanelResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    panelResizeStartRef.current = {
      x: event.clientX,
      width: panelWidth
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <div className="bg-shell h-screen overflow-hidden">
      <div
        className="grid h-screen grid-cols-[72px_var(--workstation-panel-width)_minmax(0,1fr)] grid-rows-[var(--navpro-header-height)_1fr] overflow-hidden max-[1024px]:grid-cols-1 max-[1024px]:grid-rows-[var(--navpro-header-height)_auto_auto]"
        style={workstationStyle}
      >
        <header className="col-span-full flex h-[80px] items-center justify-between border-b border-[color:var(--navpro-border-soft)] bg-white px-8">
          <div className="flex items-center gap-8">
            <div className="flex items-center">
              <span className="leading-none text-[24px] font-bold tracking-tight text-[#214cba]">NavPro Co-Dispatch</span>
            </div>

            <nav className="hidden items-center gap-2 md:flex">
              {headerNavItems.map((item) => {
                const isActive =
                  activeStage === item.stage || (item.stage === "load_assignment" && activeStage === "backhaul_review");

                return (
                  <TopNavButton
                    key={item.stage}
                    label={item.label}
                    active={isActive}
                    onClick={() => setActiveStage(item.stage)}
                  />
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-lg border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-input)] px-4 py-3.5 text-[12px] md:flex">
              <div className="rounded-full bg-[#E7F0FF] px-3 py-1 font-semibold uppercase tracking-[0.08em] text-[#214cba]">
                Live workstation
              </div>
              <div className="text-[color:var(--navpro-text-muted)]">
                {snapshot
                  ? `Fleet sync ${formatTime(snapshot.fetchedAtMs)} • ${snapshot.drivers.length} drivers`
                  : "Syncing fleet data"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void refreshAll(true)}
              className="hidden rounded-lg border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-input)] px-4 py-3.5 text-[13px] font-semibold text-[color:var(--navpro-text-muted)] md:block"
            >
              {isRefreshing ? "Syncing..." : "Refresh"}
            </button>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#b5c4ff] text-xs font-bold text-[#214cba] ring-2 ring-white">
              TC
            </div>
          </div>
        </header>

        <aside className="row-start-2 border-r border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-rail)] max-[1024px]:hidden">
            <div className="flex h-full flex-col">
              <div className="flex-1 py-4">
                <RailButton active={activeStage === "morning_triage"} label="Dash" glyph="dashboard" onClick={() => setActiveStage("morning_triage")} />
                <RailButton
                  active={activeStage === "load_assignment" || activeStage === "backhaul_review"}
                label="Map"
                glyph="map"
                onClick={() => setActiveStage("load_assignment")}
                />
                <RailButton label="Loads" glyph="truck" onClick={() => setActiveStage("load_assignment")} />
                <RailButton label="Drivers" glyph="drivers" onClick={() => setActiveStage("morning_triage")} />
                <RailButton label="Stats" glyph="analytics" onClick={() => setActiveStage("trip_monitoring")} />
              </div>
            </div>
        </aside>

        <section className="navpro-scrollbar relative row-start-2 overflow-y-auto border-r border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-panel)] max-[1024px]:border-r-0">
          <div className="sticky top-0 z-10 border-b border-[color:var(--navpro-border-soft)] bg-white/95 px-6 pb-4 pt-6 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--navpro-text-subtle)]">Dispatch desk</div>
                <div className="mt-1 text-[26px] font-bold tracking-tight text-[color:var(--navpro-text-strong)]">
                  {workstationStageLabels[activeStage]}
                </div>
                <div className="mt-1 text-[13px] text-[color:var(--navpro-text-muted)]">
                  {activeStageTabs.find((tab) =>
                    tab.stage === activeStage || (activeStage === "backhaul_review" && tab.stage === "load_assignment")
                  )?.description ?? "Dispatcher workstation"}
                </div>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <div className="rounded-full border border-[color:var(--navpro-border-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                  {snapshot ? `${snapshot.activeTrips.length} live trips` : "Syncing trips"}
                </div>
              </div>
            </div>

            <div className="flex gap-0 border-b border-[color:var(--navpro-border-soft)]">
              {activeStageTabs.map((tab) => {
                const isActive = activeStage === tab.stage || (tab.stage === "load_assignment" && activeStage === "backhaul_review");
                return (
                  <button
                    key={tab.stage}
                    type="button"
                    onClick={() => setActiveStage(tab.stage)}
                    className={[
                      "flex-1 border-b-[3px] px-2 py-3 text-center text-[14px] font-semibold",
                      isActive
                        ? "border-[color:var(--navpro-text-primary)] text-[color:var(--navpro-text-primary)]"
                        : "border-transparent text-[color:var(--navpro-text-subtle)]"
                    ].join(" ")}
                  >
                    {workstationStageLabels[tab.stage]}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            aria-label="Resize left panel"
            onPointerDown={handlePanelResizeStart}
            className="absolute right-0 top-0 z-20 hidden h-full w-3 translate-x-1/2 cursor-col-resize items-center justify-center max-[1024px]:hidden lg:flex"
          >
            <span className="h-20 w-[3px] rounded-full bg-[color:var(--navpro-border-soft)] shadow-[0_0_0_1px_rgba(255,255,255,0.7)] transition-colors hover:bg-[#214cba]" />
          </button>

          <div className="space-y-5 px-6 py-5 text-[13px]">
            {activeStage === "morning_triage" ? (
              <>
                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] p-5">
                  <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                    <Glyph name="spark" className="h-4 w-4 text-[#214cba]" />
                    Fleet brief
                  </div>
                  <div className="rounded-xl bg-white px-4 py-4 shadow-[0_4px_12px_rgba(21,27,41,0.03)]">
                    <div className="text-[15px] font-semibold leading-6 text-[color:var(--navpro-text-strong)]">
                      {snapshot?.morningBrief.headline ?? "Loading fleet morning brief..."}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                      <div className="rounded-lg bg-[#E7F0FF] px-3 py-2 text-[#214cba]">
                        <div className="font-bold">{snapshot?.morningBrief.readyCount ?? "--"}</div>
                        <div className="uppercase tracking-[0.08em]">Ready</div>
                      </div>
                      <div className="rounded-lg bg-[#FFF3D7] px-3 py-2 text-[#996B00]">
                        <div className="font-bold">{snapshot?.morningBrief.restSoonCount ?? "--"}</div>
                        <div className="uppercase tracking-[0.08em]">Rest</div>
                      </div>
                      <div className="rounded-lg bg-[#FFE5E2] px-3 py-2 text-[#BA1A1A]">
                        <div className="font-bold">{snapshot?.morningBrief.complianceFlagCount ?? "--"}</div>
                        <div className="uppercase tracking-[0.08em]">Flags</div>
                      </div>
                      <div className="rounded-lg bg-[#E9EDFF] px-3 py-2 text-[#485CC7]">
                        <div className="font-bold">{snapshot?.morningBrief.inMaintenanceCount ?? "--"}</div>
                        <div className="uppercase tracking-[0.08em]">Idle</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                      Priority queue
                    </div>
                    <div className="rounded-full bg-[#FFE5E2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#BA1A1A]">
                      {complianceItems.length + restRiskDrivers.length} flags
                    </div>
                  </div>

                  {complianceItems.slice(0, 2).map(({ driver, flag }) => (
                    <div key={`${driver.driverId}-${flag.kind}`} className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-4 shadow-[0_4px_12px_rgba(21,27,41,0.03)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={driver.name} tone="blue" />
                          <div>
                            <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">{driver.name}</div>
                            <div className="text-xs text-[color:var(--navpro-text-muted)]">
                              Unit #{driver.driverId} • {driver.homeBase.city}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-sm bg-[#FFE5E2] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#BA1A1A]">
                          Compliance
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-2 text-[12px] text-[color:var(--navpro-text-muted)]">
                        {flag.message}
                      </div>
                    </div>
                  ))}

                  {restRiskDrivers.slice(0, 2).map((driver) => (
                    <div key={driver.driverId} className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={driver.name} tone="amber" />
                          <div>
                            <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">{driver.name}</div>
                            <div className="text-xs text-[color:var(--navpro-text-muted)]">
                              Rest risk in {formatHours(driver.hosRemainingMin)}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-sm bg-[#FFF3D7] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#996B00]">
                          HOS alert
                        </div>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                        Driver desk
                      </div>
                      <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                        Search the live roster and inspect the selected seat before dispatch.
                      </div>
                    </div>
                    <div className="rounded-full bg-[color:var(--navpro-bg-muted)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                      {driverDeskRows.length} shown
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-input)] px-3 py-3">
                    <div className="flex items-center gap-2 text-[color:var(--navpro-text-muted)]">
                      <Glyph name="search" className="h-4 w-4" />
                      <input
                        value={driverSearch}
                        onChange={(event) => setDriverSearch(event.target.value)}
                        placeholder="Search driver, unit, city, or phone"
                        aria-label="Search drivers"
                        className="w-full bg-transparent text-[13px] outline-none placeholder:text-[color:var(--navpro-text-subtle)]"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
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
                      No drivers match the current search and filter.
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    {driverDeskRows.slice(0, 6).map((driver) => {
                      const status = getDriverDeskStatus(driver);
                      const isActive = selectedDeskDriver?.driverId === driver.driverId;
                      return (
                        <button
                          key={driver.driverId}
                          type="button"
                          onClick={() => setSelectedDeskDriverId(driver.driverId)}
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
                        setPasteInput(DEMO_LOAD_TEXT);
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
                      disabled={isAnalyzing}
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

                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                        Advanced engine showcase
                      </div>
                      <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                        Seeded operational signals for POI, POD, BOL, ELD, fuel, HOS, ETA, and performance
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleLoadAdvancedShowcase()}
                      disabled={isLoadingAdvancedShowcase}
                      className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-input)] px-3 py-2 text-[12px] font-semibold text-[#214cba] disabled:opacity-60"
                    >
                      {isLoadingAdvancedShowcase ? "Refreshing..." : "Refresh showcase"}
                    </button>
                  </div>

                  <div className="rounded-xl bg-[color:var(--navpro-bg-muted)] px-4 py-3 text-[12px] leading-6 text-[color:var(--navpro-text-muted)]">
                    {advancedShowcase?.explanation ??
                      "This panel shows seeded operational evidence stored in SQLite and ranked by the same decision engine used in the workstation."}
                  </div>

                  {advancedShowcase ? (
                    <div className="mt-4 space-y-3">
                      {advancedShowcase.rankedDrivers.map((driver) => (
                        (() => {
                          const hosBreakdown = driver.breakdown.find((item) => item.key === "hos");
                          return (
                        <div
                          key={`advanced-${driver.driverId}`}
                          className={[
                            "rounded-xl border p-4",
                            driver.recommended
                              ? "border-[#c7d7ff] bg-[#f5f9ff]"
                              : driver.eliminated
                                ? "border-[#ffd9d6] bg-[#fff7f6]"
                                : "border-[color:var(--navpro-border-soft)] bg-white"
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--navpro-bg-muted)] text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                {driver.rank}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                    {driver.driverName}
                                  </div>
                                  {driver.recommended ? (
                                    <div className="rounded-full bg-[#214cba] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                                      Recommended
                                    </div>
                                  ) : null}
                                  {driver.eliminated ? (
                                    <div className="rounded-full bg-[#BA1A1A] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                                      Eliminated
                                    </div>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs text-[color:var(--navpro-text-muted)]">
                                  {driver.signals.deadheadMiles} mi deadhead • {formatHours(driver.signals.etaBufferMin)} ETA buffer • home {driver.signals.eldViolationCount} ELD violations
                                </div>
                              </div>
                            </div>
                            <div className="rounded-full bg-[color:var(--navpro-bg-muted)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                              {driver.score}/100
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                            <ShowcaseMetric
                              label="HOS"
                              value={hosBreakdown?.rawValue ?? "n/a"}
                              detail="legal drive-time fit"
                            />
                            <ShowcaseMetric label="Fuel" value={formatMoney(driver.signals.fuelCostUsd)} detail={`${driver.signals.fuelEfficiencyMpg.toFixed(1)} mpg`} />
                            <ShowcaseMetric label="POD" value={formatPercent(driver.signals.podOnTimeRate)} detail="on-time proof" />
                            <ShowcaseMetric label="BOL" value={formatPercent(driver.signals.bolAccuracyRate)} detail="doc accuracy" />
                            <ShowcaseMetric label="ELD" value={formatPercent(driver.signals.eldComplianceScore)} detail={`${driver.signals.eldViolationCount} violations`} />
                            <ShowcaseMetric label="POI fuel" value={`${driver.signals.poiFuelStopMiles} mi`} detail="nearest stop" />
                            <ShowcaseMetric label="POI parking" value={`${driver.signals.poiSafeParkingMiles} mi`} detail="safe parking" />
                            <ShowcaseMetric label="Performance" value={`${driver.signals.driverPerformanceScore}/100`} detail="recent ops" />
                          </div>

                          <div className="mt-3 rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-3 text-[12px] leading-6 text-[color:var(--navpro-text-muted)]">
                            <span className="font-semibold text-[color:var(--navpro-text-strong)]">Why ranked here:</span> {driver.eliminationReason ?? driver.summary}
                          </div>

                          <div className="mt-3 grid gap-2 md:grid-cols-3">
                            {driver.breakdown.slice(0, 6).map((item) => (
                              <div key={`${driver.driverId}-${item.key}`} className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">
                                  {item.label}
                                </div>
                                <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">
                                  {item.rawValue}
                                </div>
                                <div className="mt-1 text-[11px] text-[#214cba]">+{item.contribution.toFixed(1)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                          );
                        })()
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-[12px] text-[color:var(--navpro-text-muted)]">
                      {advancedShowcaseError ?? "Loading advanced engine showcase..."}
                    </div>
                  )}
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
                  <div className="mt-2 text-[12px] leading-6 text-[color:var(--navpro-text-muted)]">
                    {openDraft?.customerSms ?? "No intervention package is open right now."}
                  </div>
                </section>

                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                      Action desk
                    </div>
                    {openDraft ? (
                      <div className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#214cba]">
                        Execute / Edit / Dismiss
                      </div>
                    ) : null}
                  </div>
                  {openDraft ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleExecuteIntervention(openDraft.id)}
                          disabled={isExecuting}
                          className="rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(33,76,186,0.2)] disabled:opacity-60"
                        >
                          {isExecuting ? "Executing..." : "Execute now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => (isEditingDraft ? handleSaveDraftEdit() : handleStartDraftEdit())}
                          className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-4 py-2.5 text-[12px] font-semibold text-[color:var(--navpro-text-muted)]"
                        >
                          {isEditingDraft ? "Save edit" : "Edit draft"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissDraft(openDraft.id)}
                          className="rounded-lg border border-[#ffd9d6] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#BA1A1A]"
                        >
                          Dismiss
                        </button>
                      </div>

                      <div className="rounded-xl bg-white p-4 shadow-[0_4px_12px_rgba(21,27,41,0.03)]">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[color:var(--navpro-text-strong)]">
                          <Glyph name="voice" className="h-4 w-4 text-[#214cba]" />
                          Voice script
                        </div>
                        {isEditingDraft ? (
                          <textarea
                            value={draftEditor.voiceScript}
                            onChange={(event) => setDraftEditor((current) => ({ ...current, voiceScript: event.target.value }))}
                            rows={4}
                            aria-label="Edit voice script"
                            className="w-full resize-none rounded-lg border border-[color:var(--navpro-border-input)] bg-[color:var(--navpro-bg-input)] px-3 py-3 text-[12px] leading-6 text-[color:var(--navpro-text)] outline-none"
                          />
                        ) : (
                          <div className="text-[12px] leading-6 text-[color:var(--navpro-text-muted)]">{openDraft.voiceScript}</div>
                        )}
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
                        {isEditingDraft ? (
                          <textarea
                            value={draftEditor.customerSms}
                            onChange={(event) => setDraftEditor((current) => ({ ...current, customerSms: event.target.value }))}
                            rows={4}
                            aria-label="Edit customer SMS"
                            className="w-full resize-none rounded-lg border border-[color:var(--navpro-border-input)] bg-[color:var(--navpro-bg-input)] px-3 py-3 text-[12px] leading-6 text-[color:var(--navpro-text)] outline-none"
                          />
                        ) : (
                          <div className="rounded-lg bg-[color:var(--navpro-bg-muted)] px-3 py-3 text-[12px] italic leading-6 text-[color:var(--navpro-text-muted)]">
                            “{openDraft.customerSms}”
                          </div>
                        )}
                      </div>
                      {isEditingDraft ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveDraftEdit()}
                            className="rounded-lg bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(33,76,186,0.2)]"
                          >
                            Save draft
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingDraft(false);
                              setDraftEditor({
                                voiceScript: openDraft.voiceScript,
                                customerSms: openDraft.customerSms
                              });
                            }}
                            className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-4 py-2.5 text-[12px] font-semibold text-[color:var(--navpro-text-muted)]"
                          >
                            Cancel edit
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-[12px] text-[color:var(--navpro-text-muted)]">No intervention drafts are open.</div>
                  )}
                </section>

                <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white p-4">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-muted)]">
                    Voice approval
                  </div>
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-[color:var(--navpro-bg-muted)] px-4 py-6">
                    <button
                      type="button"
                      onClick={() => (openDraft ? void handlePlayVoice(openDraft) : undefined)}
                      className="relative grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,#214cba_0%,#4066d4_100%)] text-white shadow-[0_0_20px_rgba(33,76,186,0.35)]"
                    >
                      <span className="absolute inset-0 animate-ping rounded-full bg-[#214cba]/30" />
                      <Glyph name="voice" className="relative h-8 w-8" />
                    </button>
                    <div className="text-sm font-semibold text-[#214cba]">
                      Say <span className="font-bold text-[color:var(--navpro-text-strong)]">“Execute”</span> to approve relay.
                    </div>
                    {openDraft?.matchedCommand ? (
                      <div className="text-[12px] text-[color:var(--navpro-text-muted)]">
                        Last command: {openDraft.matchedCommand}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => (openDraft ? void handleExecuteIntervention(openDraft.id) : undefined)}
                      disabled={!openDraft || isExecuting}
                      className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-4 py-2 text-[12px] font-semibold text-[color:var(--navpro-text-muted)] disabled:opacity-60"
                    >
                      {isExecuting ? "Executing..." : "Execute from drawer"}
                    </button>
                  </div>
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

            {(snapshotError || monitorError || assignmentFeedback || audioStatus || advancedShowcaseError) ? (
              <section className="rounded-xl border border-[color:var(--navpro-border-soft)] bg-white px-4 py-3 text-[12px] text-[color:var(--navpro-text-muted)]">
                {[snapshotError, monitorError, assignmentFeedback, audioStatus, advancedShowcaseError].filter(Boolean).join(" • ")}
              </section>
            ) : null}
          </div>
        </section>

        <section className="relative row-start-2 overflow-hidden bg-[#dfe7f3] max-[1024px]:min-h-[620px]">
          <InteractiveDispatchMap
            ref={mapRef}
            viewport={mapPresentation.viewport}
            routes={mapPresentation.routes}
            markers={mapPresentation.markers}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(233,237,255,0.12)_0%,rgba(233,237,255,0.06)_18%,rgba(233,237,255,0.02)_36%,rgba(233,237,255,0.04)_100%)]" />

          <div className="pointer-events-auto absolute left-6 top-6 z-20 flex items-center gap-3">
            <div className="glass-panel rounded-lg border border-white/60 px-4 py-2 text-[14px] font-semibold text-[color:var(--navpro-text-strong)] shadow-[0_8px_32px_rgba(21,27,41,0.08)]">
              {activeStage === "morning_triage" && snapshot?.morningBrief.headline}
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
            <div className="pointer-events-auto absolute right-6 top-24 z-30 w-[360px] rounded-xl border border-[#ffd9d6] bg-white shadow-[0_16px_40px_rgba(21,27,41,0.16)]">
              <div className="border-b border-[#ffd9d6] bg-[#fff5f4] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#BA1A1A]">
                  <Glyph name="warning" className="h-4 w-4" />
                  Live alert
                </div>
                <div className="mt-1 text-[18px] font-bold text-[color:var(--navpro-text-strong)]">Truck risk detected</div>
              </div>
              <div className="space-y-3 px-4 py-4 text-[13px] leading-6 text-[color:var(--navpro-text-muted)]">
                <div>{openDraft.voiceScript}</div>
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
                    onClick={() => setActiveStage("trip_monitoring")}
                    className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-white px-3 py-2 text-[12px] font-semibold text-[color:var(--navpro-text-muted)]"
                  >
                    Open action desk
                  </button>
                </div>
              </div>
            </div>
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
                              : "border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)]"
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
    </div>
  );
}

function ShowcaseMetric({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--navpro-border-soft)] bg-[color:var(--navpro-bg-muted)] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--navpro-text-subtle)]">{label}</div>
      <div className="mt-1 text-sm font-bold text-[color:var(--navpro-text-strong)]">{value}</div>
      <div className="mt-1 text-[11px] text-[color:var(--navpro-text-muted)]">{detail}</div>
    </div>
  );
}
