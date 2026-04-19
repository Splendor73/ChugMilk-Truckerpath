export function getClientEnv() {
  return {
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""
  };
}
