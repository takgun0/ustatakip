"use client";

import type { ReactNode } from "react";
import { BusinessProvider, initials, useBusiness } from "@/lib/business";
import { AppHeader, AppHeaderSkeleton } from "@/components/ui/AppHeader";
import { ErrorState, LoadingRegion, Skeleton } from "@/components/ui/States";

function Shell({ children }: { children: ReactNode }) {
  const { business, signOut } = useBusiness();
  return (
    <div className="min-h-dvh bg-ut-bg text-ut-text">
      <AppHeader businessName={business.name} initialsText={initials(business.name)} onSignOut={signOut} />
      {children}
    </div>
  );
}

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <BusinessProvider
      fallback={
        <div className="min-h-dvh bg-ut-bg">
          <AppHeaderSkeleton />
          <LoadingRegion label="Oturum kontrol ediliyor…" className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 py-7">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </LoadingRegion>
        </div>
      }
      errorView={(message, retry) => (
        <div className="min-h-dvh bg-ut-bg">
          <AppHeaderSkeleton />
          <main className="mx-auto max-w-[1200px] px-6 py-7">
            <ErrorState title="Panel açılamadı" description={message} onRetry={retry} />
          </main>
        </div>
      )}
    >
      <Shell>{children}</Shell>
    </BusinessProvider>
  );
}
