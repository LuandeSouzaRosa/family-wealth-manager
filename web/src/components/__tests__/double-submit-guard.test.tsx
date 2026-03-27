/**
 * @vitest-environment jsdom
 */
import { expect, test, vi, describe } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useTransition } from 'react'

// Dummy Component that mimics exactly the architecture patched in Phase 4D
function MockTransactionDialog({ onSubmit }: { onSubmit: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition()
  const isSubmittingRef = useRef(false)

  const handleSaveVulnerable = () => {
    // Old way (Falsa sensação de proteção)
    if (isPending) return;
    startTransition(async () => {
      await onSubmit();
    })
  }

  const handleSaveSecured = () => {
    // New way (Blindagem Síncrona via useRef)
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    startTransition(async () => {
      try {
        await onSubmit();
      } finally {
        isSubmittingRef.current = false;
      }
    })
  }

  return (
    <div>
      <button data-testid="vuln" onClick={handleSaveVulnerable} disabled={isPending}>Salvar Vulnerável</button>
      <button data-testid="secure" onClick={handleSaveSecured} disabled={isPending}>Salvar Seguro</button>
    </div>
  )
}

describe('Synchronous Thread Lock (Fase 4D Hardening)', () => {
  test('A sentinela useRef isola estritamente o duplo-clique síncrono no mesmo tick do event loop', async () => {
    const mockSubmit = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    const user = userEvent.setup()
    
    render(<MockTransactionDialog onSubmit={mockSubmit} />)
    
    const btnSecure = screen.getByTestId('secure')
    
    // Dispara dois cliques simultâneos de forma programática (sem yield pro React atualizar o DOM e o hook)
    // O await dblClick() do userEvent aguardaria, por isso vamos atirar os eventos síncronos
    btnSecure.click();
    btnSecure.click();
    btnSecure.click(); // Triplo spam
    
    // A função assíncrona foi chamada apenas 1 única vez
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    
    // Se fosse o cenário vulnerável, ele teria chamado mockSubmit 3 vezes.
  })
})
