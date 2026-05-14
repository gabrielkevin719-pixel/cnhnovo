import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

const SYNCPAY_BASE_URL = "https://api.syncpayments.com.br"
const SYNCPAY_CLIENT_ID = "192cea75-df6e-46df-8a2d-0f03751ce13c"
const SYNCPAY_CLIENT_SECRET = "6c7f008b-bc68-45b6-b7ed-250f0955ed82"

let cachedToken: string | null = null
let tokenExpiresAt = 0

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}

async function getAuthToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedToken
  }

  const authResp = await fetch(`${SYNCPAY_BASE_URL}/api/partner/v1/auth-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: SYNCPAY_CLIENT_ID,
      client_secret: SYNCPAY_CLIENT_SECRET,
    }),
  })

  if (!authResp.ok) {
    const errorText = await authResp.text()
    throw new Error(`Erro ao obter token: ${errorText}`)
  }

  const authData = await authResp.json()
  cachedToken = authData.access_token
  tokenExpiresAt = Date.now() + authData.expires_in * 1000

  return cachedToken
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Informe o id da transacao" },
      { status: 400, headers: corsHeaders }
    )
  }

  let token
  try {
    token = await getAuthToken()
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500, headers: corsHeaders }
    )
  }

  const statusResp = await fetch(`${SYNCPAY_BASE_URL}/api/partner/v1/transaction/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  })

  const text = await statusResp.text()
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text)
  } catch {
    data = {}
  }

  if (!statusResp.ok) {
    return NextResponse.json(
      { success: false, error: (data?.message as string) || text || "Erro ao consultar pagamento" },
      { status: statusResp.status, headers: corsHeaders }
    )
  }

  const dataObj = data?.data as Record<string, unknown> | undefined
  const status = (dataObj?.status as string) || "pending"
  const paid = status === "completed"

  try {
    const supabase = getSupabase()
    await supabase
      .from("transactions")
      .update({ status: status.toUpperCase(), paid_at: paid ? new Date().toISOString() : null })
      .eq("transaction_id", id)
  } catch {
    // Silently fail
  }

  return NextResponse.json({ success: true, id, status, paid, raw: data }, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const id = (body?.id || body?.paymentId || body?.transaction_id) as string | undefined

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Informe o id da transacao" },
      { status: 400, headers: corsHeaders }
    )
  }

  // Reuse GET logic
  const url = new URL(request.url)
  url.searchParams.set("id", id)
  return GET(new NextRequest(url))
}
