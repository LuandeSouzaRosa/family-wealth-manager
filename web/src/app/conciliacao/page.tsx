import { CsvImporter } from '@/components/csv-importer'

export default function ConciliacaoPage() {
  return (
    <div className="container mx-auto py-10 space-y-8 px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-light tracking-tight text-foreground flex items-center gap-3">
          Conciliação <span className="font-semibold text-primary">Bancária</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Importe extratos bancários em formato CSV para agilizar o lançamento de despesas.
          O sistema tentará identificar automaticamente categorias e responsáveis.
        </p>
      </div>
      
      <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
        <CsvImporter />
      </div>
    </div>
  )
}
