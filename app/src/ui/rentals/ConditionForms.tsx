"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";
import { confirmConditionAction, conditionEntryAction, uploadConditionPhotoAction } from "@/modules/rentals/actions";
import { idle } from "@/modules/server/action";
import { SubmitButton } from "@/ui/SubmitButton";
import { FieldError, FormError, invalid, prev } from "@/ui/forms/FormMessages";

type Loc = "nb" | "en";
type Phase = "handover" | "return";

const CONDITIONS = ["new", "as_new", "good", "fair", "worn", "defective"] as const;
const FUNCTIONAL = ["works", "works_with_remarks", "not_working", "not_tested"] as const;
const CLEANLINESS = ["clean", "acceptable", "needs_cleaning"] as const;
const OUTCOMES = ["returned_ok", "returned_normal_wear", "returned_with_deviation"] as const;
export const CHECKLIST = [
  "correct_item",
  "condition_described",
  "accessories_included",
  "instructions_given",
  "handover_as_agreed",
] as const;
const MAX_PHOTOS = 8;

/** Photos for a condition entry: the camera opens directly on phones (`capture="environment"`). */
function PhotoPicker() {
  const t = useTranslations("condition");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const errs: string[] = [];
    let room = MAX_PHOTOS - photos.length;
    for (const file of Array.from(files)) {
      if (room <= 0) break;
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadConditionPhotoAction(fd);
      if (res.status === "ok" && res.data) {
        const id = res.data.id;
        setPhotos((p) => [...p, id]);
        room -= 1;
      } else if (res.status === "error") {
        const key = res.detail ?? res.fieldErrors?.file;
        errs.push(`${file.name}: ${key && tv.has(key) ? tv(key) : te.has(res.code) ? te(res.code) : te("unexpected")}`);
      }
    }
    setProblems(errs);
    setBusy(false);
  }

  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 font-bold">{t("photos")}</legend>
      <p className="field-hint">{t("photosHint")}</p>
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((id) => (
            <li key={id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- own upload via the authorised media route */}
              <img
                src={`/media/${id}/thumb`}
                alt=""
                width={240}
                height={180}
                className="aspect-[4/3] w-full rounded object-cover"
              />
              <input type="hidden" name="photoId" value={id} />
              <button
                type="button"
                className="button button-subtle absolute top-1 right-1 min-h-0 p-1"
                onClick={() => setPhotos((p) => p.filter((x) => x !== id))}
                aria-label={t("removePhoto")}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {photos.length < MAX_PHOTOS && (
        <label className="button button-outline w-full cursor-pointer">
          <Camera size={20} aria-hidden="true" />
          {busy ? t("uploading") : t("takePhoto")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            multiple
            className="visually-hidden"
            disabled={busy}
            onChange={(e) => {
              void add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {problems.map((p) => (
        <p key={p} className="field-error" role="alert">
          {p}
        </p>
      ))}
    </fieldset>
  );
}

/** A party's own entry (CONDITION_REPORTS §3, category A). A correction supersedes the author's earlier entry. */
export function ConditionEntryForm({
  bookingId,
  phase,
  locale,
  accessories,
  supersedesEntryId,
}: {
  bookingId: string;
  phase: Phase;
  locale: Loc;
  accessories: string[];
  supersedesEntryId?: string;
}) {
  const t = useTranslations("condition");
  const tl = useTranslations("listing");
  const tc = useTranslations("common");
  const [state, action] = useActionState(conditionEntryAction, idle);
  const damage = phase === "handover" ? "existingDamage" : "newDamage";
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="phase" value={phase} />
      <input type="hidden" name="locale" value={locale} />
      {supersedesEntryId && <input type="hidden" name="supersedesEntryId" value={supersedesEntryId} />}
      {phase === "return" && <p className="card bg-secondary/40 p-4 text-sm">{t("returnRule")}</p>}

      <label className="field">
        {t("overall")}
        <select name="overallCondition" required defaultValue={prev(state, "overallCondition") ?? ""}>
          <option value="">–</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {tl(`condition.${c}`)}
            </option>
          ))}
        </select>
        <FieldError state={state} name="overallCondition" />
      </label>
      <label className="field">
        {t("functional")}
        <select name="functionalStatus" required defaultValue={prev(state, "functionalStatus") ?? ""}>
          <option value="">–</option>
          {FUNCTIONAL.map((c) => (
            <option key={c} value={c}>
              {t(`functionalValue.${c}`)}
            </option>
          ))}
        </select>
        <FieldError state={state} name="functionalStatus" />
      </label>
      <label className="field">
        {t(damage)}
        <textarea name={damage} rows={3} maxLength={2000} defaultValue={prev(state, damage)} />
        <span className="field-hint">{t(`${damage}Hint`)}</span>
      </label>
      {accessories.length > 0 && (
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 font-bold">{t("accessories")}</legend>
          {accessories.map((a, i) => (
            <label key={a} className="check">
              <input type="hidden" name="accessoryName" value={a} />
              <input type="checkbox" name="accessoryPresent" value={String(i)} defaultChecked />
              <span>{a}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field">
          {t("fuelOrBattery")} <span className="text-muted">({tc("optional")})</span>
          <input name="fuelOrBattery" maxLength={100} defaultValue={prev(state, "fuelOrBattery")} />
        </label>
        <label className="field">
          {t("cleanliness")} <span className="text-muted">({tc("optional")})</span>
          <select name="cleanliness" defaultValue={prev(state, "cleanliness") ?? ""}>
            <option value="">–</option>
            {CLEANLINESS.map((c) => (
              <option key={c} value={c}>
                {t(`cleanlinessValue.${c}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        {t("serial")} <span className="text-muted">({tc("optional")})</span>
        <input name="serialOrIdentifier" maxLength={100} defaultValue={prev(state, "serialOrIdentifier")} />
      </label>
      <label className="field">
        {t("notes")} <span className="text-muted">({tc("optional")})</span>
        <textarea name="notes" rows={2} maxLength={2000} defaultValue={prev(state, "notes")} />
      </label>
      {phase === "return" && (
        <fieldset className="flex flex-col gap-2 border-0 p-0" aria-invalid={invalid(state, "proposedOutcome")}>
          <legend className="mb-1 font-bold">{t("outcome")}</legend>
          {OUTCOMES.map((o) => (
            <label key={o} className="check">
              <input
                type="radio"
                name="proposedOutcome"
                value={o}
                required
                defaultChecked={prev(state, "proposedOutcome") === o}
              />
              <span>{t(`outcomeValue.${o}`)}</span>
            </label>
          ))}
          <FieldError state={state} name="proposedOutcome" />
        </fieldset>
      )}
      <PhotoPicker />
      <SubmitButton className="button button-primary w-full" pendingLabel={tc("saving")}>
        {supersedesEntryId ? t("saveCorrection") : t("saveEntry")}
      </SubmitButton>
    </form>
  );
}

/** Confirm or contest the current version; the handover needs the whole checklist. */
export function ConfirmConditionForm({ bookingId, phase, locale }: { bookingId: string; phase: Phase; locale: Loc }) {
  const t = useTranslations("condition");
  const tc = useTranslations("common");
  const [state, action] = useActionState(confirmConditionAction, idle);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="phase" value={phase} />
      <input type="hidden" name="locale" value={locale} />
      {phase === "handover" && (
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 font-bold">{t("checklist")}</legend>
          {CHECKLIST.map((k) => (
            <label key={k} className="check">
              <input type="checkbox" name="check" value={k} />
              <span>{t(`check.${k}`)}</span>
            </label>
          ))}
          <FieldError state={state} name="checklist" />
        </fieldset>
      )}
      <label className="field">
        {t("comment")} <span className="text-muted">({t("commentHint")})</span>
        <textarea name="comment" rows={2} maxLength={2000} defaultValue={prev(state, "comment")} />
        <FieldError state={state} name="comment" />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton
          className="button button-primary w-full"
          name="decision"
          value="confirm"
          pendingLabel={tc("sending")}
        >
          {t("confirm")}
        </SubmitButton>
        <SubmitButton
          className="button button-outline w-full"
          name="decision"
          value="contest"
          pendingLabel={tc("sending")}
        >
          {t("contest")}
        </SubmitButton>
      </div>
      <p className="fine-print">{t("deadlinesNote")}</p>
    </form>
  );
}
