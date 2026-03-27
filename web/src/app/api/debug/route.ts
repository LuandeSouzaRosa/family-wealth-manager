import { NextRequest, NextResponse } from "next/server";
import { createTransaction } from "@/actions/transactions";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  
  try {
    const result = await createTransaction(formData);
    return NextResponse.json({ result });
  } catch (err: any) {
    console.error("[DEBUG ROUTE FATAL]", err);
    return NextResponse.json({ fatalError: err.message, stack: err.stack }, { status: 500 });
  }
}
