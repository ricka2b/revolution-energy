export const MARATONA_FORM_ID = "maratona_start";
export const MARATONA_GROUP_URL = "https://chat.whatsapp.com/IcBlQIESzAQCe96i73OsTE";

export const ESTADOS = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
] as const;

export function normalizePhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return /^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(digits) ? `+55${digits}` : null;
}

export function buildMaratonaPayload(data: FormData, pageUrl: string, referrer: string): URLSearchParams {
  const nome = String(data.get("nome") || "").trim();
  const email = String(data.get("email") || "").trim();
  const whatsapp = normalizePhone(String(data.get("whatsapp") || ""));
  const estado = String(data.get("estado") || "");
  if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !whatsapp || !ESTADOS.some(([uf]) => uf === estado) || !data.get("consent")) {
    throw new Error("Confira seus dados e autorize o contato para continuar.");
  }
  const payload = new URLSearchParams({
    form_id: MARATONA_FORM_ID, nome, email, whatsapp, estado,
    consent: "on", consentimento: "sim", pagina: pageUrl,
    origem: referrer || "acesso_direto", enviado_em: new Date().toISOString(),
  });
  const query = new URL(pageUrl).searchParams;
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "conjunto", "anuncio", "fbclid", "gclid"]) {
    const value = query.get(key);
    if (value) payload.set(key, value);
  }
  return payload;
}

export async function sendMaratonaLead(endpoint: string, payload: URLSearchParams): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST", body: payload, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Não foi possível enviar agora. Tente novamente em instantes.");
}
