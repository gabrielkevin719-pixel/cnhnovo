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

  const transactionId = (body.id || body.transaction_id || body.idTransaction) as string | undefined

  try {
    const supabase = getSupabase()
    if (transactionId) {
      await supabase
        .from("transactions")
        .update({ status: "APPROVED", paid_at: new Date().toISOString() })
        .eq("transaction_id", transactionId)
    }
  } catch {
    // Silently fail
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders })
}
