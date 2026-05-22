"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, signConsultantToken, setConsultantCookie } from "@/lib/auth/consultant-session";

export async function consultantLoginAction(formData: FormData) {
  const email    = (formData.get("email")    as string).trim().toLowerCase();
  const password = (formData.get("password") as string);

  if (!email || !password) throw new Error("Preencha e-mail e senha");

  const consultant = await prisma.consultantUser.findFirst({
    where: { email },
  });

  if (!consultant || !verifyPassword(password, consultant.passwordHash)) {
    throw new Error("E-mail ou senha incorretos");
  }

  if (!consultant.active) {
    throw new Error("Acesso desativado. Entre em contato com o administrador.");
  }

  const token = await signConsultantToken({
    id:       consultant.id,
    clientId: consultant.clientId,
    name:     consultant.name,
  });

  await setConsultantCookie(token);
  redirect("/consultor");
}
