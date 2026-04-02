import { describe, expect, it } from 'vitest'
import { buildPostImportReviewContext } from './post-import-review-context'

describe('buildPostImportReviewContext', () => {
  it('retorna reviewHref nulo quando nao ha linhas em Outros', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Alimentacao', valor: 120, data: '2026-03-10T12:00:00.000Z' },
    ])

    expect(result.outrosRows).toBe(0)
    expect(result.outrosValue).toBe(0)
    expect(result.reviewHref).toBeNull()
    expect(result.periodReviewHref).toBe('/transacoes?month=3&year=2026&sort=value_desc')
    expect(result.periodLabel).toBe('03/2026')
  })

  it('gera deep-link com mes/ano explicitos quando lote esta no mesmo mes', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Outros', valor: 300, data: '2026-03-01T00:00:00.000Z' },
      { categoria: 'Sem categoria', valor: 50, data: '2026-03-20T00:00:00.000Z' },
      { categoria: 'Transporte', valor: 80, data: '2026-03-05T00:00:00.000Z' },
    ])

    expect(result.outrosRows).toBe(2)
    expect(result.outrosValue).toBe(350)
    expect(result.reviewHref).toBe('/transacoes?month=3&year=2026&category=Outros&sort=value_desc')
    expect(result.periodReviewHref).toBe('/transacoes?month=3&year=2026&sort=value_desc')
    expect(result.periodLabel).toBe('03/2026')
  })

  it('abre ano inteiro quando lote cobre varios meses no mesmo ano', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Outros', valor: 100, data: '2026-03-05T00:00:00.000Z' },
      { categoria: 'Outros', valor: 200, data: '2026-04-10T00:00:00.000Z' },
    ])

    expect(result.reviewHref).toBe('/transacoes?month=0&year=2026&category=Outros&sort=value_desc')
    expect(result.periodReviewHref).toBe('/transacoes?month=0&year=2026&sort=value_desc')
    expect(result.periodLabel).toBe('ano 2026')
  })

  it('abre recorte global quando lote cobre mais de um ano', () => {
    const result = buildPostImportReviewContext([
      { categoria: 'Outros', valor: 100, data: '2025-12-31T00:00:00.000Z' },
      { categoria: 'Outros', valor: 200, data: '2026-01-01T00:00:00.000Z' },
    ])

    expect(result.reviewHref).toBe('/transacoes?month=0&year=0&category=Outros&sort=value_desc')
    expect(result.periodReviewHref).toBe('/transacoes?month=0&year=0&sort=value_desc')
    expect(result.periodLabel).toBe('todos os anos')
  })
})
