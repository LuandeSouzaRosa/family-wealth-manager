import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { ParsedStatementRow, StatementParseConfidence, StatementParseResult } from "./statement-file-types";

// Banco do Brasil heuristics
// Ignores usually applied to: "SALDO", "S A L D O", "SISBB", "SALDO ANTERIOR", balances.
const isIgnorable = (desc: string) => {
  const d = desc.toLowerCase().trim();
  if (d.includes("s a l d o") || d === "saldo" || d.includes("saldo anterior") || d.includes("saldo disponível")) return true;
  if (d.includes("juros / iof") || d.includes("transf. s a l d o") || d.includes("saldos")) return true;
  return false;
};

export function extractTransactionsFromBbPdfLines(fullTextLines: string[]) {
  const rows: ParsedStatementRow[] = [];
  let ignoredLinesCount = 0;
  const warnings: string[] = [];
  const rawRowsCount = fullTextLines.length;

  for (let i = 0; i < fullTextLines.length; i++) {
    const line = fullTextLines[i];
    
    // A standard transaction logic: starts with Date DD/MM/YYYY
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})/);
    
    if (dateMatch) {
      const dateStr = dateMatch[1];
      let remainder = line.substring(dateStr.length).trim();
      
      // Remove dependency codes (usually isolated numbers after date)
      remainder = remainder.replace(/^\d+\s+/, ""); 

      const moneyPattern = /([\d.]*,\d{2})\s*([CD])?/g;
      let match;
      const moneyMatches: { val: string, sign: string, index: number, length: number }[] = [];
      
      while ((match = moneyPattern.exec(remainder)) !== null) {
        moneyMatches.push({
          val: match[1],
          sign: match[2] || "",
          index: match.index,
          length: match[0].length
        });
      }

      if (moneyMatches.length > 0) {
        // Usually, the first money match is the transaction value, and the second is the balance.
        const moneyMatch = moneyMatches[0];
        const rawValor = moneyMatch.val.replace(/\./g, "").replace(",", ".");
        let floatValor = parseFloat(rawValor);
        
        if (moneyMatch.sign === "D") {
          floatValor = -Math.abs(floatValor);
        } else if (moneyMatch.sign === "C") {
          floatValor = Math.abs(floatValor);
        } else {
          // Fallback if no sign explicitly present
        }

        const descricaoStr = remainder.substring(0, moneyMatch.index).trim().replace(/\s*\d+$/, "").trim(); // Strip trailing Doc number if any
        
        if (isIgnorable(descricaoStr) || isIgnorable(line)) {
          ignoredLinesCount++;
        } else {
           rows.push({
             data: dateStr,
             descricao: descricaoStr || "Lancamento sem descricao",
             // Mapeia valor em string formatada do source file, preservando se é negativo
             valor: String(floatValor)
           });
        }
      } else {
        ignoredLinesCount++;
      }
    } else {
      ignoredLinesCount++;
    }
  }

  let confidence: StatementParseConfidence = "high";
  if (rows.length === 0 && rawRowsCount > 10) {
     confidence = "low";
     warnings.push("0 transacoes financeiras reconhecidas. O layout do PDF pode ser incompativel ou escaneado (imagem sem texto legível).");
  }

  return { rows, ignoredLinesCount, rawRowsCount, warnings, confidence };
}

// Lazy load pdfjs-dist when needed
export async function parseBbPdfStatement(contentOrFile: ArrayBuffer | File): Promise<StatementParseResult> {
  await getResolvedPDFJS();

  let buffer: ArrayBuffer;
  if (contentOrFile instanceof Blob || contentOrFile instanceof File) {
    buffer = await contentOrFile.arrayBuffer();
  } else {
    buffer = contentOrFile;
  }

  const pdfDoc = await getDocumentProxy(new Uint8Array(buffer));
  const numPages = pdfDoc.numPages;

  const fullTextLines: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    
    const yGroups: Record<string, any[]> = {};
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform[5] / 2) * 2; 
      if (!yGroups[y]) yGroups[y] = [];
      yGroups[y].push(item);
    }

    const sortedYs = Object.keys(yGroups).map(Number).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineItems = yGroups[y].sort((a, b) => a.transform[4] - b.transform[4]);
      const lineText = lineItems.map(i => i.str).join(" ").trim();
      
      const cleanLine = lineText.replace(/\s{2,}/g, " ");
      if (cleanLine) {
        fullTextLines.push(cleanLine);
      }
    }
  }

  const result = extractTransactionsFromBbPdfLines(fullTextLines);

  return {
    sourceType: "pdf_bb",
    institution: "Banco do Brasil",
    confidence: result.confidence,
    warnings: result.warnings,
    rows: result.rows,
    rawRowsCount: result.rawRowsCount,
    parsedRowsCount: result.rows.length,
    ignoredLinesCount: result.ignoredLinesCount
  };
}
