import { NextRequest, NextResponse } from "next/server"

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const { searchParams } = new URL(request.url)

  console.log("Access log:", {
    ip: request.headers.get("x-forwarded-for") || request.headers.get("client-ip") || null,
    user_agent: request.headers.get("user-agent") || null,
    path: (body.path as string) || searchParams.get("path") || null,
    referrer: request.headers.get("referer") || null,
  })

  return NextResponse.json({ success: true })
}
