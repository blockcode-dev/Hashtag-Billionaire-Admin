import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-app-bg px-4 text-center">
    <p className="text-sm font-semibold text-primary">404</p>
    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
    <p className="max-w-sm text-sm text-muted-foreground">
      The page you're looking for doesn't exist or has moved.
    </p>
    <Button asChild>
      <Link to="/dashboard">Go to dashboard</Link>
    </Button>
  </main>
);

export default NotFound;
