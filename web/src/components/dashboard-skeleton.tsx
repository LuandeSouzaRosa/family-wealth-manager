import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-transparent space-y-8 pb-24" data-testid="dashboard-loading">
      
      {/* Hero Section Skeleton */}
      <div className="px-6 py-12 md:py-20 max-w-5xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        <div className="space-y-4 w-full max-w-lg">
          <Skeleton className="h-12 w-3/4 rounded-lg" />
          <Skeleton className="h-6 w-1/2 rounded-lg" />
        </div>
        <Skeleton className="h-12 w-40 rounded-full" />
      </div>

      {/* Main Content Skeleton */}
      <div className="px-6 max-w-7xl mx-auto space-y-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-full border border-white/5 bg-card/60">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-32 mb-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts & List Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
          
          {/* Chart Area */}
          <Card className="md:col-span-2 border-0 bg-white/5 h-[400px]">
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="flex items-center justify-center h-[300px]">
              <Skeleton className="h-64 w-64 rounded-full" />
            </CardContent>
          </Card>

          {/* Recent Transactions List */}
          <Card className="border border-white/5 bg-card/50 h-[400px]">
            <CardHeader>
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
