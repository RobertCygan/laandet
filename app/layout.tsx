import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
const manrope = localFont({
  src: "../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  display: "swap",
  variable: "--font-manrope",
  weight: "200 800",
});
import { IntroGate } from "@/components/layout/IntroGate";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResearchProvider } from "@/components/research/ResearchProvider";
import { PageTracker } from "@/components/layout/PageTracker";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);
export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "Lånndet – lei ting av folk i nærheten",
    template: "%s | Lånndet",
  },
  description:
    "Lei lokalt. Lån bort det du har. Utforsk en ny lokal markedsplass for utstyr og ting i Steigen. Tydelig merket research-demo.",
  applicationName: "Lånndet",
  openGraph: {
    title: "Lånndet – mer bruk. Mindre kjøp.",
    description:
      "En lokal idé, skapt sammen med Steigen. Utforsk testversjonen.",
    locale: "nb_NO",
    type: "website",
    images: siteUrl
      ? [
          {
            url: "/images/hero.webp",
            width: 1600,
            height: 900,
            alt: "Generert nordnorsk kystlandskap",
          },
        ]
      : [],
  },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#174d3c",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb" className={manrope.variable}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Lånndet",
              inLanguage: "nb-NO",
              description:
                "Lokal markedsplass i tidlig researchfase. Alle annonser er eksempler.",
              ...(siteUrl ? { url: siteUrl } : {}),
            }).replace(/</g, "\\u003c"),
          }}
        />
        <IntroGate>
          <a className="skip-link" href="#main">
            Hopp til innhold
          </a>
          <ResearchProvider>
            <Header />
            <main id="main">{children}</main>
            <Footer />
            <PageTracker />
          </ResearchProvider>
        </IntroGate>
      </body>
    </html>
  );
}
