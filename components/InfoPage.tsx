"use client";
import {
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { PrivacyControls } from "@/components/research/PrivacyControls";
import { useResearch } from "@/components/research/ResearchProvider";
export const infoPages: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  om: {
    title: "Mer bruk. Mindre kjøp.",
    intro:
      "Lånndet er en idé om å gjøre hverdagen litt enklere, med tingene vi allerede har rundt oss.",
    sections: [
      [
        "Vi begynner i Steigen",
        "En tilhenger til flyttingen. En tepperenser til sofaen. Eller to kajakker når vennene kommer på besøk. Det finnes mange små behov som kan løses lokalt.",
      ],
      [
        "Vi lager dette sammen",
        "Denne nettversjonen er en tidlig markedstest. Alle annonser, bilder og profiler er eksempler. Målet er å finne ut hva folk faktisk vil leie – og leie ut.",
      ],
      [
        "En lokal start, med rom for mer",
        "Vi starter i Steigen, men bygger med kommuner, lokalområder, postnummer og omtrentlige koordinater slik at flere steder kan bli med senere.",
      ],
    ],
  },
  trygghet: {
    title: "Gode avtaler trenger trygghet.",
    intro:
      "Trygghet skal være en del av Lånndet fra starten. Her er planene våre – ikke funksjoner som er aktive i dag.",
    sections: [
      [
        "BankID-verifisering · planlagt funksjon",
        "Vi vil at folk skal vite hvem de gjør avtaler med. Ingen profiler i denne demoen er verifisert med BankID.",
      ],
      [
        "Betaling · kommer ved lansering",
        "Vi planlegger enkel betaling med Vipps ved lansering. Det finnes ingen aktiv betalingsintegrasjon, og vi hevder ikke et formelt samarbeid.",
      ],
      [
        "Depositum, skade og forsikring · uavklart",
        "Vi undersøker hvordan ansvar, sikkerhet og eventuell forsikring skal løses. Ingen forsikring eller skadeordning gjelder i demoen. Endelige regler må avklares før ekte utleie.",
      ],
      [
        "Vurderinger og rapportering · planlagt funksjon",
        "Erfaringer og enkel rapportering skal hjelpe oss å holde tjenesten trygg. Det vises ingen falske omtaler eller påståtte gjennomførte utleier.",
      ],
      [
        "Personlige adresser",
        "Vi viser bare omtrentlige lokalområder. Nøyaktig adresse skal først deles privat når en avtale er inngått ved lansering.",
      ],
    ],
  },
  personvern: {
    title: "Personvern i testversjonen.",
    intro:
      "Denne forklaringen gjelder research-MVP-en. Den må erstattes av en fullstendig personvernerklæring før en offentlig lansering med sentral innsamling.",
    sections: [
      [
        "Hva lagres?",
        "Søk, kategorivalg, annonseåpninger, interesseklikk og frivillige spørresvar lagres i localStorage i nettleseren din. Eventuelle e-postadresser eller telefonnumre du selv oppgir, lagres også bare her. Fritekst og kontaktinformasjon legges ikke i den anonyme hendelsesloggen.",
      ],
      [
        "Hva sendes til oss?",
        "Ingen forskningssvar, kontaktopplysninger eller annonsekladder sendes til Lånndet i denne versjonen. Vi har ingen sentral venteliste og kan derfor ikke sende deg et lanseringsvarsel basert på dette skjemaet. Ved eksport velger du selv om filen skal deles.",
      ],
      [
        "Ingen reklamesporing",
        "Vi bruker ingen annonsepiksler, fingerprinting eller unødvendige informasjonskapsler. Hendelser har tilfeldige hendelses-ID-er, men ingen permanent person- eller enhets-ID.",
      ],
      [
        "Lagring og sletting",
        "Data blir værende på denne enheten til du sletter dem eller nettleserdataene. Den lokale hendelsesloggen er begrenset til de siste 1 500 hendelsene. Du kan eksportere alt eller slette det nedenfor.",
      ],
      [
        "Bilder, drift og kontakt",
        "Demobildene er KI-genererte og lagres med prosjektet. Bildene du velger i annonsekladden, lastes ikke opp. Ved en senere publisering kan driftsleverandøren behandle vanlige tekniske forespørselslogger. Behandlingsansvarlig, kontaktadresse, lagringstider og eventuelle databehandlere må publiseres før ekte datainnsamling.",
      ],
    ],
  },
  vilkar: {
    title: "Vilkår for å prøve Lånndet.",
    intro:
      "Dette er en demonstrasjon og en markedstest. Ingen bindende leieavtaler kan inngås her.",
    sections: [
      [
        "Eksempelannonser",
        "Alle tilbud, ønsker og profiler er fiktive og merket som demo. Prisene er illustrasjoner av mulige prisnivåer og er ikke bindende tilbud. Ingen ting kan reserveres eller betales.",
      ],
      [
        "Planlagt tjeneste",
        "Innlogging, identitetskontroll, meldinger, betaling, forsikring og utleieavtaler er ikke aktive. Endelige vilkår, gebyrer og ansvarsregler er ikke fastsatt.",
      ],
      [
        "Prøv skjemaene med omtanke",
        "Ikke legg inn sensitive opplysninger, eksakte private adresser eller informasjon om andre uten tillatelse. Annonsekladden lagres kun lokalt og blir ikke publisert.",
      ],
      [
        "Før en offentlig lansering",
        "Fullstendige leievilkår, kontaktinformasjon om ansvarlig virksomhet, personvern og regler for skade og tvister må være på plass før ekte utleie åpnes.",
      ],
    ],
  },
  kontakt: {
    title: "La oss lage noe nyttig, sammen.",
    intro:
      "Hva skulle du ønske du kunne leie i nærheten? Og hva har du stående ubrukt?",
    sections: [
      [
        "Gi en tilbakemelding",
        "Prøv spørreskjemaet og fortell oss hva du tenker. Svaret lagres bare i denne nettleseren og sendes ikke til teamet.",
      ],
      [
        "Kontakt ved lansering",
        "En offentlig kontaktadresse og informasjon om ansvarlig virksomhet er ikke fastsatt. Vi publiserer dette før tjenesten åpnes. Vi har derfor ikke lagt inn en oppdiktet e-postadresse.",
      ],
    ],
  },
};
export function InfoPage({ page }: { page: string }) {
  const { open } = useResearch();
  const data = infoPages[page];
  return (
    <div className="container info-page">
      <div className="breadcrumb">
        <Link href="/">Hjem</Link>
        <span>/</span>
        <span>
          {page === "om"
            ? "Om Lånndet"
            : page === "vilkar"
              ? "Vilkår"
              : page === "trygghet"
                ? "Trygghet"
                : page === "kontakt"
                  ? "Kontakt"
                  : "Personvern"}
        </span>
      </div>
      <div className="info-heading">
        <span className="round-icon">
          {page === "trygghet" ? (
            <ShieldCheck />
          ) : page === "kontakt" ? (
            <MessageCircle />
          ) : (
            <HeartHandshake />
          )}
        </span>
        <p className="eyebrow">LÅNNDET · TIDLIG TESTFASE</p>
        <h1>{data.title}</h1>
        <p>{data.intro}</p>
      </div>
      <div className="info-content">
        {data.sections.map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        {page === "personvern" ? (
          <PrivacyControls />
        ) : (
          <button
            className="button primary"
            onClick={() => open({ type: "survey" })}
          >
            Fortell hva du tenker <ArrowRight size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
