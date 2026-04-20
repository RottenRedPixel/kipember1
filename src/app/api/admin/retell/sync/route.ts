import { NextRequest, NextResponse } from "next/server";
import { runRetellMemoryAgentSyncServer } from "@/lib/retell-sync-server";

function getSyncApiKey() {
  return process.env.KIPEMBER_SYNC_API_KEY?.trim() || "";
}

export async function POST(request: NextRequest) {
  const syncApiKey = getSyncApiKey();
  const providedKey = request.headers.get("x-sync-key")?.trim() || "";

  if (!syncApiKey) {
    return NextResponse.json({ error: "Retell sync is not configured." }, { status: 503 });
  }

  if (!providedKey || providedKey !== syncApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const syncResult = await runRetellMemoryAgentSyncServer();
    return NextResponse.json({ syncResult });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Retell sync failed",
      },
      { status: 500 },
    );
  }
}
