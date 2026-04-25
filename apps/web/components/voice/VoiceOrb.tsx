"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface VoiceOrbProps {
  isListening?: boolean;
  isProcessing?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function VoiceOrb({
  isListening = false,
  isProcessing = false,
  disabled = false,
  onClick,
}: VoiceOrbProps) {
  const [pulse, setPulse] = useState(1);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Mic amplitude → pulse scale
  useEffect(() => {
    if (!isListening) {
      setPulse(1);
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length / 255;
          setPulse(1 + avg * 0.35);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        /* mic denied — no pulse */
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      analyserRef.current = null;
      streamRef.current = null;
    };
  }, [isListening]);

  const label = isProcessing ? "Executing..." : isListening ? "Listening..." : "Tap to speak";

  return (
    <div className="flex flex-col items-center gap-10">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative flex h-[152px] w-[152px] items-center justify-center rounded-full",
          "transition-transform duration-150",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-[1.04] active:scale-95",
        )}
        style={{ transform: `scale(${pulse})` }}
      >
        {/* Glow halo */}
        <span
          className={cn(
            "absolute inset-[-10px] rounded-full blur-xl opacity-40 transition-opacity duration-500",
            isProcessing
              ? "bg-brand-teal animate-pulse"
              : isListening
                ? "bg-brand-crimson animate-pulse"
                : "bg-brand-violet",
          )}
        />

        {/* Gradient ring */}
        <span
          className={cn(
            "absolute inset-0 rounded-full",
            isProcessing
              ? "bg-[conic-gradient(from_180deg,#0DB4C9,#1FCFA0,#0DB4C9)]"
              : "bg-[conic-gradient(from_180deg,#7B5FFF,#DC2547,#9B6DFF,#7B5FFF)]",
          )}
        />

        {/* Inner dark circle */}
        <span className="absolute inset-[6px] rounded-full bg-bg-base" />

        {/* Icon */}
        <span className="relative z-10 flex h-16 w-16 items-center justify-center">
          {isProcessing ? (
            <svg
              className="h-9 w-9 animate-spin text-brand-teal"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" opacity="0.25" />
              <path
                d="M4 12a8 8 0 018-8"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            // Synapse brand mark — triangle/pin
            <svg
              className={cn("h-9 w-9", isListening ? "text-brand-crimson" : "text-brand-crimson")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 20h20L12 2z" />
              <path d="M12 10v4" />
              <path d="M12 18h.01" />
            </svg>
          )}
        </span>
      </button>

      <p className="text-sm font-semibold text-ink-mid">{label}</p>
    </div>
  );
}
