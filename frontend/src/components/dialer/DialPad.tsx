import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { DialCoach } from "@/components/dialer/DialCoach";
import {
  BackspaceIcon,
  CloseIcon,
  MicIcon,
  MicOffIcon,
  PhoneIcon,
} from "@/components/icons";
import { useDialer, type CallDisposition } from "@/hooks/useDialer";
import { formatDuration, formatPadDisplay } from "@/lib/phone";

const PAD_MARGIN = 8;
const MIN_PAD_W = 280;
const MIN_PAD_H = 300;

type PadCorner = "nw" | "ne" | "sw" | "se";

function clampPadPos(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const maxX = window.innerWidth - width - PAD_MARGIN;
  const maxY = window.innerHeight - height - PAD_MARGIN;
  return {
    x: Math.min(Math.max(PAD_MARGIN, x), Math.max(PAD_MARGIN, maxX)),
    y: Math.min(Math.max(PAD_MARGIN, y), Math.max(PAD_MARGIN, maxY)),
  };
}

function applyCornerResize(
  corner: PadCorner,
  orig: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
): { pos: { x: number; y: number }; size: { w: number; h: number } } {
  let w = orig.w;
  let h = orig.h;
  if (corner === "se" || corner === "ne") w = orig.w + dx;
  if (corner === "sw" || corner === "nw") w = orig.w - dx;
  if (corner === "se" || corner === "sw") h = orig.h + dy;
  if (corner === "ne" || corner === "nw") h = orig.h - dy;

  const maxW = window.innerWidth - PAD_MARGIN * 2;
  const maxH = window.innerHeight - PAD_MARGIN * 2;
  w = Math.min(Math.max(MIN_PAD_W, w), maxW);
  h = Math.min(Math.max(MIN_PAD_H, h), maxH);

  let x = orig.x;
  let y = orig.y;
  if (corner === "sw" || corner === "nw") x = orig.x + orig.w - w;
  if (corner === "ne" || corner === "nw") y = orig.y + orig.h - h;

  return { pos: clampPadPos(x, y, w, h), size: { w, h } };
}

const DISPOSITIONS: { id: CallDisposition; label: string; kind: "muted" | "default" | "primary" }[] = [
  { id: "not_interested", label: "Not interested", kind: "muted" },
  { id: "follow_up", label: "Follow up", kind: "default" },
  { id: "meeting_booked", label: "Meeting booked", kind: "primary" },
];

