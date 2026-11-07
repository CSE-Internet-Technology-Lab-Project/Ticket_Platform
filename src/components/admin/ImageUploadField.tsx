"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { AlertCircle, Link as LinkIcon, LoaderCircle, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ImageUploadFieldProps {
  label: string;
  name: string;
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
}

async function compressImage(file: File, maxDim = 1200, quality = 0.84): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not parse image. Please choose a valid PNG, JPG, or WebP file."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function isWebpageLink(url: string): boolean {
  if (!url) return false;
  return /imdb\.com\/(title|mediaviewer)|wikipedia\.org\/wiki\/|rottentomatoes\.com\/m\//i.test(url);
}

export function ImageUploadField({ label, name, value, onChange, placeholder, className = "" }: ImageUploadFieldProps) {
  const isControlled = value !== undefined;
  const [internalVal, setInternalVal] = useState("");
  const val = isControlled ? value : internalVal;

  const [mode, setMode] = useState<"file" | "url">("file");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = (newVal: string) => {
    if (!isControlled) {
      setInternalVal(newVal);
    }
    setError("");
    setImageError(false);
    onChange?.(newVal);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WebP).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const dataUrl = await compressImage(file);
      update(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load image.");
    } finally {
      setLoading(false);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => {
    setDragging(false);
  };

  const isDataUrl = val.startsWith("data:image/");
  const isWebpage = isWebpageLink(val);

  return (
    <div className={`space-y-1.5 ${className}`}>
      <input type="hidden" name={name} value={val} />
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "file" ? "url" : "file");
            setError("");
          }}
          className="text-violet-600 hover:underline"
        >
          {mode === "file" ? "Or enter URL" : "Or upload from device"}
        </button>
      </div>

      {val ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={val}
              alt="Preview"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold text-slate-800">
              {isDataUrl ? "Uploaded image (ready)" : "Image link"}
            </p>
            <p className="truncate text-slate-500">
              {isDataUrl ? "Optimized and stored in database" : val}
            </p>
            {imageError && (
              <p className="flex items-center gap-1 font-medium text-rose-600">
                <AlertCircle className="size-3" /> Image cannot be displayed.
              </p>
            )}
            {isWebpage && (
              <p className="flex items-center gap-1 font-medium text-amber-600">
                <AlertCircle className="size-3" /> This is a webpage URL, not an image file.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-2 text-xs"
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => update("")}
              className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : mode === "file" ? (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition ${
            dragging ? "border-violet-600 bg-violet-50/50" : "border-slate-200 bg-slate-50 hover:bg-slate-100/70"
          }`}
        >
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-violet-600">
              <LoaderCircle className="size-4 animate-spin" /> Compressing image...
            </div>
          ) : (
            <>
              <div className="rounded-full bg-violet-100 p-2 text-violet-600">
                <Upload className="size-4" />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-slate-700">
                Click to upload image <span className="font-normal text-slate-500">or drag and drop</span>
              </p>
              <p className="text-[11px] text-slate-400">PNG, JPG, WebP up to 10MB</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="url"
              value={val}
              onChange={(e) => update(e.target.value)}
              placeholder={placeholder ?? "https://.../poster.jpg"}
              className="pl-9 text-xs"
            />
          </div>
          {isWebpage && (
            <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-700">
              Notice: This is an IMDb or wiki webpage link, not a direct image. Right-click the image on that site and choose <b>Copy image address</b>, or click <b>Or upload from device</b> above.
            </p>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        onChange={onFileInputChange}
        className="hidden"
      />

      {error && (
        <p className="flex items-center gap-1 text-xs text-rose-600">
          <AlertCircle className="size-3" /> {error}
        </p>
      )}
    </div>
  );
}
