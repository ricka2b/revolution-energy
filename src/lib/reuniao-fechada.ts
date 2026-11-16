import { normalizePhone } from "./maratona-start";

export const REUNIAO_FORM_ID = "reuniao_fechada_rafael_cheik";
export const REUNIAO_FORM_ENDPOINT = "https://n8n.a2baceleradora.com.br/webhook/reuniao-fechada-rafael-cheik";
export const REUNIAO_SUCCESS_URL = "/reuniao-fechada/obrigado/";

export function buildReuniaoPayload(data: FormData, pageUrl: string, referrer: string): URLSearchParams {
  const nome = String(data.get("nome") || "").trim();
  const email = String(data.get("email") || "").trim();
  const whatsapp = normalizePhone(String(data.get("whatsapp") || ""));
  if (!nome || nome.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !whatsapp || !data.get("consent")) {
    throw new Error("Confira seus dados para continuar.");
  }
  const payload = new URLSearchParams({
    form_id: REUNIAO_FORM_ID, nome, email, whatsapp,
    consentimento: "sim", pagina: pageUrl, origem: referrer || "acesso_direto",
    enviado_em: new Date().toISOString(),
  });
  const query = new URL(pageUrl).searchParams;
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "conjunto", "anuncio", "fbclid", "gclid"]) {
    const value = query.get(key);
    if (value) payload.set(key, value);
  }
  return payload;
}

export async function sendReuniaoLead(endpoint: string, payload: URLSearchParams): Promise<void> {
  const response = await fetch(endpoint, { method: "POST", body: payload, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("Não foi possível enviar seu cadastro.");
  const result = await response.json();
  if (result.ok !== true) throw new Error("Não foi possível confirmar seu cadastro.");
}
