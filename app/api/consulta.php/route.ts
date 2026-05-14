import { NextRequest, NextResponse } from "next/server"

const CPF_API_BASE = "https://api.amnesiatecnologia.rocks/"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}

function extractCpfData(payload: Record<string, unknown>) {
  const root = payload || {}
  const base =
    (root.DADOS as Record<string, unknown>) ||
    (root.dados as Record<string, unknown>) ||
    (root.data as Record<string, unknown>) ||
    (root.DadosBasicos as Record<string, unknown>) ||
    (root.dadosBasicos as Record<string, unknown>) ||
    (root.dados_basicos as Record<string, unknown>) ||
    root
  const nome = (base.nome || base.name || "") as string
  const nomeMae = (base.nome_mae || base.nomeMae || base.mae || "") as string
  const dataNasc = (base.data_nascimento || base.dataNascimento || base.nascimento || "") as string
  const cpf = (base.cpf || base.documento || base.document || "") as string
  return {
    cpf,
    nome,
    nome_mae: nomeMae,
    data_nascimento: dataNasc,
    sexo: (base.sexo || "") as string,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const cpfRaw = searchParams.get("cpf") || ""
  const cpf = cpfRaw.replace(/\D/g, "").slice(0, 11)

  if (!cpf) {
    return NextResponse.json({ status: 400, statusMsg: "Informe o CPF" }, { status: 400, headers: corsHeaders })
  }

  const token = process.env.CPF_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { status: 500, statusMsg: "Configure CPF_API_TOKEN nas variaveis" },
      { status: 500, headers: corsHeaders }
    )
  }

  const apiUrl = `${CPF_API_BASE}?token=${encodeURIComponent(token)}&cpf=${cpf}`

  let apiResp: Response | undefined
  let text = ""

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      apiResp = await fetch(apiUrl, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: controller.signal,
      })
      text = await apiResp.text()
      if (apiResp.ok) break
    } catch (error) {
      if (attempt === 3) {
        return NextResponse.json(
          { status: 502, statusMsg: "Falha ao consultar CPF", details: String(error) },
          { status: 502, headers: corsHeaders }
        )
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(text)
  } catch {
    data = { raw: text }
  }

  if (!apiResp || !apiResp.ok) {
    return NextResponse.json(data, { status: apiResp?.status || 500, headers: corsHeaders })
  }

  const dados = extractCpfData(data)
  return NextResponse.json({ DADOS: dados }, { headers: corsHeaders })
}
