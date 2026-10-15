import { useEffect, useRef, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";
import { IMAGE_ACCEPT, checkImageFiles } from "@/lib/uploads";

// A picked file plus a preview URL. `originFileObj` is the File to upload.
export interface UploadItem {
  uid: string;
  name: string;
  originFileObj: File;
  url: string;
}

let uidCounter = 0;

export function toUploadItem(file: File): UploadItem {
  return {
    uid: `upload-${Date.now()}-${++uidCounter}`,
    name: file.name,
    originFileObj: file,
    url: URL.createObjectURL(file),
  };
}

interface FilePickerProps {
  // Receives the picked files (one unless `multiple`).
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

// Makes `children` open the file chooser when clicked or activated by keyboard.
export function FilePicker({ onFiles, accept, multiple, disabled, className, children }: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const open = () => !disabled && input.current?.click();

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={cn("cursor-pointer", disabled && "pointer-events-none opacity-60", className)}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      {children}
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Reset so picking the same file again still fires a change.
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}

interface ImageUploadGridProps {
  fileList: UploadItem[];
  onChange: (fileList: UploadItem[]) => void;
  multiple?: boolean;
  // Hides the add tile once this many images are picked.
  maxCount?: number;
  accept?: string;
  addLabel?: ReactNode;
  className?: string;
}

// Square thumbnails of picked images with remove buttons, plus an "Upload" tile.
export function ImageUploadGrid({
  fileList,
  onChange,
  multiple,
  maxCount,
  accept = IMAGE_ACCEPT,
  addLabel = "Upload",
  className,
}: ImageUploadGridProps) {
  // Free preview URLs of items that are no longer in the list.
  const previous = useRef<UploadItem[]>(fileList);
  useEffect(() => {
    const kept = new Set(fileList.map((f) => f.url));
    previous.current.forEach((f) => !kept.has(f.url) && URL.revokeObjectURL(f.url));
    previous.current = fileList;
  }, [fileList]);

  const canAdd = maxCount === undefined || fileList.length < maxCount;

  // Only files the backend accepts (see lib/uploads.ts).
  const add = (picked: File[]) => {
    const { accepted: files, error } = checkImageFiles(picked);
    if (error) toast.error(error);
    if (!files.length) return;
    const items = files.map(toUploadItem);
    const next = maxCount === 1 ? items.slice(0, 1) : [...fileList, ...items];
    onChange(maxCount ? next.slice(0, maxCount) : next);
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {fileList.map((item) => (
        <div key={item.uid} className="group relative size-24 overflow-hidden rounded-lg border bg-muted/30">
          <img src={item.url} alt={item.name} className="size-full object-cover" />
          <button
            type="button"
            aria-label={`Remove ${item.name}`}
            onClick={() => onChange(fileList.filter((f) => f.uid !== item.uid))}
            className="absolute top-1 right-1 flex rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      {canAdd && (
        <FilePicker onFiles={add} accept={accept} multiple={multiple && maxCount !== 1}>
          <div className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <Plus className="size-4" />
            {addLabel}
          </div>
        </FilePicker>
      )}
    </div>
  );
}
