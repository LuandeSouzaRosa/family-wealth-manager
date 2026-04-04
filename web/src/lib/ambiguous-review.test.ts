import { describe, expect, it } from 'vitest'
import { isAmbiguousReviewCandidate, isGenericPixDescription } from './ambiguous-review'

describe('isGenericPixDescription', () => {
  it('detecta pix curto e generico', () => {
    expect(isGenericPixDescription('PIX ENVIADO')).toBe(true)
    expect(isGenericPixDescription('transferencia pix conta pessoal')).toBe(true)
  })

  it('ignora descricao pix com contexto rico de contraparte', () => {
    expect(
      isGenericPixDescription(
        'Transferencia enviada pelo Pix - AMO SISTEMAS LTDA - 23.145.228/0001-75 - ITAU UNIBANCO'
      )
    ).toBe(false)
  })
})

describe('isAmbiguousReviewCandidate', () => {
  it('classifica Outros como ambiguo de revisao', () => {
    expect(
      isAmbiguousReviewCandidate({
        categoria: 'Outros',
        descricao: 'Compra avulsa',
        tipo: 'Saida',
        valor: 140,
      })
    ).toBe(true)
  })

  it('classifica pix generico como ambiguo mesmo fora de Outros', () => {
    expect(
      isAmbiguousReviewCandidate({
        categoria: 'Transporte',
        descricao: 'PIX ENVIADO',
        tipo: 'Saida',
        valor: 220,
      })
    ).toBe(true)
  })

  it('ignora entrada e valores nao positivos', () => {
    expect(
      isAmbiguousReviewCandidate({
        categoria: 'Outros',
        descricao: 'PIX ENVIADO',
        tipo: 'Entrada',
        valor: 220,
      })
    ).toBe(false)

    expect(
      isAmbiguousReviewCandidate({
        categoria: 'Outros',
        descricao: 'PIX ENVIADO',
        tipo: 'Saida',
        valor: 0,
      })
    ).toBe(false)
  })
})

