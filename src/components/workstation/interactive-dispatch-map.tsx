"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ForwardedRef
} from "react";

import mapboxgl, { type GeoJSONSource, type LngLatLike } from "mapbox-gl";

import { getClientEnv } from "@/config/env.client";

export type DispatchMapViewport = {
  centerLat: number;
  centerLng: number;
  zoom: number;
};

export type DispatchMapRoute = {
  id: string;
  points: Array<{ lat: number; lng: number }>;
  stroke: string;
  width: number;
  dashed?: boolean;
  opacity?: number;
};

export type DispatchMapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "driver" | "trip" | "load" | "relay" | "backhaul";
  emphasized?: boolean;
  state?: "default" | "alert" | "hovered" | "selected";
};

export type DispatchMapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
};

type InteractiveDispatchMapProps = {
  viewport: DispatchMapViewport;
  routes: DispatchMapRoute[];
  markers: DispatchMapMarker[];
};

const ROUTE_SOLID_SOURCE_ID = "dispatch-routes-solid";
const ROUTE_DASHED_SOURCE_ID = "dispatch-routes-dashed";
const ROUTE_SOLID_LAYER_ID = "dispatch-routes-solid-line";
const ROUTE_DASHED_LAYER_ID = "dispatch-routes-dashed-line";
const ROUTE_SOLID_CASING_LAYER_ID = "dispatch-routes-solid-casing";
const ROUTE_DASHED_CASING_LAYER_ID = "dispatch-routes-dashed-casing";

function markerColor(kind: DispatchMapMarker["kind"]) {
  if (kind === "trip") {
    return "#214CBA";
  }
  if (kind === "backhaul") {
    return "#0E8A5B";
  }
  if (kind === "load") {
    return "#00598F";
  }
  if (kind === "relay") {
    return "#0E8A5B";
  }
  return "#4066D4";
}

function createLineFeatureCollection(routes: DispatchMapRoute[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes
      .filter((route) => route.points.length > 1)
      .map((route) => ({
        type: "Feature" as const,
        properties: {
          id: route.id,
          stroke: route.stroke,
          width: route.width,
          opacity: route.opacity ?? 0.96,
          casingOpacity: Math.min((route.opacity ?? 0.96) + 0.06, 1)
        },
        geometry: {
          type: "LineString" as const,
          coordinates: route.points.map((point) => [point.lng, point.lat])
        }
      }))
  };
}

function routeRequestKey(route: DispatchMapRoute) {
  return `${route.id}:${route.points.map((point) => `${point.lng.toFixed(5)},${point.lat.toFixed(5)}`).join(";")}`;
}

