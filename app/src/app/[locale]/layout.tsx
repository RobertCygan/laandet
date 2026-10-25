import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale, routing } from "@/i18n/routing";
import { getActor } from "@/modules/auth/actor";
import { SiteFooter } from "@/ui/SiteFooter";
import { SiteHeader } from "@/ui/SiteHeader";
import "../globals.css";

export const viewport: Viewport = { themeColor: "#174d3c", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: isLocale(locale) ? locale : "nb", namespace: "meta" });
  return {
    title: { default: t("title"), template: "%s · Laandet" },
    description: t("description"),
    icons: { icon: "/favicon.svg" },
    // Staging must never be indexed (P01-13); production decides via robots.txt.
    robots: process.env.APP_ENV === "production" ? undefined : { index: false, follow: false },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("common");
  const actor = await getActor();

  return (
    <html lang={locale === "nb" ? "nb-NO" : "en"}>
      <body className="flex min-h-screen flex-col">
        <a className="skip-link" href="#main">
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <SiteHeader actor={actor} locale={locale} />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
