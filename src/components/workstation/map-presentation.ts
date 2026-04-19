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
  selectedDeskDriverId?: number | null;
  isDriversView?: boolean;
  selectedTripId?: string | null;
  isRoutesView?: boolean;
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

  let zoom = 3.6;
  if (span < 0.6) {
    zoom = 8.4;
  } else if (span < 1.2) {
    zoom = 7.6;
  } else if (span < 2.5) {
    zoom = 6.9;
  } else if (span < 5) {
    zoom = 6.0;
  } else if (span < 9) {
    zoom = 5.3;
  } else if (span < 15) {
    zoom = 4.7;
  } else if (span < 25) {
    zoom = 4.1;
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

function buildDriversTrackerModel(
  input: MapPresentationInput,
  defaultViewport: DispatchMapViewport
): MapPresentationModel {
  const selectedDriver =
    input.selectedDeskDriverId != null ? input.driverById.get(input.selectedDeskDriverId) ?? null : null;
  const hoveredDriver = input.hoveredDriverId ? input.driverById.get(input.hoveredDriverId) ?? null : null;

  const activeTripByDriverId = new Map<number, FleetSnapshotResponse["activeTrips"][number]>();
  for (const trip of input.snapshot?.activeTrips ?? []) {
    activeTripByDriverId.set(trip.driverId, trip);
  }

  const selectedTrip = selectedDriver ? activeTripByDriverId.get(selectedDriver.driverId) ?? null : null;

  const routes: DispatchMapRoute[] = [];
  if (selectedTrip && selectedTrip.plannedRoute.length > 1) {
    routes.push({
      id: selectedTrip.tripId,
      points: selectedTrip.plannedRoute,
      stroke: "#214CBA",
      width: 3.4,
      dashed: selectedTrip.status !== "on_track",
      opacity: 0.98
    });
  }

  const markers: DispatchMapMarker[] = (input.snapshot?.drivers ?? []).map((driver) => {
    const trip = activeTripByDriverId.get(driver.driverId);
    const position = trip?.currentLoc ?? driver.currentLocation;
    const isSelected = driver.driverId === selectedDriver?.driverId;
    const isHovered = driver.driverId === hoveredDriver?.driverId;

    return {
      id: `driver-${driver.driverId}`,
      lat: position.lat,
      lng: position.lng,
      label: driver.name.split(" ")[0] ?? driver.name,
      kind: "driver" as const,
      state: isHovered ? "hovered" : isSelected ? "selected" : "default",
      emphasized: isHovered || isSelected
    } satisfies DispatchMapMarker;
  });

  let viewport = defaultViewport;
  if (selectedTrip) {
    viewport = viewportFromPoints(
      [...selectedTrip.plannedRoute, selectedTrip.currentLoc],
      { centerLat: selectedTrip.currentLoc.lat, centerLng: selectedTrip.currentLoc.lng, zoom: 6.4 }
    );
  } else if (selectedDriver) {
    viewport = {
      centerLat: selectedDriver.currentLocation.lat,
      centerLng: selectedDriver.currentLocation.lng,
      zoom: 8.2
    };
  } else if (input.snapshot && input.snapshot.drivers.length > 0) {
    viewport = viewportFromPoints(
      input.snapshot.drivers.map((driver) => activeTripByDriverId.get(driver.driverId)?.currentLoc ?? driver.currentLocation),
      defaultViewport
    );
  }

  return { viewport, routes, markers };
}

function buildRoutesTrackerModel(
  input: MapPresentationInput,
  defaultViewport: DispatchMapViewport
): MapPresentationModel {
  const trips = input.snapshot?.activeTrips ?? [];
  const selectedTrip = input.selectedTripId
    ? trips.find((trip) => trip.tripId === input.selectedTripId) ?? null
    : null;

  const routes: DispatchMapRoute[] = trips
    .filter((trip) => trip.plannedRoute.length > 1)
    .map((trip) => {
      const isSelected = trip.tripId === selectedTrip?.tripId;
      return {
        id: trip.tripId,
        points: trip.plannedRoute,
        stroke: isSelected ? "#214CBA" : "#9EB0D8",
        width: isSelected ? 3.6 : 1.6,
        dashed: trip.status !== "on_track",
        opacity: isSelected ? 0.98 : 0.5
      } satisfies DispatchMapRoute;
    });

  const markers: DispatchMapMarker[] = trips.map((trip) => {
    const isSelected = trip.tripId === selectedTrip?.tripId;
    return {
      id: `trip-${trip.tripId}`,
      lat: trip.currentLoc.lat,
      lng: trip.currentLoc.lng,
      label: trip.tripId,
      kind: "trip" as const,
      state: isSelected ? "selected" : trip.status !== "on_track" ? "alert" : "default",
      emphasized: isSelected || trip.status !== "on_track"
    } satisfies DispatchMapMarker;
  });

  let viewport = defaultViewport;
  if (selectedTrip) {
    viewport = viewportFromPoints(
      [...selectedTrip.plannedRoute, selectedTrip.currentLoc],
      { centerLat: selectedTrip.currentLoc.lat, centerLng: selectedTrip.currentLoc.lng, zoom: 6.4 }
    );
  } else if (trips.length > 0) {
    viewport = viewportFromPoints(
      trips.map((trip) => trip.currentLoc),
      defaultViewport
    );
  }

  return { viewport, routes, markers };
}

export function buildMapPresentationModel(input: MapPresentationInput): MapPresentationModel {
  const defaultViewport = {
    centerLat: 39.5,
    centerLng: -98.35,
    zoom: 3.2
  };

  if (input.isRoutesView) {
    return buildRoutesTrackerModel(input, defaultViewport);
  }
  if (input.isDriversView) {
    return buildDriversTrackerModel(input, defaultViewport);
  }
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
    viewport = viewportFromPoints(points, { centerLat: 35.1, centerLng: -116.5, zoom: 5.9 });
  } else if (focusPoints.length > 0) {
    viewport = viewportFromPoints(
      focusPoints,
      showReturnOverlay ? { centerLat: 36.5, centerLng: -118.3, zoom: 5.2 } : { centerLat: 36.2, centerLng: -118.8, zoom: 5.1 }
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
