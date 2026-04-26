"use client";

import { Suspense } from "react";
import { AuthTabsWrapper } from "@/components/auth/AuthTabs";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthTabsWrapper initialTab="login" />
    </Suspense>
  );
}