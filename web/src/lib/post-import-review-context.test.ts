import { describe, expect, it } from 'vitest'
import { buildPostImportReviewContext } from './post-import-review-context'

describe('buildPostImportReviewContext', () => {
  it('retorna reviewHref nulo quando nao ha linhas em Outros', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Alimentacao', valor: 120, data: '2026-03-10T12:00:00.000Z', tipo: 'Saida' },
    ])

    expect(result.outrosRows).toBe(0)
    expect(result.outrosValue).toBe(0)
    expect(result.reviewHref).toBeNull()
    expect(result.ambiguousRows).toBe(0)
    expect(result.ambiguousValue).toBe(0)
    expect(result.ambiguousReviewHref).toBeNull()
    expect(result.periodSummary.mode).toBe('consumption_focus')
    expect(result.periodSummary.totalConsumptionValue).toBe(120)
    expect(result.periodSummary.totalNonConsumptionValue).toBe(0)
    expect(result.periodSummary.attentionCategory).toBe('Alimentacao')
    expect(result.periodSummary.leaderReviewHref).toBe('/transacoes?month=3&year=2026&category=Alimentacao&sort=value_desc')
    expect(result.consolidatedSummary.coverage.status).toBe('unknown')
    expect(result.consolidatedSummary.views).toHaveLength(3)
    expect(result.periodPriorities.target).toBe('Casal')
    expect(result.periodPriorities.primaryAttention.text).toContain('Alimentacao')
    expect(result.periodPriorities.confidenceLimiter?.text).toContain('cobertura do casal ainda nao confirmada')
    expect(result.periodPriorities.nextAction.actionHref).toBe('/transacoes?month=3&year=2026&sort=value_desc')
    expect(result.periodReviewHref).toBe('/transacoes?month=3&year=2026&sort=value_desc')
    expect(result.periodLabel).toBe('03/2026')
  })

  it('gera deep-link com mes/ano explicitos quando lote esta no mesmo mes', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Outros', valor: 300, data: '2026-03-01T00:00:00.000Z', tipo: 'Saida' },
      { categoria: 'Sem categoria', valor: 50, data: '2026-03-20T00:00:00.000Z', tipo: 'Saida' },
      { categoria: 'Transporte', valor: 80, data: '2026-03-05T00:00:00.000Z', tipo: 'Saida' },
    ])

    expect(result.outrosRows).toBe(2)
    expect(result.outrosValue).toBe(350)
    expect(result.reviewHref).toBe('/transacoes?month=3&year=2026&category=Outros&sort=value_desc')
    expect(result.ambiguousRows).toBe(2)
    expect(result.ambiguousValue).toBe(350)
    expect(result.ambiguousReviewHref).toBe('/transacoes?month=3&year=2026&review=ambiguous&sort=value_desc')
    expect(result.periodSummary.mode).toBe('consumption_focus')
    expect(result.periodSummary.totalConsumptionValue).toBe(430)
    expect(result.periodSummary.totalNonConsumptionValue).toBe(0)
    expect(result.periodSummary.topConsumptionCategories[0]?.categoria).toBe('Outros')
    expect(result.consolidatedSummary.views.find((view) => view.responsavel === 'Casal')?.attentionCategory).toBe('Outros')
    expect(result.periodReviewHref).toBe('/transacoes?month=3&year=2026&sort=value_desc')
    expect(result.periodLabel).toBe('03/2026')
  })

  it('inclui pix generico na revisao ambigua mesmo fora de categoria generica', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Transporte', descricao: 'PIX ENVIADO', valor: 480, data: '2026-03-03T00:00:00.000Z', tipo: 'Saida' },
      { categoria: 'Moradia', descricao: 'Condominio', valor: 900, data: '2026-03-10T00:00:00.000Z', tipo: 'Saida' },
    ])

    expect(result.outrosRows).toBe(0)
    expect(result.reviewHref).toBeNull()
    expect(result.ambiguousRows).toBe(1)
    expect(result.ambiguousValue).toBe(480)
    expect(result.ambiguousReviewHref).toBe('/transacoes?month=3&year=2026&review=ambiguous&sort=value_desc')
    expect(result.periodSummary.mode).toBe('consumption_focus')
    expect(result.periodSummary.totalConsumptionValue).toBe(1380)
    expect(result.periodSummary.topConsumptionCategories[0]?.categoria).toBe('Moradia')
  })

  it('abre ano inteiro quando lote cobre varios meses no mesmo ano', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Outros', valor: 100, data: '2026-03-05T00:00:00.000Z', tipo: 'Saida' },
      { categoria: 'Outros', valor: 200, data: '2026-04-10T00:00:00.000Z', tipo: 'Saida' },
    ])

    expect(result.reviewHref).toBe('/transacoes?month=0&year=2026&category=Outros&sort=value_desc')
    expect(result.ambiguousReviewHref).toBe('/transacoes?month=0&year=2026&review=ambiguous&sort=value_desc')
    expect(result.periodReviewHref).toBe('/transacoes?month=0&year=2026&sort=value_desc')
    expect(result.periodLabel).toBe('ano 2026')
  })

  it('abre recorte global quando lote cobre mais de um ano', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Outros', valor: 100, data: '2025-12-31T00:00:00.000Z', tipo: 'Saida' },
      { categoria: 'Outros', valor: 200, data: '2026-01-01T00:00:00.000Z', tipo: 'Saida' },
    ])

    expect(result.reviewHref).toBe('/transacoes?month=0&year=0&category=Outros&sort=value_desc')
    expect(result.ambiguousReviewHref).toBe('/transacoes?month=0&year=0&review=ambiguous&sort=value_desc')
    expect(result.periodReviewHref).toBe('/transacoes?month=0&year=0&sort=value_desc')
    expect(result.periodLabel).toBe('todos os anos')
  })

  it('sinaliza periodo dominado por movimentacao financeira quando sobra zero consumo real', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Fatura Cartao', valor: 2000, data: '2026-03-04T00:00:00.000Z', tipo: 'Saida' },
      { categoria: 'Investimentos', valor: 900, data: '2026-03-09T00:00:00.000Z', tipo: 'Saida' },
    ])

    expect(result.periodSummary.mode).toBe('non_consumption_dominant')
    expect(result.periodSummary.totalConsumptionValue).toBe(0)
    expect(result.periodSummary.totalNonConsumptionValue).toBe(2900)
    expect(result.periodSummary.topConsumptionCategories).toHaveLength(0)
    expect(result.periodSummary.attentionCategory).toBeNull()
    expect(result.periodSummary.leaderReviewHref).toBeNull()
  })

  it('consolida por periodo persistido e sinaliza cobertura parcial/ready por responsavel', () => {
    const result = buildPostImportReviewContext(
      [
        { categoria: 'Outros', valor: 120, data: '2026-03-11T00:00:00.000Z', tipo: 'Saida', responsavel: 'Luan' },
      ],
      [
        { categoria: 'Moradia', valor: 700, data: '2026-03-02T00:00:00.000Z', tipo: 'Saida', responsavel: 'Luan', origem: 'Importação', status: 'Realizado' },
        { categoria: 'Transporte', valor: 320, data: '2026-03-03T00:00:00.000Z', tipo: 'Saida', responsavel: 'Luana', origem: 'Importação', status: 'Realizado' },
        { categoria: 'Fatura Cartao', valor: 1100, data: '2026-03-04T00:00:00.000Z', tipo: 'Saida', responsavel: 'Casal', origem: 'Importação', status: 'Realizado' },
      ]
    )

    expect(result.periodSummary.totalConsumptionValue).toBe(1020)
    expect(result.periodSummary.totalNonConsumptionValue).toBe(1100)

    expect(result.consolidatedSummary.coverage.status).toBe('ready')
    expect(result.consolidatedSummary.coverage.importedResponsaveis).toEqual(
      expect.arrayContaining(['Luan', 'Luana', 'Casal'])
    )

    const luan = result.consolidatedSummary.views.find((view) => view.responsavel === 'Luan')
    expect(luan?.attentionCategory).toBe('Moradia')
    expect(luan?.leaderReviewHref).toBe('/transacoes?month=3&year=2026&category=Moradia&sort=value_desc&responsavel=Luan')

    const casal = result.consolidatedSummary.views.find((view) => view.responsavel === 'Casal')
    expect(casal?.mode).toBe('non_consumption_dominant')
    expect(casal?.totalNonConsumptionValue).toBe(1100)
    expect(result.periodPriorities.target).toBe('Luan')
    expect(result.periodPriorities.primaryAttention.actionHref).toBe(
      '/transacoes?month=3&year=2026&category=Moradia&sort=value_desc&responsavel=Luan'
    )
    expect(result.periodPriorities.confidenceLimiter).toBeNull()
    expect(result.periodPriorities.nextAction.actionHref).toBe(
      '/transacoes?month=3&year=2026&category=Moradia&sort=value_desc&responsavel=Luan'
    )
  })

  it('prioriza completar cobertura quando leitura do casal esta parcial', () => {
    const result = buildPostImportReviewContext(
      [
        { categoria: 'Moradia', valor: 700, data: '2026-03-02T00:00:00.000Z', tipo: 'Saida', responsavel: 'Luan' },
      ],
      [
        { categoria: 'Moradia', valor: 700, data: '2026-03-02T00:00:00.000Z', tipo: 'Saida', responsavel: 'Luan', origem: 'Importacao', status: 'Realizado' },
      ]
    )

    expect(result.consolidatedSummary.coverage.status).toBe('partial')
    expect(result.periodPriorities.confidenceLimiter?.actionHref).toBe('/conciliacao')
    expect(result.periodPriorities.nextAction.actionHref).toBe('/conciliacao')
    expect(result.periodPriorities.nextAction.text).toContain('completar a visao consolidada do casal')
  })

  it('prioriza revisao ambigua quando valor ambiguo relevante persiste', () => {
    const result = buildPostImportReviewContext(
      [
        { categoria: 'Moradia', valor: 950, data: '2026-03-02T00:00:00.000Z', tipo: 'Saida', responsavel: 'Casal' },
        { categoria: 'Outros', descricao: 'PIX ENVIADO', valor: 420, data: '2026-03-03T00:00:00.000Z', tipo: 'Saida', responsavel: 'Casal' },
      ],
      [
        { categoria: 'Moradia', valor: 950, data: '2026-03-02T00:00:00.000Z', tipo: 'Saida', responsavel: 'Casal', origem: 'Importacao', status: 'Realizado' },
        { categoria: 'Outros', descricao: 'PIX ENVIADO', valor: 420, data: '2026-03-03T00:00:00.000Z', tipo: 'Saida', responsavel: 'Casal', origem: 'Importacao', status: 'Realizado' },
      ]
    )

    expect(result.consolidatedSummary.coverage.status).toBe('ready')
    expect(result.periodPriorities.confidenceLimiter?.actionHref).toBe('/transacoes?month=3&year=2026&review=ambiguous&sort=value_desc&responsavel=Casal')
    expect(result.periodPriorities.nextAction.actionHref).toBe('/transacoes?month=3&year=2026&review=ambiguous&sort=value_desc&responsavel=Casal')
    expect(result.periodPriorities.nextAction.text).toContain('revisar primeiro os ambiguos de maior impacto')
  })
})
