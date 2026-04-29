import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/db/prisma";
import { generateLeadsXlsx } from "@/lib/xlsx/export";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { authUserId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const buffer = await generateLeadsXlsx(dbUser.clientId!);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
