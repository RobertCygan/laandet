"use client";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { X, MessageCircle } from "lucide-react";
import type { Modal } from "./ResearchDialogs";
import { track, writeLocal, readLocal } from "@/lib/research";
import { STORAGE_KEYS } from "@/lib/config";
const ResearchDialogs = dynamic(() => import("./ResearchDialogs"), {
  loading: () => <h2 id="modal-title">Åpner skjemaet …</h2>,
});
const Context = createContext<{
  open: (modal: Modal) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}>({ open: () => {}, favorites: [], toggleFavorite: () => {} });
export const useResearch = () => useContext(Context);
export function ResearchProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<Modal | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const update = () =>
      setFavorites(readLocal<string[]>(STORAGE_KEYS.favorites, []));
    update();
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialog.current?.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modal]);
  function open(value: Modal) {
    if (value.type === "survey") track("survey_started");
    setModal(value);
  }
  function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((x) => x !== id)
      : [...favorites, id];
    setFavorites(next);
    writeLocal(STORAGE_KEYS.favorites, next);
  }
  return (
    <Context.Provider value={{ open, favorites, toggleFavorite }}>
      {children}
      <button className="feedback-tab" onClick={() => open({ type: "survey" })}>
        <MessageCircle size={17} />
        <span>Hva synes du?</span>
      </button>
      <dialog
        ref={dialog}
        className="modal"
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
        aria-labelledby="modal-title"
      >
        <div className="modal-inner">
          <button
            className="icon-button modal-close"
            aria-label="Lukk vinduet"
            onClick={() => setModal(null)}
          >
            <X size={21} />
          </button>
          {modal && (
            <ResearchDialogs
              modal={modal}
              onClose={() => setModal(null)}
              onLaunch={() =>
                setModal({ type: "launch", source: modal.source })
              }
            />
          )}
        </div>
      </dialog>
    </Context.Provider>
  );
}
