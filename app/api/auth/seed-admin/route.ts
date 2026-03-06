import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

/**
 * POST /api/auth/seed-admin
 * Creates the first admin user. Protected by ADMIN_PASSWORD env var.
 * Will reject if an admin already exists.
 */
export async function POST(req: Request) {
  try {
    const { password: adminPassword, name, email, userPassword } = await req.json()

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Falsches Admin-Passwort." }, { status: 401 })
    }
    if (!name || !email || !userPassword) {
      return NextResponse.json(
        { error: "name, email und userPassword sind erforderlich." },
        { status: 400 }
      )
    }

    const existingAdmin = await prisma.user.findFirst({ where: { role: "admin" } })
    if (existingAdmin) {
      return NextResponse.json(
        { error: "Ein Admin-Nutzer existiert bereits.", existingAdmin: existingAdmin.email },
        { status: 409 }
      )
    }

    const hashed = await bcrypt.hash(userPassword, 12)
    const admin = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashed,
        role: "admin",
        appRole: "shugyo",
        favorites: [],
      },
    })

    return NextResponse.json(
      { success: true, message: `Admin '${admin.name}' (${admin.email}) erfolgreich erstellt.` },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Fehler"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
