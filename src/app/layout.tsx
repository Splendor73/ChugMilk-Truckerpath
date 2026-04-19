import type { ReactNode } from "react";

import "./globals.css";
import { MockDataProvider } from "@/lib/mock-data/store";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MockDataProvider>{children}</MockDataProvider>
      </body>
    </html>
  );
}
