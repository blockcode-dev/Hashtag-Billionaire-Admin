/** @format */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusTag } from "@/components/common/StatusTag";
import { GetAdminProfileAPI } from "@/services/Api/AuthApi";

interface Profile {
  name: string;
  email: string;
  admin_role?: { name?: string };
}

export default function AdminProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    GetAdminProfileAPI()
      .then((res) => {
        if (res.data?.success) setProfile(res.data.data);
        else setError(res.data?.message || "We couldn't load your profile.");
      })
      .catch((err) => setError(err.response?.data?.message || "We couldn't load your profile."));
  }, []);

  const initials = (profile?.name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Profile"
        description="Your admin account details."
        actions={
          <Button asChild variant="outline">
            <Link to="/change-password">
              <KeyRound />
              Change password
            </Link>
          </Button>
        }
      />

      <section className="rounded-xl border bg-card p-6 shadow-xs">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : !profile ? (
          <div className="flex items-center gap-4" aria-busy="true">
            <Skeleton className="size-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-lg font-semibold text-primary-soft-foreground ring-1 ring-primary-border">
              {initials}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">{profile.name}</h2>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4" />
                {profile.email}
              </p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4" />
                <StatusTag color="gold">{profile.admin_role?.name || "No role"}</StatusTag>
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
