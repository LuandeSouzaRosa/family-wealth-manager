import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 rounded-lg bg-muted/50" />
        <Skeleton className="h-6 w-96 rounded-md bg-muted/30" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-border/50 bg-card/50">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32 mb-2 bg-muted/40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-48 bg-muted/50" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Skeleton */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-6">
          <Skeleton className="h-[300px] w-full rounded-xl bg-muted/20" />
        </CardContent>
      </Card>
    </div>
  )
}
