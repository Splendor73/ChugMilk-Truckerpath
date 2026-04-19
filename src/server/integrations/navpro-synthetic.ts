import { DEMO_BREAKDOWN_SCRIPT, SCENARIO_STAGES, type ScenarioControlAction, type ScenarioStage } from "../../../data/demo/scenarios";
import { findLoadById } from "@/server/core/load-board";
import { createTripId } from "@/shared/utils/ids";
import { addHours, nowMs } from "@/shared/utils/time";

type Coordinates = {
  lat: number;
  lng: number;
};

type SyntheticDriverBlueprint = {
  driverId: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  homeCity: string;
  homeState: string;
  homeBase: Coordinates;
  currentLocation: Coordinates;
  hosRemainingMin: number;
  workStatus: "AVAILABLE" | "IN_TRANSIT" | "RESTING" | "MAINTENANCE";
  actualMiles: number;
  oorMiles: number;
  scheduleMiles: number;
  actualTimeMin: number;
  currentLoadId?: string;
  inspectionExpiresInDays?: number;
  fatiguePattern?: boolean;
  trailTemplate?: Coordinates[];
};

type SyntheticTripRecord = {
  tripId: string;
  driverId: number;
  loadId: string;
  route: Coordinates[];
  currentLoc: Coordinates;
  etaMs: number;
  appointmentTimeIso: string;
  status: "on_track" | "route_deviation" | "long_idle" | "hos_risk" | "eta_slip";
  notes?: string;
};

type SyntheticState = {
  initializedAtMs: number;
  stage: ScenarioStage;
  freezeHeroValues: boolean;
  createdTrips: SyntheticTripRecord[];
  tripScenarioOverrides: Record<string, string | undefined>;
};

type SyntheticDriverRuntime = SyntheticDriverBlueprint & {
  lastKnownLocation: string;
  latestUpdateMs: number;
  trail: Array<{ id: number; latitude: number; longitude: number; time: string }>;
  assignedTripId: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __coDispatchSyntheticNavPro__: SyntheticState | undefined;
}

const HERO_DRIVER_IDS = {
  mike: 101,
  jake: 102,
  kevin: 103,
  sam: 104,
  sara: 105,
  luis: 106,
  maria: 107,
  priya: 110,
  omar: 111,
  chris: 113
} as const;

const CITY_COORDS = {
  Phoenix: { lat: 33.4484, lng: -112.074 },
  Tempe: { lat: 33.4152, lng: -111.8315 },
  Flagstaff: { lat: 35.1983, lng: -111.6513 },
  Victorville: { lat: 34.5362, lng: -117.2928 },
  "Los Angeles": { lat: 34.0522, lng: -118.2437 },
  "Las Vegas": { lat: 36.1699, lng: -115.1398 },
  Bakersfield: { lat: 35.3733, lng: -119.0187 },
  Reno: { lat: 39.5296, lng: -119.8138 },
  Ontario: { lat: 34.0633, lng: -117.6509 },
  Yuma: { lat: 32.6927, lng: -114.6277 },
  Fresno: { lat: 36.7378, lng: -119.7871 },
  Stockton: { lat: 37.9577, lng: -121.2908 },
  "Long Beach": { lat: 33.7701, lng: -118.1937 },
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  Sacramento: { lat: 38.5816, lng: -121.4944 },
  "San Bernardino": { lat: 34.1083, lng: -117.2898 },
  Mesa: { lat: 33.4152, lng: -111.8315 },
  Tucson: { lat: 32.2226, lng: -110.9747 },
  Barstow: { lat: 34.8958, lng: -117.0228 },
  Goodyear: { lat: 33.4353, lng: -112.3582 },
  Glendale: { lat: 33.5387, lng: -112.186 }
} as const;

const routingProfiles = [
  {
    id: 6831,
    profile_name: "53ft Dry Van",
    vehicle_type: "DRY_VAN"
  },
  {
    id: 6832,
    profile_name: "Reefer Corridor",
    vehicle_type: "REEFER"
  }
];

