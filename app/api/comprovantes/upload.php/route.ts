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
    await supabase.from("comprovantes").insert({
      transaction_id: (body.transaction_id || body.id) as string | null,
      cpf: body.cpf as string | null,
      nome: body.nome as string | null,
      arquivo: (body.arquivo || body.file || body.url) as string | null,
      extra: body,
    })
  } catch {
    // Silently fail
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders })
}
