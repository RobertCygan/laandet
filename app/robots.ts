import type { MetadataRoute } from "next";
// No canonical host is invented; add a sitemap once a production domain is set.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/research", "/profil/"] },
  };
}