const driverBlueprints: SyntheticDriverBlueprint[] = [
  {
    driverId: 101,
    firstName: "Mike",
    lastName: "Chen",
    phone: "602-555-0101",
    email: "mike.chen@codispatch.demo",
    homeCity: "Tempe",
    homeState: "AZ",
    homeBase: CITY_COORDS.Tempe,
    currentLocation: CITY_COORDS.Goodyear,
    // Anchor driver for the demo. Plenty of HOS runway so the dispatcher
    // can confidently pick him for new loads throughout the walkthrough.
    hosRemainingMin: 23 * 60,
    workStatus: "AVAILABLE",
    actualMiles: 118,
    oorMiles: 6,
    scheduleMiles: 124,
    actualTimeMin: 220,
    inspectionExpiresInDays: 5,
    trailTemplate: [
      { lat: 33.3817, lng: -112.166 },
      { lat: 33.395, lng: -112.21 },
      { lat: 33.4095, lng: -112.257 },
      { lat: 33.4238, lng: -112.304 },
      { lat: 33.4353, lng: -112.3582 }
    ]
  },
  {
    driverId: 102,
    firstName: "Jake",
    lastName: "Morrison",
    phone: "928-555-0102",
    email: "jake.morrison@codispatch.demo",
    homeCity: "Flagstaff",
    homeState: "AZ",
    homeBase: CITY_COORDS.Flagstaff,
    currentLocation: CITY_COORDS.Flagstaff,
    hosRemainingMin: 240,
    workStatus: "AVAILABLE",
    actualMiles: 410,
    oorMiles: 18,
    scheduleMiles: 402,
    actualTimeMin: 430,
    trailTemplate: [
      { lat: 34.998, lng: -111.74 },
      { lat: 35.051, lng: -111.71 },
      { lat: 35.101, lng: -111.68 },
      { lat: 35.151, lng: -111.664 },
      { lat: 35.1983, lng: -111.6513 }
    ]
  },
  {
    driverId: 103,
    firstName: "Kevin",
    lastName: "Walsh",
    phone: "760-555-0103",
    email: "kevin.walsh@codispatch.demo",
    homeCity: "Victorville",
    homeState: "CA",
    homeBase: CITY_COORDS.Victorville,
    currentLocation: CITY_COORDS.Victorville,
    hosRemainingMin: 540,
    workStatus: "AVAILABLE",
    actualMiles: 278,
    oorMiles: 12,
    scheduleMiles: 286,
    actualTimeMin: 320,
    trailTemplate: [
      { lat: 34.622, lng: -117.397 },
      { lat: 34.601, lng: -117.366 },
      { lat: 34.576, lng: -117.333 },
      { lat: 34.553, lng: -117.311 },
      { lat: 34.5362, lng: -117.2928 }
    ]
  },
  {
    driverId: 104,
    firstName: "Sam",
    lastName: "Rodriguez",
    phone: "909-555-0104",
    email: "sam.rodriguez@codispatch.demo",
    homeCity: "Los Angeles",
    homeState: "CA",
    homeBase: CITY_COORDS["Los Angeles"],
    currentLocation: CITY_COORDS.Barstow,
    hosRemainingMin: 420,
    workStatus: "MAINTENANCE",
    actualMiles: 350,
    oorMiles: 5,
    scheduleMiles: 360,
    actualTimeMin: 360,
    currentLoadId: "TL-ACT3-01",
    trailTemplate: [
      { lat: 34.0522, lng: -118.2437 },
      { lat: 34.213, lng: -117.905 },
      { lat: 34.438, lng: -117.533 },
      { lat: 34.708, lng: -117.192 },
      { lat: 34.8958, lng: -117.0228 }
    ]
  },
  {
    driverId: 105,
    firstName: "Sara",
    lastName: "Patel",
    phone: "480-555-0105",
    email: "sara.patel@codispatch.demo",
    homeCity: "Phoenix",
    homeState: "AZ",
    homeBase: CITY_COORDS.Phoenix,
    currentLocation: CITY_COORDS.Phoenix,
    hosRemainingMin: 105,
    workStatus: "RESTING",
    actualMiles: 560,
    oorMiles: 20,
    scheduleMiles: 540,
    actualTimeMin: 555,
    fatiguePattern: true,
    trailTemplate: [
      { lat: 33.478, lng: -112.208 },
      { lat: 33.471, lng: -112.169 },
      { lat: 33.462, lng: -112.132 },
      { lat: 33.455, lng: -112.099 },
      { lat: 33.4484, lng: -112.074 }
    ]
  },
  {
    driverId: 106,
    firstName: "Luis",
    lastName: "Ortega",
    phone: "702-555-0106",
    email: "luis.ortega@codispatch.demo",
    homeCity: "Las Vegas",
    homeState: "NV",
    homeBase: CITY_COORDS["Las Vegas"],
    currentLocation: CITY_COORDS["Las Vegas"],
    hosRemainingMin: 500,
    workStatus: "AVAILABLE",
    actualMiles: 300,
    oorMiles: 8,
    scheduleMiles: 306,
    actualTimeMin: 340
  },
  {
    driverId: 107,
    firstName: "Maria",
    lastName: "Lopez",
    phone: "661-555-0107",
    email: "maria.lopez@codispatch.demo",
    homeCity: "Bakersfield",
    homeState: "CA",
    homeBase: CITY_COORDS.Bakersfield,
    currentLocation: CITY_COORDS.Bakersfield,
    hosRemainingMin: 600,
    workStatus: "AVAILABLE",
    actualMiles: 180,
    oorMiles: 4,
    scheduleMiles: 184,
    actualTimeMin: 250
  },
  {
    driverId: 108,
    firstName: "Andre",
    lastName: "Flores",
    phone: "775-555-0108",
    email: "andre.flores@codispatch.demo",
    homeCity: "Reno",
    homeState: "NV",
    homeBase: CITY_COORDS.Reno,
    currentLocation: CITY_COORDS.Reno,
    hosRemainingMin: 575,
    workStatus: "AVAILABLE",
    actualMiles: 210,
    oorMiles: 11,
    scheduleMiles: 220,
    actualTimeMin: 255
  },
  {
    driverId: 109,
    firstName: "Noah",
    lastName: "Kim",
    phone: "520-555-0109",
    email: "noah.kim@codispatch.demo",
    homeCity: "Tucson",
    homeState: "AZ",
    homeBase: CITY_COORDS.Tucson,
    currentLocation: CITY_COORDS.Tucson,
    hosRemainingMin: 90,
    workStatus: "RESTING",
    actualMiles: 590,
    oorMiles: 17,
    scheduleMiles: 602,
    actualTimeMin: 570
  },
  {
    driverId: 110,
    firstName: "Priya",
    lastName: "Nair",
    phone: "909-555-0110",
    email: "priya.nair@codispatch.demo",
    homeCity: "Ontario",
    homeState: "CA",
    homeBase: CITY_COORDS.Ontario,
    currentLocation: CITY_COORDS.Ontario,
    hosRemainingMin: 630,
    workStatus: "AVAILABLE",
    actualMiles: 140,
    oorMiles: 7,
    scheduleMiles: 146,
    actualTimeMin: 210
  },
  {
    driverId: 111,
    firstName: "Omar",
    lastName: "Hassan",
    phone: "480-555-0111",
    email: "omar.hassan@codispatch.demo",
    homeCity: "Mesa",
    homeState: "AZ",
    homeBase: CITY_COORDS.Mesa,
    currentLocation: CITY_COORDS.Tucson,
    // Secondary anchor driver. Max HOS cushion so he can be used as the
    // relay option or a fresh pick when the demo script calls for a long
    // lane without HOS concerns.
    hosRemainingMin: 25 * 60,
    workStatus: "AVAILABLE",
    actualMiles: 130,
    oorMiles: 3,
    scheduleMiles: 136,
    actualTimeMin: 205
  },
  {
    driverId: 112,
    firstName: "Elena",
    lastName: "Ruiz",
    phone: "928-555-0112",
    email: "elena.ruiz@codispatch.demo",
    homeCity: "Yuma",
    homeState: "AZ",
    homeBase: CITY_COORDS.Yuma,
    currentLocation: CITY_COORDS.Yuma,
    hosRemainingMin: 610,
    workStatus: "AVAILABLE",
    actualMiles: 160,
    oorMiles: 6,
    scheduleMiles: 164,
    actualTimeMin: 230
  },
  {
    driverId: 113,
    firstName: "Chris",
    lastName: "Stone",
    phone: "916-555-0113",
    email: "chris.stone@codispatch.demo",
    homeCity: "Sacramento",
    homeState: "CA",
    homeBase: CITY_COORDS.Sacramento,
    currentLocation: CITY_COORDS.Sacramento,
    hosRemainingMin: 390,
    workStatus: "AVAILABLE",
    actualMiles: 420,
    oorMiles: 16,
    scheduleMiles: 428,
    actualTimeMin: 410
  },
  {
    driverId: 114,
    firstName: "Ben",
    lastName: "Carter",
    phone: "559-555-0114",
    email: "ben.carter@codispatch.demo",
    homeCity: "Fresno",
    homeState: "CA",
    homeBase: CITY_COORDS.Fresno,
    currentLocation: CITY_COORDS.Fresno,
    hosRemainingMin: 480,
    workStatus: "AVAILABLE",
    actualMiles: 290,
    oorMiles: 13,
    scheduleMiles: 300,
    actualTimeMin: 330
  },
  {
    driverId: 115,
    firstName: "Tina",
    lastName: "Brooks",
    phone: "209-555-0115",
    email: "tina.brooks@codispatch.demo",
    homeCity: "Stockton",
    homeState: "CA",
    homeBase: CITY_COORDS.Stockton,
    currentLocation: CITY_COORDS.Stockton,
    hosRemainingMin: 650,
    workStatus: "AVAILABLE",
    actualMiles: 95,
    oorMiles: 2,
    scheduleMiles: 98,
    actualTimeMin: 150
  },
  {
    driverId: 116,
    firstName: "Raul",
    lastName: "Gomez",
    phone: "909-555-0116",
    email: "raul.gomez@codispatch.demo",
    homeCity: "San Bernardino",
    homeState: "CA",
    homeBase: CITY_COORDS["San Bernardino"],
    currentLocation: CITY_COORDS["San Bernardino"],
    hosRemainingMin: 570,
    workStatus: "AVAILABLE",
    actualMiles: 240,
    oorMiles: 9,
    scheduleMiles: 248,
    actualTimeMin: 295
  },
  {
    driverId: 117,
    firstName: "Aiden",
    lastName: "Ross",
    phone: "623-555-0117",
    email: "aiden.ross@codispatch.demo",
    homeCity: "Phoenix",
    homeState: "AZ",
    homeBase: CITY_COORDS.Phoenix,
    currentLocation: CITY_COORDS.Phoenix,
    hosRemainingMin: 50,
    workStatus: "RESTING",
    actualMiles: 610,
    oorMiles: 21,
    scheduleMiles: 620,
    actualTimeMin: 600
  },
  {
    driverId: 118,
    firstName: "Emily",
    lastName: "Zhao",
    phone: "562-555-0118",
    email: "emily.zhao@codispatch.demo",
    homeCity: "Long Beach",
    homeState: "CA",
    homeBase: CITY_COORDS["Long Beach"],
    currentLocation: CITY_COORDS["Long Beach"],
    hosRemainingMin: 620,
    workStatus: "AVAILABLE",
    actualMiles: 155,
    oorMiles: 5,
    scheduleMiles: 160,
    actualTimeMin: 225
  }
];

