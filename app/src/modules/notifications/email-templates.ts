/**
 * Plain-text transactional emails in nb and en. Emails contain a short notice and a link,
 * never message bodies, exact addresses or secrets other than the single-use link.
 */
export type EmailTemplate =
  | "verify_email"
  | "reset_password"
  | "password_changed"
  | "email_change_requested"
  | "existing_account_signup"
  | "deletion_requested"
  | "listing_hidden"
  | "appeal_decided"
  | "account_measure"
  | "role_granted"
  | "account_erased"
  | "inactivity_warning"
  | "activity";

type Rendered = { subject: string; text: string };

/** One neutral sentence per account measure (P03-03). */
const MEASURE = {
  nb: {
    warn: "Laandet har gitt deg en advarsel.",
    restrict:
      "Kontoen din er begrenset. Du kan logge inn, lese og fullføre pågående leieforhold og saker, men ikke publisere, sende forespørsler eller starte nye samtaler.",
    suspend: "Kontoen din er stengt. Du kan logge inn bare for å lese begrunnelsen, klage og laste ned dataene dine.",
    reinstate: "Kontoen din er åpnet igjen.",
  },
  en: {
    warn: "Laandet has given you a warning.",
    restrict:
      "Your account is restricted. You can sign in, read and finish ongoing rentals and cases, but not publish, send requests or start new conversations.",
    suspend: "Your account is suspended. You can sign in only to read the reasons, appeal and download your data.",
    reinstate: "Your account has been reinstated.",
  },
};
type Payload = Record<string, string>;

const signature = {
  nb: "\n\nHilsen\nLaandet\n\nDu får denne e-posten fordi e-postadressen er registrert hos Laandet.",
  en: "\n\nBest regards,\nLaandet\n\nYou are receiving this email because this address is registered with Laandet.",
};

/**
 * Phase 02 activity notices: one short sentence per kind, plus a link. Never message text,
 * prices or addresses (ARCHITECTURE §4.8).
 */
