"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
type Sources = { webm: string; mp4: string };
/** Plays once per document opening; route navigation does not replay it. */
export function IntroGate({
  children,
  sources = { webm: "/videos/intro.webm", mp4: "/videos/intro.mp4" },
}: {
  children: ReactNode;
  sources?: Sources;
}) {
  const [phase, setPhase] = useState<
    "pending" | "playing" | "leaving" | "done"
  >("pending");
  const video = useRef<HTMLVideoElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const finish = useCallback(
    () => setPhase((current) => (current === "done" ? "done" : "leaving")),
    [],
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        setPhase("done");
      else setPhase("playing");
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (phase === "done") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== "playing") return;
    skip.current?.focus({ preventScroll: true });
    const playback = video.current?.play();
    playback?.catch(finish);
    const fallback = window.setTimeout(finish, 12000);
    return () => window.clearTimeout(fallback);
  }, [phase, finish]);
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("done"), 220);
    return () => window.clearTimeout(timer);
  }, [phase]);
  const active = phase !== "done";
  return (
    <>
      <div
        className={`intro-content ${phase === "leaving" ? "intro-content-reveal" : ""}`}
        inert={active ? true : undefined}
        aria-hidden={active ? true : undefined}
      >
        {children}
      </div>
      {active && (
        <section
          className={`logo-intro ${phase === "leaving" ? "logo-intro-leaving" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logo-intro-title"
          data-testid="logo-intro"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              finish();
            }
            if (e.key === "Tab") {
              e.preventDefault();
              skip.current?.focus();
            }
          }}
        >
          <h2 id="logo-intro-title" className="visually-hidden">
            G-PSI GovTech Solutions – logoanimasjon
          </h2>
          {phase !== "pending" && (
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
              <source src={sources.webm} type="video/webm" />
              <source src={sources.mp4} type="video/mp4" />
            </video>
          )}
          <div className="logo-intro-footer">
            <span>Åpner Lånndet</span>
            <button ref={skip} className="logo-intro-skip" onClick={finish}>
              Hopp over intro <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>
      )}
    </>
  );
}
