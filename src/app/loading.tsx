export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center animate-pulse">
          <span className="text-lg font-bold">₹</span>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
      </div>
    </div>
  );
}