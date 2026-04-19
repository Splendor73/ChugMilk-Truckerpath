/**
 * Load Seed Generator
 * Produces 500 realistic broker loads:
 *   - 300 (60%) on the PHX / LA / SFO / Vegas corridor
 *   - 200 (40%) nationwide
 *   - Always includes demo seeds: TL-DEMO-01, TL-BH-01/02/03
 */

const fs = require("fs");
const path = require("path");

// ─── City Catalog ─────────────────────────────────────────────────────────────

const CORRIDOR_CITIES = [
  { city: "Phoenix",       state: "AZ", lat: 33.4484, lng: -112.0740, region: "SW" },
  { city: "Tempe",         state: "AZ", lat: 33.4152, lng: -111.8315, region: "SW" },
  { city: "Mesa",          state: "AZ", lat: 33.4152, lng: -111.8315, region: "SW" },
  { city: "Scottsdale",    state: "AZ", lat: 33.4942, lng: -111.9261, region: "SW" },
  { city: "Tucson",        state: "AZ", lat: 32.2226, lng: -110.9747, region: "SW" },
  { city: "Flagstaff",     state: "AZ", lat: 35.1983, lng: -111.6513, region: "SW" },
  { city: "Los Angeles",   state: "CA", lat: 34.0522, lng: -118.2437, region: "CA" },
  { city: "San Bernardino",state: "CA", lat: 34.1083, lng: -117.2898, region: "CA" },
  { city: "Riverside",     state: "CA", lat: 33.9806, lng: -117.3755, region: "CA" },
  { city: "Barstow",       state: "CA", lat: 34.8958, lng: -117.0228, region: "CA" },
  { city: "Bakersfield",   state: "CA", lat: 35.3733, lng: -119.0187, region: "CA" },
  { city: "Fresno",        state: "CA", lat: 36.7378, lng: -119.7871, region: "CA" },
  { city: "Stockton",      state: "CA", lat: 37.9577, lng: -121.2908, region: "CA" },
  { city: "Oakland",       state: "CA", lat: 37.8044, lng: -122.2712, region: "CA" },
  { city: "San Francisco", state: "CA", lat: 37.7749, lng: -122.4194, region: "CA" },
  { city: "San Jose",      state: "CA", lat: 37.3382, lng: -121.8863, region: "CA" },
  { city: "Sacramento",    state: "CA", lat: 38.5816, lng: -121.4944, region: "CA" },
  { city: "Las Vegas",     state: "NV", lat: 36.1699, lng: -115.1398, region: "NV" },
  { city: "Henderson",     state: "NV", lat: 36.0395, lng: -114.9817, region: "NV" },
  { city: "Reno",          state: "NV", lat: 39.5296, lng: -119.8138, region: "NV" },
  { city: "Victorville",   state: "CA", lat: 34.5362, lng: -117.2928, region: "CA" },
  { city: "Long Beach",    state: "CA", lat: 33.7701, lng: -118.1937, region: "CA" },
  { city: "Pomona",        state: "CA", lat: 34.0553, lng: -117.7500, region: "CA" },
  { city: "Ontario",       state: "CA", lat: 34.0633, lng: -117.6509, region: "CA" },
  { city: "Yuma",          state: "AZ", lat: 32.6927, lng: -114.6277, region: "SW" },
];

