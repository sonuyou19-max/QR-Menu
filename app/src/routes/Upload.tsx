import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { fill, useI18n } from "../i18n";
import { compressImage } from "../lib/compress-image";
import { MAX_PHOTOS } from "../lib/extraction";
import type { Tables } from "../lib/database.types";
import { supabase } from "../lib/supabase";
import { useRestaurant } from "../restaurant/RestaurantProvider";
import { UploadStatusBadge } from "./UploadResult";

interface Photo {
  id: string;
  blob: Blob;
  url: string;
}

type ErrorKey =
  "tooMany" | "unsupported" | "upload" | "rateLimited" | "generic";
type Progress =
  | { step: "preparing" }
  | { step: "uploading"; n: number; total: number }
  | { step: "starting" };

/** Pick menu photos (camera or gallery), compress them, upload, and start the AI reading. */
export function Upload() {
  const { t, lang } = useI18n();
  const { restaurant } = useRestaurant();
  const navigate = useNavigate();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [earlier, setEarlier] = useState<Tables<"menu_uploads">[]>([]);

  useEffect(() => {
    void supabase
      .from("menu_uploads")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setEarlier(data ?? []));
  }, [restaurant.id]);

  // Free the preview images when leaving the page.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(
    () => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    [],
  );

  const showError = (key: ErrorKey) => {
    setError(key);
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) showError("tooMany");
    setProgress({ step: "preparing" });
    const added: Photo[] = [];
    let failed = false;
    for (const file of picked) {
      try {
        const blob = await compressImage(file);
        added.push({
          id: crypto.randomUUID(),
          blob,
          url: URL.createObjectURL(blob),
        });
      } catch {
        failed = true;
      }
    }
    setProgress(null);
    setPhotos((list) => [...list, ...added]);
    if (failed) showError("unsupported");
  };

  const remove = (id: string) =>
    setPhotos((list) => {
      const photo = list.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return list.filter((p) => p.id !== id);
    });

  const moveEarlier = (index: number) =>
    setPhotos((list) => {
      const next = [...list];
      [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
      return next;
    });

  const submit = async () => {
    setError(null);
    const uploadId = crypto.randomUUID();
    const paths = photos.map(
      (_, i) => `${restaurant.id}/${uploadId}/${i + 1}.jpg`,
    );
    for (const [i, photo] of photos.entries()) {
      setProgress({ step: "uploading", n: i + 1, total: photos.length });
      const { error: uploadError } = await supabase.storage
        .from("menu-uploads")
        .upload(paths[i]!, photo.blob, { contentType: "image/jpeg" });
      if (uploadError) {
        setProgress(null);
        return showError("upload");
      }
    }
    setProgress({ step: "starting" });
    const { error: insertError } = await supabase.from("menu_uploads").insert({
      id: uploadId,
      restaurant_id: restaurant.id,
      source_type: "photo",
      file_paths: paths,
      status: "processing",
    });
    if (insertError) {
      setProgress(null);
      return showError("upload");
    }
    const { error: invokeError } = await supabase.functions.invoke(
      "process-menu",
      { body: { uploadId, lang } },
    );
    if (invokeError) {
      const status = (invokeError as { context?: Response }).context?.status;
      setProgress(null);
      return showError(status === 429 ? "rateLimited" : "generic");
    }
    navigate(`/upload/${uploadId}`);
  };

  const busy = progress !== null;
  const progressText =
    progress?.step === "preparing"
      ? t.upload.preparing
      : progress?.step === "uploading"
        ? fill(t.upload.uploading, { n: progress.n, total: progress.total })
        : progress?.step === "starting"
          ? t.upload.starting
          : null;
  const full = photos.length >= MAX_PHOTOS;

  return (
    <div>
      <Link
        to="/"
        className="text-ink-muted inline-flex min-h-11 items-center gap-1.5 font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {restaurant.name}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
        {t.upload.title}
      </h1>
      <p className="text-ink-muted mt-2 text-lg">{t.upload.intro}</p>

      <div className="rounded-card bg-mustard-50 mt-6 p-4">
        <p className="font-semibold">{t.upload.tipsTitle}</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          {t.upload.tips.map((tip) => (
            <li key={tip}>{fill(tip, { max: MAX_PHOTOS })}</li>
          ))}
        </ul>
      </div>

      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-control bg-paprika-50 text-danger mt-6 flex gap-2 p-3 font-medium"
        >
          <TriangleAlert
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          {fill(t.upload.errors[error], { max: MAX_PHOTOS })}
        </p>
      )}

      {photos.length > 0 && (
        <>
          <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo, i) => (
              <li
                key={photo.id}
                className="rounded-card bg-surface shadow-card relative overflow-hidden"
              >
                <img
                  src={photo.url}
                  alt={fill(t.upload.photoAlt, { n: i + 1 })}
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="bg-ink/80 text-canvas absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-sm font-semibold">
                  {fill(t.upload.page, { n: i + 1 })}
                </span>
                <div className="absolute top-1 right-1 flex gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => moveEarlier(i)}
                      className="bg-surface/90 text-ink grid size-10 place-items-center rounded-full"
                      aria-label={fill(t.upload.moveEarlier, { n: i + 1 })}
                    >
                      <ArrowLeft className="size-5" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(photo.id)}
                    className="bg-surface/90 text-ink grid size-10 place-items-center rounded-full"
                    aria-label={fill(t.upload.remove, { n: i + 1 })}
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-ink-muted mt-2 text-sm">
            {fill(t.upload.count, { count: photos.length, max: MAX_PHOTOS })}
          </p>
        </>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy || full}
          onClick={() => cameraInput.current?.click()}
          className={photos.length ? "btn-secondary" : "btn-primary"}
        >
          <Camera className="size-5" aria-hidden="true" />
          {t.upload.takePhoto}
        </button>
        <button
          type="button"
          disabled={busy || full}
          onClick={() => galleryInput.current?.click()}
          className="btn-secondary"
        >
          <ImagePlus className="size-5" aria-hidden="true" />
          {photos.length ? t.upload.addMore : t.upload.choosePhotos}
        </button>
      </div>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {(photos.length > 0 || busy) && (
        <button
          type="button"
          disabled={busy || photos.length === 0}
          onClick={() => void submit()}
          className="btn-primary mt-4 w-full text-lg"
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-5" aria-hidden="true" />
          )}
          {progressText ?? t.upload.submit}
        </button>
      )}
      <p aria-live="polite" className="sr-only">
        {progressText}
      </p>

      {earlier.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{t.upload.earlier}</h2>
          <ul className="mt-3 space-y-2">
            {earlier.map((u) => (
              <li key={u.id}>
                <Link
                  to={`/upload/${u.id}`}
                  className="rounded-card bg-surface shadow-card flex min-h-14 items-center gap-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1">
                    {fill(t.upload.uploadedOn, {
                      date: new Date(u.created_at).toLocaleString(lang, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                      count: u.file_paths?.length ?? 0,
                    })}
                  </span>
                  <UploadStatusBadge upload={u} />
                  <ChevronRight
                    className="text-ink-muted size-5 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
