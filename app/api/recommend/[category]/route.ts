import { type NextRequest, NextResponse } from "next/server";

const DEPRECATION_DATE = "2026-02-18";

export async function POST(
  _request: NextRequest,
  { params }: { params: { category: string } }
) {
  return NextResponse.json(
    {
      error: "Route deprecated",
      message: `This demo route has been retired and will be removed after ${DEPRECATION_DATE}.`,
      replacement: `/api/recommend/ai/${params.category}`,
      deprecationDate: DEPRECATION_DATE,
    },
    { status: 410 }
  );
}