const NATIONAL_CITIES = [
  { city: "Dallas",        state: "TX", lat: 32.7767, lng: -96.7970  },
  { city: "Fort Worth",    state: "TX", lat: 32.7555, lng: -97.3308  },
  { city: "Houston",       state: "TX", lat: 29.7604, lng: -95.3698  },
  { city: "San Antonio",   state: "TX", lat: 29.4241, lng: -98.4936  },
  { city: "El Paso",       state: "TX", lat: 31.7619, lng: -106.4850 },
  { city: "Chicago",       state: "IL", lat: 41.8781, lng: -87.6298  },
  { city: "Atlanta",       state: "GA", lat: 33.7490, lng: -84.3880  },
  { city: "Denver",        state: "CO", lat: 39.7392, lng: -104.9903 },
  { city: "Seattle",       state: "WA", lat: 47.6062, lng: -122.3321 },
  { city: "Portland",      state: "OR", lat: 45.5051, lng: -122.6750 },
  { city: "Salt Lake City",state: "UT", lat: 40.7608, lng: -111.8910 },
  { city: "Albuquerque",   state: "NM", lat: 35.0844, lng: -106.6504 },
  { city: "Kansas City",   state: "MO", lat: 39.0997, lng: -94.5786  },
  { city: "St. Louis",     state: "MO", lat: 38.6270, lng: -90.1994  },
  { city: "Memphis",       state: "TN", lat: 35.1495, lng: -90.0490  },
  { city: "Nashville",     state: "TN", lat: 36.1627, lng: -86.7816  },
  { city: "Indianapolis",  state: "IN", lat: 39.7684, lng: -86.1581  },
  { city: "Columbus",      state: "OH", lat: 39.9612, lng: -82.9988  },
  { city: "Charlotte",     state: "NC", lat: 35.2271, lng: -80.8431  },
  { city: "Jacksonville",  state: "FL", lat: 30.3322, lng: -81.6557  },
  { city: "Miami",         state: "FL", lat: 25.7617, lng: -80.1918  },
  { city: "Tampa",         state: "FL", lat: 27.9506, lng: -82.4572  },
  { city: "Orlando",       state: "FL", lat: 28.5383, lng: -81.3792  },
  { city: "Minneapolis",   state: "MN", lat: 44.9778, lng: -93.2650  },
  { city: "Detroit",       state: "MI", lat: 42.3314, lng: -83.0458  },
  { city: "Cleveland",     state: "OH", lat: 41.4993, lng: -81.6944  },
  { city: "Pittsburgh",    state: "PA", lat: 40.4406, lng: -79.9959  },
  { city: "Philadelphia",  state: "PA", lat: 39.9526, lng: -75.1652  },
  { city: "New York",      state: "NY", lat: 40.7128, lng: -74.0060  },
  { city: "Boston",        state: "MA", lat: 42.3601, lng: -71.0589  },
  { city: "Buffalo",       state: "NY", lat: 42.8864, lng: -78.8784  },
  { city: "Louisville",    state: "KY", lat: 38.2527, lng: -85.7585  },
  { city: "Birmingham",    state: "AL", lat: 33.5207, lng: -86.8025  },
  { city: "New Orleans",   state: "LA", lat: 29.9511, lng: -90.0715  },
  { city: "Oklahoma City", state: "OK", lat: 35.4676, lng: -97.5164  },
  { city: "Tulsa",         state: "OK", lat: 36.1540, lng: -95.9928  },
  { city: "Omaha",         state: "NE", lat: 41.2565, lng: -95.9345  },
  { city: "Wichita",       state: "KS", lat: 37.6872, lng: -97.3301  },
  { city: "Spokane",       state: "WA", lat: 47.6587, lng: -117.4260 },
  { city: "Boise",         state: "ID", lat: 43.6150, lng: -116.2023 },
];

const EQUIPMENT_TYPES = [
  "DRY_VAN", "DRY_VAN", "DRY_VAN", "DRY_VAN", // weighted heavier
  "REEFER", "REEFER",
  "FLATBED",
  "STEP_DECK",
  "TANKER",
  "INTERMODAL",
];

const COMMODITIES = [
  "General Freight",
  "General Freight",
  "General Freight",
  "Automotive Parts",
  "Electronics",
  "Food & Beverage",
  "Frozen Foods",
  "Building Materials",
  "Retail Goods",
  "Chemicals",
  "Paper Products",
  "Machinery",
  "Consumer Goods",
  "Healthcare Supplies",
  "Agricultural Products",
  "Packaged Foods",
  "Household Goods",
  "Steel Coils",
  "Lumber",
  "Industrial Equipment",
];

const BROKERS = [
  { name: "Coyote Logistics",   contact_name: "Dan Torres",    phone: "+1-312-555-0101" },
  { name: "CH Robinson",        contact_name: "Lisa Park",     phone: "+1-952-555-0202" },
  { name: "Echo Global",        contact_name: "Marcus Webb",   phone: "+1-800-555-0303" },
  { name: "Total Quality",      contact_name: "Priya Nair",    phone: "+1-708-555-0404" },
  { name: "MoLo Solutions",     contact_name: "James Ruiz",    phone: "+1-312-555-0505" },
  { name: "XPO Logistics",      contact_name: "Sarah Kim",     phone: "+1-855-555-0606" },
  { name: "Transplace",         contact_name: "Carlos Diaz",   phone: "+1-972-555-0707" },
  { name: "RXO Transport",      contact_name: "Amy Chen",      phone: "+1-888-555-0808" },
  { name: "GlobalTranz",        contact_name: "Mike Davis",    phone: "+1-800-555-0909" },
  { name: "ABC Logistics",      contact_name: "John Smith",    phone: "+1-555-555-1234" },
  { name: "FreightQuote",       contact_name: "Rachel Moore",  phone: "+1-800-555-1010" },
  { name: "Landstar",           contact_name: "Tom Bradley",   phone: "+1-904-555-1111" },
];

