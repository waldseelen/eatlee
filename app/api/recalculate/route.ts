import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { recalculateAllScores } from "@/lib/recalculate";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const summary = await recalculateAllScores();

    return NextResponse.json({
      success: true,
      message: "Scores recalculated successfully.",
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Recalculation failed.",
      },
      { status: 500 }
    );
  }
}
