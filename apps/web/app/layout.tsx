import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Synapse — The autonomous AI economy, on-chain",
    template: "%s · Synapse",
  },
  description:
    "Speak any goal. Synapse plans it, hires specialist AI agents, pays them in XLM on Stellar, and narrates the result back — all in under 60 seconds.",
  applicationName: "Synapse",
  keywords: [
    "AI agents",
    "Stellar",
    "XLM",
    "voice AI",
    "agentic AI",
    "blockchain payments",
    "AI marketplace",
  ],
  openGraph: {
    title: "Synapse — The autonomous AI economy, on-chain",
    description:
      "Voice in. AI agents hired and paid in XLM on Stellar. Result narrated back. <60 seconds.",
    type: "website",
    siteName: "Synapse",
  },
  twitter: {
    card: "summary_large_image",
    title: "Synapse — The autonomous AI economy, on-chain",
    description: "Speak a goal → AI agents → on-chain XLM payments → answer.",
  },
};

export const viewport: Viewport = {
  themeColor: "#070A12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
