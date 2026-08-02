'use client';

import { FileIcon, UploadCloud, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/**
 * File uploader — presentational layer.
 *
 * KNOWN LIMITATION (MILESTONE_03_PLAN.md): this validates type and size in the
 * browser, which is a **usability** feature, not a security control. A client can
 * bypass it trivially. The server must re-validate type, size, and content when the
 * storage adapter lands — see SECURITY_RULES.md → Input Handling.
 *
 * Upload itself goes through an injected `onUpload`, so the real storage backend
 * (Milestone 24) plugs in without touching this component.
 */

export type UploaderFile = {
  id: string;
  name: string;
  size: number;
  progress: number;
  error?: string;
};

type UploaderProps = {
  accept?: string;
  maxSizeBytes?: number;
  maxFiles?: number;
  onUpload?: (file: File) => Promise<void>;
  className?: string;
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);

  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function Uploader({
  accept,
  maxSizeBytes = 10 * 1024 * 1024,
  maxFiles = 5,
  onUpload,
  className,
}: UploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploaderFile[]>([]);

  function validate(file: File): string | undefined {
    if (file.size > maxSizeBytes) {
      return `Too large. Maximum ${formatBytes(maxSizeBytes)}.`;
    }

    if (accept) {
      const patterns = accept.split(',').map((value) => value.trim());
      const matches = patterns.some((pattern) =>
        pattern.endsWith('/*')
          ? file.type.startsWith(pattern.slice(0, -1))
          : file.type === pattern || file.name.toLowerCase().endsWith(pattern),
      );

      if (!matches) return 'That file type is not accepted.';
    }

    return undefined;
  }

  async function addFiles(incoming: FileList | null) {
    if (!incoming) return;

    const room = maxFiles - files.length;
    const selected = Array.from(incoming).slice(0, Math.max(room, 0));

    for (const file of selected) {
      const id = `${file.name}-${file.size}-${files.length}`;
      const error = validate(file);

      setFiles((current) => [
        ...current,
        { id, name: file.name, size: file.size, progress: error ? 0 : 5, error },
      ]);

      if (error || !onUpload) continue;

      try {
        await onUpload(file);
        setFiles((current) =>
          current.map((entry) => (entry.id === id ? { ...entry, progress: 100 } : entry)),
        );
      } catch {
        setFiles((current) =>
          current.map((entry) =>
            entry.id === id ? { ...entry, error: 'Upload failed.', progress: 0 } : entry,
          ),
        );
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/*
        Drag-and-drop is an enhancement, never the only route: the label and hidden
        input mean the control is fully keyboard operable, and 2.5.7 requires a
        single-pointer alternative to dragging (ACCESSIBILITY_RULES.md).
      */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-2xl border border-dashed transition-colors',
          isDragging ? 'border-primary bg-accent' : 'border-border',
        )}
      >
        <label
          htmlFor={inputId}
          className="focus-within:ring-ring flex cursor-pointer flex-col items-center gap-3 px-6 py-10 text-center focus-within:ring-2 focus-within:ring-offset-2"
        >
          <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-2xl">
            <UploadCloud aria-hidden="true" className="size-5" />
          </span>

          <span className="space-y-1">
            <span className="block text-sm font-medium">Drop files here, or browse</span>
            <span className="text-muted-foreground block text-xs">
              Up to {maxFiles} files, {formatBytes(maxSizeBytes)} each
            </span>
          </span>

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            multiple={maxFiles > 1}
            accept={accept}
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.target.files);
              // Reset so selecting the same file twice still fires a change event.
              event.target.value = '';
            }}
          />
        </label>
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 rounded-lg border p-3">
              <FileIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
              />

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                    {formatBytes(file.size)}
                  </span>
                </div>

                {file.error ? (
                  <p role="alert" className="text-destructive text-xs">
                    {file.error}
                  </p>
                ) : (
                  <Progress
                    value={file.progress}
                    aria-label={`Uploading ${file.name}`}
                    className="h-1"
                  />
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setFiles((current) => current.filter((entry) => entry.id !== file.id))
                }
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
