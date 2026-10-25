"use client";

import { useActionState, useRef, useState, startTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, X } from "lucide-react";
import { saveListingAction, uploadImageAction } from "@/modules/listings/actions";
import { idle } from "@/modules/server/action";
import { Notice } from "@/ui/Notice";
import { FieldError, FormError, invalid } from "@/ui/forms/FormMessages";

type Loc = "nb" | "en";
type ListingType = "rent_out" | "wanted" | "give_away";

export type WizardCategory = {
  id: string;
  labels: Record<Loc, string>;
  policy: "allowed" | "restricted" | "prohibited";
  safetyNotice: Record<Loc, string> | null;
  allowPaidRental: boolean;
  allowedListingTypes: string[];
};

export type WizardInitial = {
  listingId?: string;
  status?: string;
  type?: ListingType;
  categoryId?: string;
  localityId?: string;
  text: Record<string, string>;
  freeLoan: boolean;
  handoverPickup: boolean;
  handoverOwnerDelivery: boolean;
  handoverMeet: boolean;
  restrictedAck: boolean;
  images: { id: string; alt: string }[];
};

const MAX_IMAGES = 8;
const MAX_BYTES = 10 * 1024 * 1024;
const CONDITIONS = ["new", "as_new", "good", "fair", "worn", "defective"] as const;
const UNITS = ["hour", "day", "weekend", "week"] as const;

/** Which step shows which field, so a server error can open the right step. */
const FIELD_STEP: Record<string, number> = {
  type: 1,
  categoryId: 1,
  title: 2,
  description: 2,
  itemCondition: 2,
  knownDefects: 2,
  images: 2,
  accessories: 2,
  freeLoan: 3,
  price: 3,
  priceUnit: 3,
  declaredValue: 3,
  deposit: 3,
  usageRestrictions: 3,
  operatingInstructions: 3,
  wantedFrom: 3,
  wantedTo: 3,
  budget: 3,
  localityId: 4,
  areaNote: 4,
  handover: 4,
  deliveryFee: 4,
  deliveryRadiusKm: 4,
  meetingAreaNote: 4,
  restrictedAck: 5,
};

