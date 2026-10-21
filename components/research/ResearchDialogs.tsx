"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Mail,
  ArrowLeft,
  HeartHandshake,
  LockKeyhole,
} from "lucide-react";
import { categories } from "@/data/categories";
import { isContact, saveInterest, saveSurvey, track } from "@/lib/research";
export type Modal = {
  type: "survey" | "intent" | "launch" | "login";
  source?: string;
  title?: string;
  owner?: boolean;
};
export default function ResearchDialogs({
  modal,
  onClose,
  onLaunch,
}: {
  modal: Modal;
  onClose: () => void;
  onLaunch: () => void;
}) {
  return modal.type === "survey" ? (
    <Survey key="survey" onClose={onClose} />
  ) : modal.type === "intent" ? (
    <Intent key={modal.source} modal={modal} onLaunch={onLaunch} />
  ) : (
    <Launch key={modal.type} modal={modal} />
  );
}
const yesNo = ["Ja", "Kanskje", "Nei"];
const questions = [
  {
    title: "Ville du brukt Lånndet?",
    hint: "Tenk på ting du trenger – eller allerede har.",
    options: yesNo,
    key: "use",
  },
  {
    title: "Hva ville du først og fremst brukt tjenesten til?",
    options: ["Leie ting", "Leie ut ting", "Begge deler"],
    key: "purpose",
  },
  {
    title: "Hva kunne du tenke deg å leie?",
    hint: "Velg gjerne flere kategorier.",
    options: categories.map((c) => c.name),
    key: "categories",
    multi: true,
  },
  {
    title: "Har du ting du kunne vurdert å leie ut?",
    options: yesNo,
    key: "own",
  },
  {
    title: "Hva er viktigst for deg?",
    hint: "Velg det som ville gjort deg trygg på å prøve.",
    options: [
      "BankID",
      "Forsikring",
      "Trygg betaling",
      "Lokale brukere",
      "Gode priser",
      "Vurderinger",
      "Levering",
      "Annet",
    ],
    key: "priorities",
    multi: true,
  },
  {
    title: "Hvor langt vil du kjøre for å hente noe?",
    options: ["Under 5 km", "5–15 km", "15–30 km", "Over 30 km"],
    key: "distance",
  },
  {
    title: "Ville levering gjort deg mer interessert?",
    options: yesNo,
    key: "delivery",
  },
];
function Survey({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    categories: [],
    priorities: [],
  });
  const [missing, setMissing] = useState("");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step, done]);
  const q = questions[step];
  function next() {
    if (
      q &&
      (!answers[q.key] ||
        (Array.isArray(answers[q.key]) && answers[q.key].length === 0))
    ) {
      setError("Velg minst ett svar for å fortsette.");
      return;
    }
    setError("");
    setStep(step + 1);
  }
  function finish(e: FormEvent) {
    e.preventDefault();
    if (contact && (!isContact(contact) || !consent)) {
      setError(
        "Skriv en gyldig e-post eller et telefonnummer, og bekreft lokal lagring.",
      );
      return;
    }
    const ok = saveSurvey({
      use: String(answers.use),
      purpose: String(answers.purpose),
      categories: answers.categories as string[],
      own: String(answers.own),
      priorities: answers.priorities as string[],
      distance: String(answers.distance),
      delivery: String(answers.delivery),
      missing,
      contact: contact.trim() || undefined,
    });
    if (!ok) {
      setError(
        "Nettleseren tillater ikke lagring. Last ned svaret eller prøv med lokal lagring aktivert.",
      );
      return;
    }
    setDone(true);
  }
  if (done)
    return (
      <div className="success-content">
        <span className="round-icon">
          <Check />
        </span>
        <p className="eyebrow">TAKK FOR AT DU BIDRAR</p>
        <h2 id="modal-title" ref={heading} tabIndex={-1}>
          Du er med på å forme Lånndet.
        </h2>
        <p>
          Svaret er lagret i denne nettleseren. Det er ikke sendt til teamet. Du
          kan eksportere eller slette det fra Personvern.
        </p>
        <button className="button primary" onClick={onClose}>
          Tilbake til Lånndet <ArrowRight size={17} />
        </button>
      </div>
    );
  return (
    <>
      <p className="eyebrow">ET PAR MINUTTER · HELT FRIVILLIG</p>
      <div className="survey-progress">
        <span>Spørsmål {step + 1} av 9</span>
        <span>{Math.round((step / 9) * 100)} %</span>
      </div>
      <div className="progress-track">
        <i style={{ width: `${((step + 1) / 9) * 100}%` }} />
      </div>
      <h2 id="modal-title" ref={heading} tabIndex={-1}>
        {q?.title ??
          (step === 7
            ? "Hva mangler for at du skulle brukt Lånndet?"
            : "Vil du være blant de første som får teste?")}
      </h2>
      {q ? (
        <>
          <p className="muted">
            {q.hint || "Ditt ærlige svar hjelper oss videre."}
          </p>
          <div className={`answer-options ${q.multi ? "compact-options" : ""}`}>
            {q.options.map((option) => {
              const value = answers[q.key];
              const selected = q.multi
                ? Array.isArray(value) && value.includes(option)
                : value === option;
              return (
                <button
                  key={option}
                  className={selected ? "answer selected" : "answer"}
                  aria-pressed={selected}
                  onClick={() => {
                    setError("");
                    setAnswers({
                      ...answers,
                      [q.key]: q.multi
                        ? Array.isArray(value) && value.includes(option)
                          ? value.filter((x) => x !== option)
                          : [...(Array.isArray(value) ? value : []), option]
                        : option,
                    });
                  }}
                >
                  {option}
                  {selected && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </>
      ) : step === 7 ? (
        <>
          <p className="muted">Valgfritt. Ikke skriv sensitive opplysninger.</p>
          <label className="field">
            Dine tanker
            <textarea
              value={missing}
              onChange={(e) => setMissing(e.target.value)}
              maxLength={2000}
              placeholder="Jeg ville brukt Lånndet hvis …"
              rows={5}
            />
          </label>
        </>
      ) : (
        <form id="survey-finish" onSubmit={finish}>
          <p>
            Kontaktinformasjon er valgfritt. Du kan fullføre uten å dele den.
          </p>
          <label className="field">
            E-post eller telefon (valgfritt)
            <input
              autoComplete="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={150}
              placeholder="E-post eller telefonnummer"
            />
          </label>
          {contact && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Jeg samtykker til at kontaktopplysningen lagres lokalt sammen med
              svaret mitt.
            </label>
          )}
          <p className="privacy-note">
            <LockKeyhole size={15} /> Ingenting sendes til teamet i denne
            testversjonen.
          </p>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        {step > 0 ? (
          <button
            className="button ghost"
            onClick={() => {
              setStep(step - 1);
              setError("");
            }}
          >
            <ArrowLeft size={16} />
            Tilbake
          </button>
        ) : (
          <span />
        )}
        {step < 8 ? (
          <button
            className="button primary"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              next();
            }}
          >
            {step === 7 ? "Fortsett" : "Neste"}
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="button primary"
            key="submit-survey"
            form="survey-finish"
            type="submit"
          >
            Lagre svaret <Check size={16} />
          </button>
        )}
      </div>
      <p className="fine-print">
        Ingen konto. Ingen sporing på tvers av nettsteder. Lagres bare her.
      </p>
    </>
  );
}
function Intent({ modal, onLaunch }: { modal: Modal; onLaunch: () => void }) {
  const [answer, setAnswer] = useState("");
  return (
    <>
      <span className="round-icon">
        <HeartHandshake />
      </span>
      <p className="eyebrow">KOMMER VED LANSERING</p>
      <h2 id="modal-title">
        {modal.owner
          ? "Har du noe lignende?"
          : "Dette kan bli starten på noe lokalt."}
      </h2>
      <p>
        {modal.owner
          ? "Flott! Denne annonsen er et eksempel. Ville du vurdert å leie ut tilsvarende utstyr?"
          : "Denne funksjonen kommer ved lansering. Ville du brukt Lånndet til å leie denne?"}
      </p>
      {!answer ? (
        <div className="answer-options horizontal">
          {yesNo.map((a) => (
            <button
              className="answer"
              key={a}
              onClick={() => {
                track(modal.owner ? "have_this_clicked" : "rent_cta_clicked", {
                  listingId: modal.source ?? "",
                  answer: a,
                });
                setAnswer(a);
              }}
            >
              {a}
            </button>
          ))}
        </div>
      ) : (
        <div className="inline-success" role="status">
          <Check size={19} />
          Takk! Interessen er registrert lokalt på denne enheten.
        </div>
      )}
      <button className="text-link" onClick={onLaunch}>
        Jeg vil teste ved lansering <ArrowRight size={17} />
      </button>
      <p className="fine-print">
        Ingen reservasjon, betaling eller kontakt med en utleier blir opprettet.
      </p>
    </>
  );
}
function Launch({ modal }: { modal: Modal }) {
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!isContact(contact) || !consent) {
      setError("Skriv gyldig e-post eller telefon, og bekreft lokal lagring.");
      return;
    }
    if (saveInterest(contact.trim(), modal.source ?? modal.type)) {
      setDone(true);
      setError("");
    } else setError("Kunne ikke lagre. Nettleseren må tillate lokal lagring.");
  }
  return (
    <>
      <span className="round-icon">
        <Mail />
      </span>
      <p className="eyebrow">LÅNNDET ER IKKE LANSERT ENNÅ</p>
      <h2 id="modal-title">
        {modal.type === "login"
          ? "Snart kan vi dele mer."
          : "Bli med fra begynnelsen."}
      </h2>
      <p>
        {modal.type === "login"
          ? "Innlogging og konto kommer ved lansering. Du kan utforske alle eksemplene uten konto."
          : "Har du lyst til å teste Lånndet når vi åpner i Steigen?"}
      </p>
      {done ? (
        <div className="inline-success" role="status">
          <Check />
          Interessen din er lagret på denne enheten. Ingen melding er sendt, og
          du er ikke meldt på en utsendelse.
        </div>
      ) : (
        <form onSubmit={submit}>
          <label className="field">
            E-post eller telefon
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              autoComplete="email"
              maxLength={150}
              required
              placeholder="din@epost.no"
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            Jeg samtykker til lokal lagring av kontaktopplysningen min.
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full-width" type="submit">
            Ja, jeg vil teste <ArrowRight size={17} />
          </button>
        </form>
      )}
      <p className="privacy-note">
        <LockKeyhole size={15} /> Testversjon: lagres bare i nettleseren, ikke
        hos Lånndet. Se Personvern for eksport og sletting.
      </p>
    </>
  );
}
