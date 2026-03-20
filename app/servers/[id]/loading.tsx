import { Skeleton } from "@/components/ui/skeleton";

export default function ServerDetailLoading() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-[200px] w-full" />
        </div>
      </main>
    </div>
  );
}
