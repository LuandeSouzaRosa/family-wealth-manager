import { describe, it, expect } from 'vitest'

// ==========================================
// 1. Lógica de Filtro de Responsável
// ==========================================
function shouldShow(itemResponsavel: string, filtro: string) {
  if (filtro === "Todos") return true
  return itemResponsavel?.toLowerCase() === filtro.toLowerCase()
}

describe('Filtro de Responsável', () => {
  it('deve mostrar tudo quando filtro é "Todos"', () => {
    expect(shouldShow("Luan", "Todos")).toBe(true)
    expect(shouldShow("Esposa", "Todos")).toBe(true)
  })

  it('deve filtrar corretamente por nome (case insensitive)', () => {
    expect(shouldShow("Luan", "Luan")).toBe(true)
    expect(shouldShow("luan", "Luan")).toBe(true) // Teste de case
    expect(shouldShow("Esposa", "Luan")).toBe(false)
  })

  it('deve lidar com responsáveis nulos ou indefinidos', () => {
    expect(shouldShow(undefined as any, "Luan")).toBe(false)
    expect(shouldShow(null as any, "Todos")).toBe(true)
  })
})

// ==========================================
// 2. Lógica de Categorização Inteligente
// ==========================================
type Regra = { texto_contem: string, categoria_destino: string }

function aplicarRegras(descricao: string, regras: Regra[]) {
  const regra = regras.find(r => descricao.toLowerCase().includes(r.texto_contem.toLowerCase()))
  return regra ? regra.categoria_destino : "Outros"
}

describe('Categorização Inteligente', () => {
  const regrasMock = [
    { texto_contem: "Uber", categoria_destino: "Transporte" },
    { texto_contem: "Ifood", categoria_destino: "Alimentação" },
    { texto_contem: "Netflix", categoria_destino: "Lazer" }
  ]

  it('deve categorizar com base na palavra-chave exata', () => {
    expect(aplicarRegras("Pagamento Uber * Viagem", regrasMock)).toBe("Transporte")
  })

  it('deve categorizar ignorando maiúsculas/minúsculas', () => {
    expect(aplicarRegras("compra ifood sp", regrasMock)).toBe("Alimentação")
  })

  it('deve retornar "Outros" quando nenhuma regra bater', () => {
    expect(aplicarRegras("Compra Padaria da Esquina", regrasMock)).toBe("Outros")
  })

  it('deve priorizar a primeira regra encontrada', () => {
    // Se tivermos "Uber Eats" e regras para "Uber"(Transporte) e "Eats"(Alimentação),
    // a ordem do array de regras define quem ganha.
    expect(aplicarRegras("Uber Eats", regrasMock)).toBe("Transporte") 
  })
})

// ==========================================
// 3. Lógica de Saldo Livre (Metas)
// ==========================================
function calcularSaldoLivre(saldoTotal: number, metas: { valor_atual: number }[]) {
  const saldoComprometido = metas.reduce((acc, m) => acc + m.valor_atual, 0)
  return saldoTotal - saldoComprometido
}

describe('Cálculo de Saldo Livre (Potes)', () => {
  it('deve subtrair o valor acumulado nas metas do saldo total', () => {
    const saldoTotal = 10000
    const metas = [
      { valor_atual: 2000 }, // Reserva
      { valor_atual: 1500 }  // Viagem
    ]
    
    // Comprometido = 3500
    // Livre = 10000 - 3500 = 6500
    expect(calcularSaldoLivre(saldoTotal, metas)).toBe(6500)
  })

  it('deve retornar saldo livre igual ao total se não houver metas', () => {
    expect(calcularSaldoLivre(5000, [])).toBe(5000)
  })

  it('deve permitir saldo livre negativo (se gastou mais do que devia)', () => {
    // Cenário: Tenho 2000 no banco, mas minhas metas somam 3000 (o dinheiro sumiu!)
    expect(calcularSaldoLivre(2000, [{ valor_atual: 3000 }])).toBe(-1000)
  })
})