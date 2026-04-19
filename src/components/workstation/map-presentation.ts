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

export function buildMapPresentationModel(input: MapPresentationInput): MapPresentationModel {
  const defaultViewport = {
    centerLat: 39.5,
    centerLng: -98.35,
    zoom: 3.2
  };

  const routes: DispatchMapRoute[] = [];
  for (const trip of input.snapshot?.activeTrips ?? []) {
    if (trip.plannedRoute.length > 1) {
      routes.push({
        id: trip.tripId,
        points: trip.plannedRoute,
        stroke: trip.tripId === input.activeTrip?.tripId ? "#214CBA" : "#9EB0D8",
        width: trip.tripId === input.activeTrip?.tripId ? 2.8 : 1.6,
        dashed: trip.status !== "on_track"
      });
    }
  }

  if (input.parsedLoad) {
    routes.push({
      id: `load-${input.parsedLoad.loadId}`,
      points: [input.parsedLoad.origin, input.parsedLoad.destination],
      stroke: "#214CBA",
      width: 3.6
    });
  }

  if (input.parsedLoad && input.selectedBackhaul && input.backhaulOpen) {
    routes.push({
      id: `backhaul-${input.selectedBackhaul.returnLoad.loadId}`,
      points: [
        input.parsedLoad.destination,
        input.selectedBackhaul.returnLoad.origin,
        input.selectedBackhaul.returnLoad.destination
      ],
      stroke: "#0E8A5B",
      width: 4
    });
  }

  const markers: DispatchMapMarker[] = [
    ...(input.snapshot?.drivers.map((driver) => ({
      id: `driver-${driver.driverId}`,
      lat: driver.currentLocation.lat,
      lng: driver.currentLocation.lng,
      label: driver.name.split(" ")[0] ?? driver.name,
      kind: "driver" as const,
      emphasized:
        driver.driverId === input.selectedScore?.driverId ||
        driver.driverId === input.openDraft?.relayDriverId ||
        (input.activeStage === "morning_triage" &&
          (driver.complianceFlags.length > 0 || driver.hosStatus !== "fresh"))
    })) ?? []),
    ...(input.snapshot?.activeTrips.map((trip) => ({
      id: `trip-${trip.tripId}`,
      lat: trip.currentLoc.lat,
      lng: trip.currentLoc.lng,
      label: trip.tripId,
      kind: "trip" as const,
      emphasized:
        trip.tripId === input.activeTrip?.tripId ||
        (input.activeStage === "morning_triage" && trip.status !== "on_track")
    })) ?? [])
  ];

  if (input.parsedLoad) {
    markers.push(
      {
        id: `load-origin-${input.parsedLoad.loadId}`,
        lat: input.parsedLoad.origin.lat,
        lng: input.parsedLoad.origin.lng,
        label: `${input.parsedLoad.origin.city} Pickup`,
        kind: "load",
        emphasized: true
      },
      {
        id: `load-destination-${input.parsedLoad.loadId}`,
        lat: input.parsedLoad.destination.lat,
        lng: input.parsedLoad.destination.lng,
        label: `${input.parsedLoad.destination.city} Drop`,
        kind: "load",
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
        emphasized: true
      });
    }
  }

  let viewport = defaultViewport;
  if (input.activeStage === "trip_monitoring") {
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
  } else if (input.backhaulOpen && input.parsedLoad && input.selectedBackhaul) {
    viewport = viewportFromPoints(
      [
        input.parsedLoad.origin,
        input.parsedLoad.destination,
        input.selectedBackhaul.returnLoad.origin,
        input.selectedBackhaul.returnLoad.destination
      ],
      { centerLat: 36.5, centerLng: -118.3, zoom: 4.5 }
    );
  } else if (input.parsedLoad) {
    viewport = viewportFromPoints(
      [
        input.parsedLoad.origin,
        input.parsedLoad.destination,
        ...(input.selectedScore
          ? [input.driverById.get(input.selectedScore.driverId)?.currentLocation].filter(Boolean) as Coordinates[]
          : [])
      ],
      { centerLat: 36.2, centerLng: -118.8, zoom: 4.4 }
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