export const ACTIVITY_KINDS = {
  booking_requested: { nb: "Du har fått en forespørsel om å leie «%s».", en: 'You have a new request to rent "%s".' },
  booking_accepted: {
    nb: "Forespørselen din om «%s» er godtatt. Les og godta leieavtalen.",
    en: 'Your request for "%s" was accepted. Read and accept the agreement.',
  },
  booking_declined: { nb: "Forespørselen din om «%s» ble ikke godtatt.", en: 'Your request for "%s" was declined.' },
  booking_withdrawn: { nb: "Forespørselen om «%s» er trukket tilbake.", en: 'The request for "%s" was withdrawn.' },
  booking_expired: { nb: "Leieforholdet for «%s» er utløpt.", en: 'The rental of "%s" has expired.' },
  booking_cancelled: { nb: "Leieforholdet for «%s» er avbestilt.", en: 'The rental of "%s" was cancelled.' },
  agreement_new_revision: {
    nb: "Det er laget en ny versjon av leieavtalen for «%s». Godta den på nytt.",
    en: 'There is a new version of the agreement for "%s". Please accept it again.',
  },
  booking_confirmed: {
    nb: "Leieavtalen for «%s» er godtatt av dere begge.",
    en: 'Both of you have accepted the agreement for "%s".',
  },
  condition_to_confirm: {
    nb: "Det er registrert tilstand for «%s». Se over og bekreft.",
    en: 'The condition of "%s" has been recorded. Please review and confirm.',
  },
  handed_over: { nb: "«%s» er registrert som utlevert.", en: '"%s" is recorded as handed over.' },
  return_reminder: {
    nb: "Leieperioden for «%s» er over. Husk å levere tilbake og registrere tilstanden.",
    en: 'The rental period for "%s" has ended. Remember to return it and record the condition.',
  },
  not_returned_possible: {
    nb: "«%s» er ikke registrert som tilbakelevert. Du kan nå markere den som «Ikke tilbakelevert».",
    en: '"%s" has not been recorded as returned. You can now mark it as "Not returned".',
  },
  booking_completed: { nb: "Leieforholdet for «%s» er fullført.", en: 'The rental of "%s" is completed.' },
  booking_disputed: { nb: "Det er meldt fra om et problem med «%s».", en: 'A problem has been reported for "%s".' },
  claim_received: { nb: "Noen vil gjerne ha «%s».", en: 'Someone would like "%s".' },
  claim_selected: { nb: "Du er valgt som mottaker av «%s».", en: 'You have been chosen to receive "%s".' },
  claim_not_selected: {
    nb: "Giveren har valgt en annen mottaker av «%s» foreløpig.",
    en: 'The giver has chosen someone else for "%s" for now.',
  },
  claim_cancelled: { nb: "Overleveringen av «%s» er avlyst.", en: 'The handover of "%s" was cancelled.' },
  claim_expired: {
    nb: "Ønsket ditt om å få «%s» fikk ikke svar innen 14 dager og er utløpt.",
    en: 'Your request for "%s" got no answer within 14 days and has expired.',
  },
  transfer_to_confirm: { nb: "Bekreft overleveringen av «%s».", en: 'Please confirm the handover of "%s".' },
  transfer_confirmed: {
    nb: "Overleveringen av «%s» er bekreftet av dere begge.",
    en: 'Both of you have confirmed the handover of "%s".',
  },
  dispute_opened: {
    nb: "Det er meldt fra om et problem i leieforholdet «%s». Se saken og svar innen 7 dager.",
    en: 'A problem has been reported for the rental of "%s". See the case and answer within 7 days.',
  },
  dispute_update: { nb: "Det er nytt i saken om «%s».", en: 'There is news in the case about "%s".' },
  dispute_escalated: {
    nb: "Laandet er bedt om hjelp i saken om «%s». Support leser saken.",
    en: 'Laandet has been asked to help with the case about "%s". Support will read the case.',
  },
  dispute_closed: { nb: "Saken om «%s» er avsluttet.", en: 'The case about "%s" is closed.' },
  new_message: { nb: "Du har en ny melding om «%s».", en: 'You have a new message about "%s".' },
  review_open: {
    nb: "Leieforholdet for «%s» er fullført. Du kan nå skrive en vurdering i 14 dager.",
    en: 'The rental of "%s" is completed. You can now write a review for 14 days.',
  },
  review_published: {
    nb: "Vurderingene etter leieforholdet for «%s» er publisert.",
    en: 'The reviews after the rental of "%s" have been published.',
  },
  review_removed: {
    nb: "En vurdering du skrev om «%s», er fjernet av Laandet. Se begrunnelsen.",
    en: 'A review you wrote about "%s" was removed by Laandet. See the reasons.',
  },
  review_restored: {
    nb: "En vurdering du skrev om «%s», er gjenopprettet.",
    en: 'A review you wrote about "%s" has been restored.',
  },
} as const;
export type ActivityKind = keyof typeof ACTIVITY_KINDS;

const activityText = (locale: "nb" | "en", p: Payload) =>
  (ACTIVITY_KINDS[p.kind as ActivityKind]?.[locale] ?? "").replace("%s", p.title ?? "");

