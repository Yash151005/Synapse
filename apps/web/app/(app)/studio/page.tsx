"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Network, Wallet } from "lucide-react";
import type { Plan } from "@synapse/shared";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoiceOrb } from "@/components/voice/VoiceOrb";
import { PlanTree } from "@/components/plan/PlanTree";
import { CostMeter } from "@/components/ledger/CostMeter";
import { TxFeed } from "@/components/ledger/TxFeed";
import { AgentGraph3D } from "@/components/network/AgentGraph3D";

type TaskVisualState = "pending" | "discovering" | "paying" | "executing" | "done" | "failed";

type OrchestrateResponse = {
  sessionId: string;
  plan: Plan;
  tasks: Array<{ id: string; result?: { ok?: boolean } }>;
  totalCostUsdc: number;
  narration: string;
};

type StrategyMode = "balanced" | "cheapest" | "fastest";
type LanguageMode = "en-US" | "hi-IN" | "es-ES";

type HistoryItem = {
  id: string;
  goal: string;
  createdAt: string;
  strategy: StrategyMode;
  budgetUsdc: number;
};

const QUICK_GOALS = [
  "Find flights from SFO to NYC next Friday under $300 and summarize weather.",
  "Plan a Goa weekend under INR 25000 with flights, hotel, and weather.",
  "Compare 3 hotels near Times Square and convert total cost to INR.",
];

