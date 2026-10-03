import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md space-y-4">
        <div className="mx-auto size-14 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center">
          <Compass className="size-7" />
        </div>
        <div>
          <p className="text-sm font-mono text-muted-foreground">404</p>
          <h1 className="text-2xl font-bold mt-1">Page not found</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}