"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Photo } from "@/lib/types";

export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: Photo[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const photo = photos[index];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onClose, onIndex, photos.length]);

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Photo">
      <button type="button" className="absolute right-4 top-4 rounded-md bg-panel p-2 text-foreground" onClick={onClose} aria-label="Close photo">
        <X className="h-5 w-5" />
      </button>
      {photos.length > 1 ? (
        <button
          type="button"
          className="absolute left-3 rounded-md bg-panel p-2"
          aria-label="Previous photo"
          onClick={() => onIndex((index - 1 + photos.length) % photos.length)}
        >
          <ChevronLeft />
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/photos/${photo.id}`} alt={photo.originalName} className="max-h-[86vh] max-w-[92vw] rounded object-contain" />
      {photos.length > 1 ? (
        <button
          type="button"
          className="absolute right-3 rounded-md bg-panel p-2"
          aria-label="Next photo"
          onClick={() => onIndex((index + 1) % photos.length)}
        >
          <ChevronRight />
        </button>
      ) : null}
      <div className="absolute bottom-4 font-mono text-xs text-fog">
        {photo.originalName} · {index + 1} / {photos.length}
      </div>
    </div>
  );
}
