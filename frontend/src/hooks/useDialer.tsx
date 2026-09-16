import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Call, Device } from "@twilio/voice-sdk";

import { ApiError } from "@/lib/api/client";
import { createSession, updateSession, type SessionOutcome } from "@/lib/api/coach";
import { setLeadFollowUp, setLeadStatus } from "@/lib/api/leads";
import { emitCrmLeadPatch } from "@/lib/crmEvents";
import { getVoiceToken } from "@/lib/api/voice";
import { sanitizePadInput, toDialable } from "@/lib/phone";

export type CallDisposition = "not_interested" | "follow_up" | "meeting_booked";

const DISPOSITION_OUTCOME: Record<CallDisposition, SessionOutcome> = {
  not_interested: "not_interested",
  follow_up: "callback",
  meeting_booked: "meeting_booked",
};

export type DialerStatus =
  | "idle"
  | "connecting"
  | "ringing"
  | "open"
  | "error";

export interface OpenDialerOpts {
  number?: string;
  name?: string;
  placeId?: string;
}

interface DialerContextValue {
  open: boolean;
  number: string;
  displayName: string | null;
  callerId: string;
  status: DialerStatus;
  error: string | null;
  muted: boolean;
  durationSec: number;
  inCall: boolean;
  sessionId: string | null;
  needsDisposition: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  openDialer: (opts?: OpenDialerOpts) => void;
  closeDialer: () => void;
  setNumber: (value: string) => void;
  pressDigit: (digit: string) => void;
  backspace: () => void;
  placeCall: () => Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
  resolveDisposition: (choice: CallDisposition) => void;
  skipDisposition: () => void;
  savingDisposition: boolean;
}

const DialerContext = createContext<DialerContextValue | null>(null);

function isDestroyedError(err: unknown): boolean {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: string }).message)
      : String(err ?? "");
  return /device has been destroyed/i.test(msg);
}

function deviceIsUsable(device: Device | null): boolean {
  return Boolean(device && device.state !== Device.State.Destroyed);
}

function twilioErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 503) {
      return "Dialer isn’t configured yet. Add Twilio settings on the API.";
    }
    return err.message;
  }
  if (err && typeof err === "object") {
    const rec = err as { message?: string; code?: number };
    if (rec.code === 31005 || rec.code === 31000) {
      return "Twilio couldn’t reach the dialer webhook. Local calls need a public URL (tunnel or Railway).";
    }
    if (typeof rec.message === "string" && rec.message) return rec.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Couldn’t place the call.";
}