const KEYS: { digit: string; letters?: string }[] = [
  { digit: "1" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*" },
  { digit: "0", letters: "+" },
  { digit: "#" },
];

function statusLabel(
  status: ReturnType<typeof useDialer>["status"],
  durationSec: number,
  error: string | null,
): string {
  switch (status) {
    case "connecting":
      return "Calling…";
    case "ringing":
      return "Ringing…";
    case "open":
      return formatDuration(durationSec);
    case "error":
      return error || "Couldn’t connect";
    default:
      return "Ready";
  }
}

export function DialPad() {
  const {
    open,
    number,
    displayName,
    callerId,
    status,
    error,
    muted,
    durationSec,
    inCall,
    sessionId,
    needsDisposition,
    openDialer,
    closeDialer,
    setNumber,
    pressDigit,
    backspace,
    placeCall,
    hangup,
    toggleMute,
    resolveDisposition,
    skipDisposition,
    savingDisposition,
  } = useDialer();

  const inputRef = useRef<HTMLInputElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    corner: PadCorner;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (needsDisposition) {
          skipDisposition();
          return;
        }
        closeDialer();
        return;
      }
      if (needsDisposition || inCall) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (e.key === "Enter") {
          e.preventDefault();
          void placeCall();
        }
        return;
      }
      if (/^[0-9*#]$/.test(e.key)) {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void placeCall();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, inCall, needsDisposition, closeDialer, skipDisposition, pressDigit, backspace, placeCall]);

  useEffect(() => {
    if (open && status === "idle" && !needsDisposition) inputRef.current?.focus();
  }, [open, status, needsDisposition]);

  const clampToPad = useCallback((x: number, y: number) => {
    const el = padRef.current;
    if (!el) return { x, y };
    const w = size?.w ?? el.offsetWidth;
    const h = size?.h ?? el.offsetHeight;
    return clampPadPos(x, y, w, h);
  }, [size]);

  useEffect(() => {
    if (!pos && !size) return;
    const onResize = () => {
      const el = padRef.current;
      if (!el) return;
      const w = size?.w ?? el.offsetWidth;
      const h = size?.h ?? el.offsetHeight;
      const maxW = window.innerWidth - PAD_MARGIN * 2;
      const maxH = window.innerHeight - PAD_MARGIN * 2;
      if (size) {
        setSize({
          w: Math.min(Math.max(MIN_PAD_W, w), maxW),
          h: Math.min(Math.max(MIN_PAD_H, h), maxH),
        });
      }
      if (pos) setPos(clampToPad(pos.x, pos.y));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, size, clampToPad]);

  const onDragStart = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };
    setPos({ x: rect.left, y: rect.top });
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onDragMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setPos(
      clampToPad(
        drag.origX + (e.clientX - drag.startX),
        drag.origY + (e.clientY - drag.startY),
      ),
    );
  };

  const onDragEnd = (e: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const onResizeStart = (e: ReactPointerEvent<HTMLElement>, corner: PadCorner) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    resizeRef.current = {
      pointerId: e.pointerId,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      origW: rect.width,
      origH: rect.height,
    };
    setPos({ x: rect.left, y: rect.top });
    setSize({ w: rect.width, h: rect.height });
    setResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const onResizeMove = (e: ReactPointerEvent<HTMLElement>) => {
    const liveResize = resizeRef.current;
    if (!liveResize || liveResize.pointerId !== e.pointerId) return;
    const next = applyCornerResize(
      liveResize.corner,
      {
        x: liveResize.origX,
        y: liveResize.origY,
        w: liveResize.origW,
        h: liveResize.origH,
      },
      e.clientX - liveResize.startX,
      e.clientY - liveResize.startY,
    );
    setPos(next.pos);
    setSize(next.size);
  };

  const onResizeEnd = (e: ReactPointerEvent<HTMLElement>) => {
    if (resizeRef.current?.pointerId !== e.pointerId) return;
    resizeRef.current = null;
    setResizing(false);
  };

  const live = status === "open" || status === "ringing" || status === "connecting";
  const showKeypad = !inCall && !needsDisposition;

  return (
    <>
      <button
        type="button"
        className={`dial-fab${open ? " dial-fab--open" : ""}${live && !open ? " dial-fab--live" : ""}`}
        onClick={() => (open ? closeDialer() : openDialer())}
        aria-label={open ? "Hide dial pad" : live ? "Show live call" : "Open dial pad"}
        aria-expanded={open}
      >
        <PhoneIcon aria-hidden="true" />
        {live && !open ? (
          <span className="dial-fab__time">{formatDuration(durationSec)}</span>
        ) : (
          <span className="dial-fab__label">Dial</span>
        )}
      </button>

      {open && (
        <div
          ref={padRef}
          className={`dial-pad${dragging ? " dial-pad--dragging" : ""}${resizing ? " dial-pad--resizing" : ""}${pos ? " dial-pad--moved" : ""}${size ? " dial-pad--sized" : ""}`}
          role="dialog"
          aria-modal="false"
          aria-labelledby="dial-pad-title"
          style={{
            ...(pos ? { left: pos.x, top: pos.y } : {}),
            ...(size ? { width: size.w, height: size.h } : {}),
          }}
        >
          <header
            className="dial-pad__top"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div className="dial-pad__who">
              <h2 id="dial-pad-title" className="dial-pad__title">
                {displayName || "Dial"}
              </h2>
              <p
                className={`dial-pad__status${status === "error" ? " dial-pad__status--error" : ""}`}
              >
                {needsDisposition
                  ? "Call ended"
                  : statusLabel(status, durationSec, error)}
              </p>
            </div>
            <button
              type="button"
              className="dial-pad__icon-btn"
              onClick={closeDialer}
              aria-label={inCall ? "Hide dial pad" : "Close dial pad"}
            >
              <CloseIcon aria-hidden="true" />
            </button>
          </header>

          <div className="dial-pad__display">
            <input
              ref={inputRef}
              className="dial-pad__input"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              spellCheck={false}
              readOnly={inCall || needsDisposition}
              value={formatPadDisplay(number)}
              placeholder="Enter number"
              aria-label="Phone number"
              onChange={(e) => setNumber(e.target.value)}
            />
            {showKeypad && number && (
              <button
                type="button"
                className="dial-pad__icon-btn dial-pad__backspace"
                onClick={backspace}
                aria-label="Delete last digit"
              >
                <BackspaceIcon aria-hidden="true" />
              </button>
            )}
          </div>

          {showKeypad && (
            <div className="dial-pad__keys">
              {KEYS.map((key) => (
                <button
                  key={key.digit}
                  type="button"
                  className="dial-key"
                  onClick={() => pressDigit(key.digit)}
                  aria-label={key.digit === "*" ? "star" : key.digit === "#" ? "pound" : key.digit}
                >
                  <span className="dial-key__digit">{key.digit}</span>
                  {key.letters && (
                    <span className="dial-key__letters">{key.letters}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {inCall && sessionId && <DialCoach sessionId={sessionId} />}

          {needsDisposition && (
            <div className="dial-disposition" role="group" aria-label="Call outcome">
              <p className="dial-disposition__label">How did it go?</p>
              {error && (
                <p className="dial-pad__status dial-pad__status--error">{error}</p>
              )}
              {DISPOSITIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`dial-disposition__btn dial-disposition__btn--${opt.kind}`}
                  disabled={savingDisposition}
                  onClick={() => void resolveDisposition(opt.id)}
                >
                  {savingDisposition ? "Saving…" : opt.label}
                </button>
              ))}
              <button
                type="button"
                className="dial-disposition__skip"
                disabled={savingDisposition}
                onClick={skipDisposition}
              >
                Skip
              </button>
            </div>
          )}

          {!needsDisposition && (
            <div className="dial-pad__actions">
              {inCall ? (
                <>
                  <button
                    type="button"
                    className={`dial-pad__side${muted ? " dial-pad__side--on" : ""}`}
                    onClick={toggleMute}
                    aria-pressed={muted}
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? (
                      <MicOffIcon aria-hidden="true" />
                    ) : (
                      <MicIcon aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="dial-action dial-action--hangup"
                    onClick={hangup}
                    aria-label="Hang up"
                  >
                    <PhoneIcon aria-hidden="true" />
                  </button>
                  <span className="dial-pad__side dial-pad__side--spacer" />
                </>
              ) : (
                <>
                  <span className="dial-pad__side dial-pad__side--spacer" />
                  <button
                    type="button"
                    className="dial-action dial-action--call"
                    onClick={() => void placeCall()}
                    disabled={number.replace(/\D/g, "").length < 10}
                    aria-label="Call"
                  >
                    <PhoneIcon aria-hidden="true" />
                  </button>
                  <span className="dial-pad__side dial-pad__side--spacer" />
                </>
              )}
            </div>
          )}

          {callerId && !needsDisposition && (
            <p className="dial-pad__from">From {formatPadDisplay(callerId)}</p>
          )}

          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <button
              key={corner}
              type="button"
              className={`dial-pad__resize dial-pad__resize--${corner}`}
              aria-label={`Resize dial pad from ${corner} corner`}
              onPointerDown={(e) => onResizeStart(e, corner)}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              onPointerCancel={onResizeEnd}
            />
          ))}
        </div>
      )}
    </>
  );
}
