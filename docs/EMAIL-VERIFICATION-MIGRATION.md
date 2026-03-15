# E-Mail-Verifizierung: Migration & Aktivierung

## 1. Datenbank-Migration ausführen

```bash
npx prisma db push --accept-data-loss
```

Oder manuell (PostgreSQL):

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailConfirmedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerificationToken_key" ON "User"("emailVerificationToken") WHERE "emailVerificationToken" IS NOT NULL;
```

## 2. Bestehende Nutzer migrieren (Grandfathering)

```bash
npx tsx scripts/grandfather-email-verification.ts
```

## 3. Takumis-Filter aktivieren

Nach der Migration in **`app/api/takumis/route.ts`** und **`lib/takumis-server.ts`**:

- `include: { user: { select: { appRole: true, isVerified: true, emailConfirmedAt: true } } }`
- Filter: `return u && u.appRole === "takumi" && !!u.emailConfirmedAt`
