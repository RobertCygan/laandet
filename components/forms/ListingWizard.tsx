"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  X,
  Package,
  Search,
  MapPin,
  Truck,
  Eye,
  Save,
  RotateCcw,
  CalendarDays,
} from "lucide-react";
import { categories, areas, categoryName } from "@/data/categories";
import { CategoryIcon } from "@/components/Icon";
import { useResearch } from "@/components/research/ResearchProvider";
import { readLocal, writeLocal, track } from "@/lib/research";
import { STORAGE_KEYS } from "@/lib/config";
type Draft = {
  type: "rental" | "wanted";
  category: string;
  title: string;
  description: string;
  hour: string;
  day: string;
  weekend: string;
  week: string;
  budget: string;
  location: string;
  postalCode: string;
  delivery: boolean;
  deliveryPrice: string;
  availableFrom: string;
  availableTo: string;
  availability: string;
};
const empty: Draft = {
  type: "rental",
  category: "",
  title: "",
  description: "",
  hour: "",
  day: "",
  weekend: "",
  week: "",
  budget: "",
  location: "",
  postalCode: "",
  delivery: false,
  deliveryPrice: "",
  availableFrom: "",
  availableTo: "",
  availability: "",
};
const steps = [
  "Hva vil du dele?",
  "Fortell litt mer",
  "Pris og praktisk",
  "Sted og tidspunkt",
  "Forhåndsvisning",
];
export function ListingWizard({ initialType }: { initialType: string }) {
  const { open } = useResearch();
  const [draft, setDraft] = useState<Draft>({
    ...empty,
    type: initialType === "wanted" ? "wanted" : "rental",
  });
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [completed, setCompleted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const imageUrls = useRef<string[]>([]);
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      track("create_listing_started", {
        type: initialType === "wanted" ? "wanted" : "rental",
      });
      started.current = true;
    }
    const urls = imageUrls.current;
    return () => {
      urls.forEach(URL.revokeObjectURL);
    };
  }, [initialType]);
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft({ ...draft, [key]: value });
    setError("");
  }
  function validate() {
    if (step === 0 && !draft.category)
      return "Velg en kategori før du fortsetter.";
    if (
      step === 1 &&
      (draft.title.trim().length < 5 || draft.description.trim().length < 20)
    )
      return "Skriv en tittel på minst 5 tegn og en beskrivelse på minst 20 tegn.";
    if (step === 2) {
      if (
        draft.type === "rental" &&
        ![draft.hour, draft.day, draft.weekend, draft.week].some(
          (v) => Number(v) > 0,
        )
      )
        return "Legg til minst én pris større enn 0 kr.";
      if (draft.type === "wanted" && !draft.budget.trim())
        return "Beskriv budsjettet ditt. Du kan også skrive «etter avtale».";
      if (
        draft.delivery &&
        (!draft.deliveryPrice || Number(draft.deliveryPrice) < 0)
      )
        return "Oppgi en leveringspris, eventuelt 0 kr.";
    }
    if (step === 3) {
      if (!draft.location) return "Velg et område.";
      if (!/^\d{4}$/.test(draft.postalCode))
        return "Skriv et norsk postnummer med fire sifre.";
      if (
        draft.availableFrom &&
        draft.availableTo &&
        draft.availableFrom > draft.availableTo
      )
        return "Sluttdato må være etter startdato.";
    }
    return "";
  }
  function next(e: FormEvent) {
    e.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setStep(Math.min(4, step + 1));
    heading.current?.focus();
  }
  function save() {
    const ok = writeLocal(STORAGE_KEYS.draft, draft);
    setNotice(
      ok
        ? "Kladden er lagret i denne nettleseren. Bilder må velges på nytt etter en oppdatering."
        : "Kunne ikke lagre kladden. Lokal lagring er deaktivert.",
    );
  }
  function restore() {
    const saved = readLocal<Draft | null>(STORAGE_KEYS.draft, null);
    if (saved && ["rental", "wanted"].includes(saved.type)) {
      setDraft({ ...empty, ...saved });
      setStep(0);
      setNotice("Den lokale kladden er gjenopprettet.");
    } else setNotice("Ingen lagret kladd i denne nettleseren.");
  }
  function finish() {
    track("create_listing_completed_demo", {
      type: draft.type,
      category: draft.category,
      location: draft.location,
      delivery: draft.delivery,
    });
    setCompleted(true);
    writeLocal(STORAGE_KEYS.draft, draft);
  }
  return (
    <div className="container wizard-page">
      <div className="breadcrumb">
        <Link href="/">Hjem</Link>
        <span>/</span>
        <span>Ny annonse</span>
      </div>
      <div className="wizard-intro">
        <p className="eyebrow">FRA BOD TIL NYTTE</p>
        <h1>Hva vil du dele med nabolaget?</h1>
        <p>Prøv å lage en annonse. Ingenting publiseres i testversjonen.</p>
      </div>
      {completed ? (
        <section className="wizard-card completed-card">
          <span className="round-icon">
            <Check />
          </span>
          <h2>Lånndet er ikke lansert ennå.</h2>
          <p>
            Du har prøvd hele annonseflyten. Annonsen er bare en lokal kladd og
            vises ikke til andre.
          </p>
          <h3>Vil du få beskjed når du kan publisere annonsen?</h3>
          <button
            className="button primary"
            onClick={() => open({ type: "launch", source: "create-listing" })}
          >
            Ja, gi meg beskjed <ArrowRight size={17} />
          </button>
          <p className="fine-print">
            I denne versjonen lagres interessen bare på enheten din.
          </p>
          <Link href="/utforsk" className="text-link">
            Tilbake til annonsene
          </Link>
        </section>
      ) : (
        <div className="wizard-layout">
          <aside className="wizard-steps" aria-label="Annonsetrinn">
            {steps.map((title, i) => (
              <div
                key={title}
                className={`${step === i ? "current " : ""}${step > i ? "complete" : ""}`}
                aria-current={step === i ? "step" : undefined}
              >
                <span>{step > i ? <Check size={16} /> : i + 1}</span>
                <strong>{title}</strong>
              </div>
            ))}
            <div className="wizard-tip">
              <Package size={25} />
              <h3>Det trenger ikke være nytt.</h3>
              <p>Bare nyttig for noen i nærheten.</p>
            </div>
          </aside>
          <section className="wizard-card">
            <div className="wizard-card-top">
              <span className="eyebrow">TRINN {step + 1} AV 5</span>
              <div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Gjenopprett lokal kladd"
                  onClick={restore}
                >
                  <RotateCcw size={17} />
                </button>
                <button
                  className="button ghost small-button"
                  type="button"
                  onClick={save}
                >
                  <Save size={16} />
                  Lagre kladd
                </button>
              </div>
            </div>
            {notice && (
              <p className="inline-success" role="status">
                {notice}
              </p>
            )}
            <h2 ref={heading} tabIndex={-1}>
              {steps[step]}
            </h2>
            <form onSubmit={next}>
              {step === 0 && (
                <>
                  <p className="muted">
                    Like fint å ha noe å tilby som å vite hva du trenger.
                  </p>
                  <div className="type-choices">
                    <button
                      type="button"
                      className={draft.type === "rental" ? "selected" : ""}
                      aria-pressed={draft.type === "rental"}
                      onClick={() => update("type", "rental")}
                    >
                      <Package size={27} />
                      <strong>Jeg vil leie ut</strong>
                      <span>La tingene dine komme til nytte.</span>
                    </button>
                    <button
                      type="button"
                      className={draft.type === "wanted" ? "selected" : ""}
                      aria-pressed={draft.type === "wanted"}
                      onClick={() => update("type", "wanted")}
                    >
                      <Search size={27} />
                      <strong>Jeg ønsker å leie</strong>
                      <span>Kanskje noen i nærheten har det.</span>
                    </button>
                  </div>
                  <label className="field">
                    Velg kategori
                    <select
                      aria-label="Velg kategori"
                      value={draft.category}
                      onChange={(e) => update("category", e.target.value)}
                    >
                      <option value="">Hva slags ting gjelder det?</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="wizard-category-icons">
                    {categories.slice(0, 6).map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        aria-label={`Velg ${c.name}`}
                        title={c.name}
                        className={draft.category === c.id ? "selected" : ""}
                        onClick={() => update("category", c.id)}
                      >
                        <CategoryIcon name={c.icon} size={23} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <label className="field">
                    Tittel
                    <input
                      value={draft.title}
                      onChange={(e) => update("title", e.target.value)}
                      maxLength={100}
                      placeholder={
                        draft.type === "rental"
                          ? "For eksempel: Høytrykksspyler med terrassevasker"
                          : "For eksempel: Trenger tilhenger en helg"
                      }
                    />
                  </label>
                  <label className="field">
                    Beskrivelse
                    <textarea
                      value={draft.description}
                      onChange={(e) => update("description", e.target.value)}
                      maxLength={3000}
                      rows={5}
                      placeholder="Fortell hva det gjelder, hva som følger med og hva som er greit å vite."
                    />
                  </label>
                  <label className="upload-zone">
                    <Upload size={26} />
                    <strong>Legg til bilder (valgfritt)</strong>
                    <span>
                      Inntil 5 bilder · JPG, PNG eller WebP · maks. 8 MB hver
                    </span>
                    <input
                      type="file"
                      aria-label="Velg bilder"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (
                          files.some(
                            (f) =>
                              f.size > 8 * 1024 * 1024 ||
                              ![
                                "image/jpeg",
                                "image/png",
                                "image/webp",
                              ].includes(f.type),
                          )
                        ) {
                          setError(
                            "Velg JPG-, PNG- eller WebP-bilder på maks. 8 MB.",
                          );
                          return;
                        }
                        const next = files
                          .slice(0, 5 - images.length)
                          .map((f) => ({
                            name: f.name,
                            url: URL.createObjectURL(f),
                          }));
                        imageUrls.current.push(...next.map((i) => i.url));
                        setImages([...images, ...next]);
                        setError("");
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="upload-previews">
                    {images.map((image, i) => (
                      <div key={image.url}>
                        <Image
                          src={image.url}
                          alt={image.name}
                          width={100}
                          height={80}
                          unoptimized
                        />
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Fjern ${image.name}`}
                          onClick={() => {
                            URL.revokeObjectURL(image.url);
                            setImages(images.filter((_, n) => n !== i));
                          }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="fine-print">
                    Bildene forlater aldri denne nettleseren. Ikke last opp
                    bilder av andre uten tillatelse.
                  </p>
                </>
              )}
              {step === 2 && (
                <>
                  {draft.type === "rental" ? (
                    <>
                      <p className="muted">
                        Velg ett eller flere prisintervaller. Priser oppgis i
                        norske kroner.
                      </p>
                      <div className="price-inputs">
                        {(["hour", "day", "weekend", "week"] as const).map(
                          (key, i) => (
                            <label className="field" key={key}>
                              {
                                ["Per time", "Per dag", "Per helg", "Per uke"][
                                  i
                                ]
                              }
                              <div className="input-suffix">
                                <input
                                  type="number"
                                  min="1"
                                  max="100000"
                                  step="1"
                                  value={draft[key]}
                                  onChange={(e) => update(key, e.target.value)}
                                  placeholder="0"
                                />
                                <span>kr</span>
                              </div>
                            </label>
                          ),
                        )}
                      </div>
                    </>
                  ) : (
                    <label className="field">
                      Budsjett
                      <input
                        value={draft.budget}
                        onChange={(e) => update("budget", e.target.value)}
                        maxLength={100}
                        placeholder="For eksempel: Opptil 700 kr / helg"
                      />
                    </label>
                  )}
                  <label className="field disabled-field">
                    Depositum
                    <input disabled placeholder="Kommer ved lansering" />
                  </label>
                  <div className="filter-divider" />
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={draft.delivery}
                      onChange={(e) => update("delivery", e.target.checked)}
                    />
                    <Truck size={19} />
                    {draft.type === "rental"
                      ? "Jeg kan tilby levering"
                      : "Jeg er interessert i levering"}
                  </label>
                  {draft.delivery && (
                    <label className="field">
                      {draft.type === "rental"
                        ? "Pris for levering"
                        : "Maks. budsjett for levering"}{" "}
                      (kr)
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={draft.deliveryPrice}
                        onChange={(e) =>
                          update("deliveryPrice", e.target.value)
                        }
                        placeholder="For eksempel 150"
                      />
                    </label>
                  )}
                  <p className="fine-print">
                    Ingen betaling eller depositum håndteres i testversjonen.
                  </p>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="form-two-col">
                    <label className="field">
                      Kommune
                      <input value="Steigen" readOnly />
                    </label>
                    <label className="field">
                      Område
                      <select
                        aria-label="Område"
                        value={draft.location}
                        onChange={(e) => update("location", e.target.value)}
                      >
                        <option value="">Velg et område</option>
                        {areas.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    Postnummer
                    <input
                      inputMode="numeric"
                      value={draft.postalCode}
                      onChange={(e) =>
                        update(
                          "postalCode",
                          e.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                      maxLength={4}
                      placeholder="8283"
                    />
                  </label>
                  <p className="privacy-note">
                    <MapPin size={15} />
                    Vi viser bare et omtrentlig område. Ikke skriv gateadresse.
                  </p>
                  <div className="filter-divider" />
                  <h3>
                    <CalendarDays size={19} />
                    Tilgjengelighet / ønsket periode
                  </h3>
                  <div className="form-two-col">
                    <label className="field">
                      Fra (valgfritt)
                      <input
                        type="date"
                        value={draft.availableFrom}
                        onChange={(e) =>
                          update("availableFrom", e.target.value)
                        }
                      />
                    </label>
                    <label className="field">
                      Til (valgfritt)
                      <input
                        type="date"
                        min={draft.availableFrom}
                        value={draft.availableTo}
                        onChange={(e) => update("availableTo", e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="field">
                    Noe mer om tidspunktet? (valgfritt)
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={draft.availability}
                      onChange={(e) => update("availability", e.target.value)}
                      placeholder="For eksempel: Helger passer best. Fleksibel på tidspunkt."
                    />
                  </label>
                </>
              )}
              {step === 4 && (
                <>
                  <div className="listing-preview">
                    <div className="preview-image">
                      {images[0] ? (
                        <Image
                          src={images[0].url}
                          fill
                          unoptimized
                          alt="Ditt valgte annonsebilde"
                        />
                      ) : (
                        <>
                          <Package size={45} />
                          <span>Din lokale forhåndsvisning</span>
                        </>
                      )}
                      <span className="demo-badge">Demoannonse</span>
                    </div>
                    <div>
                      <span className="category-label">
                        {categoryName(draft.category)} ·{" "}
                        {draft.type === "rental" ? "Til leie" : "Ønskes leid"}
                      </span>
                      <h3>{draft.title}</h3>
                      <p className="listing-location">
                        <MapPin size={15} />
                        {draft.location}, {draft.postalCode} · Steigen
                      </p>
                      <p className="preview-description">{draft.description}</p>
                      {draft.type === "wanted" ? (
                        <strong>{draft.budget}</strong>
                      ) : (
                        <div className="preview-prices">
                          {(["hour", "day", "weekend", "week"] as const).map(
                            (k, i) =>
                              draft[k] && (
                                <span key={k}>
                                  {draft[k]} kr /{" "}
                                  {["time", "dag", "helg", "uke"][i]}
                                </span>
                              ),
                          )}
                        </div>
                      )}
                      {draft.delivery && (
                        <p>
                          <Truck size={16} />{" "}
                          {draft.type === "rental"
                            ? "Levering tilbys"
                            : "Levering ønskes"}{" "}
                          · {draft.deliveryPrice} kr
                        </p>
                      )}
                      {(draft.availableFrom || draft.availableTo) && (
                        <p>
                          <CalendarDays size={16} />{" "}
                          {draft.availableFrom || "Fleksibel start"} –{" "}
                          {draft.availableTo || "Fleksibel slutt"}
                        </p>
                      )}
                      {draft.availability && <p>{draft.availability}</p>}
                    </div>
                  </div>
                  <div className="research-banner">
                    <Eye size={19} />
                    <p>
                      Dette er kun en forhåndsvisning på din enhet. Annonsen
                      blir ikke publisert.
                    </p>
                  </div>
                </>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="wizard-actions">
                {step > 0 ? (
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => {
                      setStep(step - 1);
                      setError("");
                    }}
                  >
                    <ArrowLeft size={17} />
                    Tilbake
                  </button>
                ) : (
                  <Link href="/utforsk" className="text-link">
                    Avbryt
                  </Link>
                )}
                {step < 4 ? (
                  <button className="button primary" type="submit">
                    {step === 3 ? "Forhåndsvis annonse" : "Neste"}
                    <ArrowRight size={17} />
                  </button>
                ) : (
                  <button
                    className="button primary"
                    type="button"
                    onClick={finish}
                  >
                    Fullfør demoen <Check size={17} />
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
