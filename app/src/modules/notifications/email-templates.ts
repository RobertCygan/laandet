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
  | "role_granted";

type Rendered = { subject: string; text: string };
type Payload = Record<string, string>;

const signature = {
  nb: "\n\nHilsen\nLaandet\n\nDu får denne e-posten fordi e-postadressen er registrert hos Laandet.",
  en: "\n\nBest regards,\nLaandet\n\nYou are receiving this email because this address is registered with Laandet.",
};

const templates: Record<EmailTemplate, Record<"nb" | "en", (p: Payload) => Rendered>> = {
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
};

export function renderEmail(template: EmailTemplate, locale: "nb" | "en", payload: Payload): Rendered {
  const r = templates[template][locale](payload);
  return { subject: r.subject, text: r.text + signature[locale] };
}

export function isEmailTemplate(value: string): value is EmailTemplate {
  return value in templates;
}
