"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { connectFreighter } from "@/lib/stellar/freighter";

type AuthKind = "wallet" | "passkey";

export type AuthSession = {
  kind: AuthKind;
  subject: string;
  label: string;
  createdAt: string;
};

type StoredPasskey = {
  id: string;
  name: string;
  createdAt: string;
};

type AuthContextValue = {
  loading: boolean;
  session: AuthSession | null;
  loginWithFreighter: () => Promise<AuthSession>;
  registerPasskey: (label: string) => Promise<AuthSession>;
  loginWithPasskey: () => Promise<AuthSession>;
  logout: () => void;
};

const AUTH_STORAGE_KEY = "synapse.auth.session";
const PASSKEY_STORAGE_KEY = "synapse.auth.passkeys";

const AuthContext = createContext<AuthContextValue | null>(null);

function randomChallenge(length = 32): ArrayBuffer {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function bytesToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBuffer(input: string): ArrayBuffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function readStoredPasskeys(): StoredPasskey[] {
  try {
    const raw = localStorage.getItem(PASSKEY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPasskey[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredPasskeys(passkeys: StoredPasskey[]) {
  localStorage.setItem(PASSKEY_STORAGE_KEY, JSON.stringify(passkeys));
}

function persistSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) {
        setSession(JSON.parse(raw) as AuthSession);
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSession = useCallback((nextSession: AuthSession | null) => {
    setSession(nextSession);
    persistSession(nextSession);
  }, []);

  const loginWithFreighter = useCallback(async () => {
    const address = await connectFreighter();
    const nextSession: AuthSession = {
      kind: "wallet",
      subject: address,
      label: address,
      createdAt: new Date().toISOString(),
    };
    updateSession(nextSession);
    return nextSession;
  }, [updateSession]);

  const registerPasskey = useCallback(async (label: string) => {
    if (!window.PublicKeyCredential || !navigator.credentials?.create) {
      throw new Error("Passkeys are not supported in this browser.");
    }

    const displayName = label.trim() || "Synapse operator";
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: "Synapse" },
        user: {
          id: randomChallenge(),
          name: displayName,
          displayName,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        timeout: 60_000,
        attestation: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      },
    });

    if (!(credential instanceof PublicKeyCredential)) {
      throw new Error("Passkey creation did not return a credential.");
    }

    const id = bytesToBase64Url(credential.rawId);
    const passkeys = readStoredPasskeys();
    const nextPasskeys = [
      ...passkeys.filter((item) => item.id !== id),
      { id, name: displayName, createdAt: new Date().toISOString() },
    ];
    writeStoredPasskeys(nextPasskeys);

    const nextSession: AuthSession = {
      kind: "passkey",
      subject: `passkey:${id}`,
      label: displayName,
      createdAt: new Date().toISOString(),
    };
    updateSession(nextSession);
    return nextSession;
  }, [updateSession]);

  const loginWithPasskey = useCallback(async () => {
    if (!window.PublicKeyCredential || !navigator.credentials?.get) {
      throw new Error("Passkeys are not supported in this browser.");
    }

    const passkeys = readStoredPasskeys();
    if (passkeys.length === 0) {
      throw new Error("No passkey is registered on this device yet.");
    }

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: passkeys.map((item) => ({
          id: base64UrlToBuffer(item.id),
          type: "public-key" as const,
        })),
        userVerification: "preferred",
        timeout: 60_000,
      },
    });

    if (!(assertion instanceof PublicKeyCredential)) {
      throw new Error("Passkey verification did not return a credential.");
    }

    const id = bytesToBase64Url(assertion.rawId);
    const match = passkeys.find((item) => item.id === id);
    if (!match) {
      throw new Error("Passkey is not registered in this browser profile.");
    }

    const nextSession: AuthSession = {
      kind: "passkey",
      subject: `passkey:${match.id}`,
      label: match.name,
      createdAt: new Date().toISOString(),
    };
    updateSession(nextSession);
    return nextSession;
  }, [updateSession]);

  const logout = useCallback(() => {
    updateSession(null);
  }, [updateSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      loginWithFreighter,
      registerPasskey,
      loginWithPasskey,
      logout,
    }),
    [loading, session, loginWithFreighter, registerPasskey, loginWithPasskey, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within <AuthProvider>.");
  }
  return context;
}
