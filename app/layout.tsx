import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gargantua — Black Hole Simulation",
  description:
    "Real-time Schwarzschild geodesic ray-tracer: gravitational lensing, Doppler-beamed accretion disk, HDR bloom.",
};

export const viewport: Viewport = {
  themeColor: "#030307",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
