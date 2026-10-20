import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET() {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1 ? "connected" : dbState === 2 ? "connecting" : "disconnected";

  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
      },
      environment: process.env.NODE_ENV,
    },
    { status: 200 }
  );
}
