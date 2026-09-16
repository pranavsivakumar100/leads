import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import type { CoachModelOption } from "@/lib/api/settings";

type ModelGroup = [string, CoachModelOption[]];

export function ModelSelect({
  id,
  value,
  groups,
  disabled = false,
  onChange,
}: {
  id: string;
  value: string;
  groups: ModelGroup[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const flat = useMemo(() => groups.flatMap(([, models]) => models), [groups]);

  const placeMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const maxH = 280;
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const height = Math.max(120, Math.min(maxH, openUp ? spaceAbove - gap : spaceBelow - gap));
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      maxHeight: height,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  };

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const selected = flat.findIndex((m) => m.id === value);
    setActiveIndex(selected >= 0 ? selected : 0);
  }, [open, flat, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onReposition = (e: Event) => {
      if (e.type === "scroll" && menuRef.current?.contains(e.target as Node)) return;
      if (e.type === "scroll") {
        setOpen(false);
        return;
      }
      placeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = menuRef.current?.querySelector<HTMLElement>(
      `[data-model-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const pick = (modelId: string) => {
    onChange(modelId);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(flat.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(flat.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const next = flat[activeIndex];
      if (next) pick(next.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  let optionIndex = -1;

  return (
    <div className="model-select" ref={wrapRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="text-input model-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className={value ? undefined : "model-select__placeholder"}>
          {value || (disabled ? "Loading models…" : "Select a model")}
        </span>
        <ChevronDownIcon aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={listId}
          className="model-select__menu"
          style={menuStyle}
          role="listbox"
          aria-labelledby={id}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
          }
        >
          {flat.length === 0 ? (
            <div className="model-select__empty">No models available.</div>
          ) : (
            groups.map(([provider, models]) => (
              <div key={provider} className="model-select__group" role="group" aria-label={provider}>
                <div className="model-select__group-label">{provider}</div>
                {models.map((model) => {
                  optionIndex += 1;
                  const index = optionIndex;
                  const selected = model.id === value;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      id={`${listId}-opt-${index}`}
                      data-model-index={index}
                      role="option"
                      aria-selected={selected}
                      className={`model-select__option${selected ? " model-select__option--selected" : ""}${active ? " model-select__option--active" : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => pick(model.id)}
                    >
                      <span>{model.id}</span>
                      {selected && <CheckIcon aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