async function fetchDynamicRoute(route: DispatchMapRoute, token: string): Promise<DispatchMapRoute> {
  if (route.points.length < 2) {
    return route;
  }

  const coordinates = route.points.map((point) => `${point.lng},${point.lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}` +
    `?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${token}`;

  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Directions lookup failed for ${route.id}`);
  }

  const payload = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: number[][] } }>;
  };

  const geometry = payload.routes?.[0]?.geometry?.coordinates;
  if (!geometry || geometry.length < 2) {
    return route;
  }

  return {
    ...route,
    points: geometry.map((coordinate) => ({
      lng: coordinate[0],
      lat: coordinate[1]
    }))
  };
}

function ensureRouteLayers(map: mapboxgl.Map) {
  if (!map.getSource(ROUTE_SOLID_SOURCE_ID)) {
    map.addSource(ROUTE_SOLID_SOURCE_ID, {
      type: "geojson",
      data: createLineFeatureCollection([])
    });
  }

  if (!map.getSource(ROUTE_DASHED_SOURCE_ID)) {
    map.addSource(ROUTE_DASHED_SOURCE_ID, {
      type: "geojson",
      data: createLineFeatureCollection([])
    });
  }

  if (!map.getLayer(ROUTE_SOLID_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_SOLID_CASING_LAYER_ID,
      type: "line",
      source: ROUTE_SOLID_SOURCE_ID,
      paint: {
        "line-color": "rgba(255,255,255,0.88)",
        "line-width": ["+", ["get", "width"], 3],
        "line-opacity": ["coalesce", ["get", "casingOpacity"], 0.9]
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    });
  }

  if (!map.getLayer(ROUTE_SOLID_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_SOLID_LAYER_ID,
      type: "line",
      source: ROUTE_SOLID_SOURCE_ID,
      paint: {
        "line-color": ["get", "stroke"],
        "line-width": ["get", "width"],
        "line-opacity": ["coalesce", ["get", "opacity"], 0.98]
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    });
  }

  if (!map.getLayer(ROUTE_DASHED_CASING_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_DASHED_CASING_LAYER_ID,
      type: "line",
      source: ROUTE_DASHED_SOURCE_ID,
      paint: {
        "line-color": "rgba(255,255,255,0.82)",
        "line-width": ["+", ["get", "width"], 3],
        "line-opacity": ["coalesce", ["get", "casingOpacity"], 0.8]
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    });
  }

  if (!map.getLayer(ROUTE_DASHED_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_DASHED_LAYER_ID,
      type: "line",
      source: ROUTE_DASHED_SOURCE_ID,
      paint: {
        "line-color": ["get", "stroke"],
        "line-width": ["get", "width"],
        "line-opacity": ["coalesce", ["get", "opacity"], 0.95],
        "line-dasharray": [2.2, 1.6]
      },
      layout: {
        "line-cap": "round",
        "line-join": "round"
      }
    });
  }
}

function updateRouteSources(map: mapboxgl.Map, routes: DispatchMapRoute[]) {
  ensureRouteLayers(map);

  const solidRoutes = routes.filter((route) => !route.dashed);
  const dashedRoutes = routes.filter((route) => route.dashed);

  (map.getSource(ROUTE_SOLID_SOURCE_ID) as GeoJSONSource).setData(createLineFeatureCollection(solidRoutes));
  (map.getSource(ROUTE_DASHED_SOURCE_ID) as GeoJSONSource).setData(createLineFeatureCollection(dashedRoutes));
}

function createMarkerNode(marker: DispatchMapMarker) {
  const state = marker.state ?? (marker.emphasized ? "selected" : "default");
  const color = markerColor(marker.kind);
  const prominent = state === "selected" || state === "hovered" || marker.kind === "load" || marker.kind === "backhaul";
  const dotSize =
    state === "hovered" ? 18 : state === "selected" || marker.emphasized ? 16 : state === "alert" ? 14 : 12;

  const root = document.createElement("div");
  root.className = "dispatch-map-marker";
  root.style.zIndex = String(
    state === "hovered" ? 5 : state === "selected" || marker.kind === "relay" || marker.kind === "backhaul" ? 4 : state === "alert" ? 3 : 1
  );

  const label = document.createElement("div");
  label.className = "dispatch-map-label";
  label.textContent = marker.label;
  label.style.opacity = prominent ? "1" : "0.86";
  label.style.transform = prominent ? "translateY(-1px)" : "none";
  label.style.borderColor = prominent ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.72)";
  label.style.boxShadow =
    state === "hovered"
      ? "0 8px 22px rgba(21,27,41,0.22)"
      : prominent
        ? "0 6px 18px rgba(21,27,41,0.16)"
        : "0 4px 12px rgba(21,27,41,0.12)";

  const dot = document.createElement("div");
  dot.className = marker.emphasized ? "dispatch-map-dot dispatch-map-dot--large" : "dispatch-map-dot";
  dot.style.backgroundColor = color;
  dot.style.width = `${dotSize}px`;
  dot.style.height = `${dotSize}px`;
  dot.style.border = state === "hovered" ? "2px solid rgba(255,255,255,0.98)" : "2px solid rgba(255,255,255,0.92)";
  dot.style.boxShadow =
    state === "hovered"
      ? `0 0 0 6px ${color}22, 0 10px 20px rgba(21,27,41,0.24)`
      : state === "selected"
        ? `0 0 0 4px ${color}20, 0 8px 18px rgba(21,27,41,0.18)`
        : state === "alert"
          ? "0 0 0 4px rgba(217,119,6,0.16)"
          : "0 4px 12px rgba(21,27,41,0.14)";

  if (prominent || state === "alert") {
    const ring = document.createElement("div");
    ring.className = "dispatch-map-dot-ring";
    ring.style.borderColor = state === "alert" ? "#D97706" : color;
    ring.style.opacity = state === "hovered" ? "1" : "0.82";
    dot.appendChild(ring);
  }

  root.appendChild(label);
  root.appendChild(dot);

  return root;
}

function syncMarkers(
  map: mapboxgl.Map,
  markers: DispatchMapMarker[],
  markerRegistry: Array<mapboxgl.Marker>
) {
  markerRegistry.forEach((marker) => marker.remove());
  markerRegistry.length = 0;

  markers
    .slice()
    .sort((left, right) => {
      const leftRank =
        left.state === "hovered" ? 4 : left.state === "selected" || left.kind === "relay" || left.kind === "backhaul" ? 3 : left.state === "alert" ? 2 : 1;
      const rightRank =
        right.state === "hovered" ? 4 : right.state === "selected" || right.kind === "relay" || right.kind === "backhaul" ? 3 : right.state === "alert" ? 2 : 1;

      return leftRank - rightRank;
    })
    .forEach((marker) => {
    const instance = new mapboxgl.Marker({
      element: createMarkerNode(marker),
      anchor: "bottom"
    })
      .setLngLat([marker.lng, marker.lat] satisfies LngLatLike)
      .addTo(map);

    markerRegistry.push(instance);
    });
}

function InteractiveDispatchMapInner(
  { viewport, routes, markers }: InteractiveDispatchMapProps,
  ref: ForwardedRef<DispatchMapHandle>
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Array<mapboxgl.Marker>>([]);
  const token = getClientEnv().mapboxToken;
  const [dynamicRoutes, setDynamicRoutes] = useState<DispatchMapRoute[]>(routes);
  const viewportKey = useMemo(
    () => `${viewport.centerLat.toFixed(4)}:${viewport.centerLng.toFixed(4)}:${viewport.zoom.toFixed(2)}`,
    [viewport.centerLat, viewport.centerLng, viewport.zoom]
  );
  const routeKey = useMemo(() => routes.map(routeRequestKey).join("|"), [routes]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn() {
        mapRef.current?.zoomIn({ duration: 350 });
      },
      zoomOut() {
        mapRef.current?.zoomOut({ duration: 350 });
      },
      resetView() {
        mapRef.current?.easeTo({
          center: [viewport.centerLng, viewport.centerLat],
          zoom: viewport.zoom,
          duration: 950,
          easing: (t) => t * (2 - t)
        });
      }
    }),
    [viewport.centerLat, viewport.centerLng, viewport.zoom]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) {
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/navigation-day-v1",
      center: [viewport.centerLng, viewport.centerLat],
      zoom: viewport.zoom,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false
    });

    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      updateRouteSources(map, routes);
      syncMarkers(map, markers, markersRef.current);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token, viewport.centerLat, viewport.centerLng, viewport.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    updateRouteSources(map, dynamicRoutes);
    syncMarkers(map, markers, markersRef.current);
  }, [dynamicRoutes, markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    map.easeTo({
      center: [viewport.centerLng, viewport.centerLat],
      zoom: viewport.zoom,
      duration: 950,
      easing: (t) => t * (2 - t)
    });
  }, [viewport.centerLat, viewport.centerLng, viewport.zoom, viewportKey]);

  useEffect(() => {
    let cancelled = false;

    if (!token || routes.length === 0) {
      setDynamicRoutes(routes);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const resolvedRoutes = await Promise.all(
          routes.map(async (route) => {
            try {
              return await fetchDynamicRoute(route, token);
            } catch {
              return route;
            }
          })
        );

        if (!cancelled) {
          setDynamicRoutes(resolvedRoutes);
        }
      } catch {
        if (!cancelled) {
          setDynamicRoutes(routes);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeKey, routes, token]);

  if (!token) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,#eef2fb_0%,#dde5f2_100%)] text-sm font-medium text-[color:var(--navpro-text-muted)]">
        Add `NEXT_PUBLIC_MAPBOX_TOKEN` to render the live map.
      </div>
    );
  }

  return <div ref={containerRef} className="absolute inset-0" />;
}

export const InteractiveDispatchMap = forwardRef(InteractiveDispatchMapInner);
