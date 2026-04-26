"use client";

import { Suspense } from "react";
import { AuthTabsWrapper } from "@/components/auth/AuthTabs";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthTabsWrapper initialTab="register" />
    </Suspense>
  );
}