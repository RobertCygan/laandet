"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PLAYBACK_RATE = 2;
/** Once per page load: navigating back to the front page inside the site does not replay it. */
let playedThisDocument = false;

/**
 * The owner's logo animation (D-062) over the front page, at double speed (about 3.5 s).
 * - The page is rendered underneath; the overlay only appears after hydration, so without JavaScript
 *   nothing is hidden.
 * - Skipped for «reduced motion»; Escape or the button ends it; a playback error ends it.
 * - Nothing is stored in the browser.
 */
export function IntroGate({ title, opening, skip }: { title: string; opening: string; skip: string }) {
  const [phase, setPhase] = useState<"off" | "playing" | "leaving">("off");
  const video = useRef<HTMLVideoElement>(null);
  const skipButton = useRef<HTMLButtonElement>(null);
  const finish = useCallback(() => setPhase((p) => (p === "off" ? "off" : "leaving")), []);

  useEffect(() => {
    if (playedThisDocument) return;
    const frame = requestAnimationFrame(() => {
      playedThisDocument = true;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPhase("playing");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    skipButton.current?.focus({ preventScroll: true });
    const el = video.current;
    if (el) {
      el.defaultPlaybackRate = PLAYBACK_RATE;
      el.playbackRate = PLAYBACK_RATE;
      el.play()?.catch(finish);
    }
    const fallback = window.setTimeout(finish, 6000);
    return () => {
      window.clearTimeout(fallback);
      document.body.style.overflow = previous;
    };
  }, [phase, finish]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("off"), 220);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "off") return null;
  return (
    <section
      className={`logo-intro ${phase === "leaving" ? "logo-intro-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="logo-intro"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish();
        }
        if (e.key === "Tab") {
          e.preventDefault();
          skipButton.current?.focus();
        }
      }}
    >
      <video
        ref={video}
        className="logo-intro-video"
        autoPlay
        muted
        playsInline
        preload="auto"
        width={1080}
        height={1080}
        onEnded={finish}
        onError={finish}
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/videos/intro.webm" type="video/webm" />
        <source src="/videos/intro.mp4" type="video/mp4" />
      </video>
      <div className="logo-intro-footer">
        <span>{opening}</span>
        <button ref={skipButton} type="button" className="logo-intro-skip" onClick={finish}>
          {skip} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
