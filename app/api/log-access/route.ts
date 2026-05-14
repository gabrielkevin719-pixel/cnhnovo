import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    const supabase = getSupabase()
    await supabase.from("access_logs").insert({
      ip: request.headers.get("x-forwarded-for") || request.headers.get("client-ip") || null,
      user_agent: request.headers.get("user-agent") || null,
      path: (body.path as string) || null,
      referrer: request.headers.get("referer") || null,
      extra: body,
    })
  } catch {
    // Silently fail
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders })
}

export async function GET() {
  return NextResponse.json({ success: true }, { headers: corsHeaders })
}
