import type { ReactNode } from "react";

import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
