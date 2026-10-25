import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pageLocale, param } from "@/i18n/page";
import { signOutAction } from "@/modules/auth/actions";
import { requirePageUser } from "@/modules/auth/guards";
import { listLocalities } from "@/modules/listings/queries";
import { getOwnProfile } from "@/modules/users/service";
import { ChangeEmailForm, ChangePasswordForm, ProfileForm } from "@/ui/forms/AccountForms";
import { ResendVerificationForm, SignOutEverywhereForm } from "@/ui/forms/AuthForms";
import { NarrowPage, PageHeader } from "@/ui/layout/PageHeader";
import { Notice } from "@/ui/Notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/konto">) {
  const locale = await pageLocale(params);
  const actor = await requirePageUser(locale, "/konto");
  const sp = await searchParams;
  const [profile, localities] = await Promise.all([getOwnProfile(actor), listLocalities()]);
  if (!profile) return null;
  const t = await getTranslations("account");
  const ta = await getTranslations("auth");
  const staff = profile.role === "moderator" || profile.role === "admin";
  const statusNotice =
    profile.status === "restricted" ? t("statusRestricted") : profile.status === "suspended" ? t("statusSuspended") : profile.status === "deletion_pending" ? t("statusDeletion") : null;

  return (
    <NarrowPage>
      <PageHeader title={t("title")}>
        <Link href={`/profil/${actor.id}`} className="text-link mt-3 inline-block">
          {t("publicProfile")}
        </Link>
      </PageHeader>
      <div className="flex flex-col gap-6">
        {param(sp.epost) === "1" && profile.emailVerified && (
          <Notice tone="success" role="status">
            {t("emailChanged")}
          </Notice>
        )}
        {param(sp.verified) === "1" && profile.emailVerified && (
          <Notice tone="success" role="status">
            {ta("verifiedBanner")}
          </Notice>
        )}
        {statusNotice && <Notice tone="warning">{statusNotice}</Notice>}

        <section className="card p-6" aria-labelledby="email-h">
          <h2 id="email-h" className="mb-3 text-xl">
            {t("emailHeading")}
          </h2>
          <p className="break-all">
            {profile.email}{" "}
            <span className={`badge ${profile.emailVerified ? "" : "badge-warning"}`}>{profile.emailVerified ? t("emailVerified") : t("emailUnverified")}</span>
          </p>
          {!profile.emailVerified && (
            <div className="mt-4 flex flex-col gap-4">
              <Notice tone="warning">{ta("unverifiedBanner")}</Notice>
              <ResendVerificationForm locale={locale} email={profile.email} />
            </div>
          )}
          {profile.emailVerified && (
            <details className="mt-4">
              <summary className="cursor-pointer font-bold">{t("changeEmailButton")}</summary>
              <div className="mt-4">
                <ChangeEmailForm locale={locale} />
              </div>
            </details>
          )}
        </section>

        <section className="card p-6" aria-labelledby="profile-h">
          <h2 id="profile-h" className="mb-4 text-xl">
            {t("detailsHeading")}
          </h2>
          <ProfileForm
            profile={{ name: profile.name, bio: profile.bio, localitySlug: profile.localitySlug, locale: profile.locale, emailNotifications: profile.emailNotifications }}
            localities={localities.map((l) => ({ slug: l.slug, name: l.name }))}
          />
        </section>

        {staff && (
          <section className="card p-6" aria-labelledby="staff-h">
            <h2 id="staff-h" className="mb-3 text-xl">
              {t("staffHeading")}
            </h2>
            {profile.twoFactorEnabled ? (
              <p>{t("staff2faOn")}</p>
            ) : (
              <>
                <p className="mb-4">{t("staff2faOff")}</p>
                <Link href="/konto/tofaktor" className="button button-primary">
                  {t("staff2faSetup")}
                </Link>
              </>
            )}
          </section>
        )}

        <section className="card p-6" aria-labelledby="security-h">
          <h2 id="security-h" className="mb-4 text-xl">
            {t("securityHeading")}
          </h2>
          <details className="mb-5">
            <summary className="cursor-pointer font-bold">{t("passwordHeading")}</summary>
            <div className="mt-4">
              <ChangePasswordForm />
            </div>
          </details>
          <div className="flex flex-wrap gap-3">
            <form action={signOutAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="button button-subtle">
                {t("signOut")}
              </button>
            </form>
            <SignOutEverywhereForm locale={locale} />
          </div>
        </section>

        <section className="card p-6" aria-labelledby="delete-h">
          <h2 id="delete-h" className="mb-3 text-xl">
            {t("deleteHeading")}
          </h2>
          <p className="mb-4">{t("deleteLead")}</p>
          <Link href="/konto/slett" className="button button-outline">
            {t("deleteButton")}
          </Link>
        </section>
      </div>
    </NarrowPage>
  );
}