type BrowserSpeechRecognitionEvent = Event & {
  results: { [index: number]: { [index: number]: { transcript: string; confidence: number } } };
};
type BrowserSpeechRecognition = EventTarget & {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;
declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

export default function StudioPage() {
  const router = useRouter();
  const { loading: authLoading, session: authSession, loginWithFreighter } = useAuth();
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
  const [strategy, setStrategy] = useState<StrategyMode>("balanced");
  const [language, setLanguage] = useState<LanguageMode>("en-US");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [identityCopied, setIdentityCopied] = useState(false);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const runStartRef = useRef<number | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);
  // Refs to latest values so effects with stable deps can access current state
  const runOrchestrationRef = useRef<(inputGoal?: string) => Promise<void>>(async () => {});
  const isProcessingRef = useRef(isProcessing);

  useEffect(() => { runOrchestrationRef.current = runOrchestration; });
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  useEffect(() => {
    if (!authLoading && !authSession) {
      router.replace("/auth/login?next=%2Fstudio");
    }
  }, [authLoading, authSession, router]);

  // Speech recognition — only recreate when language changes, not on every isProcessing toggle
  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = language;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (text) { setGoal(text); void runOrchestrationRef.current(text); }
    };
    rec.onerror = (event) => {
      setIsListening(false);
      const errType = (event as Event & { error?: string }).error;
      if (errType === "not-allowed" || errType === "permission-denied") {
        setError("Microphone access denied. Allow microphone permission in your browser settings and try again.");
      } else if (errType === "no-speech") {
        setError("No speech detected. Hold space and speak clearly.");
      } else if (errType === "audio-capture") {
        setError("No microphone found. Connect a microphone and try again.");
      } else {
        setError("Speech recognition failed. Type your goal instead.");
      }
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  }, [language]);

  // Keyboard push-to-talk — stable handler using refs so it never needs to remount
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !isProcessingRef.current && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (!recognitionRef.current) {
          setError("Speech recognition is not supported in this browser. Use Chrome or Edge, or type your goal.");
          return;
        }
        setError(null); setIsListening(true); recognitionRef.current.start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault(); recognitionRef.current?.stop(); setIsListening(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  useEffect(() => {
    const prefill = localStorage.getItem("synapse.prefillGoal");
    if (prefill) {
      setGoal(prefill);
      localStorage.removeItem("synapse.prefillGoal");
    }
    try {
      const raw = localStorage.getItem("synapse.goalHistory");
      if (!raw) return;
      setHistory((JSON.parse(raw) as HistoryItem[]).slice(0, 6));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isProcessing) return;
    const id = window.setInterval(() => {
      if (runStartRef.current) setElapsedMs(Date.now() - runStartRef.current);
    }, 120);
    return () => window.clearInterval(id);
  }, [isProcessing]);

  const activeTaskIds = useMemo(
    () => Object.entries(taskStates).filter(([, s]) => s === "discovering" || s === "paying" || s === "executing").map(([id]) => id),
    [taskStates],
  );

  function startListening() {
    if (isProcessing) return;
    if (!recognitionRef.current) {
      setError("Speech recognition is not supported in this browser. Use Chrome or Edge, or type your goal.");
      return;
    }
    setError(null); setIsListening(true);
    try { recognitionRef.current.start(); } catch { setIsListening(false); }
  }
  function stopListening() {
    recognitionRef.current?.stop(); setIsListening(false);
  }

  async function runOrchestration(inputGoal?: string) {
    const finalGoal = (inputGoal ?? goal).trim();
    if (!finalGoal || finalGoal.length < 5) { setError("Please provide a longer goal."); return; }

    setError(null); setIsProcessing(true); setNarration(""); setPlan(null);
    setTaskStates({}); setTotalCostUsdc(0); setElapsedMs(0);
    runStartRef.current = Date.now();
    runAbortRef.current?.abort();
    runAbortRef.current = new AbortController();
    const localSessionId = crypto.randomUUID();
    setSessionId(localSessionId);

    try {
      const res = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: runAbortRef.current.signal,
        body: JSON.stringify({ sessionId: localSessionId, goal: finalGoal, userAddress: authSession?.subject, budgetUsdc, strategy }),
      });
      if (!res.ok) { const text = await res.text(); throw new Error(text || `Orchestration failed (${res.status})`); }

      const data = (await res.json()) as OrchestrateResponse;
      setSessionId(data.sessionId); setPlan(data.plan);
      setTotalCostUsdc(data.totalCostUsdc ?? 0); setNarration(data.narration ?? "");
      setElapsedMs(runStartRef.current ? Date.now() - runStartRef.current : 0);

      const nextItem: HistoryItem = { id: crypto.randomUUID(), goal: finalGoal, createdAt: new Date().toISOString(), strategy, budgetUsdc };
      setHistory((prev) => {
        const merged = [nextItem, ...prev.filter((h) => h.goal !== nextItem.goal)].slice(0, 6);
        localStorage.setItem("synapse.goalHistory", JSON.stringify(merged));
        return merged;
      });

      const nextStates: Record<string, TaskVisualState> = {};
      for (const task of data.plan.tasks) {
        const result = data.tasks.find((t) => t.id === task.id)?.result;
        nextStates[task.id] = result?.ok === false ? "failed" : "done";
      }
      setTaskStates(nextStates);
    } catch (err) {
      setError(err instanceof DOMException && err.name === "AbortError" ? "Run cancelled." : err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessing(false); runAbortRef.current = null;
    }
  }

  function cancelRun() { runAbortRef.current?.abort(); setIsProcessing(false); }

  async function speakNarration() {
    if (!narration || isSpeaking) return;
    setIsSpeaking(true);

    // Try ElevenLabs first
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: narration }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
        await audio.play();
        return;
      }
    } catch {
      // fall through to browser TTS
    }

    // Fallback: browser speechSynthesis
    if (!("speechSynthesis" in window)) { setIsSpeaking(false); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(narration);
    utter.rate = 1.03; utter.pitch = 1.0; utter.lang = language;
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  if (authLoading || !authSession) {
    return (
      <main className="relative grid min-h-screen place-items-center bg-bg-base grid-bg text-ink-high">
        <div className="glass px-5 py-4 text-sm text-ink-mid">Loading studio...</div>
      </main>
    );
  }

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-bg-base grid-bg">
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/5 bg-bg-raised/60 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="block h-5 w-5 rounded-xs bg-linear-to-br from-brand-crimson to-brand-violet shadow-[0_0_8px_rgba(220,37,71,0.4)]" />
            <span className="font-display text-lg italic">Synapse</span>
          </Link>
          <Badge tone="teal">Studio</Badge>
          <span className="text-xs text-ink-low">/studio</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loginWithFreighter()}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-ink-mid transition hover:text-ink-high"
          >
            <Wallet className="h-4 w-4" />
            {authSession.kind === "wallet" ? "Freighter connected" : "Connect Freighter"}
          </button>
          <button
            type="button"
            className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-ink-high transition hover:border-white/40"
            onClick={() => {
              const label = authSession.kind === "wallet"
                ? authSession.subject
                : authSession.subject.replace("passkey:", "");
              void navigator.clipboard.writeText(label).then(() => {
                setIdentityCopied(true);
                setTimeout(() => setIdentityCopied(false), 2000);
              });
            }}
          >
            {identityCopied ? "Copied ✓" : authSession.kind === "wallet" ? "Wallet identity" : "Passkey identity"}
          </button>
        </div>
      </header>

      {/* ── Body: 3-column ── */}
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_280px]">

        {/* ── LEFT: Plan tree ── */}
        <aside className="flex flex-col overflow-hidden border-r border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
            <Activity className="h-3.5 w-3.5 text-ink-low" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-ink-low">Plan</span>
            <span className="text-[11px] text-ink-low/50">· Goal to tasks</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PlanTree plan={plan} taskStates={taskStates} />
          </div>
        </aside>

        {/* ── CENTER: Voice + controls ── */}
        <section className="flex flex-col overflow-y-auto">
          {/* Orb area */}
          <div className="flex flex-1 flex-col items-center justify-center px-6 pt-10 pb-4">
            <VoiceOrb
              isListening={isListening}
              isProcessing={isProcessing}
              onClick={() => { if (isListening) stopListening(); else startListening(); }}
            />
          </div>

          {/* Controls */}
          <div className="px-6 pb-6">
            <div className="mx-auto max-w-2xl space-y-3">
              {/* Textarea */}
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void runOrchestration(); } }}
                placeholder="Speak or type your goal..."
                rows={3}
                className="w-full resize-none rounded-md border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-ink-high outline-none placeholder:text-ink-low focus:border-brand-teal/60"
              />

              {/* Hint + Run */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-ink-low">Hold space to talk, or type and run.</p>
                <div className="flex items-center gap-2">
                  {isProcessing && (
                    <Button size="sm" variant="outline" onClick={cancelRun}>Cancel</Button>
                  )}
                  <button
                    type="button"
                    onClick={() => void runOrchestration()}
                    disabled={isProcessing || goal.trim().length < 5}
                    className="rounded-md bg-brand-crimson px-5 py-2 text-sm font-semibold text-white shadow-[0_0_12px_rgba(220,37,71,0.35)] transition hover:bg-brand-crimson/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isProcessing ? "Running..." : "Run"}
                  </button>
                </div>
              </div>

              {/* Strategy + Language */}
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Strategy"
                  value={strategy}
                  onChange={(v) => setStrategy(v as StrategyMode)}
                  options={[
                    { value: "balanced", label: "Balanced" },
                    { value: "cheapest", label: "Cheapest" },
                    { value: "fastest", label: "Fastest" },
                  ]}
                />
                <SelectField
                  label="Language"
                  value={language}
                  onChange={(v) => setLanguage(v as LanguageMode)}
                  options={[
                    { value: "en-US", label: "English (US)" },
                    { value: "hi-IN", label: "Hindi" },
                    { value: "es-ES", label: "Spanish" },
                  ]}
                />
              </div>

              {/* Budget */}
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between text-xs text-ink-low">
                  <span>Budget ceiling</span>
                  <span className="font-mono text-ink-mid">${budgetUsdc.toFixed(3)} USDC</span>
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

              {/* Quick goals */}
              <div className="flex flex-wrap gap-2">
                {QUICK_GOALS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGoal(preset)}
                    className="rounded-full border border-white/10 bg-white/3 px-3 py-1 text-xs text-ink-mid transition hover:bg-white/8 hover:text-ink-high"
                  >
                    {preset.length > 52 ? `${preset.slice(0, 52)}...` : preset}
                  </button>
                ))}
              </div>

              {/* History */}
              {history.length > 0 && (
                <div className="rounded-md border border-white/10 bg-black/20 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-ink-low">recent commands</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {history.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setGoal(item.goal); setStrategy(item.strategy); setBudgetUsdc(item.budgetUsdc); void runOrchestration(item.goal); }}
                        className="rounded-full border border-white/10 bg-white/3 px-3 py-1 text-xs text-ink-mid transition hover:bg-white/8 hover:text-ink-high"
                      >
                        {item.goal.length > 44 ? `${item.goal.slice(0, 44)}...` : item.goal}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-brand-crimson">{error}</p>}

              {narration && (
                <div className="rounded-md border border-white/10 bg-black/20 px-4 py-3 text-center text-sm text-ink-mid">
                  {narration}
                  <div className="mt-3 flex justify-center">
                    <Button variant="outline" size="sm" disabled={isSpeaking} onClick={() => void speakNarration()}>
                      {isSpeaking ? "Speaking…" : "Play narration"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Agent graph strip */}
          <div className="flex h-40 shrink-0 items-center gap-3 border-t border-white/5 px-6">
            <div className="flex items-center gap-2 text-ink-low">
              <Network className="h-4 w-4" />
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em]">Agent network</div>
                <div className="text-[10px] text-ink-low/50">Hires + payment paths</div>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <AgentGraph3D plan={plan} activeTaskIds={activeTaskIds} />
            </div>
          </div>
        </section>

        {/* ── RIGHT: Runtime / Cost / Ledger ── */}
        <aside className="flex flex-col gap-0 overflow-hidden border-l border-white/5">
          {/* Runtime */}
          <div className="border-b border-white/5 px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">Runtime</p>
            <p className="mt-2 font-mono text-2xl text-brand-teal">{(elapsedMs / 1000).toFixed(1)}s</p>
          </div>

          {/* Session cost */}
          <div className="border-b border-white/5 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low">Session cost</p>
              <span className="rounded-full border border-brand-teal/40 px-2 py-0.5 font-mono text-[10px] text-brand-teal">XLM</span>
            </div>
            <p className="mt-2 font-mono text-2xl tracking-wider text-brand-teal">
              {totalCostUsdc.toFixed(6)}
            </p>
            <p className="mt-2 text-xs text-ink-low">
              Stripe minimum $0.30 · You{" "}
              <span className="font-mono text-brand-teal">${totalCostUsdc.toFixed(6)}</span>
            </p>
          </div>

          {/* Ledger feed */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <TxFeed sessionId={sessionId} />
          </div>

          {sessionId && (
            <div className="border-t border-white/5 px-5 py-3">
              <Link href={`/sessions/${sessionId}`} className="text-xs text-brand-teal hover:underline">
                View session receipts →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-low">{label}</p>
      <div className="relative mt-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-transparent py-0.5 text-sm text-ink-high outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-bg-sunken">
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-low">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </span>
      </div>
    </div>
  );
}