export function ListingWizard({
  locale,
  categories,
  localities,
  initial,
  initialStep,
}: {
  locale: Loc;
  categories: WizardCategory[];
  localities: { id: string; name: string }[];
  initial: WizardInitial;
  initialStep?: number;
}) {
  const t = useTranslations("wizard");
  const tl = useTranslations("listing");
  const tc = useTranslations("common");
  const [state, dispatch, pending] = useActionState(saveListingAction, idle);
  const [step, setStep] = useState(initialStep ?? (initial.type ? 2 : 1));
  const [type, setType] = useState<ListingType | undefined>(initial.type);
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? "");
  const [freeLoan, setFreeLoan] = useState(initial.freeLoan);
  const [delivery, setDelivery] = useState(initial.handoverOwnerDelivery);
  const [meet, setMeet] = useState(initial.handoverMeet);
  const [images, setImages] = useState(initial.images);
  const [preview, setPreview] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // After a failed save, open the first step with an error (adjusting state during render).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error" && state.fieldErrors) {
      const steps = Object.keys(state.fieldErrors).map((f) => FIELD_STEP[f] ?? 5);
      setStep(Math.min(...steps));
    }
  }

  const editing = Boolean(initial.listingId);
  const live = initial.status === "published" || initial.status === "paused";
  const category = categories.find((c) => c.id === categoryId);
  const forType = categories.filter((c) => !type || c.allowedListingTypes.includes(type));
  const paidAllowed = category?.allowPaidRental ?? true;
  const offer = type !== "wanted";
  const v = (name: string) => initial.text[name] ?? "";
  const titles = [t("stepType"), t("stepDetails"), t("stepPrice"), t("stepPlace"), t("stepPreview")];

  function go(next: number) {
    if (next === 5 && formRef.current) {
      const fd = new FormData(formRef.current);
      setPreview(
        Object.fromEntries([...fd.entries()].filter(([, val]) => typeof val === "string")) as Record<string, string>,
      );
    }
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(e.currentTarget, submitter);
    // Manual dispatch keeps what the user typed (a form `action` would reset the fields).
    startTransition(() => dispatch(fd));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} method="post" noValidate className="flex flex-col gap-6">
      <ol className="stepper" aria-label={t("stepOf", { step, total: 5 })}>
        {titles.map((title, i) => (
          <li key={title} aria-current={step === i + 1 ? "step" : undefined}>
            <span className="num">{i + 1}</span>
            <span className="hidden md:inline">{title}</span>
          </li>
        ))}
      </ol>
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl outline-none">
        <span className="visually-hidden">{t("stepOf", { step, total: 5 })}: </span>
        {titles[step - 1]}
      </h2>
      <FormError state={state} />

      <input type="hidden" name="locale" value={locale} />
      {initial.listingId && <input type="hidden" name="listingId" value={initial.listingId} />}
      <input type="hidden" name="step" value={step} />

      {/* Step 1: type and category */}
      <div hidden={step !== 1} className="flex flex-col gap-6">
        <fieldset className="border-0 p-0">
          <legend className="mb-3 font-bold">{t("stepType")}</legend>
          {editing && <p className="field-hint mb-3">{t("typeLocked")}</p>}
          <div className="radio-cards">
            {(
              [
                ["rent_out", t("typeRent"), t("typeRentHint")],
                ["wanted", t("typeWanted"), t("typeWantedHint")],
                ["give_away", t("typeGive"), t("typeGiveHint")],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="radio-card">
                <input
                  type="radio"
                  name="type"
                  value={value}
                  checked={type === value}
                  disabled={editing && type !== value}
                  onChange={() => {
                    setType(value);
                    if (category && !category.allowedListingTypes.includes(value)) setCategoryId("");
                  }}
                />
                <strong>{label}</strong>
                <span>{hint}</span>
              </label>
            ))}
          </div>
          <FieldError state={state} name="type" />
        </fieldset>
        <label className="field">
          {t("category")}
          <select
            name="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-invalid={invalid(state, "categoryId")}
          >
            <option value="">{t("chooseCategory")}</option>
            {forType.map((c) => (
              <option key={c.id} value={c.id}>
                {c.labels[locale]}
              </option>
            ))}
          </select>
          <FieldError state={state} name="categoryId" />
        </label>
        {category?.policy === "restricted" && (
          <Notice tone="warning">
            <p className="font-bold">{t("restrictedNotice")}</p>
            {category.safetyNotice && <p>{category.safetyNotice[locale]}</p>}
          </Notice>
        )}
        {category && !category.allowPaidRental && type === "rent_out" && <Notice>{t("freeOnlyNotice")}</Notice>}
      </div>

      {/* Step 2: details and photos */}
      <div hidden={step !== 2} className="flex flex-col gap-6">
        <label className="field">
          {t("titleLabel")}
          <span className="field-hint">{t("titleHint")}</span>
          <input name="title" maxLength={90} defaultValue={v("title")} aria-invalid={invalid(state, "title")} />
          <FieldError state={state} name="title" />
        </label>
        <label className="field">
          {t("descriptionLabel")}
          <span className="field-hint">{t("descriptionHint")}</span>
          <textarea
            name="description"
            rows={6}
            maxLength={4000}
            defaultValue={v("description")}
            aria-invalid={invalid(state, "description")}
          />
          <FieldError state={state} name="description" />
        </label>
        {offer && (
          <>
            <label className="field">
              {t("conditionLabel")}
              <select
                name="itemCondition"
                defaultValue={v("itemCondition")}
                aria-invalid={invalid(state, "itemCondition")}
              >
                <option value="">–</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {tl(`condition.${c}`)}
                  </option>
                ))}
              </select>
              <FieldError state={state} name="itemCondition" />
            </label>
            <label className="field">
              {t("knownDefectsLabel")}
              <span className="field-hint">{t("knownDefectsHint")}</span>
              <textarea
                name="knownDefects"
                rows={3}
                maxLength={1000}
                defaultValue={v("knownDefects")}
                aria-invalid={invalid(state, "knownDefects")}
              />
              <FieldError state={state} name="knownDefects" />
            </label>
          </>
        )}
        {type === "rent_out" && (
          <label className="field">
            {t("accessoriesLabel")}
            <span className="field-hint">{t("accessoriesHint")}</span>
            <textarea name="accessories" rows={3} maxLength={2000} defaultValue={v("accessories")} />
          </label>
        )}
        <ImageUploader images={images} setImages={setImages} />
        <FieldError state={state} name="images" />
      </div>

      {/* Step 3: price and practical */}
      <div hidden={step !== 3} className="flex flex-col gap-6">
        {type === "rent_out" && (
          <>
            <label className="check">
              <input
                type="checkbox"
                name="freeLoan"
                checked={freeLoan || !paidAllowed}
                disabled={!paidAllowed}
                onChange={(e) => setFreeLoan(e.target.checked)}
              />
              <span>{t("freeLoanLabel")}</span>
            </label>
            {!paidAllowed && <input type="hidden" name="freeLoan" value="on" />}
            <div className="grid gap-4 sm:grid-cols-2">
              {!(freeLoan || !paidAllowed) && (
                <label className="field">
                  {t("priceLabel")}
                  <input
                    name="price"
                    inputMode="decimal"
                    defaultValue={v("price")}
                    aria-invalid={invalid(state, "price")}
                  />
                  <FieldError state={state} name="price" />
                </label>
              )}
              <label className="field">
                {t("unitLabel")}
                <select
                  name="priceUnit"
                  defaultValue={v("priceUnit") || "day"}
                  aria-invalid={invalid(state, "priceUnit")}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {tl(`unit.${u}`)}
                    </option>
                  ))}
                </select>
                <FieldError state={state} name="priceUnit" />
              </label>
            </div>
            <label className="field">
              {t("declaredValueLabel")}
              <span className="field-hint">{t("declaredValueHint")}</span>
              <input
                name="declaredValue"
                inputMode="decimal"
                defaultValue={v("declaredValue")}
                aria-invalid={invalid(state, "declaredValue")}
              />
              <FieldError state={state} name="declaredValue" />
            </label>
            <label className="field">
              {t("depositLabel")}
              <span className="field-hint">{t("depositHint")}</span>
              <input
                name="deposit"
                inputMode="decimal"
                defaultValue={v("deposit")}
                aria-invalid={invalid(state, "deposit")}
              />
              <FieldError state={state} name="deposit" />
            </label>
            <label className="field">
              {t("usageLabel")}
              <span className="field-hint">{t("usageHint")}</span>
              <textarea name="usageRestrictions" rows={3} maxLength={1000} defaultValue={v("usageRestrictions")} />
              <FieldError state={state} name="usageRestrictions" />
            </label>
            <label className="field">
              {t("instructionsLabel")}
              <textarea
                name="operatingInstructions"
                rows={3}
                maxLength={2000}
                defaultValue={v("operatingInstructions")}
              />
              <FieldError state={state} name="operatingInstructions" />
            </label>
          </>
        )}
        {type === "wanted" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field">
                {t("wantedFromLabel")}
                <input type="date" name="wantedFrom" defaultValue={v("wantedFrom")} />
                <FieldError state={state} name="wantedFrom" />
              </label>
              <label className="field">
                {t("wantedToLabel")}
                <input
                  type="date"
                  name="wantedTo"
                  defaultValue={v("wantedTo")}
                  aria-invalid={invalid(state, "wantedTo")}
                />
                <FieldError state={state} name="wantedTo" />
              </label>
            </div>
            <label className="field">
              {t("budgetLabel")} <span className="field-hint">({tc("optional")})</span>
              <input
                name="budget"
                inputMode="decimal"
                defaultValue={v("budget")}
                aria-invalid={invalid(state, "budget")}
              />
              <FieldError state={state} name="budget" />
            </label>
          </>
        )}
        {type === "give_away" && <Notice>{t("giveFreeNote")}</Notice>}
        {!type && <Notice tone="warning">{t("stepType")}</Notice>}
      </div>

      {/* Step 4: place and handover */}
      <div hidden={step !== 4} className="flex flex-col gap-6">
        <label className="field">
          {t("localityLabel")}
          <select name="localityId" defaultValue={initial.localityId ?? ""} aria-invalid={invalid(state, "localityId")}>
            <option value="">–</option>
            {localities.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <FieldError state={state} name="localityId" />
        </label>
        <label className="field">
          {t("areaNoteLabel")} <span className="field-hint">({tc("optional")})</span>
          <span className="field-hint">{t("areaNoteHint")}</span>
          <input name="areaNote" maxLength={80} defaultValue={v("areaNote")} />
          <FieldError state={state} name="areaNote" />
        </label>
        <fieldset className="flex flex-col gap-3 border-0 p-0">
          <legend className="mb-2 font-bold">
            {type === "wanted" ? t("handoverWantedLabel") : t("handoverLabel")}
          </legend>
          <label className="check">
            <input type="checkbox" name="handoverPickup" defaultChecked={initial.handoverPickup} />
            <span>{t("pickupOption")}</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="handoverOwnerDelivery"
              checked={delivery}
              onChange={(e) => setDelivery(e.target.checked)}
            />
            <span>{t("deliveryOption")}</span>
          </label>
          {delivery && (
            <div className="grid gap-4 pl-8 sm:grid-cols-2">
              <label className="field">
                {t("deliveryFeeLabel")}
                <input
                  name="deliveryFee"
                  inputMode="decimal"
                  defaultValue={v("deliveryFee")}
                  aria-invalid={invalid(state, "deliveryFee")}
                />
                <FieldError state={state} name="deliveryFee" />
              </label>
              <label className="field">
                {t("deliveryRadiusLabel")}
                <input
                  name="deliveryRadiusKm"
                  inputMode="numeric"
                  defaultValue={v("deliveryRadiusKm")}
                  aria-invalid={invalid(state, "deliveryRadiusKm")}
                />
                <FieldError state={state} name="deliveryRadiusKm" />
              </label>
            </div>
          )}
          <label className="check">
            <input type="checkbox" name="handoverMeet" checked={meet} onChange={(e) => setMeet(e.target.checked)} />
            <span>{t("meetOption")}</span>
          </label>
          {meet && (
            <label className="field pl-8">
              {t("meetingAreaLabel")}
              <input name="meetingAreaNote" maxLength={80} defaultValue={v("meetingAreaNote")} />
            </label>
          )}
          <FieldError state={state} name="handover" />
        </fieldset>
      </div>

      {/* Step 5: preview */}
      <div hidden={step !== 5} className="flex flex-col gap-5">
        <Notice tone="warning">{t("previewNoAddress")}</Notice>
        {category?.policy === "restricted" && (
          <div className="flex flex-col gap-2">
            {category.safetyNotice && <Notice tone="warning">{category.safetyNotice[locale]}</Notice>}
            <label className="check">
              <input
                type="checkbox"
                name="restrictedAck"
                defaultChecked={initial.restrictedAck}
                aria-invalid={invalid(state, "restrictedAck")}
              />
              <span>{t("restrictedAckLabel")}</span>
            </label>
            <FieldError state={state} name="restrictedAck" />
          </div>
        )}
        <div className="card p-5">
          <p className="category-label">
            {type ? tl(`type.${type}`) : "–"} · {category?.labels[locale] ?? "–"}
          </p>
          <h3 className="mt-1 text-xl">{preview.title || "–"}</h3>
          <p className="mt-1 text-sm text-muted">
            {localities.find((l) => l.id === preview.localityId)?.name ?? "–"}, Steigen
          </p>
          {preview.description && <p className="mt-3 line-clamp-5 whitespace-pre-line">{preview.description}</p>}
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {type === "rent_out" && (
              <>
                <dt className="font-bold">{t("priceLabel")}</dt>
                <dd>
                  {preview.freeLoan === "on" || !paidAllowed
                    ? tl("freeLoan")
                    : `${preview.price || "–"} kr / ${tl(`unit.${(preview.priceUnit as (typeof UNITS)[number]) || "day"}`)}`}
                </dd>
                <dt className="font-bold">{t("depositLabel")}</dt>
                <dd>{preview.deposit ? `${preview.deposit} kr` : "–"}</dd>
              </>
            )}
            {offer && preview.itemCondition && (
              <>
                <dt className="font-bold">{t("conditionLabel")}</dt>
                <dd>{tl(`condition.${preview.itemCondition as (typeof CONDITIONS)[number]}`)}</dd>
              </>
            )}
            <dt className="font-bold">{t("photos")}</dt>
            <dd>{images.length}</dd>
          </dl>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        {step > 1 && (
          <button type="button" className="button button-subtle" onClick={() => go(step - 1)}>
            {tc("back")}
          </button>
        )}
        {step < 5 && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => go(step + 1)}
            disabled={step === 1 && !type}
          >
            {tc("next")}
          </button>
        )}
        {live ? (
          <button type="submit" name="intent" value="draft" className="button button-primary" disabled={pending}>
            {pending ? tc("saving") : tc("save")}
          </button>
        ) : (
          <>
            <button
              type="submit"
              name="intent"
              value="draft"
              className="button button-outline"
              disabled={pending || !type}
            >
              {pending ? tc("saving") : tc("saveDraft")}
            </button>
            {step === 5 && (
              <button type="submit" name="intent" value="publish" className="button button-primary" disabled={pending}>
                {tc("publish")}
              </button>
            )}
          </>
        )}
      </div>
    </form>
  );
}

