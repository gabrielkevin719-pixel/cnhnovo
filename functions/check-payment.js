const SYNCPAY_BASE_URL = "https://api.syncpayments.com.br";
const SYNCPAY_CLIENT_ID = "192cea75-df6e-46df-8a2d-0f03751ce13c";
const SYNCPAY_CLIENT_SECRET = "6c7f008b-bc68-45b6-b7ed-250f0955ed82";

const { getSupabase } = require("./lib/supabase");

let cachedToken = null;
let tokenExpiresAt = 0;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

async function getAuthToken() {
  // Retorna token em cache se ainda for válido (com 5 min de margem)
  if (cachedToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedToken;
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
  });

  if (!authResp.ok) {
    const errorText = await authResp.text();
    throw new Error(`Erro ao obter token: ${errorText}`);
  }

  const authData = await authResp.json();
  cachedToken = authData.access_token;
  tokenExpiresAt = Date.now() + (authData.expires_in * 1000);
  
  return cachedToken;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: "",
    };
  }

  let id = event.queryStringParameters?.id;
  if (event.httpMethod === "POST") {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      id = body?.id || body?.paymentId || body?.transaction_id || id;
    } catch {}
  }

  if (!id) {
    return jsonResponse(400, { success: false, error: "Informe o id da transação" });
  }

  let token;
  try {
    token = await getAuthToken();
  } catch (err) {
    return jsonResponse(500, { success: false, error: err.message });
  }

  const statusResp = await fetch(`${SYNCPAY_BASE_URL}/api/partner/v1/transaction/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await statusResp.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }

  if (!statusResp.ok) {
    return jsonResponse(statusResp.status, { success: false, error: data?.message || text || "Erro ao consultar pagamento" });
  }

  // Status possíveis da SyncPay: pending, completed, failed, refunded, med
  const status = data?.data?.status || "pending";
  const paid = status === "completed";

  try {
    const supabase = getSupabase();
    await supabase
      .from("transactions")
      .update({ status: status.toUpperCase(), paid_at: paid ? new Date().toISOString() : null })
      .eq("transaction_id", id);
  } catch (_) {}

  return jsonResponse(200, {
    success: true,
    id,
    status,
    paid,
    raw: data,
  });
};
