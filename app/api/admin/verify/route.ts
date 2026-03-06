import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { password } = await req.json()
  const adminPw = process.env.ADMIN_PASSWORD

  if (!adminPw) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD ist nicht konfiguriert." },
      { status: 500 }
    )
  }

  if (password === adminPw) {
    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { error: "Falsches Passwort." },
    { status: 401 }
  )
}
