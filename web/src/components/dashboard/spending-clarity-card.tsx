"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { AlertTriangle, TrendingUp } from "lucide-react";

interface TopCategory {
  categoria: string;
  total: number;
  percentual: number;
  lancamentos: number;
}

interface BiggestIncrease {
  categoria: string;
  delta: number;
}

interface SpendingClarityData {
  totalSaidasRealizadas: number;
  topCategorias: TopCategory[];
  concentracaoTop3Percentual: number;
  totalRecorrente: number;
  totalPontual: number;
  percentualRecorrente: number;
  percentualPontual: number;
  maiorAltaVsMesAnterior: BiggestIncrease | null;
}

interface SpendingClarityCardProps {
  data: SpendingClarityData;
  responsavel: string;
  compact?: boolean;
  totalSaidasRealizadasTodos?: number;
  transacoesHref?: string;
}

type PrimaryInsight = {
  title: string;
  message: string;
};

type EvidenceStrength = "alta" | "moderada" | "baixa";

type EvidenceCalibration = {
  strength: EvidenceStrength;
  label: string;
  message: string;
};

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isGenericCategory(categoria: string): boolean {
  const normalized = normalizeLabel(categoria);
  return normalized === "outros" || normalized === "sem categoria";
}

function isGenericLeader(data: SpendingClarityData): boolean {
  if (data.topCategorias.length === 0) return false;

  const categoriaLider = data.topCategorias[0];
  const liderGenerica = isGenericCategory(categoriaLider.categoria);

  return liderGenerica && categoriaLider.percentual >= 60;
}

function buildEvidenceCalibration(data: SpendingClarityData): EvidenceCalibration {
  if (data.totalSaidasRealizadas <= 0 || data.topCategorias.length === 0) {
    return {
      strength: "baixa",
      label: "Baixa",
      message: "Nao ha saidas suficientes no recorte atual para sustentar um insight forte.",
    };
  }

  const categoriaLider = data.topCategorias[0];
  const genericShareTop = data.topCategorias
    .filter((item) => isGenericCategory(item.categoria))
    .reduce((acc, item) => acc + item.percentual, 0);

  const reasons: string[] = [];
  if (isGenericLeader(data)) reasons.push("a categoria lider ainda e generica");
  if (genericShareTop >= 40) reasons.push(`categorias genericas somam ${genericShareTop.toFixed(0)}% do top 3`);
  if (categoriaLider.lancamentos < 2) reasons.push(`a categoria lider tem apenas ${categoriaLider.lancamentos} lancamento(s)`);
  if (categoriaLider.percentual < 25) reasons.push(`a categoria lider representa ${categoriaLider.percentual.toFixed(0)}% das saidas`);

  if (reasons.length > 0) {
    return {
      strength: "baixa",
      label: "Baixa",
      message: `Leitura preliminar: ${reasons.join("; ")}.`,
    };
  }

  if (categoriaLider.lancamentos >= 3 && categoriaLider.percentual >= 40 && genericShareTop < 20) {
    return {
      strength: "alta",
      label: "Alta",
      message: `Categoria lider com boa sustentacao (${categoriaLider.lancamentos} lancamentos e ${categoriaLider.percentual.toFixed(0)}% das saidas).`,
    };
  }

  return {
    strength: "moderada",
    label: "Moderada",
    message: "A direcao principal esta visivel, mas vale validar os lancamentos no extrato antes de decidir corte.",
  };
}

function buildPrimaryInsight(data: SpendingClarityData): PrimaryInsight {
  if (data.topCategorias.length === 0) {
    return {
      title: "Sem pressao de gasto",
      message: "Nao houve saidas realizadas no filtro atual.",
    };
  }

  if (isGenericLeader(data)) {
    const categoriaLider = data.topCategorias[0];
    return {
      title: "Classificacao ainda generica",
      message: `Grande parte das saidas esta em \"${categoriaLider.categoria}\". Classificar os principais lancamentos deixa o insight mais confiavel.`,
    };
  }

  if (data.concentracaoTop3Percentual >= 70) {
    return {
      title: "Gasto concentrado",
      message: `Top 3 categorias concentram ${data.concentracaoTop3Percentual.toFixed(0)}% das saidas. Revisar essas categorias tende a gerar maior impacto.`,
    };
  }

  if (data.maiorAltaVsMesAnterior) {
    return {
      title: "Maior alta do mes",
      message: `${data.maiorAltaVsMesAnterior.categoria} subiu ${formatCurrency(data.maiorAltaVsMesAnterior.delta)} vs mes anterior. Revisar essa categoria primeiro reduz o desvio mais rapido.`,
    };
  }

  if (data.percentualPontual >= 40) {
    return {
      title: "Peso de gastos pontuais",
      message: "Parte relevante do gasto foi pontual. Revise lancamentos excepcionais antes de criar regra fixa.",
    };
  }

  return {
    title: "Gasto espalhado",
    message: "O gasto esta distribuido. Priorize a categoria lider e as duas seguintes para controle semanal rapido.",
  };
}

function buildControlHint(data: SpendingClarityData): string {
  if (data.topCategorias.length === 0) {
    return "Sem acao necessaria neste recorte.";
  }

  if (isGenericLeader(data)) {
    const categoriaLider = data.topCategorias[0];
    return `Revise no extrato os maiores lancamentos em \"${categoriaLider.categoria}\" e recategorize os mais relevantes.`;
  }

  if (data.concentracaoTop3Percentual >= 70) {
    return "Revise agora as 3 categorias lideres no extrato e corte pelo menos 1 item de cada.";
  }

  if (data.maiorAltaVsMesAnterior) {
    return `Comece pela categoria ${data.maiorAltaVsMesAnterior.categoria} para reduzir o desvio mais rapido.`;
  }

  if (data.percentualPontual >= 40) {
    return "Filtre lancamentos pontuais no extrato e valide o que nao vai se repetir.";
  }

  return "Revise semanalmente as 3 categorias lideres para manter o mes sob controle.";
}

