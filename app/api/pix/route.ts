import { NextRequest, NextResponse } from "next/server"

const SYNCPAY_BASE_URL = "https://api.syncpayments.com.br"
const SYNCPAY_CLIENT_ID = "6025b61a-129e-48b5-a5bf-82b89b850e40"
const SYNCPAY_CLIENT_SECRET = "1aa78add-1139-4022-9310-9618f399aca2"

let cachedToken: string | null = null
let tokenExpiresAt = 0
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 5000 // 5 seconds between requests

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const timeSinceLastRequest = Date.now() - lastRequestTime
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    }

    try {
      lastRequestTime = Date.now()
      const response = await fetch(url, options)

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after")
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt + 2) * 2000 // Longer waits
        console.log(`[v0] Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`)
        await delay(waitTime)
        continue
      }

      return response
    } catch (error) {
      lastError = error as Error
      const waitTime = Math.pow(2, attempt + 2) * 2000
      console.log(`[v0] Request failed. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`)
      await delay(waitTime)
    }
  }

  throw lastError || new Error("Max retries exceeded")
}

async function getAuthToken() {
  // Use cached token if valid (with 10 min margin instead of 5)
  if (cachedToken && Date.now() < tokenExpiresAt - 600000) {
    console.log("[v0] Using cached token")
    return cachedToken
  }

  console.log("[v0] Requesting new auth token...")

  const authResp = await fetchWithRetry(`${SYNCPAY_BASE_URL}/api/partner/v1/auth-token`, {
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
  // Cache for longer - assume 1 hour if not specified
  const expiresIn = authData.expires_in || 3600
  tokenExpiresAt = Date.now() + expiresIn * 1000
  console.log(`[v0] Token cached, expires in ${expiresIn} seconds`)

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

  let token: string
  try {
    token = await getAuthToken()
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Erro de autenticação com o serviço de pagamento. Tente novamente." },
      { status: 500 }
    )
  }

  const payload = {
    amount: amountNum, // Amount in reais (not cents)
    description: "Vinculacao CPF",
    client: {
      name: customerName,
      cpf: customerCpf,
      email: customerEmail,
      phone: customerPhone,
    },
    webhook_url: process.env.POSTBACK_URL || (body.postback as string) || "https://cnhnovo.com/api/webhook",
  }

  console.log("[v0] PIX Payload:", JSON.stringify(payload, null, 2))

  const syncResp = await fetchWithRetry(`${SYNCPAY_BASE_URL}/api/partner/v1/cash-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const text = await syncResp.text()
  console.log("[v0] SyncPayments Response Status:", syncResp.status)
  console.log("[v0] SyncPayments Response Body:", text)

  if (!syncResp.ok) {
    let userMessage = "Erro ao criar PIX. Tente novamente."
    if (syncResp.status === 429) {
      userMessage = "Sistema ocupado. Aguarde alguns segundos e tente novamente."
    } else if (syncResp.status >= 500) {
      userMessage = "Serviço temporariamente indisponível. Tente novamente em alguns minutos."
    } else if (syncResp.status === 422) {
      userMessage = "Dados inválidos. Verifique CPF, email e telefone."
    } else if (syncResp.status === 401) {
      userMessage = "Erro de autenticação. Tente novamente."
    }
    return NextResponse.json({ success: false, error: userMessage, details: text }, { status: syncResp.status })
  }

  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text)
  } catch {
    data = {}
  }

  // Map response according to SyncPayments API documentation
  const pixCode = (data?.pix_code as string) || null
  const identifier = (data?.identifier as string) || null

  return NextResponse.json({
    success: true,
    pix_code: pixCode,
    transaction_id: identifier,
    deposit_id: identifier,
    qrcode: pixCode, // pix_code can be used as QR code content
    amount: amountNum,
    key: null,
    brcode: pixCode,
    payload: pixCode,
    pixCode: pixCode,
    pix: { key: null, brcode: pixCode, qrcode: pixCode, payload: pixCode },
    raw: data,
  })
}
