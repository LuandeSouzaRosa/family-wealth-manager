import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { ParsedStatementRow, StatementParseConfidence, StatementParseResult } from "./statement-file-types";

// Banco do Brasil heuristics
// Ignores usually applied to: "SALDO", "S A L D O", "SISBB", "SALDO ANTERIOR", balances.
const isIgnorable = (desc: string) => {
  const d = desc.toLowerCase().trim();
  if (d.includes("s a l d o") || d === "saldo" || d.includes("saldo anterior") || d.includes("saldo disponível") || d.includes("saldo do dia")) return true;
  if (d.includes("juros / iof") || d.includes("transf. s a l d o") || d.includes("saldos")) return true;
  if (d.includes("extrato de conta corrente") || d.includes("sisbb")) return true;
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
      
      // Matches money and sign. Supports: D, C, (+), (-)
      const moneyPattern = /([\d.]*,\d{2})\s*(\(\+\)|\(-\)|[CD])?/g;
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
        // Find the last money match, as it represents the transaction value, and balances are sometimes matched before
        const moneyMatch = moneyMatches[moneyMatches.length - 1]; 
        const rawValor = moneyMatch.val.replace(/\./g, "").replace(",", ".");
        let floatValor = parseFloat(rawValor);
        
        const isDebit = moneyMatch.sign.includes("-") || moneyMatch.sign === "D";
        const isCredit = moneyMatch.sign.includes("+") || moneyMatch.sign === "C";

        if (isDebit) {
          floatValor = -Math.abs(floatValor);
        } else if (isCredit) {
          floatValor = Math.abs(floatValor);
        } else {
          // Fallback if no sign explicitly present: assume it as positive (can be corrected by user)
        }

        // Clean up the description logic to not eat the value itself
        let coreDesc = remainder.substring(0, moneyMatch.index).trim();
        // Remove document numbers at the start or end of the core description
        coreDesc = coreDesc.replace(/^[\d\s]+/, "").replace(/\s*\d+$/, "").trim(); 
        
        if (isIgnorable(coreDesc) || isIgnorable(line)) {
          ignoredLinesCount++;
        } else {
           // Sliding window for rich description: BB PDFs scatter text above and below the core transaction.
           const descParts: string[] = [];
           
           // Look behind: line i - 1
           if (i > 0) {
             const prevLine = fullTextLines[i - 1];
             const isDateDetail = prevLine.match(/^\d{2}\/\d{2}/) || prevLine.match(/^(\d{2}\/\d{2}\/\d{4})/);
             if (!isDateDetail && !isIgnorable(prevLine)) {
               descParts.push(prevLine.trim());
             }
           }
           
           // Core
           if (coreDesc) {
             descParts.push(coreDesc);
           }
           
           // Look ahead: line i + 1
           if (i + 1 < fullTextLines.length) {
             const nextLine = fullTextLines[i + 1];
             if (!nextLine.match(/^(\d{2}\/\d{2}\/\d{4})/) && !isIgnorable(nextLine)) {
               descParts.push(nextLine.replace(/^[\d\s/:]+/, "").trim()); // remove dates/hours from detail lines
             }
           }

           const finalDesc = descParts.filter(Boolean).join(" - ") || "Lançamento sem descrição";

           rows.push({
             data: dateStr,
             descricao: finalDesc,
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
