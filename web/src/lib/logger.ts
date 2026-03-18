export type LogContext = {
  action: string;
  userId?: string;
  metadata?: Record<string, any>;
};

/**
 * Registra um erro de forma estruturada e retorna uma mensagem segura para a UX.
 * Impede que mensagens de banco de dados cruas afetem o usuário.
 */
export function handleError(context: LogContext, error: unknown, fallbackMessage = "Ocorreu um erro inesperado."): { error: string } {
  let rawMessage = fallbackMessage;

  if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    rawMessage = String((error as any).message);
  } else if (typeof error === "string") {
    rawMessage = error;
  }

  // 1. Log Estruturado para Produção (Vercel/Axiom)
  console.error(JSON.stringify({
    level: "ERROR",
    timestamp: new Date().toISOString(),
    action: context.action,
    userId: context.userId || "anonymous",
    metadata: context.metadata,
    error: rawMessage,
    // stack: error instanceof Error ? error.stack : undefined // opcional, pode ser mto ruidoso
  }));

  // 2. Sanitização para o Usuário
  const lowerMsg = rawMessage.toLowerCase();
  
  if (lowerMsg.includes("violates foreign key") || lowerMsg.includes("reference")) {
    return { error: "Alguma informação relacionada não foi encontrada." };
  }
  if (lowerMsg.includes("duplicate key")) {
    return { error: "Este registro já existe." };
  }
  if (lowerMsg.includes("fetch") || lowerMsg.includes("network")) {
    return { error: "Problema de conexão. Tente novamente mais tarde." };
  }
  if (lowerMsg.includes("timeout")) {
    return { error: "A operação demorou muito. Tente novamente." };
  }

  // Para erros de domínio/regras zods (ex: "Sessão expirada"), repassamos a msg
  return { error: rawMessage };
}

/**
 * Registra um evento de sucesso ou progresso.
 */
export function logInfo(context: LogContext, message: string) {
  console.log(JSON.stringify({
    level: "INFO",
    timestamp: new Date().toISOString(),
    action: context.action,
    userId: context.userId || "anonymous",
    message,
    metadata: context.metadata,
  }));
}