const FACILITY_SUFFIXES = ["DC", "Hub", "Warehouse", "Distribution Center", "Fulfillment Center", "Cross-Dock"];
const RISK_FLAGS_POOL = [
  "TIGHT_PICKUP_WINDOW",
  "HEAVY_LOAD",
  "HAZMAT_ADJACENT",
  "LUMPER_REQUIRED",
  "DOCK_APPOINTMENT_REQUIRED",
  "LIMITED_APPOINTMENT_SLOTS",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function facilityName(city) {
  return `${city} ${pick(FACILITY_SUFFIXES)} ${Math.floor(rand(1, 10))}`;
}

function riskFlags(equipment, miles, pickupHoursFromNow) {
  const flags = [];
  if (pickupHoursFromNow < 6) flags.push("TIGHT_PICKUP_WINDOW");
  if (miles > 1200) flags.push("DOCK_APPOINTMENT_REQUIRED");
  if (equipment === "REEFER") flags.push("LUMPER_REQUIRED");
  if (Math.random() < 0.15) flags.push(pick(RISK_FLAGS_POOL));
  return [...new Set(flags)];
}

function backhaulScore(miles, deadhead) {
  // Higher score = better return load candidate (corridor alignment)
  const ratio = deadhead / (miles + 1);
  return Math.round(Math.max(0.1, Math.min(0.99, 1 - ratio * 1.5)) * 100) / 100;
}

// Base date: April 20, 2026 (day 1 of event) — all pickups within 14 days
const BASE_DATE = new Date("2026-04-20T00:00:00Z");

function pickupWindow(dayOffset, hourStart, windowHours) {
  const start = new Date(BASE_DATE);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hourStart, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hourStart + windowHours, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function deliveryWindow(pickupEnd, driveHours) {
  const start = new Date(pickupEnd);
  start.setTime(start.getTime() + driveHours * 60 * 60 * 1000);
  const end = new Date(start);
  end.setHours(end.getHours() + 4);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ─── Load Builder ─────────────────────────────────────────────────────────────

function buildLoad(id, origin, destination, overrides = {}) {
  const miles = haversine(origin.lat, origin.lng, destination.lat, destination.lng);
  const equipment = overrides.equipment_type || pick(EQUIPMENT_TYPES);
  const weight = overrides.weight_lbs || Math.round(rand(18000, 44000) / 500) * 500;
  const dayOffset = overrides.dayOffset !== undefined ? overrides.dayOffset : Math.floor(rand(0, 13));
  const hourStart = overrides.hourStart !== undefined ? overrides.hourStart : pick([6, 7, 8, 9, 10, 11, 12, 14]);
  const windowHours = overrides.windowHours !== undefined ? overrides.windowHours : pick([2, 3, 4, 6]);
  const pickup = pickupWindow(dayOffset, hourStart, windowHours);
  const driveHours = miles / 50 + rand(1, 3); // 50mph avg + dwell
  const delivery = deliveryWindow(pickup.end, driveHours);

  // Rate: base ~$2/mi for DRY_VAN, premium for REEFER/FLATBED
  const rateMultiplier =
    equipment === "REEFER" ? rand(2.4, 3.2) :
    equipment === "FLATBED" ? rand(2.2, 3.0) :
    equipment === "TANKER"  ? rand(2.5, 3.5) :
    rand(1.6, 2.8);
  const rate =
    overrides.rate_usd !== undefined
      ? overrides.rate_usd
      : Math.round(Math.max(800, Math.min(4500, miles * rateMultiplier)) / 50) * 50;

  const deadhead = overrides.deadhead_to_pickup_miles !== undefined
    ? overrides.deadhead_to_pickup_miles
    : Math.round(rand(10, 120));

  const pickupHoursFromNow = dayOffset * 24 + hourStart;

  return {
    load_id: id,
    reference_number: `RC-${Math.floor(rand(10000, 99999))}`,
    origin: {
      facility_name: overrides.origin_facility || facilityName(origin.city),
      city: origin.city,
      state: origin.state,
      lat: origin.lat,
      lng: origin.lng,
    },
    destination: {
      facility_name: overrides.dest_facility || facilityName(destination.city),
      city: destination.city,
      state: destination.state,
      lat: destination.lat,
      lng: destination.lng,
    },
    pickup_window: pickup,
    delivery_window: delivery,
    equipment_type: equipment,
    weight_lbs: weight,
    commodity: overrides.commodity || pick(COMMODITIES),
    rate_usd: rate,
    miles,
    book_now: Math.random() > 0.35,
    reload_opportunity: Math.random() > 0.5,
    broker: pick(BROKERS),
    deadhead_to_pickup_miles: deadhead,
    backhaul_score: backhaulScore(miles, deadhead),
    risk_flags: riskFlags(equipment, miles, pickupHoursFromNow),
    status: "AVAILABLE",
  };
}

// ─── Fixed Demo Seeds ─────────────────────────────────────────────────────────

const PHX = CORRIDOR_CITIES.find(c => c.city === "Phoenix");
const SFO = CORRIDOR_CITIES.find(c => c.city === "San Francisco");
const LAS = CORRIDOR_CITIES.find(c => c.city === "Las Vegas");
const RENO = CORRIDOR_CITIES.find(c => c.city === "Reno");

const DEMO_SEEDS = [
  // ── The primary demo load (Act 2 — paste into LoadInbox) ──
  buildLoad("TL-DEMO-01", PHX, SFO, {
    origin_facility: "Phoenix DC 4",
    dest_facility:   "Bay Area Hub",
    equipment_type:  "DRY_VAN",
    weight_lbs:      38000,
    commodity:       "General Freight",
    rate_usd:        3200,
    deadhead_to_pickup_miles: 42,
    dayOffset:       0,
    hourStart:       9,
    windowHours:     4,
    backhaul_score:  0.82,
  }),

  // ── Backhaul options (Act 2 — BackhaulModal) ──
  buildLoad("TL-BH-01", SFO, LAS, {
    origin_facility: "Bay Area Hub",
    dest_facility:   "Las Vegas DC 2",
    equipment_type:  "DRY_VAN",
    weight_lbs:      28000,
    commodity:       "Retail Goods",
    rate_usd:        1800,
    deadhead_to_pickup_miles: 12,
    dayOffset:       1,
    hourStart:       14,
    windowHours:     3,
    backhaul_score:  0.76,
  }),

  buildLoad("TL-BH-02", SFO, PHX, {
    // SFO → Vegas corridor then PHX — the recommended "money" backhaul
    origin_facility: "Bay Area Fulfillment Center 3",
    dest_facility:   "Phoenix DC 1",
    equipment_type:  "DRY_VAN",
    weight_lbs:      32000,
    commodity:       "Consumer Goods",
    rate_usd:        2400,
    deadhead_to_pickup_miles: 18,
    dayOffset:       1,
    hourStart:       12,
    windowHours:     4,
    backhaul_score:  0.91,
  }),

  buildLoad("TL-BH-03", SFO, RENO, {
    origin_facility: "Oakland Hub 1",
    dest_facility:   "Reno Distribution Center 2",
    equipment_type:  "DRY_VAN",
    weight_lbs:      24000,
    commodity:       "Electronics",
    rate_usd:        1200,
    deadhead_to_pickup_miles: 22,
    dayOffset:       1,
    hourStart:       10,
    windowHours:     3,
    backhaul_score:  0.64,
  }),
];

// ─── Corridor Loads (300 total, 4 already from seeds) ────────────────────────

function generateCorridorLoads(count) {
  const loads = [];
  for (let i = 0; i < count; i++) {
    const id = `LD-C-${String(i + 1).padStart(4, "0")}`;
    let origin = pick(CORRIDOR_CITIES);
    let destination = pick(CORRIDOR_CITIES);
    // Avoid same-city round trips
    while (destination.city === origin.city) destination = pick(CORRIDOR_CITIES);
    loads.push(buildLoad(id, origin, destination));
  }
  return loads;
}

// ─── National Loads (200 total) ───────────────────────────────────────────────

function generateNationalLoads(count) {
  const all = [...CORRIDOR_CITIES, ...NATIONAL_CITIES];
  const loads = [];
  for (let i = 0; i < count; i++) {
    const id = `LD-N-${String(i + 1).padStart(4, "0")}`;
    // At least one leg touches a national city
    let origin      = pick(NATIONAL_CITIES);
    let destination = pick(all);
    while (destination.city === origin.city) destination = pick(all);
    loads.push(buildLoad(id, origin, destination));
  }
  return loads;
}

// ─── Assemble & Write ─────────────────────────────────────────────────────────

const corridorLoads = generateCorridorLoads(296); // 296 + 4 demo seeds = 300
const nationalLoads = generateNationalLoads(200);

const allLoads = [
  ...DEMO_SEEDS,
  ...corridorLoads,
  ...nationalLoads,
];

console.log(`Total loads: ${allLoads.length}`);
console.log(`  Demo seeds:     ${DEMO_SEEDS.length}`);
console.log(`  Corridor loads: ${corridorLoads.length}`);
console.log(`  National loads: ${nationalLoads.length}`);

// Summary stats
const rates = allLoads.map(l => l.rate_usd);
console.log(`  Rate range: $${Math.min(...rates)} – $${Math.max(...rates)}`);
console.log(`  Avg rate:   $${Math.round(rates.reduce((a, b) => a + b) / rates.length)}`);

const outDir = path.join(__dirname, "loads");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "seed.json"),
  JSON.stringify(allLoads, null, 2),
  "utf8"
);

console.log(`\nWritten → data/loads/seed.json`);
