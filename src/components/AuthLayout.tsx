import type { ReactNode } from "react";
import logoFull from "@/assets/logo.webp";

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  // Shown under the card, e.g. a "Back to sign in" link.
  footer?: ReactNode;
}

// Shared frame for the signed-out screens: sign in, forgot and reset password.
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-app-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <img src={logoFull} alt="Hashtag Billionaire" className="mx-auto mb-8 h-11 w-auto" />
        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}
