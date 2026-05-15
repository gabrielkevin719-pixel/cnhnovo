import { NextRequest, NextResponse } from "next/server"

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

  // Store comprovante data (would typically go to a database)
  console.log("Comprovante upload:", {
    transaction_id: body.transaction_id || body.id || null,
    cpf: body.cpf || null,
    nome: body.nome || null,
    arquivo: body.arquivo || body.file || body.url || null,
  })

  return NextResponse.json({ success: true })
}
