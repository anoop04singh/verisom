import { NextResponse } from "next/server";
import { readVerisomRequestStatus } from "@/lib/verisom";

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { requestId } = await context.params;
    const { searchParams } = new URL(request.url);
    const startBlock = searchParams.get("startBlock");

    const result = await readVerisomRequestStatus({
      requestId,
      startBlock: startBlock ? Number(startBlock) : undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown status failure.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
