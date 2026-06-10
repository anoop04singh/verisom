import { NextResponse } from "next/server";
import { submitVerisomRequest } from "@/lib/verisom";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await submitVerisomRequest({
      targetAddress: body.targetAddress,
      chainName: body.chainName,
      contractContext: body.contractContext,
      privateKey: body.privateKey
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown request failure.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
