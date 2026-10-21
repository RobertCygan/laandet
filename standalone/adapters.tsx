/* eslint-disable @next/next/no-img-element -- The offline export embeds images directly and has no Next.js image server. */
/** Browser-only adapters used exclusively by the single-file export. */
import {
  lazy,
  Suspense,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import assets from "standalone:assets";
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
export function useOfflineLocation() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1) || "/",
    () => "/",
  );
}
export function toHash(href: string) {
  if (/^(https?:|mailto:|tel:|data:|blob:)/i.test(href)) return href;
  return "#" + (href.startsWith("/") ? href : "/" + href);
}
export function OfflineLink({
  href,
  prefetch: _prefetch,
  scroll: _scroll,
  replace: _replace,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
}) {
  void _prefetch;
  void _scroll;
  void _replace;
  return <a {...props} href={toHash(href)} />;
}
// The standalone file has no Next image server; every image is an embedded data URI.
export function OfflineImage({
  src,
  alt,
  fill,
  priority,
  unoptimized: _unoptimized,
  sizes: _sizes,
  style,
  ...props
}: {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  void _unoptimized;
  void _sizes;
  return (
    <img
      {...props}
      alt={alt}
      src={assets[src] ?? src}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      style={
        fill
          ? {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              ...style,
            }
          : style
      }
    />
  );
}
export function usePathname() {
  return useOfflineLocation().split(/[?#]/)[0] || "/";
}
export function useRouter() {
  return {
    push: (href: string) => {
      window.location.hash = toHash(href);
    },
    replace: (href: string) => window.location.replace(toHash(href)),
    back: () => window.history.back(),
    refresh: () => window.location.reload(),
  };
}
export function offlineDynamic<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  options?: { loading?: ComponentType },
) {
  const Loaded = lazy(loader);
  const Loading = options?.loading;
  return function OfflineLazy(props: P) {
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <Loaded {...props} />
      </Suspense>
    );
  };
}
export function notFound(): never {
  throw new Error("Siden finnes ikke i denne demoen.");
}
export function OfflineNotice({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
