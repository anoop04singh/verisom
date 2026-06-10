import { NextResponse } from "next/server";
import { analyzeTargetContract } from "@/lib/audit-pipeline";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await analyzeTargetContract({
      targetAddress: body.targetAddress,
      chainName: body.chainName,
      auditFocus: body.auditFocus
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis failure.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
