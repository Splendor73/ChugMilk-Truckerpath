import type { BackhaulOption, Driver, DriverScore, FleetSnapshotResponse, Load, MonitorDraftView } from "@/shared/contracts";
import type {
  DispatchMapMarker,
  DispatchMapRoute,
  DispatchMapViewport
} from "@/components/workstation/interactive-dispatch-map";
import type { WorkstationStage } from "@/lib/navigation/workstation";

type Coordinates = { lat: number; lng: number };

export type MapPresentationInput = {
  activeStage: WorkstationStage;
  snapshot: FleetSnapshotResponse | null;
  activeTrip: FleetSnapshotResponse["activeTrips"][number] | null;
  openDraft: MonitorDraftView | null;
  parsedLoad: Load | null;
  selectedScore: DriverScore | null;
  hoveredDriverId?: number | null;
  selectedBackhaul: BackhaulOption | null;
  backhaulOpen: boolean;
  driverById: Map<number, Driver>;
};

export type MapPresentationModel = {
  viewport: DispatchMapViewport;
  routes: DispatchMapRoute[];
  markers: DispatchMapMarker[];
};

function midpoint(points: Coordinates[]) {
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  return { lat, lng };
}

function spread(points: Coordinates[]) {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  return {
    lat: Math.max(...lats) - Math.min(...lats),
    lng: Math.max(...lngs) - Math.min(...lngs)
  };
}

function viewportFromPoints(points: Coordinates[], fallback: DispatchMapViewport): DispatchMapViewport {
  if (points.length === 0) {
    return fallback;
  }

  const center = midpoint(points);
  const range = spread(points);
  const span = Math.max(range.lng, range.lat * 1.45);

  let zoom = 3.3;
  if (span < 2.5) {
    zoom = 6.2;
  } else if (span < 5) {
    zoom = 5.4;
  } else if (span < 9) {
    zoom = 4.8;
  } else if (span < 15) {
    zoom = 4.2;
  } else if (span < 25) {
    zoom = 3.7;
  }

  return {
    centerLat: center.lat,
    centerLng: center.lng,
    zoom
  };
}

function routePoints(route: DispatchMapRoute | null) {
  return route ? route.points : [];
}

function tripPoints(trip: FleetSnapshotResponse["activeTrips"][number] | null) {
  if (!trip) {
    return [];
  }

  return [...trip.plannedRoute, trip.currentLoc];
}

