"use client";

/**
 * PhotoCapture — lets the user build a set of recipe photos (up to MAX_PHOTOS)
 * either by taking them with their device camera or uploading from their library.
 *
 * All images are resized client-side (canvas, max 1920 px on the longest edge,
 * JPEG quality PHOTO_JPEG_QUALITY) before being stored, keeping the base64 payload that gets
 * sent to the API lean.
 *
 * NOTE: EXIF orientation (mobile cameras embed a rotation tag that browsers
 * don't always honour when drawing to canvas) is not corrected here.
 * If rotated thumbnails appear, add exifr-based pre-rotation in processFile().
 */

import { useState, useRef, useEffect } from "react";
import { PHOTO_MAX_COUNT, PHOTO_MAX_DIMENSION_PX, PHOTO_JPEG_QUALITY, PHOTO_MAX_FILE_SIZE_BYTES } from "@/lib/constants";

export interface CapturedPhoto {
  /** Raw base64 string (no data-URI prefix) — sent to the API. */
  base64: string;
  /** Full data-URI (data:image/jpeg;base64,...) — used as <img> src. */
  preview: string;
  mediaType: "image/jpeg";
}

interface PhotoCaptureProps {
  photos: CapturedPhoto[];
  onPhotosChange: (photos: CapturedPhoto[]) => void;
  maxPhotos?: number;
}

type CameraState = "idle" | "requesting" | "active" | "error";

// ─── Image helpers ────────────────────────────────────────────────────────────

