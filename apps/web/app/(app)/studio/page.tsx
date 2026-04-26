"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ExternalLink, Network, Wallet } from "lucide-react";
import type { Plan } from "@synapse/shared";
import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoiceOrb } from "@/components/voice/VoiceOrb";
import { PlanTree } from "@/components/plan/PlanTree";
import { TxFeed } from "@/components/ledger/TxFeed";
import { AgentGraph3D } from "@/components/network/AgentGraph3D";
import { NetworkModal } from "@/components/network/NetworkModal";
import { AuctionPanel, type StreamEvent } from "@/components/studio/AuctionPanel";

type TaskVisualState = "pending" | "discovering" | "paying" | "executing" | "done" | "failed";

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
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [taskStates, setTaskStates] = useState<Record<string, TaskVisualState>>({});
  const [budgetUsdc, setBudgetUsdc] = useState(0.05);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [strategy, setStrategy] = useState<StrategyMode>("balanced");
  const [language, setLanguage] = useState<LanguageMode>("en-US");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [identityCopied, setIdentityCopied] = useState(false);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [showNetworkModal, setShowNetworkModal] = useState(false);

  const [approvalRequired, setApprovalRequired] = useState<{
    session_id: string;
    agents: Array<{
      task_id: string;
      capability: string;
      agent_name: string;
      agent_address: string | null;
      amount_xlm: number;
      sub_agent: { capability: string; name: string; amount_xlm: number } | null;
    }>;
    total_xlm: number;
    total_payments: number;
  } | null>(null);

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

    setError(null); setIsProcessing(true); setNarration(""); setPlan(null); setAgentNames({});
    setTaskStates({}); setTotalCostUsdc(0); setElapsedMs(0); setStreamEvents([]); setProofUrl(null);
    runStartRef.current = Date.now();
    runAbortRef.current?.abort();
    runAbortRef.current = new AbortController();
    const localSessionId = crypto.randomUUID();
    setSessionId(localSessionId);

    try {
      const res = await fetch("/api/orchestrate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: runAbortRef.current.signal,
        body: JSON.stringify({ sessionId: localSessionId, goal: finalGoal, userAddress: authSession?.subject, budgetUsdc, strategy }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `Orchestration failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const handleEvent = (type: string, data: Record<string, unknown>) => {
        const event: StreamEvent = { type, ...data };
        setStreamEvents(prev => [...prev, event]);

        switch (type) {
          case "session_start":
            setSessionId(data.session_id as string);
            break;
          case "plan": {
            const tasks = data.tasks as Array<{ id: string; capability: string; title: string; status: string; depends_on: string[]; parallel_group: number; max_price_usdc: number; query: string }>;
            const plan: Plan = { summary: data.summary as string, tasks: tasks as Plan["tasks"], narration_template: "" };
            setPlan(plan);
            const states: Record<string, TaskVisualState> = {};
            for (const t of tasks) states[t.id] = "pending";
            setTaskStates(states);
            break;
          }
          case "winner":
            if (data.task_id && data.agent) {
              setAgentNames(prev => ({ ...prev, [data.task_id as string]: (data.agent as { name: string }).name }));
              setTaskStates(prev => ({ ...prev, [data.task_id as string]: "discovering" }));
            }
            break;
          case "payment_approval_required":
            setApprovalRequired(data as typeof approvalRequired);
            break;
          case "payment_approved":
            setApprovalRequired(null);
            break;
          case "executing":
            setTaskStates(prev => ({ ...prev, [data.task_id as string]: "executing" }));
            break;
          case "payment_confirmed":
            setTaskStates(prev => ({ ...prev, [data.task_id as string]: "paying" }));
            break;
          case "task_done":
            setTaskStates(prev => ({ ...prev, [data.task_id as string]: "done" }));
            break;
          case "narration":
            setNarration(data.text as string);
            setElapsedMs(runStartRef.current ? Date.now() - runStartRef.current : 0);
            // Auto-play TTS
            void autoPlayNarration(data.text as string);
            break;
          case "done":
            setTotalCostUsdc(data.total_gas_fees as number ?? 0);
            setProofUrl(data.proof_url as string);
            if (data.session_id) setSessionId(data.session_id as string);
            const nextItem: HistoryItem = { id: crypto.randomUUID(), goal: finalGoal, createdAt: new Date().toISOString(), strategy, budgetUsdc };
            setHistory(prev => {
              const merged = [nextItem, ...prev.filter(h => h.goal !== nextItem.goal)].slice(0, 6);
              localStorage.setItem("synapse.goalHistory", JSON.stringify(merged));
              return merged;
            });
            break;
          case "error":
            setError(data.message as string ?? "Unknown error");
            setTaskStates(prev => {
              const updated = { ...prev };
              for (const id of Object.keys(updated)) {
                if (updated[id] === "executing" || updated[id] === "paying" || updated[id] === "discovering") {
                  updated[id] = "failed";
                }
              }
              return updated;
            });
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          let eventType = "message";
          let dataStr = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }
          if (dataStr) {
            try { handleEvent(eventType, JSON.parse(dataStr) as Record<string, unknown>); }
            catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      setError(err instanceof DOMException && err.name === "AbortError" ? "Run cancelled." : err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessing(false); runAbortRef.current = null;
    }
  }

  async function autoPlayNarration(text: string) {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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
    } catch { /* fall through */ }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.03; utter.lang = language;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utter);
    } else {
      setIsSpeaking(false);
    }
  }

  function cancelRun() { runAbortRef.current?.abort(); setIsProcessing(false); }

  async function handleApproval(approved: boolean) {
    if (!sessionId) return;
    setApprovalRequired(null);
    if (!approved) { setIsProcessing(false); }
    await fetch("/api/orchestrate/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, approved }),
    });
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
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr_240px]">

        {/* ── LEFT: Auction feed (during run) / Plan tree (at rest) ── */}
        <aside className="flex flex-col overflow-hidden border-r border-white/5">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
            <Activity className="h-3.5 w-3.5 text-ink-low" />
            {streamEvents.length > 0 ? (
              <>
                <span className="text-[11px] uppercase tracking-[0.18em] text-ink-low">Agent Auction</span>
                {isProcessing && <span className="h-1.5 w-1.5 rounded-full bg-brand-teal animate-pulse" />}
              </>
            ) : (
              <>
                <span className="text-[11px] uppercase tracking-[0.18em] text-ink-low">Plan</span>
                <span className="text-[11px] text-ink-low/50">· Goal to tasks</span>
              </>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {streamEvents.length > 0
              ? <AuctionPanel events={streamEvents} />
              : <PlanTree plan={plan} taskStates={taskStates} agentNames={agentNames} />
            }
          </div>
        </aside>

        {/* ── CENTER: Voice + controls ── */}
        <section className="min-h-0 overflow-y-auto">
          <div className="flex min-h-full flex-col">
            {/* Orb touch area */}
            <div className="flex shrink-0 items-center justify-center border-b border-white/5 px-5 py-7">
              <VoiceOrb
                isListening={isListening}
                isProcessing={isProcessing}
                onClick={() => { if (isListening) stopListening(); else startListening(); }}
              />
            </div>

            {/* Controls */}
            <div className="shrink-0 px-5 py-4">
            <div className="mx-auto max-w-xl space-y-3">

              {/* Textarea */}
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void runOrchestration(); } }}
                placeholder="Speak or type your goal..."
                rows={4}
                className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-ink-high outline-none placeholder:text-ink-low focus:border-brand-teal/60"
              />

              {/* Run row */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-ink-low/60">Hold space to talk · ⌘↵ to run</p>
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
                    {isProcessing ? "Running…" : "Run"}
                  </button>
                </div>
              </div>

              {/* Compact options row */}
              <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as StrategyMode)}
                  className="appearance-none bg-transparent text-xs text-ink-mid outline-none cursor-pointer hover:text-ink-high"
                >
                  <option value="balanced" className="bg-bg-sunken">Balanced</option>
                  <option value="cheapest" className="bg-bg-sunken">Cheapest</option>
                  <option value="fastest" className="bg-bg-sunken">Fastest</option>
                </select>
                <span className="text-white/15">|</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LanguageMode)}
                  className="appearance-none bg-transparent text-xs text-ink-mid outline-none cursor-pointer hover:text-ink-high"
                >
                  <option value="en-US" className="bg-bg-sunken">English</option>
                  <option value="hi-IN" className="bg-bg-sunken">Hindi</option>
                  <option value="es-ES" className="bg-bg-sunken">Spanish</option>
                </select>
                <span className="text-white/15">|</span>
                <span className="text-[10px] text-ink-low">Budget</span>
                <input
                  type="range"
                  min={0.005}
                  max={0.2}
                  step={0.005}
                  value={budgetUsdc}
                  onChange={(e) => setBudgetUsdc(Number(e.target.value))}
                  className="flex-1 accent-brand-teal"
                />
                <span className="font-mono text-[10px] text-ink-mid w-16 text-right">{budgetUsdc.toFixed(3)} XLM</span>
              </div>

              {/* Quick goals — single line horizontal scroll */}
              <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {QUICK_GOALS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGoal(preset)}
                    className="shrink-0 rounded-full border border-white/10 bg-white/3 px-3 py-1 text-xs text-ink-mid transition hover:bg-white/8 hover:text-ink-high"
                  >
                    {preset.length > 40 ? `${preset.slice(0, 40)}…` : preset}
                  </button>
                ))}
                {history.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setGoal(item.goal); setStrategy(item.strategy); setBudgetUsdc(item.budgetUsdc); void runOrchestration(item.goal); }}
                    className="shrink-0 rounded-full border border-brand-teal/20 bg-brand-teal/5 px-3 py-1 text-xs text-brand-teal/70 transition hover:bg-brand-teal/10 hover:text-brand-teal"
                  >
                    ↩ {item.goal.length > 36 ? `${item.goal.slice(0, 36)}…` : item.goal}
                  </button>
                ))}
              </div>

              {error && <p className="text-sm text-brand-crimson">{error}</p>}

              {narration && (
                <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-sm text-ink-mid leading-relaxed">{narration}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" disabled={isSpeaking} onClick={() => void autoPlayNarration(narration)}>
                      {isSpeaking ? "Speaking…" : "Replay narration"}
                    </Button>
                    {proofUrl && (
                      <a
                        href={proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-brand-teal/30 bg-brand-teal/8 px-3 py-1.5 text-xs text-brand-teal hover:bg-brand-teal/15 transition"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View proof
                      </a>
                    )}
                    {proofUrl && (
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${proofUrl}`); }}
                        className="ml-auto text-[11px] text-ink-low hover:text-ink-mid transition"
                      >
                        Copy proof link
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>

            {/* Agent graph strip — included in center scroll */}
            <div className="mt-auto flex h-32 shrink-0 items-center gap-3 border-t border-white/5 px-4">
              <div className="flex shrink-0 flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-ink-low">
                  <Network className="h-3.5 w-3.5" />
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em]">Agent network</div>
                    <div className="text-[9px] text-ink-low/40">Hires + payment paths</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNetworkModal(true)}
                  className="flex items-center gap-1 rounded-md border border-brand-teal/30 bg-brand-teal/8 px-2.5 py-1 text-[11px] text-brand-teal transition hover:bg-brand-teal/15"
                >
                  <Network className="h-3 w-3" />
                  Full view
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <AgentGraph3D plan={plan} activeTaskIds={activeTaskIds} agentNames={agentNames} />
              </div>
            </div>
          </div>
        </section>

        {/* ── RIGHT: Stats + Ledger ── */}
        <aside className="flex flex-col overflow-hidden border-l border-white/5">
          {/* Combined stats row */}
          <div className="grid grid-cols-2 border-b border-white/5">
            <div className="border-r border-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-low">Runtime</p>
              <p className="mt-1 font-mono text-xl text-brand-teal">{(elapsedMs / 1000).toFixed(1)}s</p>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-ink-low">Cost</p>
                <span className="rounded border border-brand-teal/30 px-1.5 py-0.5 font-mono text-[9px] text-brand-teal">XLM</span>
              </div>
              <p className="mt-1 font-mono text-xl text-brand-teal">{totalCostUsdc.toFixed(5)}</p>
            </div>
          </div>
          <p className="border-b border-white/5 px-4 py-1.5 text-[10px] text-ink-low/50">
            Stellar testnet · gas only · {totalCostUsdc.toFixed(6)} XLM
          </p>

          {/* Ledger feed */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <TxFeed sessionId={sessionId} />
          </div>

          {sessionId && (
            <div className="border-t border-white/5 px-4 py-2.5">
              <Link href={`/sessions/${sessionId}`} className="text-xs text-brand-teal hover:underline">
                View session receipts →
              </Link>
            </div>
          )}
        </aside>
      </div>

      {showNetworkModal && (
        <NetworkModal
          plan={plan}
          activeTaskIds={activeTaskIds}
          agentNames={agentNames}
          sessionId={sessionId}
          onClose={() => setShowNetworkModal(false)}
        />
      )}

      {/* ── PAYMENT APPROVAL MODAL ── */}
      {approvalRequired && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-bg-raised shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="border-b border-white/8 px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-low mb-1">Payment confirmation</p>
              <h2 className="text-base font-semibold text-ink-high">Approve agent payments?</h2>
              <p className="mt-1 text-xs text-ink-low">
                {approvalRequired.total_payments} payment{approvalRequired.total_payments !== 1 ? "s" : ""} ·{" "}
                <span className="font-mono text-brand-mint">{approvalRequired.total_xlm.toFixed(7)} XLM</span> total on Stellar testnet
              </p>
            </div>

            {/* Agent list */}
            <ul className="max-h-56 overflow-y-auto divide-y divide-white/5 px-0">
              {approvalRequired.agents.map((a) => (
                <li key={a.task_id} className="px-5 py-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-brand-teal">{a.capability}</span>
                      <span className="ml-2 text-ink-mid">{a.agent_name}</span>
                    </div>
                    <span className="font-mono text-brand-mint shrink-0">{a.amount_xlm.toFixed(7)} XLM</span>
                  </div>
                  {a.agent_address && (
                    <p className="mt-0.5 font-mono text-[10px] text-ink-low/60 truncate">{a.agent_address}</p>
                  )}
                  {a.sub_agent && (
                    <div className="mt-1.5 ml-3 border-l border-white/10 pl-2 flex items-center justify-between gap-2">
                      <span className="text-ink-low/70">↳ {a.sub_agent.capability} helper · {a.sub_agent.name}</span>
                      <span className="font-mono text-brand-mint/70 shrink-0">{a.sub_agent.amount_xlm.toFixed(7)} XLM</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="border-t border-white/8 flex gap-3 px-5 py-4">
              <button
                type="button"
                onClick={() => void handleApproval(true)}
                className="flex-1 rounded-lg bg-brand-mint/15 border border-brand-mint/30 py-2.5 text-sm font-semibold text-brand-mint hover:bg-brand-mint/25 transition-colors"
              >
                Approve &amp; Pay
              </button>
              <button
                type="button"
                onClick={() => void handleApproval(false)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-ink-low hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
