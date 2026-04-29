import { prisma } from "@/lib/db/prisma";

interface CustomerInput {
  clientId: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  birthDate?: Date;
}

export async function findOrCreateCustomer(input: CustomerInput) {
  const { clientId, phone, document } = input;

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
    if (!customer.email     && input.email)     updates.email     = input.email;
    if (!customer.document  && input.document)  updates.document  = input.document;
    if (!customer.zipCode   && input.zipCode)   updates.zipCode   = input.zipCode;
    if (!customer.city      && input.city)      updates.city      = input.city;
    if (!customer.state     && input.state)     updates.state     = input.state;
    if (!customer.birthDate && input.birthDate) updates.birthDate = input.birthDate;

    if (Object.keys(updates).length > 0) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: updates,
      });
    }

    return customer;
  }

  try {
    return await prisma.customer.create({ data: input });
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
