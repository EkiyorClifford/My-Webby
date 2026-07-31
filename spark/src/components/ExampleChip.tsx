"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ExampleIdea = {
  label: string;
  idea: string;
  preview: string;
};

type ExampleChipProps = {
  example: ExampleIdea;
  disabled?: boolean;
  onSelect: (idea: string) => void;
};

/** Plain text example picker: not a tinted pill chip. */
export default function ExampleChip({
  example,
  disabled,
  onSelect,
}: ExampleChipProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(example.idea)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onTouchStart={() => {
          clearHold();
          holdTimer.current = setTimeout(() => setOpen(true), 420);
        }}
        onTouchEnd={clearHold}
        onTouchCancel={clearHold}
        aria-describedby={open ? tipId : undefined}
        className="text-sm text-[var(--quiet)] transition-colors hover:text-[var(--accent-soft)] disabled:opacity-40"
      >
        {example.label}
      </button>
      {open ? (
        <div
          id={tipId}
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-2 w-56 bg-[var(--surface-raised)] p-3 text-left text-[11px] leading-relaxed text-[var(--muted)]"
          style={{
            boxShadow: "inset 0 1px 0 rgba(242,235,224,0.06)",
            outline: "1px solid rgba(242,235,224,0.1)",
          }}
        >
          {example.preview}
        </div>
      ) : null}
    </div>
  );
}
