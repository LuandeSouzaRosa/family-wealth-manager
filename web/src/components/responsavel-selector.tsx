"use client"

import { useFilter } from "@/contexts/filter-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, User, UserCheck } from "lucide-react"

export function ResponsavelSelector() {
  const { responsavel, setResponsavel } = useFilter()

  return (
    <div className="flex items-center gap-2">
        <Select value={responsavel} onValueChange={(val: any) => setResponsavel(val)}>
            <SelectTrigger className="w-[130px] h-9 bg-background/50 border-border/50 text-xs font-medium focus:ring-primary/20">
                <div className="flex items-center gap-2">
                    {responsavel === "Todos" && <Users className="w-3.5 h-3.5 text-muted-foreground" />}
                    {responsavel === "Luan" && <User className="w-3.5 h-3.5 text-blue-500" />}
                    {responsavel === "Esposa" && <UserCheck className="w-3.5 h-3.5 text-pink-500" />}
                    <SelectValue />
                </div>
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Luan">Luan</SelectItem>
                <SelectItem value="Esposa">Esposa</SelectItem>
            </SelectContent>
        </Select>
    </div>
  )
}