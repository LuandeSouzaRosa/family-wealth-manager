"use client"

import { useFilter } from "@/contexts/filter-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, User, UserCheck, Heart } from "lucide-react"

export function ResponsavelSelector() {
  const { responsavel, setResponsavel } = useFilter()

  return (
    <div className="flex items-center gap-2">
        <Select value={responsavel} onValueChange={(val: any) => setResponsavel(val)}>
            <SelectTrigger className="w-[140px] h-12 bg-background/50 border-transparent shadow-none text-sm font-medium focus:ring-0 hover:bg-background/80 transition-colors">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-full bg-secondary">
                        {responsavel === "Todos" && <Users className="w-4 h-4 text-foreground" />}
                        {responsavel === "Luan" && <User className="w-4 h-4 text-blue-500" />}
                        {responsavel === "Luana" && <UserCheck className="w-4 h-4 text-pink-500" />}
                        {responsavel === "Casal" && <Heart className="w-4 h-4 text-rose-500" />}
                    </div>
                    <span>{responsavel}</span>
                </div>
            </SelectTrigger>
            <SelectContent align="end" className="w-[160px]">
                <SelectItem value="Todos">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>Todos</span>
                    </div>
                </SelectItem>
                <SelectItem value="Luan">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        <span>Luan</span>
                    </div>
                </SelectItem>
                <SelectItem value="Luana">
                    <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-pink-500" />
                        <span>Luana</span>
                    </div>
                </SelectItem>
                <SelectItem value="Casal">
                    <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-500" />
                        <span>Casal</span>
                    </div>
                </SelectItem>
            </SelectContent>
        </Select>
    </div>
  )
}