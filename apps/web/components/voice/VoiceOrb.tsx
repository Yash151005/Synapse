/**
 * components/voice/VoiceOrb.tsx — Animated voice input orb with audio reactivity
 * 
 * The signature UI element. Pulses with gradient (crimson → violet).
 * Reacts to microphone input amplitude via Web Audio API.
 * Pulsates during agent execution (teal).
 */

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationIdRef = useRef<number>();
  const [amplitude, setAmplitude] = useState(0);

  // Set up audio input during listening state
  useEffect(() => {
    if (!isListening) return;

    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateAmplitude = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAmplitude(average / 255); // Normalize to 0–1
          animationIdRef.current = requestAnimationFrame(updateAmplitude);
        };

        updateAmplitude();
      } catch (err) {
        console.error("Microphone access failed:", err);
      }
    };

    setupAudio();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isListening]);

  // Canvas animation loop for visual feedback
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 60;
      const radiusVariation = baseRadius * 0.2 * amplitude;

      // Outer glow ring
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius + radiusVariation + 20);
      if (isProcessing) {
        gradient.addColorStop(0, "rgba(13, 180, 201, 0.3)");
        gradient.addColorStop(0.5, "rgba(13, 180, 201, 0.1)");
        gradient.addColorStop(1, "rgba(13, 180, 201, 0)");
      } else if (isListening) {
        gradient.addColorStop(0, "rgba(220, 37, 71, 0.3)");
        gradient.addColorStop(0.5, "rgba(123, 95, 255, 0.1)");
        gradient.addColorStop(1, "rgba(123, 95, 255, 0)");
      } else {
        gradient.addColorStop(0, "rgba(13, 180, 201, 0.2)");
        gradient.addColorStop(1, "rgba(13, 180, 201, 0)");
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + radiusVariation + 20, 0, Math.PI * 2);
      ctx.fill();

      // Main orb
      const orbGradient = ctx.createRadialGradient(centerX - 10, centerY - 10, 10, centerX, centerY, baseRadius);
      if (isProcessing) {
        orbGradient.addColorStop(0, "#1FCFA0");
        orbGradient.addColorStop(1, "#0DB4C9");
      } else {
        orbGradient.addColorStop(0, "#DC2547");
        orbGradient.addColorStop(1, "#7B5FFF");
      }
      ctx.fillStyle = orbGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + radiusVariation, 0, Math.PI * 2);
      ctx.fill();

      // Highlight for depth
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX - 15, centerY - 15, baseRadius + radiusVariation - 10, 0, Math.PI * 2);
      ctx.stroke();

      requestAnimationFrame(animate);
    };

    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [isListening, isProcessing, amplitude]);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-60 w-60 items-center justify-center rounded-full transition-all",
        isListening || isProcessing ? "ring-4 ring-brand-violet/50" : "",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105 active:scale-95 cursor-pointer",
      )}
    >
      {/* Canvas for real-time animation */}
      <canvas
        ref={canvasRef}
        width={240}
        height={240}
        className="absolute inset-0 rounded-full"
      />

      {/* Icon overlay */}
      <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-bg-base">
        {isProcessing ? (
          <svg
            className="h-10 w-10 animate-spin text-brand-teal"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" opacity="0.25" />
            <path
              d="M4 12a8 8 0 018-8v0m0 16v0a8 8 0 01-8-8m16 0a8 8 0 01-8 8m0-16v0a8 8 0 018 8"
              strokeWidth="2"
            />
          </svg>
        ) : isListening ? (
          <svg
            className="h-10 w-10 text-brand-crimson"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 16.91c-1.48 1.46-3.77 2.39-6 2.39s-4.52-.93-6-2.39M9 18.9v2.01M15 18.9v2.01" />
          </svg>
        ) : (
          <svg
            className="h-10 w-10 text-brand-crimson"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8m0 8a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
        )}
      </div>

      {/* Status text */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
        <p className="text-sm font-semibold text-ink-mid">
          {isProcessing ? "Executing..." : isListening ? "Listening..." : "Tap to speak"}
        </p>
      </div>
    </button>
  );
}
