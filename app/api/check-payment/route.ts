import { NextRequest, NextResponse } from "next/server"

const SYNCPAY_BASE_URL = "https://api.syncpayments.com.br"
const SYNCPAY_CLIENT_ID = "6025b61a-129e-48b5-a5bf-82b89b850e40"
const SYNCPAY_CLIENT_SECRET = "1aa78add-1139-4022-9310-9618f399aca2"

let cachedToken: string | null = null
let tokenExpiresAt = 0

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
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  let id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ success: false, error: "Informe o id da transação" }, { status: 400 })
  }

  let token: string
  try {
    token = await getAuthToken()
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
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
      { status: statusResp.status }
    )
  }

  const status = ((data?.data as Record<string, unknown>)?.status as string) || "pending"
  const paid = status === "completed"

  return NextResponse.json({
    success: true,
    id,
    status,
    paid,
    raw: data,
  })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const id = (body?.id || body?.paymentId || body?.transaction_id) as string

  if (!id) {
    return NextResponse.json({ success: false, error: "Informe o id da transação" }, { status: 400 })
  }

  let token: string
  try {
    token = await getAuthToken()
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
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
      { status: statusResp.status }
    )
  }

  const status = ((data?.data as Record<string, unknown>)?.status as string) || "pending"
  const paid = status === "completed"

  return NextResponse.json({
    success: true,
    id,
    status,
    paid,
    raw: data,
  })
}
