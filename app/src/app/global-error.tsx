"use client";

/**
 * Last-resort error page when the root layout itself fails (SEC-42). It cannot use translations or the
 * site layout, so it is short, bilingual and shows only the reference code.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="nb">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "40rem", margin: "0 auto" }}>
        <h1>Noe gikk galt</h1>
        <p>Vi beklager. Prøv igjen om litt.</p>
        <p lang="en">Something went wrong. Please try again in a moment.</p>
        {error.digest && (
          <p>
            Referanse / reference: <code>{error.digest}</code>
          </p>
        )}
        <p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is intended when the root layout failed */}
          <a href="/">Laandet</a>
        </p>
      </body>
    </html>
  );
}
