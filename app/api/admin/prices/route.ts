import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { recalculateAllScores } from "@/lib/recalculate";
import { getServiceClient } from "@/lib/supabase";

interface PriceChange {
  foodId: string;
  pricePerKg: number;
}

function isPriceChangeArray(value: unknown): value is PriceChange[] {
  return Array.isArray(value) && value.every((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const candidate = entry as Partial<PriceChange>;
    return (
      typeof candidate.foodId === "string" &&
      candidate.foodId.length > 0 &&
      typeof candidate.pricePerKg === "number" &&
      Number.isFinite(candidate.pricePerKg) &&
      candidate.pricePerKg > 0
    );
  });
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { prices?: unknown }
      | null;

    if (!body || !isPriceChangeArray(body.prices) || body.prices.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid price payload." },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from("prices").insert(
      body.prices.map((change) => ({
        food_id: change.foodId,
        price_per_kg: change.pricePerKg,
        updated_at: now,
      }))
    );

    if (insertError) {
      return NextResponse.json(
        { success: false, message: insertError.message },
        { status: 500 }
      );
    }

    const summary = await recalculateAllScores();

    return NextResponse.json({
      success: true,
      message: `${body.prices.length} price update(s) saved by ${user.email ?? "admin"}.`,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Price save failed.",
      },
      { status: 500 }
    );
  }
}
