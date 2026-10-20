import { NextRequest, NextResponse } from "next/server";
import { defaultFacilityService } from "@/lib/maps/facility-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const facility = await defaultFacilityService.getFacilityById(id);

    if (!facility) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Healthcare facility not found.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: facility,
    });
  } catch (error) {
    console.error("[FACILITY BY ID ERROR]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve facility details.",
        },
      },
      { status: 500 }
    );
  }
}
