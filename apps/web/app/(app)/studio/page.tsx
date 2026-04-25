"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, Network, Wallet } from "lucide-react";
import type { Plan } from "@synapse/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoiceOrb } from "@/components/voice/VoiceOrb";
import { PlanTree } from "@/components/plan/PlanTree";
import { CostMeter } from "@/components/ledger/CostMeter";
import { TxFeed } from "@/components/ledger/TxFeed";
import { AgentGraph3D } from "@/components/network/AgentGraph3D";

type TaskVisualState =
  | "pending"
  | "discovering"
  | "paying"
  | "executing"
  | "done"
  | "failed";

type OrchestrateResponse = {
  sessionId: string;
  plan: Plan;
  tasks: Array<{
    id: string;
    result?: {
      ok?: boolean;
    };
  }>;
  totalCostUsdc: number;
  narration: string;
};

const QUICK_GOALS = [
  "Find flights from SFO to NYC next Friday under $300 and summarize weather.",
  "Plan a Goa weekend under INR 25000 with flights, hotel, and weather.",
  "Compare 3 hotels near Times Square and convert total cost to INR.",
];

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult;
    length: number;
  }

  interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
    length: number;
  }

  interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }
}

export default function StudioPage() {
  const [goal, setGoal] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [narration, setNarration] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalCostUsdc, setTotalCostUsdc] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [taskStates, setTaskStates] = useState<Record<string, TaskVisualState>>({});
  const [budgetUsdc, setBudgetUsdc] = useState(0.05);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const runStartRef = useRef<number | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (text) {
        setGoal(text);
        void runOrchestration(text);
      }
    };

    rec.onerror = () => {
      setIsListening(false);
      setError("Speech recognition failed. Type your goal instead.");
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isProcessing) {
        e.preventDefault();
        startListening();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        stopListening();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isProcessing]);

  useEffect(() => {
    if (!isProcessing) return;
    const id = window.setInterval(() => {
      if (runStartRef.current) {
        setElapsedMs(Date.now() - runStartRef.current);
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [isProcessing]);

  const activeTaskIds = useMemo(
    () =>
      Object.entries(taskStates)
        .filter(([, s]) => s === "discovering" || s === "paying" || s === "executing")
        .map(([id]) => id),
    [taskStates],
  );

  function startListening() {
    if (!recognitionRef.current || isProcessing) return;
    setError(null);
    setIsListening(true);
    recognitionRef.current.start();
  }

  function stopListening() {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }

  async function runOrchestration(inputGoal?: string) {
    const finalGoal = (inputGoal ?? goal).trim();
    if (!finalGoal || finalGoal.length < 5) {
      setError("Please provide a longer goal.");
      return;
    }

    setError(null);
    setIsProcessing(true);
    setNarration("");
    setPlan(null);
    setTaskStates({});
    setTotalCostUsdc(0);
    setElapsedMs(0);
    runStartRef.current = Date.now();

    const localSessionId = crypto.randomUUID();
    setSessionId(localSessionId);

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: localSessionId,
          goal: finalGoal,
          budgetUsdc,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Orchestration failed (${res.status})`);
      }

      const data = (await res.json()) as OrchestrateResponse;
      setSessionId(data.sessionId);
      setPlan(data.plan);
      setTotalCostUsdc(data.totalCostUsdc ?? 0);
      setNarration(data.narration ?? "");
      setElapsedMs(runStartRef.current ? Date.now() - runStartRef.current : 0);

      const nextStates: Record<string, TaskVisualState> = {};
      for (const task of data.plan.tasks) {
        const result = data.tasks.find((t) => t.id === task.id)?.result;
        nextStates[task.id] = result?.ok === false ? "failed" : "done";
      }
      setTaskStates(nextStates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessing(false);
    }
  }

  function speakNarration() {
    if (!narration || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(narration);
    utter.rate = 1.03;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  }

  return (
    <main className="relative grid min-h-screen grid-cols-12 grid-rows-[auto_1fr] gap-3 bg-bg-base p-3 grid-bg">
      <header className="col-span-12 flex items-center justify-between rounded-md border border-white/5 bg-bg-raised/60 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="block h-5 w-5 rounded-xs bg-linear-to-br from-brand-crimson to-brand-violet" />
            <span className="font-display text-lg italic">Synapse</span>
          </Link>
          <Badge tone="teal">Studio</Badge>
          <span className="text-xs text-ink-low">/studio</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <Wallet className="h-4 w-4" /> Connect Freighter
          </Button>
          <Button variant="outline" size="sm">
            Guest treasury
          </Button>
        </div>
      </header>

      <section className="col-span-3 flex flex-col gap-3">
        <PanelHeader icon={<Activity className="h-4 w-4" />} title="Plan" subtitle="Goal to tasks" />
        <PlanTree plan={plan} taskStates={taskStates} />
      </section>

      <section className="col-span-6 flex flex-col gap-3">
        <div className="glass relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-8">
          <VoiceOrb
            isListening={isListening}
            isProcessing={isProcessing}
            onClick={() => {
              if (isListening) stopListening();
              else startListening();
            }}
          />

          <div className="mt-10 w-full max-w-xl">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Speak or type your goal..."
              className="h-24 w-full resize-none rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-high outline-none focus:border-brand-teal"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-ink-low">Hold space to talk, or type and run.</p>
              <Button
                size="sm"
                onClick={() => void runOrchestration()}
                disabled={isProcessing || goal.trim().length < 5}
              >
                {isProcessing ? "Running..." : "Run"}
              </Button>
            </div>
            <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between text-xs text-ink-low">
                <span>Budget ceiling</span>
                <span className="font-mono">${budgetUsdc.toFixed(3)} USDC</span>
              </div>
              <input
                type="range"
                min={0.005}
                max={0.2}
                step={0.005}
                value={budgetUsdc}
                onChange={(e) => setBudgetUsdc(Number(e.target.value))}
                className="mt-2 w-full accent-brand-teal"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_GOALS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGoal(preset)}
                  className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs text-ink-mid transition hover:bg-white/10 hover:text-ink-high"
                >
                  {preset.length > 52 ? `${preset.slice(0, 52)}...` : preset}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="mt-4 text-sm text-brand-crimson">{error}</p> : null}
          {narration ? (
            <div className="mt-4 max-w-2xl rounded-md border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-ink-mid">
              {narration}
              <div className="mt-3 flex justify-center">
                <Button variant="outline" size="sm" onClick={speakNarration}>
                  Play narration
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex h-44 items-center justify-center">
          <PanelHeader icon={<Network className="h-4 w-4" />} title="Agent network" subtitle="Hires + payment paths" inline />
          <div className="ml-3 h-full flex-1">
            <AgentGraph3D plan={plan} activeTaskIds={activeTaskIds} />
          </div>
        </div>
      </section>

      <section className="col-span-3 flex flex-col gap-3">
        <div className="glass px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-low">runtime</div>
          <div className="mt-1 font-mono text-xl text-brand-teal">{(elapsedMs / 1000).toFixed(1)}s</div>
        </div>
        <CostMeter totalCostUsdc={totalCostUsdc} />
        <div className="min-h-0 flex-1">
          <TxFeed sessionId={sessionId} />
        </div>
        {sessionId ? (
          <Link href={`/sessions/${sessionId}`} className="text-xs text-brand-teal hover:underline">
            View session receipts
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function PanelHeader({
  icon,
  title,
  subtitle,
  inline = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex items-center gap-3 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-white/4 text-ink-mid">
          {icon}
        </span>
        <div>
          <div className="text-sm">{title}</div>
          <div className="text-xs text-ink-low">{subtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-ink-mid">{icon}</span>
      <span className="text-[11px] uppercase tracking-[0.18em] text-ink-low">{title}</span>
      <span className="text-[11px] text-ink-low/60">· {subtitle}</span>
    </div>
  );
}
