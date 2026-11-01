/**
 * A person's avatar: the profile photo when there is one (D-061), otherwise the first letter of the
 * display name. Decorative: the name is always written next to it.
 */
export function Avatar({ name, mediaId, size = "sm" }: { name: string; mediaId?: string | null; size?: "sm" | "lg" }) {
  if (mediaId) {
    // eslint-disable-next-line @next/next/no-img-element -- served by /media with its own access rules
    return <img src={`/media/${mediaId}/thumb`} alt="" className={`avatar avatar-${size} avatar-photo`} />;
  }
  const initial = (name.trim().charAt(0) || "?").toLocaleUpperCase("nb");
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {initial}
    </span>
  );
}