function buildLeaderReviewHref(baseHref: string, categoriaLider?: string): string {
  const categoria = categoriaLider?.trim();
  if (!categoria) return baseHref;

  const url = new URL(baseHref, "http://fwm.local");
  url.searchParams.set("category", categoria);
  url.searchParams.set("sort", "value_desc");

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildActionTitle(evidence: EvidenceCalibration): string {
  if (evidence.strength === "alta") return "Ajuste sugerido de maior impacto";
  if (evidence.strength === "moderada") return "Ajuste sugerido (confirmar no extrato)";
  return "Sugestao preliminar (baixa confianca)";
}

function buildActionHint(hint: string, evidence: EvidenceCalibration): string {
  if (evidence.strength === "alta") return hint;
  if (evidence.strength === "moderada") return `${hint} Confirme as linhas de maior valor antes de decidir.`;
  return `${hint} Trate como triagem inicial e valide no extrato antes de agir.`;
}

export function SpendingClarityCard({
  data,
  responsavel,
  compact = false,
  totalSaidasRealizadasTodos = 0,
  transacoesHref,
}: SpendingClarityCardProps) {
  const now = new Date();
  const defaultTransacoesHref = `/transacoes?month=${now.getMonth() + 1}&year=${now.getFullYear()}`;
  const targetTransacoesHref = transacoesHref || defaultTransacoesHref;
  const hint = buildControlHint(data);
  const primaryInsight = buildPrimaryInsight(data);
  const evidence = buildEvidenceCalibration(data);
  const categoriaLider = data.topCategorias[0] ?? null;
  const reviewHref = buildLeaderReviewHref(targetTransacoesHref, categoriaLider?.categoria);
  const actionTitle = buildActionTitle(evidence);
  const actionHint = buildActionHint(hint, evidence);
  const hasOtherScopeMovement =
    data.totalSaidasRealizadas <= 0 &&
    totalSaidasRealizadasTodos > 0 &&
    responsavel !== "Todos";

  return (
    <Card className="border border-border/50 shadow-sm bg-card">
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Onde esta pesando no mes
        </CardTitle>
        <CardDescription>
          Saidas realizadas ({responsavel})
        </CardDescription>
      </CardHeader>
      <CardContent className={compact ? "space-y-3" : "space-y-4"}>
        {data.totalSaidasRealizadas <= 0 ? (
          hasOtherScopeMovement ? (
            <p className="text-sm text-muted-foreground">
              Ja houve saidas realizadas no mes, mas nao neste filtro de responsavel. Ajuste o filtro ou revise a classificacao no extrato.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nao houve saidas realizadas neste recorte.</p>
          )
        ) : (
          <>
            <div className="rounded-lg border border-border/60 p-3 bg-muted/20 space-y-1 text-sm">
              <p>
                Total de saidas realizadas: <strong>{formatCurrency(data.totalSaidasRealizadas)}</strong>.
              </p>
              {categoriaLider ? (
                <p>
                  Categoria lider do mes: <strong>{categoriaLider.categoria}</strong> ({formatCurrency(categoriaLider.total)}, {categoriaLider.percentual.toFixed(0)}%).
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm space-y-1">
              <p className="font-medium">{primaryInsight.title}</p>
              <p className="text-muted-foreground">{primaryInsight.message}</p>
            </div>

            <div className="rounded-lg border border-border/60 p-3 bg-muted/20 text-sm" data-testid="spending-clarity-evidence-strength">
              <p className="font-medium">
                Confianca do insight: <strong>{evidence.label}</strong>
              </p>
              <p className="text-muted-foreground mt-1">{evidence.message}</p>
            </div>

            <div className="space-y-2">
              {data.topCategorias.map((item, index) => (
                <div key={`${item.categoria}-${index}`} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-xs text-muted-foreground">{index + 1}.</span>
                    <span className="font-medium">{item.categoria}</span>
                    <span className="text-xs text-muted-foreground">({item.lancamentos} lanc.)</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium tabular-nums">{formatCurrency(item.total)}</div>
                    <div className="text-xs text-muted-foreground">{item.percentual.toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border/60 p-3 bg-muted/20 space-y-2 text-sm">
              <p>Concentracao top 3: <strong>{data.concentracaoTop3Percentual.toFixed(0)}%</strong>.</p>
              {data.maiorAltaVsMesAnterior ? (
                <p className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-red-500" />
                  Maior alta vs mes anterior: <strong>{data.maiorAltaVsMesAnterior.categoria}</strong> (+{formatCurrency(data.maiorAltaVsMesAnterior.delta)}).
                </p>
              ) : (
                <p className="text-muted-foreground">Sem alta de categoria vs mes anterior para este filtro.</p>
              )}
              <p>
                Recorrente x pontual: <strong>{formatCurrency(data.totalRecorrente)}</strong> ({data.percentualRecorrente.toFixed(0)}%) vs{" "}
                <strong>{formatCurrency(data.totalPontual)}</strong> ({data.percentualPontual.toFixed(0)}%).
              </p>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-medium mb-1">{actionTitle}</p>
              <p className="text-muted-foreground">{actionHint}</p>
            </div>
          </>
        )}

        <div className="pt-1">
          <Link href={reviewHref}>
            <Button variant="outline" size="sm">
              Revisar no extrato
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
