/** @format */

import { Link } from "react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shown inside the app shell when a page needs a role this admin doesn't have.
const UnauthorizedPage = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
    <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Lock className="size-5" />
    </span>
    <h1 className="text-2xl font-semibold tracking-tight text-foreground">You don't have access</h1>
    <p className="max-w-md text-sm text-muted-foreground">
      This page is for Super Admins. Ask one of them if you need access.
    </p>
    <Button asChild variant="outline">
      <Link to="/dashboard">Go to dashboard</Link>
    </Button>
  </div>
);

export default UnauthorizedPage;
