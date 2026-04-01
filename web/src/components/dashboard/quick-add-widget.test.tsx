/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickAddWidget } from "./quick-add-widget";
import { FilterProvider } from "@/contexts/filter-context";

const { createTransactionMock, toastMock } = vi.hoisted(() => ({
  createTransactionMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/actions/transactions", () => ({
  createTransaction: (...args: unknown[]) => createTransactionMock(...args),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      ...props
    }: React.HTMLProps<HTMLDivElement> & { initial?: unknown; animate?: unknown; exit?: unknown }) => (
      <div {...props}>{children}</div>
    ),
    button: ({
      children,
      whileHover,
      whileTap,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { whileHover?: unknown; whileTap?: unknown }) => (
      <button {...props}>{children}</button>
    ),
    p: ({
      children,
      initial,
      animate,
      ...props
    }: React.HTMLProps<HTMLParagraphElement> & { initial?: unknown; animate?: unknown }) => (
      <p {...props}>{children}</p>
    ),
  },
}));

describe("QuickAddWidget double-submit guard", () => {
  const renderWithFilterProvider = () => {
    return render(
      <FilterProvider>
        <QuickAddWidget />
      </FilterProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createTransactionMock.mockResolvedValue({ success: true });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("bloqueia cliques sincronos multiplos em uma unica submissao", async () => {
    renderWithFilterProvider();

    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-add-toggle"));
    });

    const input = screen.getByTestId("quick-add-input");
    const submit = screen.getByTestId("quick-add-submit");

    await act(async () => {
      fireEvent.change(input, { target: { value: "ifood 45 hoje" } });
    });
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      submit.click();
      submit.click();
      submit.click();
    });
    expect(createTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("nao libera novo envio apos 8s se a primeira action ainda estiver pendente", async () => {
    vi.useFakeTimers();
    createTransactionMock.mockImplementation(() => new Promise(() => {}));

    renderWithFilterProvider();

    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-add-toggle"));
    });

    const input = screen.getByTestId("quick-add-input");
    const submit = screen.getByTestId("quick-add-submit");

    await act(async () => {
      fireEvent.change(input, { target: { value: "ifood 45 hoje" } });
    });
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      submit.click();
    });
    expect(createTransactionMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(8500);
    });

    await act(async () => {
      submit.click();
    });
    expect(createTransactionMock).toHaveBeenCalledTimes(1);
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("usa responsavel especifico do filtro ao criar transacao", async () => {
    window.localStorage.setItem("fwm_responsavel_filter", "Luana");

    renderWithFilterProvider();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-add-toggle"));
    });

    const input = screen.getByTestId("quick-add-input");
    const submit = screen.getByTestId("quick-add-submit");

    await act(async () => {
      fireEvent.change(input, { target: { value: "ifood 45 hoje" } });
    });

    await act(async () => {
      submit.click();
    });

    expect(createTransactionMock).toHaveBeenCalledTimes(1);
    const formDataArg = createTransactionMock.mock.calls[0][0] as FormData;
    expect(formDataArg.get("responsavel")).toBe("Luana");
  });

  it("cai em Casal quando filtro estiver em Todos", async () => {
    window.localStorage.setItem("fwm_responsavel_filter", "Todos");

    renderWithFilterProvider();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("quick-add-toggle"));
    });

    const input = screen.getByTestId("quick-add-input");
    const submit = screen.getByTestId("quick-add-submit");

    await act(async () => {
      fireEvent.change(input, { target: { value: "ifood 45 hoje" } });
    });

    await act(async () => {
      submit.click();
    });

    expect(createTransactionMock).toHaveBeenCalledTimes(1);
    const formDataArg = createTransactionMock.mock.calls[0][0] as FormData;
    expect(formDataArg.get("responsavel")).toBe("Casal");
  });
});