export function DialerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [number, setNumberState] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [callerId, setCallerId] = useState("");
  const [status, setStatus] = useState<DialerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [needsDisposition, setNeedsDisposition] = useState(false);
  const [savingDisposition, setSavingDisposition] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const tokenRef = useRef<string | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const placeIdRef = useRef<string>("");
  const nameRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const reachedOpenRef = useRef(false);

  const inCall =
    status === "connecting" || status === "ringing" || status === "open";

  useEffect(() => {
    if (!inCall) {
      setLocalStream(null);
      setRemoteStream(null);
      return;
    }
    const sync = () => {
      const call = callRef.current;
      if (!call) return;
      const local = call.getLocalStream() ?? null;
      const remote = call.getRemoteStream() ?? null;
      setLocalStream((prev) => (prev === local ? prev : local));
      setRemoteStream((prev) => (prev === remote ? prev : remote));
    };
    sync();
    const id = window.setInterval(sync, 400);
    return () => window.clearInterval(id);
  }, [inCall]);

  const endSession = useCallback((outcome: SessionOutcome) => {
    const id = sessionIdRef.current;
    if (!id) return;
    void updateSession(id, { ended: true, outcome }).catch(() => undefined);
  }, []);

  const clearSession = useCallback(() => {
    sessionIdRef.current = null;
    setSessionId(null);
    setNeedsDisposition(false);
  }, []);

  const promptDisposition = useCallback(() => {
    setNeedsDisposition(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (status !== "open") {
      setDurationSec(0);
      connectedAtRef.current = null;
      return;
    }
    connectedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      const start = connectedAtRef.current;
      if (start) setDurationSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const bindCall = useCallback((call: Call) => {
    callRef.current = call;
    const onRinging = () => setStatus("ringing");
    const onAccept = () => {
      reachedOpenRef.current = true;
      setStatus("open");
      setMuted(call.isMuted());
    };
    const onEnd = () => {
      callRef.current = null;
      setMuted(false);
      endSession(reachedOpenRef.current ? "connected" : "no_answer");
      reachedOpenRef.current = false;
      setStatus("idle");
      promptDisposition();
    };
    const onError = (err: Error) => {
      if (isDestroyedError(err)) return;
      setError(twilioErrorMessage(err));
      setStatus("error");
    };
    call.on("ringing", onRinging);
    call.on("accept", onAccept);
    call.on("disconnect", onEnd);
    call.on("cancel", onEnd);
    call.on("reject", onEnd);
    call.on("error", onError);
  }, [endSession, promptDisposition]);

  const discardDevice = useCallback(() => {
    const device = deviceRef.current;
    deviceRef.current = null;
    tokenRef.current = null;
    if (!device || device.state === Device.State.Destroyed) return;
    device.removeAllListeners();
    try {
      device.destroy();
    } catch {
      // Already torn down.
    }
  }, []);

  const ensureDevice = useCallback(async (): Promise<Device> => {
    const existing = deviceRef.current;
    if (deviceIsUsable(existing) && tokenRef.current) return existing as Device;
    if (existing) discardDevice();

    const { token, caller_id } = await getVoiceToken();
    tokenRef.current = token;
    setCallerId(caller_id);

    const device = new Device(token, {
      logLevel: 0,
      codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      closeProtection: true,
    });
    device.on("error", (err) => {
      if (isDestroyedError(err) || device.state === Device.State.Destroyed) {
        deviceRef.current = null;
        tokenRef.current = null;
        return;
      }
      setError(twilioErrorMessage(err));
      setStatus("error");
    });
    device.on("destroyed", () => {
      if (deviceRef.current === device) {
        deviceRef.current = null;
        tokenRef.current = null;
      }
    });
    deviceRef.current = device;
    return device;
  }, [discardDevice]);

  const skipDisposition = useCallback(() => {
    clearSession();
    setError(null);
    if (status === "error") setStatus("idle");
  }, [clearSession, status]);

  const savingRef = useRef(false);
  const resolveDisposition = useCallback(
    async (choice: CallDisposition) => {
      if (savingRef.current) return;
      savingRef.current = true;
      const id = sessionIdRef.current;
      const placeId = placeIdRef.current;
      setSavingDisposition(true);
      setError(null);
      try {
        if (id) {
          await updateSession(id, { outcome: DISPOSITION_OUTCOME[choice] });
        }
        if (placeId) {
          if (choice === "not_interested") {
            await setLeadStatus(placeId, "passed");
            await setLeadFollowUp(placeId, false);
            emitCrmLeadPatch({
              placeId,
              followUp: false,
              outreachStatus: "passed",
            });
          } else if (choice === "follow_up") {
            await setLeadFollowUp(placeId, true);
            emitCrmLeadPatch({ placeId, followUp: true });
          } else {
            await setLeadStatus(placeId, "interested");
            await setLeadFollowUp(placeId, true);
            emitCrmLeadPatch({
              placeId,
              followUp: true,
              outreachStatus: "interested",
            });
          }
        }
        clearSession();
      } catch {
        setError(
          placeId
            ? "Couldn't save that to CRM. Try again."
            : "Couldn't save the call outcome.",
        );
      } finally {
        savingRef.current = false;
        setSavingDisposition(false);
      }
    },
    [clearSession],
  );

  const openDialer = useCallback((opts?: OpenDialerOpts) => {
    if (opts?.number && needsDisposition) {
      clearSession();
    }
    if (opts?.number) setNumberState(sanitizePadInput(opts.number));
    if (opts?.name !== undefined) {
      setDisplayName(opts.name || null);
      nameRef.current = opts.name || null;
    }
    if (opts?.placeId !== undefined) placeIdRef.current = opts.placeId;
    if (status === "error") setStatus("idle");
    setError(null);
    setOpen(true);
  }, [clearSession, needsDisposition, status]);

  const closeDialer = useCallback(() => {
    setOpen(false);
  }, []);

  const setNumber = useCallback(
    (value: string) => {
      if (inCall) return;
      setNumberState(sanitizePadInput(value));
    },
    [inCall],
  );

  const pressDigit = useCallback(
    (digit: string) => {
      if (inCall) {
        callRef.current?.sendDigits(digit);
        return;
      }
      setNumberState((prev) => sanitizePadInput(prev + digit));
    },
    [inCall],
  );

  const backspace = useCallback(() => {
    if (inCall) return;
    setNumberState((prev) => {
      if (prev === "+") return "";
      return prev.slice(0, -1);
    });
  }, [inCall]);

  const hangup = useCallback(() => {
    callRef.current?.disconnect();
    callRef.current = null;
    setMuted(false);
    endSession(reachedOpenRef.current ? "connected" : "no_answer");
    reachedOpenRef.current = false;
    setError(null);
    if (status !== "idle") setStatus("idle");
    promptDisposition();
  }, [endSession, promptDisposition, status]);

  const placeCall = useCallback(async () => {
    const dest = toDialable(number);
    if (!dest || dest.replace(/\D/g, "").length < 10) {
      setError("Enter a 10-digit number.");
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("connecting");
    reachedOpenRef.current = false;
    setNeedsDisposition(false);
    try {
      try {
        const session = await createSession({
          lead_name: nameRef.current || displayName || dest,
          lead_place_id: placeIdRef.current || "",
        });
        sessionIdRef.current = session.id;
        setSessionId(session.id);
      } catch {
        // Call still proceeds if logging fails.
      }
      const device = await ensureDevice();
      const call = await device.connect({ params: { To: dest } });
      bindCall(call);
    } catch (err) {
      if (isDestroyedError(err)) {
        discardDevice();
        try {
          const device = await ensureDevice();
          const call = await device.connect({ params: { To: dest } });
          bindCall(call);
          return;
        } catch (retryErr) {
          endSession("no_answer");
          clearSession();
          setError(twilioErrorMessage(retryErr));
          setStatus("error");
          return;
        }
      }
      endSession("no_answer");
      clearSession();
      setError(twilioErrorMessage(err));
      setStatus("error");
    }
  }, [bindCall, discardDevice, displayName, ensureDevice, endSession, clearSession, number]);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const next = !call.isMuted();
    call.mute(next);
    setMuted(next);
  }, []);

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      discardDevice();
    };
  }, [discardDevice]);

  const value = useMemo<DialerContextValue>(
    () => ({
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
      localStream,
      remoteStream,
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
    }),
    [
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
      localStream,
      remoteStream,
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
    ],
  );

  return (
    <DialerContext.Provider value={value}>{children}</DialerContext.Provider>
  );
}

export function useDialer(): DialerContextValue {
  const ctx = useContext(DialerContext);
  if (!ctx) {
    throw new Error("useDialer must be used within DialerProvider");
  }
  return ctx;
}