export function buildMapPresentationModel(input: MapPresentationInput): MapPresentationModel {
  const defaultViewport = {
    centerLat: 39.5,
    centerLng: -98.35,
    zoom: 3.2
  };
  const hoveredDriver = input.hoveredDriverId ? input.driverById.get(input.hoveredDriverId) ?? null : null;
  const selectedDriver = input.selectedScore ? input.driverById.get(input.selectedScore.driverId) ?? null : null;
  const previewDriver = hoveredDriver ?? selectedDriver;
  const outboundTrip = input.parsedLoad
    ? input.snapshot?.activeTrips.find((trip) => trip.loadId === input.parsedLoad?.loadId) ?? null
    : null;
  const returnTrip = input.selectedBackhaul
    ? input.snapshot?.activeTrips.find((trip) => trip.loadId === input.selectedBackhaul?.returnLoad.loadId) ?? null
    : null;
  const showOutboundOverlay = Boolean(
    input.parsedLoad && (input.activeStage === "load_assignment" || input.activeStage === "backhaul_review" || outboundTrip)
  );
  const showReturnOverlay = Boolean(input.parsedLoad && input.selectedBackhaul && (input.backhaulOpen || returnTrip));

  const routes: DispatchMapRoute[] = [];
  for (const trip of input.snapshot?.activeTrips ?? []) {
    const assignmentTrip =
      trip.loadId === input.parsedLoad?.loadId || trip.loadId === input.selectedBackhaul?.returnLoad.loadId;
    const selectedDriverTrip = trip.driverId === input.selectedScore?.driverId;

    if (trip.plannedRoute.length > 1) {
      routes.push({
        id: trip.tripId,
        points: trip.plannedRoute,
        stroke:
          trip.tripId === input.activeTrip?.tripId
            ? "#214CBA"
            : assignmentTrip
              ? "#335FD6"
              : selectedDriverTrip
                ? "#5E7BCE"
                : "#9EB0D8",
        width:
          trip.tripId === input.activeTrip?.tripId ? 2.8 : assignmentTrip ? 2.5 : selectedDriverTrip ? 2.2 : 1.6,
        dashed: trip.status !== "on_track",
        opacity:
          trip.tripId === input.activeTrip?.tripId ? 0.98 : assignmentTrip ? 0.9 : selectedDriverTrip ? 0.84 : 0.62
      });
    }
  }

  if (showOutboundOverlay && input.parsedLoad) {
    routes.push({
      id: `load-${input.parsedLoad.loadId}`,
      points: [input.parsedLoad.origin, input.parsedLoad.destination],
      stroke: "#214CBA",
      width: outboundTrip ? 4.2 : 3.6,
      opacity: outboundTrip ? 0.98 : 0.94
    });
  }

  if (input.parsedLoad && previewDriver && input.activeStage !== "morning_triage") {
    routes.push({
      id: `deadhead-driver-${previewDriver.driverId}-load-${input.parsedLoad.loadId}`,
      points: [previewDriver.currentLocation, input.parsedLoad.origin],
      stroke: hoveredDriver ? "#D97706" : "#C67A12",
      width: hoveredDriver ? 3.1 : 2.6,
      dashed: true,
      opacity: hoveredDriver ? 0.92 : 0.78
    });
  }

  if (showReturnOverlay && input.parsedLoad && input.selectedBackhaul) {
    routes.push({
      id: `backhaul-${input.selectedBackhaul.returnLoad.loadId}`,
      points: [
        input.parsedLoad.destination,
        input.selectedBackhaul.returnLoad.origin,
        input.selectedBackhaul.returnLoad.destination
      ],
      stroke: "#0E8A5B",
      width: returnTrip ? 4.2 : 4,
      opacity: returnTrip ? 0.98 : 0.94
    });
  }

  const markers: DispatchMapMarker[] = [
    ...(input.snapshot?.drivers.map((driver) => ({
      id: `driver-${driver.driverId}`,
      lat: driver.currentLocation.lat,
      lng: driver.currentLocation.lng,
      label: driver.name.split(" ")[0] ?? driver.name,
      kind: "driver" as const,
      state:
        driver.driverId === hoveredDriver?.driverId
          ? ("hovered" as const)
          : driver.driverId === input.selectedScore?.driverId || driver.driverId === input.openDraft?.relayDriverId
            ? ("selected" as const)
            : input.activeStage === "morning_triage" &&
                (driver.complianceFlags.length > 0 || driver.hosStatus !== "fresh")
              ? ("alert" as const)
              : ("default" as const),
      emphasized:
        driver.driverId === hoveredDriver?.driverId ||
        driver.driverId === input.selectedScore?.driverId ||
        driver.driverId === input.openDraft?.relayDriverId ||
        (input.activeStage === "morning_triage" && (driver.complianceFlags.length > 0 || driver.hosStatus !== "fresh"))
    })) ?? []),
    ...(input.snapshot?.activeTrips.map((trip) => ({
      id: `trip-${trip.tripId}`,
      lat: trip.currentLoc.lat,
      lng: trip.currentLoc.lng,
      label: trip.tripId,
      kind: "trip" as const,
      state:
        trip.tripId === input.activeTrip?.tripId || trip.driverId === input.selectedScore?.driverId
          ? ("selected" as const)
          : input.activeStage === "morning_triage" && trip.status !== "on_track"
            ? ("alert" as const)
            : ("default" as const),
      emphasized:
        trip.tripId === input.activeTrip?.tripId ||
        trip.driverId === input.selectedScore?.driverId ||
        (input.activeStage === "morning_triage" && trip.status !== "on_track")
    })) ?? [])
  ];

  if (showOutboundOverlay && input.parsedLoad) {
    markers.push(
      {
        id: `load-origin-${input.parsedLoad.loadId}`,
        lat: input.parsedLoad.origin.lat,
        lng: input.parsedLoad.origin.lng,
        label: `${input.parsedLoad.origin.city} Pickup`,
        kind: "load",
        state: "selected",
        emphasized: true
      },
      {
        id: `load-destination-${input.parsedLoad.loadId}`,
        lat: input.parsedLoad.destination.lat,
        lng: input.parsedLoad.destination.lng,
        label: `${input.parsedLoad.destination.city} Drop`,
        kind: "load",
        state: "selected",
        emphasized: true
      }
    );
  }

  if (showReturnOverlay && input.selectedBackhaul) {
    markers.push(
      {
        id: `backhaul-origin-${input.selectedBackhaul.returnLoad.loadId}`,
        lat: input.selectedBackhaul.returnLoad.origin.lat,
        lng: input.selectedBackhaul.returnLoad.origin.lng,
        label: `${input.selectedBackhaul.returnLoad.origin.city} Backhaul`,
        kind: "backhaul",
        state: "selected",
        emphasized: true
      },
      {
        id: `backhaul-destination-${input.selectedBackhaul.returnLoad.loadId}`,
        lat: input.selectedBackhaul.returnLoad.destination.lat,
        lng: input.selectedBackhaul.returnLoad.destination.lng,
        label: `${input.selectedBackhaul.returnLoad.destination.city} Return`,
        kind: "backhaul",
        state: "selected",
        emphasized: true
      }
    );
  }

  if (input.openDraft?.relayDriverId) {
    const relay = input.driverById.get(input.openDraft.relayDriverId);
    if (relay) {
      markers.push({
        id: `relay-${relay.driverId}`,
        lat: relay.currentLocation.lat,
        lng: relay.currentLocation.lng,
        label: `${relay.name.split(" ")[0]} Relay`,
        kind: "relay",
        state: "selected",
        emphasized: true
      });
    }
  }

  const outboundOverlayRoute = routes.find((route) => route.id === `load-${input.parsedLoad?.loadId}`);
  const backhaulOverlayRoute = input.selectedBackhaul
    ? routes.find((route) => route.id === `backhaul-${input.selectedBackhaul?.returnLoad.loadId}`)
    : null;
  const focusPoints = [
    ...routePoints(outboundOverlayRoute ?? null),
    ...routePoints(backhaulOverlayRoute ?? null),
    ...(previewDriver ? [previewDriver.currentLocation] : []),
    ...tripPoints(outboundTrip),
    ...tripPoints(returnTrip)
  ];

  let viewport = defaultViewport;
  if (input.activeStage === "trip_monitoring" && input.openDraft) {
    const points = [
      ...(input.activeTrip?.plannedRoute ?? []),
      ...(input.openDraft?.relayDriverId
        ? (() => {
            const relay = input.driverById.get(input.openDraft.relayDriverId);
            return relay ? [relay.currentLocation] : [];
          })()
        : []),
      ...(input.activeTrip ? [input.activeTrip.currentLoc] : [])
    ];
    viewport = viewportFromPoints(points, { centerLat: 35.1, centerLng: -116.5, zoom: 5.1 });
  } else if (focusPoints.length > 0) {
    viewport = viewportFromPoints(
      focusPoints,
      showReturnOverlay ? { centerLat: 36.5, centerLng: -118.3, zoom: 4.5 } : { centerLat: 36.2, centerLng: -118.8, zoom: 4.4 }
    );
  } else if (input.snapshot) {
    viewport = viewportFromPoints(
      [
        ...input.snapshot.drivers.map((driver) => driver.currentLocation),
        ...input.snapshot.activeTrips.map((trip) => trip.currentLoc)
      ],
      defaultViewport
    );
  }

  return {
    viewport,
    routes,
    markers
  };
}
