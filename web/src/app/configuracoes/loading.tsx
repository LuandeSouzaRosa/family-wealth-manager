import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Main Card */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-6">
           <Skeleton className="h-12 w-full rounded-md" />
           <div className="space-y-3">
             <Skeleton className="h-10 w-full" />
             <Skeleton className="h-10 w-full" />
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