function ImageUploader({
  images,
  setImages,
}: {
  images: { id: string; alt: string }[];
  setImages: (fn: (prev: { id: string; alt: string }[]) => { id: string; alt: string }[]) => void;
}) {
  const t = useTranslations("wizard");
  const tv = useTranslations("validation");
  const te = useTranslations("errors");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const problems: string[] = [];
    let room = MAX_IMAGES - images.length;
    for (const file of Array.from(files)) {
      if (room <= 0) {
        problems.push(tv("too_many_images"));
        break;
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name}: ${tv("image_too_large")}`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadImageAction(fd);
      if (res.status === "ok" && res.data) {
        const id = res.data.id;
        setImages((prev) => [...prev, { id, alt: "" }]);
        room -= 1;
      } else if (res.status === "error") {
        const key = res.detail ?? res.fieldErrors?.file;
        problems.push(
          `${file.name}: ${key && tv.has(key) ? tv(key) : te.has(res.code) ? te(res.code) : te("unexpected")}`,
        );
      }
    }
    setErrors(problems);
    setBusy(false);
  }

  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 font-bold">{t("photos")}</legend>
      <p className="field-hint">{t("photosHint")}</p>
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="card flex flex-col gap-2 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- own upload via the authorised media route */}
              <img
                src={`/media/${img.id}/thumb`}
                alt=""
                className="aspect-[4/3] w-full rounded object-cover"
                width={480}
                height={360}
              />
              <input type="hidden" name="imageId" value={img.id} />
              <label className="field text-xs">
                {t("altLabel")}
                <input
                  name="imageAlt"
                  maxLength={150}
                  value={img.alt}
                  onChange={(e) =>
                    setImages((prev) => prev.map((p) => (p.id === img.id ? { ...p, alt: e.target.value } : p)))
                  }
                />
              </label>
              <button
                type="button"
                className="button button-ghost button-sm"
                onClick={() => setImages((prev) => prev.filter((p) => p.id !== img.id))}
              >
                <X size={16} aria-hidden="true" />
                {t("removePhoto")} {i + 1}
              </button>
            </li>
          ))}
        </ul>
      )}
      {images.length < MAX_IMAGES && (
        <label className="button button-outline w-fit cursor-pointer">
          <ImagePlus size={18} aria-hidden="true" />
          {busy ? t("uploading") : t("addPhoto")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="visually-hidden"
            disabled={busy}
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      )}
      <div aria-live="polite">
        {busy && <span className="visually-hidden">{t("uploading")}</span>}
        {errors.length > 0 && (
          <Notice tone="danger">
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Notice>
        )}
      </div>
    </fieldset>
  );
}
