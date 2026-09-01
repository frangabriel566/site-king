"use server";

import { cepLookupSchema } from "@/lib/validations/checkout";

export type CepResult =
  | { ok: true; street: string; district: string; city: string; state: string }
  | { ok: false; message: string };

type ViaCepResponse = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export async function lookupCepAction(cep: string): Promise<CepResult> {
  const parsed = cepLookupSchema.safeParse({ cep });
  if (!parsed.success) {
    return { ok: false, message: "CEP inválido." };
  }

  const digits = parsed.data.cep.replace(/\D/g, "");

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: "Não foi possível consultar o CEP." };
    }
    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) {
      return { ok: false, message: "CEP não encontrado." };
    }

    return {
      ok: true,
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return { ok: false, message: "Não foi possível consultar o CEP." };
  }
}