function cloneCoords(point: Coordinates) {
  return { lat: point.lat, lng: point.lng };
}

function getState(): SyntheticState {
  if (!global.__coDispatchSyntheticNavPro__) {
    global.__coDispatchSyntheticNavPro__ = {
      initializedAtMs: nowMs(),
      stage: "morning_triage",
      freezeHeroValues: true,
      createdTrips: [],
      tripScenarioOverrides: {}
    };
  }
  return global.__coDispatchSyntheticNavPro__;
}

function formatIsoFromNow(offsetMinutes: number) {
  return new Date(nowMs() + offsetMinutes * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function describeLocation(city: string, state: string, workStatus: SyntheticDriverBlueprint["workStatus"]) {
  if (workStatus === "MAINTENANCE") {
    return `Outside ${city}, ${state}`;
  }
  if (workStatus === "RESTING") {
    return `${city} Rest Area, ${state}`;
  }
  return `${city}, ${state}`;
}

function buildTrail(driver: SyntheticDriverBlueprint, latestUpdateMs: number) {
  const template = driver.trailTemplate ?? [
    cloneCoords(driver.homeBase),
    {
      lat: (driver.homeBase.lat + driver.currentLocation.lat) / 2,
      lng: (driver.homeBase.lng + driver.currentLocation.lng) / 2
    },
    cloneCoords(driver.currentLocation)
  ];

  return template.map((point, index) => ({
    id: driver.driverId * 100 + index,
    latitude: point.lat,
    longitude: point.lng,
    time: new Date(latestUpdateMs - (template.length - index) * 12 * 60 * 1000).toISOString()
  }));
}

function getBaseTrips(_stage: ScenarioStage): SyntheticTripRecord[] {
  // Five concurrent trips is the baseline the demo is rehearsed against:
  //   - Three healthy on_track runs give the map something alive to show
  //     and prove the monitoring layer ignores healthy trips.
  //   - TRIP-ACT3 is the canonical Act 3 breakdown; it keeps the scripted
  //     `long_idle` status and the existing voice/SMS narrative.
  //   - TRIP-ACT5 is a second, tonally different alert (eta_slip) so the
  //     dispatcher sees two alert styles side-by-side on boot without
  //     having to trigger anything. `draftIntervention` renders each
  //     trigger in its own voice so the "AI-generated copy" story is
  //     visible right away.
  // NOTE on driver selection: the ranking/elimination tests expect Jake
  // (id 102) to appear in `scoreLoad` as an eliminated candidate, and
  // `scoreLoad` filters out any driver with an `activeTripId`. Jake must
  // therefore stay unassigned. Kevin (103) is the scripted relay at the
  // hardcoded "28 miles from Barstow" distance in the breakdown voice
  // script, so he also stays unassigned. That leaves Priya, Maria, Sam,
  // Chris, and Luis for the five baseline trips below.
  const priyaTrip: SyntheticTripRecord = {
    tripId: "TRIP-ACT1",
    driverId: HERO_DRIVER_IDS.priya,
    loadId: "TL-ACT1-01",
    route: [
      cloneCoords(CITY_COORDS.Victorville),
      cloneCoords(CITY_COORDS.Ontario),
      cloneCoords(CITY_COORDS["Los Angeles"]),
      cloneCoords(CITY_COORDS["Long Beach"])
    ],
    currentLoc: { lat: 34.08, lng: -117.88 },
    etaMs: addHours(nowMs(), 2),
    appointmentTimeIso: formatIsoFromNow(120),
    status: "on_track"
  };

  const mariaTrip: SyntheticTripRecord = {
    tripId: "TRIP-ACT2",
    driverId: HERO_DRIVER_IDS.maria,
    loadId: "TL-ACT2-01",
    route: [
      cloneCoords(CITY_COORDS.Bakersfield),
      cloneCoords(CITY_COORDS.Fresno),
      cloneCoords(CITY_COORDS.Stockton),
      cloneCoords(CITY_COORDS.Sacramento)
    ],
    currentLoc: { lat: 37.2, lng: -120.35 },
    etaMs: addHours(nowMs(), 4),
    appointmentTimeIso: formatIsoFromNow(240),
    status: "on_track"
  };

  const samTrip: SyntheticTripRecord = {
    tripId: "TRIP-ACT3",
    driverId: HERO_DRIVER_IDS.sam,
    loadId: "TL-ACT3-01",
    route: [
      cloneCoords(CITY_COORDS["Los Angeles"]),
      cloneCoords(CITY_COORDS.Barstow),
      cloneCoords(CITY_COORDS.Phoenix)
    ],
    currentLoc: cloneCoords(CITY_COORDS.Barstow),
    etaMs: addHours(nowMs(), 3),
    appointmentTimeIso: formatIsoFromNow(180),
    status: "long_idle",
    notes: DEMO_BREAKDOWN_SCRIPT
  };

  const chrisTrip: SyntheticTripRecord = {
    tripId: "TRIP-ACT4",
    driverId: HERO_DRIVER_IDS.chris,
    loadId: "TL-ACT4-01",
    route: [
      cloneCoords(CITY_COORDS.Sacramento),
      cloneCoords(CITY_COORDS.Reno)
    ],
    currentLoc: { lat: 39.05, lng: -120.55 },
    etaMs: addHours(nowMs(), 2.5),
    appointmentTimeIso: formatIsoFromNow(150),
    status: "on_track"
  };

  const luisTrip: SyntheticTripRecord = {
    tripId: "TRIP-ACT5",
    driverId: HERO_DRIVER_IDS.luis,
    loadId: "TL-ACT5-01",
    route: [
      cloneCoords(CITY_COORDS.Flagstaff),
      cloneCoords(CITY_COORDS.Phoenix)
    ],
    // Mid-route on I-17, south of Camp Verde, visibly behind schedule.
    currentLoc: { lat: 34.55, lng: -111.86 },
    etaMs: addHours(nowMs(), 5),
    appointmentTimeIso: formatIsoFromNow(300),
    status: "eta_slip",
    notes: "Construction on I-17 south of Camp Verde has pushed ETA back about 2 hours. Customer needs a friendly heads-up."
  };

  return [priyaTrip, mariaTrip, samTrip, chrisTrip, luisTrip];
}

function withStageOverlay(driver: SyntheticDriverBlueprint, stage: ScenarioStage): SyntheticDriverBlueprint {
  if (driver.driverId === HERO_DRIVER_IDS.sam) {
    return {
      ...driver,
      workStatus: "MAINTENANCE"
    };
  }

  if (driver.driverId === HERO_DRIVER_IDS.sara && stage === "morning_triage") {
    return {
      ...driver,
      hosRemainingMin: 105,
      workStatus: "RESTING"
    };
  }

  return { ...driver };
}

function buildRuntimeDrivers(state: SyntheticState) {
  const createdTripsByDriver = new Map<number, SyntheticTripRecord[]>();
  state.createdTrips.forEach((trip) => {
    createdTripsByDriver.set(trip.driverId, [...(createdTripsByDriver.get(trip.driverId) ?? []), trip]);
  });

  const baseTrips = getBaseTrips(state.stage);
  const allTrips = [...baseTrips, ...state.createdTrips];
  const activeTripsByDriver = new Map<number, SyntheticTripRecord[]>();
  allTrips.forEach((trip) => {
    activeTripsByDriver.set(trip.driverId, [...(activeTripsByDriver.get(trip.driverId) ?? []), trip]);
  });

  const drivers = driverBlueprints.map((blueprint, index) => {
    const driver = withStageOverlay(blueprint, state.stage);
    const latestUpdateMs = state.initializedAtMs - (index % 5) * 9 * 60 * 1000;
    const createdTrip = createdTripsByDriver.get(driver.driverId)?.at(-1) ?? null;
    const activeTrip = activeTripsByDriver.get(driver.driverId)?.at(-1) ?? null;

    // Whether the driver's active trip came from the base demo set or was
    // created at runtime, we want the driver panel + map to reflect that
    // they're on the road: pin them to the trip's current GPS and flip
    // their work status to IN_TRANSIT. The stage overlay still wins for
    // scripted overrides (e.g. Sam stays MAINTENANCE during the breakdown
    // beat even though he technically has an assigned trip).
    const assignedTrip = createdTrip ?? activeTrip;
    const stageOverrideWorkStatus =
      driver.workStatus === "MAINTENANCE" || driver.workStatus === "RESTING"
        ? driver.workStatus
        : null;
    const currentLocation = assignedTrip ? cloneCoords(assignedTrip.currentLoc) : cloneCoords(driver.currentLocation);
    const workStatus = stageOverrideWorkStatus
      ?? (assignedTrip ? "IN_TRANSIT" : driver.workStatus);
    const currentLoadId = assignedTrip?.loadId ?? driver.currentLoadId;

    return {
      ...driver,
      currentLocation,
      currentLoadId,
      workStatus,
      lastKnownLocation: describeLocation(driver.homeCity, driver.homeState, workStatus),
      latestUpdateMs,
      trail: buildTrail({ ...driver, currentLocation }, latestUpdateMs),
      assignedTripId: activeTrip?.tripId ?? null
    } satisfies SyntheticDriverRuntime;
  });

  return {
    drivers,
    activeTrips: allTrips
  };
}

function buildDriverLoads(driver: SyntheticDriverRuntime) {
  if (!driver.currentLoadId) {
    return {
      driver_assign_loads: [],
      driver_current_load: null
    };
  }

  const load = findLoadById(driver.currentLoadId);
  if (!load) {
    return {
      driver_assign_loads: [],
      driver_current_load: null
    };
  }

  return {
    driver_assign_loads: [],
    driver_current_load: {
      load_id: driver.currentLoadId,
      load_show_id: driver.currentLoadId,
      origin: `${load.origin.city}, ${load.origin.state}`,
      destination: `${load.destination.city}, ${load.destination.state}`,
      pickup_date: load.pickupStartMs,
      delivery_date: load.pickupEndMs
    }
  };
}

function buildDriverRecord(driver: SyntheticDriverRuntime) {
  const licenseExpiration = driver.inspectionExpiresInDays
    ? new Date(nowMs() + driver.inspectionExpiresInDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : "2027-08-03";

  return {
    driver_id: driver.driverId,
    basic_info: {
      driver_first_name: driver.firstName,
      driver_last_name: driver.lastName,
      work_status: driver.workStatus === "AVAILABLE" ? "AVAILABLE" : driver.workStatus,
      driver_type: "OWNER_OPERATOR_OO",
      driver_phone_number: driver.phone,
      driver_email: driver.email
    },
    driver_location: {
      last_known_location: driver.lastKnownLocation,
      latest_update: driver.latestUpdateMs,
      timezone: "MST"
    },
    driver_activities: [
      {
        time: driver.latestUpdateMs - 4 * 60 * 60 * 1000,
        activities: [
          `${driver.firstName} ${driver.lastName} checked in with dispatch.`
        ]
      }
    ],
    loads: buildDriverLoads(driver),
    contact_detail_info: {
      driver_city: driver.homeCity,
      driver_state: driver.homeState,
      driver_country: "UNITED_STATES"
    },
    license_detail_info: {
      license_expiration: licenseExpiration,
      license_country: "UNITED_STATES",
      license_state: driver.homeState,
      license_type: "A",
      restrictions: [],
      endorsements: ["H"]
    },
    risk_flags: {
      fatigue_pattern: Boolean(driver.fatiguePattern)
    },
    active_trip_id: driver.assignedTripId
  };
}

function buildPerformanceRecord(driver: SyntheticDriverRuntime) {
  return {
    driver_id: driver.driverId,
    oor_miles: driver.oorMiles,
    schedule_miles: driver.scheduleMiles,
    actual_miles: driver.actualMiles,
    schedule_time: Math.min(driver.actualTimeMin + 25, 660),
    actual_time: driver.actualTimeMin,
    remaining_drive_min: driver.hosRemainingMin,
    hos_remaining_min: driver.hosRemainingMin
  };
}

function buildDispatchRecord(driverId: number, activeTrips: SyntheticTripRecord[]) {
  const driver = buildRuntimeDrivers(getState()).drivers.find((item) => item.driverId === driverId);
  const activeTrip = activeTrips.find((trip) => trip.driverId === driverId) ?? null;
  if (!driver) {
    return {
      code: 200,
      success: true,
      msg: "success",
      data: {
        points: [],
        active_trip: null
      }
    };
  }

  return {
    code: 200,
    success: true,
    msg: "success",
    data: {
      points: driver.trail,
      active_trip: activeTrip
        ? {
            trip_id: activeTrip.tripId,
            eta: new Date(activeTrip.etaMs).toISOString(),
            status: activeTrip.status
          }
        : null
    }
  };
}

function buildTripList(trips: SyntheticTripRecord[]) {
  return {
    code: 200,
    success: true,
    msg: "success",
    data: trips.map((trip) => ({
      trip_id: trip.tripId,
      driver_id: trip.driverId,
      load_id: trip.loadId,
      current_lat: trip.currentLoc.lat,
      current_lng: trip.currentLoc.lng,
      eta_ms: trip.etaMs,
      status: trip.status,
      planned_route: trip.route.map((point) => ({ lat: point.lat, lng: point.lng }))
    })),
    total: trips.length
  };
}

function nextStage(current: ScenarioStage): ScenarioStage {
  const index = SCENARIO_STAGES.indexOf(current);
  return SCENARIO_STAGES[(index + 1) % SCENARIO_STAGES.length] ?? "morning_triage";
}

export function resetSyntheticNavProState() {
  global.__coDispatchSyntheticNavPro__ = {
    initializedAtMs: nowMs(),
    stage: "morning_triage",
    freezeHeroValues: true,
    createdTrips: [],
    tripScenarioOverrides: {}
  };
  return global.__coDispatchSyntheticNavPro__;
}

export function controlSyntheticNavPro(input: {
  action?: ScenarioControlAction;
  stage?: ScenarioStage;
  freezeHeroValues?: boolean;
  tripId?: string;
  scenario?: string;
}) {
  const state = getState();
  switch (input.action) {
    case "reset":
      return resetSyntheticNavProState();
    case "set_stage":
      state.stage = input.stage ?? nextStage(state.stage);
      return state;
    case "freeze":
      state.freezeHeroValues = input.freezeHeroValues ?? true;
      return state;
    case "trigger_trip":
      if (input.tripId && input.scenario) {
        state.tripScenarioOverrides[input.tripId] = input.scenario;
        state.stage = "in_transit_monitoring";
      }
      return state;
    default:
      if (input.tripId && input.scenario) {
        state.tripScenarioOverrides[input.tripId] = input.scenario;
        state.stage = "in_transit_monitoring";
      }
      return state;
  }
}

export function getSyntheticScenarioSnapshot() {
  const state = getState();
  const runtime = buildRuntimeDrivers(state);
  return {
    state,
    drivers: runtime.drivers,
    trips: runtime.activeTrips
  };
}

export async function syntheticQueryDrivers(payload?: { page?: number; size?: number }) {
  const { drivers } = getSyntheticScenarioSnapshot();
  const page = payload?.page ?? 0;
  const pageSize = payload?.size ?? drivers.length;
  return {
    code: 200,
    success: true,
    msg: "success",
    total: drivers.length,
    page,
    page_size: pageSize,
    data: drivers.slice(page * pageSize, page * pageSize + pageSize).map(buildDriverRecord)
  };
}

export async function syntheticQueryDriverPerformance(driverId: number) {
  const { drivers } = getSyntheticScenarioSnapshot();
  const driver = drivers.find((item) => item.driverId === driverId);
  return {
    code: 200,
    success: true,
    msg: "success",
    total: driver ? 1 : 0,
    page: 0,
    page_size: 20,
    data: driver ? [buildPerformanceRecord(driver)] : []
  };
}

export async function syntheticGetDriverDispatch(driverId: number) {
  const { trips } = getSyntheticScenarioSnapshot();
  return buildDispatchRecord(driverId, trips);
}

export async function syntheticQueryTrips() {
  const { trips, state } = getSyntheticScenarioSnapshot();
  const adjustedTrips = trips.map((trip) => {
    const override = state.tripScenarioOverrides[trip.tripId];
    if (override === "breakdown") {
      return { ...trip, status: "long_idle" as const, currentLoc: cloneCoords(CITY_COORDS.Barstow), etaMs: addHours(nowMs(), 3) };
    }
    if (override === "route_deviation") {
      return { ...trip, status: "route_deviation" as const, currentLoc: { lat: 34.701, lng: -116.412 }, etaMs: addHours(nowMs(), 4) };
    }
    if (override === "eta_slip") {
      return { ...trip, status: "eta_slip" as const, etaMs: addHours(nowMs(), 5) };
    }
    return trip;
  });
  return buildTripList(adjustedTrips);
}

export async function syntheticGetRoutingProfiles() {
  return {
    code: 200,
    success: true,
    msg: "success",
    total: routingProfiles.length,
    page: 0,
    page_size: routingProfiles.length,
    data: routingProfiles
  };
}

export async function syntheticCreateTrip(payload: Record<string, unknown>) {
  const state = getState();
  const stopPoints = Array.isArray(payload.stop_points) ? payload.stop_points as Array<Record<string, unknown>> : [];
  const firstStop = stopPoints[0];
  const lastStop = stopPoints.at(-1);
  const tripId = createTripId(new Date(nowMs()).toISOString().slice(0, 10).replace(/-/g, ""));
  const appointmentTime = typeof lastStop?.appointment_time === "string"
    ? Date.parse(lastStop.appointment_time)
    : addHours(nowMs(), 8);
  const route = stopPoints
    .map((point) => {
      const lat = typeof point.latitude === "number" ? point.latitude : null;
      const lng = typeof point.longitude === "number" ? point.longitude : null;
      if (lat == null || lng == null) {
        return null;
      }
      return { lat, lng };
    })
    .filter(Boolean) as Coordinates[];

  const trip: SyntheticTripRecord = {
    tripId,
    driverId: Number(payload.driver_id),
    loadId: String(payload.trip_name ?? payload.load_id ?? tripId),
    route: route.length >= 2 ? route : [cloneCoords(CITY_COORDS.Phoenix), cloneCoords(CITY_COORDS["San Francisco"])],
    currentLoc: route[0] ?? cloneCoords(CITY_COORDS.Phoenix),
    etaMs: Number.isFinite(appointmentTime) ? appointmentTime : addHours(nowMs(), 8),
    appointmentTimeIso: typeof lastStop?.appointment_time === "string" ? lastStop.appointment_time : formatIsoFromNow(480),
    status: "on_track"
  };

  state.createdTrips.push(trip);

  return {
    code: 200,
    success: true,
    msg: "success",
    trip_id: trip.tripId
  };
}

export function getSyntheticBreakdownScript() {
  return DEMO_BREAKDOWN_SCRIPT;
}