const templates: Record<EmailTemplate, Record<"nb" | "en", (p: Payload) => Rendered>> = {
  activity: {
    nb: (p) => ({
      subject: `Laandet: ${activityText("nb", p)}`,
      text: `Hei ${p.name}!\n\n${activityText("nb", p)}\n\n${p.url}`,
    }),
    en: (p) => ({
      subject: `Laandet: ${activityText("en", p)}`,
      text: `Hi ${p.name}!\n\n${activityText("en", p)}\n\n${p.url}`,
    }),
  },
  verify_email: {
    nb: (p) => ({
      subject: "Bekreft e-postadressen din hos Laandet",
      text: `Hei ${p.name}!\n\nTrykk på lenken for å bekrefte e-postadressen din. Lenken gjelder i 24 timer og kan brukes én gang:\n\n${p.url}\n\nHar du ikke opprettet konto hos Laandet, kan du se bort fra denne e-posten.`,
    }),
    en: (p) => ({
      subject: "Confirm your email address for Laandet",
      text: `Hi ${p.name}!\n\nOpen the link to confirm your email address. The link is valid for 24 hours and can be used once:\n\n${p.url}\n\nIf you did not create an account with Laandet, you can ignore this email.`,
    }),
  },
  reset_password: {
    nb: (p) => ({
      subject: "Nytt passord til Laandet",
      text: `Hei ${p.name}!\n\nNoen ba om å lage et nytt passord for kontoen din. Lenken gjelder i 1 time og kan brukes én gang:\n\n${p.url}\n\nHar du ikke bedt om dette, kan du se bort fra e-posten. Passordet ditt er ikke endret.`,
    }),
    en: (p) => ({
      subject: "New password for Laandet",
      text: `Hi ${p.name}!\n\nSomeone asked to set a new password for your account. The link is valid for 1 hour and can be used once:\n\n${p.url}\n\nIf you did not ask for this, you can ignore this email. Your password has not been changed.`,
    }),
  },
  password_changed: {
    nb: (p) => ({
      subject: "Passordet ditt hos Laandet er endret",
      text: `Hei ${p.name}!\n\nPassordet til kontoen din ble endret, og du er logget ut fra andre enheter. Var det ikke deg? Lag et nytt passord med en gang via «Glemt passord» og kontakt oss.`,
    }),
    en: (p) => ({
      subject: "Your Laandet password has been changed",
      text: `Hi ${p.name}!\n\nThe password for your account was changed, and you have been signed out on other devices. Was it not you? Set a new password right away via "Forgot password" and contact us.`,
    }),
  },
  email_change_requested: {
    nb: (p) => ({
      subject: "Endring av e-postadresse hos Laandet",
      text: `Hei ${p.name}!\n\nDet er bedt om å endre e-postadressen for kontoen din hos Laandet. Endringen skjer først når lenken som er sendt til den nye adressen, blir åpnet. Var det ikke deg? Endre passordet ditt med en gang via «Glemt passord» og kontakt oss.`,
    }),
    en: (p) => ({
      subject: "Change of email address at Laandet",
      text: `Hi ${p.name}!\n\nA change of the email address for your Laandet account was requested. It only takes effect when the link sent to the new address is opened. Was it not you? Change your password right away via "Forgot password" and contact us.`,
    }),
  },
  existing_account_signup: {
    nb: (p) => ({
      subject: "Noen prøvde å opprette konto med e-postadressen din",
      text: `Hei ${p.name}!\n\nNoen prøvde å opprette en ny konto hos Laandet med denne e-postadressen. Du har allerede en konto. Har du glemt passordet, kan du lage et nytt her:\n\n${p.url}`,
    }),
    en: (p) => ({
      subject: "Someone tried to create an account with your email address",
      text: `Hi ${p.name}!\n\nSomeone tried to create a new Laandet account with this email address. You already have an account. If you forgot your password, you can set a new one here:\n\n${p.url}`,
    }),
  },
  deletion_requested: {
    nb: (p) => ({
      subject: "Vi har mottatt ønsket ditt om å slette kontoen",
      text: `Hei ${p.name}!\n\nKontoen din hos Laandet er nå deaktivert, og annonsene dine er skjult. Vi sletter kontoen innen 30 dager, eller når pågående leieforhold og saker er avsluttet. Les mer om hva som slettes og hva som lagres i personvernerklæringen.`,
    }),
    en: (p) => ({
      subject: "We have received your request to delete your account",
      text: `Hi ${p.name}!\n\nYour Laandet account is now deactivated and your listings are hidden. We will delete the account within 30 days, or when ongoing rentals and cases have ended. The privacy notice explains what is deleted and what is kept.`,
    }),
  },
  listing_hidden: {
    nb: (p) => ({
      subject: "Annonsen din er skjult",
      text: `Hei ${p.name}!\n\nAnnonsen «${p.title}» er skjult av Laandet.\n\nBegrunnelse:\n${p.statement}\n\nDu kan lese avgjørelsen og klage her:\n${p.url}`,
    }),
    en: (p) => ({
      subject: "Your listing has been hidden",
      text: `Hi ${p.name}!\n\nThe listing "${p.title}" has been hidden by Laandet.\n\nStatement of reasons:\n${p.statement}\n\nYou can read the decision and appeal here:\n${p.url}`,
    }),
  },
  account_measure: {
    nb: (p) => ({
      subject: "Avgjørelse om kontoen din hos Laandet",
      text: `Hei ${p.name}!\n\n${MEASURE.nb[p.measure as keyof typeof MEASURE.nb] ?? ""}\n\nBegrunnelse:\n${p.statement}\n\nDu kan lese avgjørelsen og klage her:\n${p.url}`,
    }),
    en: (p) => ({
      subject: "A decision about your Laandet account",
      text: `Hi ${p.name}!\n\n${MEASURE.en[p.measure as keyof typeof MEASURE.en] ?? ""}\n\nStatement of reasons:\n${p.statement}\n\nYou can read the decision and appeal here:\n${p.url}`,
    }),
  },
  appeal_decided: {
    nb: (p) => ({
      subject: "Klagen din er behandlet",
      text: `Hei ${p.name}!\n\nKlagen din er behandlet. Resultat: ${p.outcome}.\n\n${p.decision}\n\nSe saken her:\n${p.url}`,
    }),
    en: (p) => ({
      subject: "Your appeal has been decided",
      text: `Hi ${p.name}!\n\nYour appeal has been decided. Outcome: ${p.outcome}.\n\n${p.decision}\n\nSee it here:\n${p.url}`,
    }),
  },
  role_granted: {
    nb: (p) => ({
      subject: "Endring av rolle i Laandet",
      text: `Hei ${p.name}!\n\nBrukeren ${p.subject} har fått rollen «${p.role}». Begrunnelse: ${p.reason}\n\nHvis dette ikke er avtalt, ta kontakt med de andre administratorene straks.`,
    }),
    en: (p) => ({
      subject: "Role change in Laandet",
      text: `Hi ${p.name}!\n\nThe user ${p.subject} was given the role "${p.role}". Reason: ${p.reason}\n\nIf this was not agreed, contact the other administrators immediately.`,
    }),
  },
  account_erased: {
    nb: (p) => ({
      subject: "Kontoen din hos Laandet er slettet",
      text: `Hei ${p.name}!\n\nKontoen din hos Laandet er nå slettet. E-postadressen, passordet, profilen og annonsene uten leieforhold er fjernet. Leieavtaler, tilstandsrapporter og saker beholdes uten e-postadressen din så lenge personvernerklæringen sier, fordi den andre parten kan trenge dem.\n\nDette er den siste e-posten du får fra oss.`,
    }),
    en: (p) => ({
      subject: "Your Laandet account has been deleted",
      text: `Hi ${p.name}!\n\nYour Laandet account has now been deleted. Your email address, password, profile and listings without rentals have been removed. Rental agreements, condition reports and cases are kept without your email address for as long as the privacy notice says, because the other party may need them.\n\nThis is the last email you will get from us.`,
    }),
  },
  inactivity_warning: {
    nb: (p) => ({
      subject: "Vil du beholde kontoen din hos Laandet?",
      text: `Hei ${p.name}!\n\nDu har ikke logget inn hos Laandet på to år. Hvis du vil beholde kontoen, logger du inn før ${p.date}. Ellers sletter vi den, slik personvernerklæringen beskriver.\n\n${p.url}`,
    }),
    en: (p) => ({
      subject: "Do you want to keep your Laandet account?",
      text: `Hi ${p.name}!\n\nYou have not signed in to Laandet for two years. If you want to keep the account, sign in before ${p.date}. Otherwise we will delete it, as the privacy notice describes.\n\n${p.url}`,
    }),
  },
};

export function renderEmail(template: EmailTemplate, locale: "nb" | "en", payload: Payload): Rendered {
  const r = templates[template][locale](payload);
  return { subject: r.subject, text: r.text + signature[locale] };
}

export function isEmailTemplate(value: string): value is EmailTemplate {
  return value in templates;
}