function drawResized(source: HTMLImageElement | HTMLVideoElement, naturalW: number, naturalH: number): HTMLCanvasElement {
  const scale = Math.min(1, PHOTO_MAX_DIMENSION_PX / Math.max(naturalW, naturalH));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(naturalW * scale);
  canvas.height = Math.round(naturalH * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire canvas 2D context");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function dataUrlToPhoto(dataUrl: string): CapturedPhoto {
  return {
    preview: dataUrl,
    base64: dataUrl.replace(/^data:image\/jpeg;base64,/, ""),
    mediaType: "image/jpeg",
  };
}

async function processFile(file: File): Promise<CapturedPhoto> {
  const maxMB = Math.round(PHOTO_MAX_FILE_SIZE_BYTES / (1024 * 1024));
  if (file.size > PHOTO_MAX_FILE_SIZE_BYTES) {
    throw new Error(`"${file.name}" is too large — photos must be under ${maxMB} MB`);
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = drawResized(img, img.naturalWidth, img.naturalHeight);
      resolve(dataUrlToPhoto(canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY)));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not load ${file.name}`));
    };
    img.src = objectUrl;
  });
}

function captureVideoFrame(video: HTMLVideoElement): CapturedPhoto {
  const canvas = drawResized(video, video.videoWidth, video.videoHeight);
  return dataUrlToPhoto(canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhotoCapture({ photos, onPhotosChange, maxPhotos = PHOTO_MAX_COUNT }: PhotoCaptureProps) {
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop stream on unmount
  useEffect(() => () => stopStream(), []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setCameraError(null);
    setUploadError(null);
    setVideoReady(false);
    setCameraState("requesting");

    const tryGetMedia = async (constraints: MediaStreamConstraints) =>
      navigator.mediaDevices.getUserMedia(constraints);

    try {
      // Prefer rear camera; fall back to any video if over-constrained
      let stream: MediaStream;
      try {
        stream = await tryGetMedia({
          video: { facingMode: "environment", width: { ideal: PHOTO_MAX_DIMENSION_PX } },
          audio: false,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "OverconstrainedError") {
          stream = await tryGetMedia({ video: true, audio: false });
        } else {
          throw err;
        }
      }

      streamRef.current = stream;
      setCameraState("active");
      // videoRef may not exist until the state update re-renders the video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 0);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Allow access in your browser settings, or upload a photo instead.");
      } else if (name === "NotFoundError") {
        setCameraError("No camera found on this device. Use 'Upload from device' instead.");
      } else {
        setCameraError("Could not start the camera. Try uploading a photo instead.");
      }
      setCameraState("error");
    }
  }

  function closeCamera() {
    stopStream();
    setCameraState("idle");
    setCameraError(null);
    setVideoReady(false);
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !streamRef.current || !videoReady) return;

    try {
      const photo = captureVideoFrame(video);
      const next = [...photos, photo];
      onPhotosChange(next);
      // Auto-close when we hit the max
      if (next.length >= maxPhotos) closeCamera();
    } catch {
      setCameraError("Could not capture the photo. Please try again.");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting same file
    if (!files.length) return;

    setUploadError(null);

    const slots = maxPhotos - photos.length;
    const toProcess = files.slice(0, slots);

    // Process sequentially to avoid saturating memory with large canvases
    const newPhotos: CapturedPhoto[] = [];
    const errors: string[] = [];
    for (const file of toProcess) {
      try {
        newPhotos.push(await processFile(file));
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Could not load "${file.name}"`);
      }
    }

    if (newPhotos.length > 0) onPhotosChange([...photos, ...newPhotos]);

    if (errors.length === 1) {
      setUploadError(errors[0]);
    } else if (errors.length > 1) {
      setUploadError(`${errors.length} photos could not be loaded and were skipped.`);
    }
  }

  function removePhoto(index: number) {
    onPhotosChange(photos.filter((_, i) => i !== index));
  }

  const canAddMore = photos.length < maxPhotos;
  const cameraVisible = cameraState === "active" || cameraState === "requesting";

  return (
    <div className="space-y-4">

      {/* ── Camera view ──────────────────────────────────────────────────── */}
      {cameraVisible && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={() => setVideoReady(true)}
            className="w-full max-h-64 object-cover"
          />

          {/* Waiting overlay */}
          {!videoReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <p className="text-white/70 text-sm animate-pulse">Starting camera…</p>
            </div>
          )}

          {/* Controls bar */}
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
            <button
              type="button"
              onClick={closeCamera}
              className="text-white/80 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>

            {/* Shutter button */}
            <button
              type="button"
              onClick={handleCapture}
              disabled={!videoReady}
              aria-label="Take photo"
              className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-amber-700" />
            </button>

            <span className="text-white/60 text-xs tabular-nums">
              {photos.length + 1} / {maxPhotos}
            </span>
          </div>
        </div>
      )}

      {/* Camera error (shown below closed camera) */}
      {cameraState === "error" && cameraError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {cameraError}
        </p>
      )}

      {/* Upload error (shown after a failed file import) */}
      {uploadError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span className="flex-1">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="shrink-0 text-amber-500 hover:text-amber-700 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Photo thumbnails ─────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {photos.map((photo, i) => (
            <div key={i} className="relative group shrink-0">
              {/* Page number badge */}
              <span className="absolute -top-1.5 -left-1.5 z-10 w-5 h-5 bg-amber-700 text-white rounded-full text-xs flex items-center justify-center font-bold select-none">
                {i + 1}
              </span>

              <img
                src={photo.preview}
                alt={`Recipe photo ${i + 1}`}
                className="w-24 h-24 rounded-xl object-cover border-2 border-amber-200"
              />

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removePhoto(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Add-photo buttons ────────────────────────────────────────────── */}
      {!cameraVisible && canAddMore && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-amber-300 hover:border-amber-400 hover:bg-amber-50 rounded-xl text-amber-700 text-sm font-medium transition-colors"
          >
            <span>📷</span>
            <span>{photos.length === 0 ? "Take a photo" : "Take another"}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-stone-300 hover:border-stone-400 hover:bg-stone-50 rounded-xl text-stone-600 text-sm font-medium transition-colors"
          >
            <span>🖼️</span>
            <span>{photos.length === 0 ? "Upload from device" : "Upload more"}</span>
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Status hint ──────────────────────────────────────────────────── */}
      <p className="text-xs text-stone-400">
        {photos.length === 0
          ? `Recipes spanning multiple pages? Add up to ${maxPhotos} photos and I will read across them all.`
          : photos.length >= maxPhotos
          ? `${maxPhotos} photos added — ready to extract the recipe.`
          : `${photos.length} photo${photos.length !== 1 ? "s" : ""} added · up to ${maxPhotos - photos.length} more allowed`}
      </p>
    </div>
  );
}
