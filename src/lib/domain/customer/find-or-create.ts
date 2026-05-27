import { prisma } from "@/lib/db/prisma";
import { normalizePhone, normalizeDocument, normalizeEmail, normalizeState } from "@/lib/utils/normalize";

interface CustomerInput {
  clientId: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  zipCode?: string;
  city?: string;
  state?: string;
}

export async function findOrCreateCustomer(input: CustomerInput) {
  const phone    = normalizePhone(input.phone);
  const document = input.document ? normalizeDocument(input.document) : undefined;
  const email    = input.email    ? normalizeEmail(input.email)        : undefined;
  const state    = input.state    ? normalizeState(input.state)        : undefined;
  const name     = input.name.trim();
  const clientId = input.clientId;

  // Busca por phone primeiro, depois por document
  let customer = await prisma.customer.findFirst({
    where: {
      clientId,
      OR: [
        { phone },
        ...(document ? [{ document }] : []),
      ],
    },
  });

  if (customer) {
    // Atualiza apenas campos que estavam null
    const updates: Partial<CustomerInput> = {};
    if (!customer.email     && email)     updates.email     = email;
    if (!customer.document  && document)  updates.document  = document;
    if (!customer.zipCode   && input.zipCode)   updates.zipCode   = input.zipCode;
    if (!customer.city      && input.city)      updates.city      = input.city;
    if (!customer.state     && state)     updates.state     = state;

    if (Object.keys(updates).length > 0) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: updates,
      });
    }

    return customer;
  }

  try {
    return await prisma.customer.create({
      data: { ...input, name, phone, document, email, state },
    });
  } catch (err: unknown) {
    // P2002 = unique constraint — race condition between concurrent requests
    if ((err as { code?: string }).code === "P2002") {
      const existing = await prisma.customer.findFirst({
        where: {
          clientId,
          OR: [{ phone }, ...(document ? [{ document }] : [])],
        },
      });
      if (existing) return existing;
    }
    throw err;
  }
}
