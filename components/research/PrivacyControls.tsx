"use client";
import { useState, useSyncExternalStore } from "react";
import { Download, Trash2, Check } from "lucide-react";
import { STORAGE_KEYS } from "@/lib/config";
import {
  readLocal,
  writeLocal,
  clearResearch,
  downloadJson,
} from "@/lib/research";
function subscribe(callback: () => void) {
  window.addEventListener("laanndet:storage", callback);
  return () => window.removeEventListener("laanndet:storage", callback);
}
export function PrivacyControls() {
  const enabled = useSyncExternalStore(
    subscribe,
    () => readLocal(STORAGE_KEYS.tracking, true),
    () => true,
  );
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="privacy-controls">
      <h2>Du bestemmer over lokale data.</h2>
      <label className="check-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            writeLocal(STORAGE_KEYS.tracking, e.target.checked);
            setMessage(
              e.target.checked
                ? "Lokal hendelsesregistrering er slått på."
                : "Lokal hendelsesregistrering er slått av. Skjemaer lagres fortsatt når du selv velger å sende dem.",
            );
          }}
        />
        Registrer anonyme handlinger bare i denne nettleseren
      </label>
      <div className="button-row">
        <button
          className="button outline"
          onClick={() => {
            downloadJson(
              Object.fromEntries(
                Object.entries(STORAGE_KEYS).map(([name, key]) => [
                  name,
                  readLocal(key, null),
                ]),
              ),
              "laanndet-mine-lokale-data.json",
            );
            setMessage("Dine lokale data er lastet ned.");
          }}
        >
          <Download size={17} />
          Last ned mine data
        </button>
        <button
          className="button danger-button"
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={17} />
          Slett lokale data
        </button>
      </div>
      {confirm && (
        <div className="delete-confirm">
          <p>
            Dette sletter svar, kontaktinformasjon, kladd, favoritter og
            hendelser fra denne nettleseren.
          </p>
          <div className="button-row">
            <button
              className="button danger-button"
              onClick={() => {
                clearResearch();
                writeLocal(STORAGE_KEYS.tracking, false);
                setConfirm(false);
                setMessage(
                  "Alle Lånndet-data er slettet fra denne nettleseren. Ny hendelsesregistrering er slått av.",
                );
              }}
            >
              Ja, slett alt lokalt
            </button>
            <button
              className="button outline"
              onClick={() => setConfirm(false)}
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="inline-success" role="status">
          <Check size={17} />
          {message}
        </p>
      )}
    </section>
  );
}
