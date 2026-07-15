import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import type { Locale } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Pill Tracker — Care, made simple and beautiful",
  description:
    "A luxurious, bilingual medication tracker: schedules, photo confirmation, AI pill identification, alerts, and reporting.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pill Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f1712",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const cookieLocale = (await cookies()).get("pt_locale")?.value as
    | Locale
    | undefined;
  const initialLocale: Locale =
    (user?.locale as Locale) || cookieLocale || "en";

  return (
    <html lang={initialLocale} className={`${display.variable} ${sans.variable}`}>
      <body>
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
