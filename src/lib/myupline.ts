import { normalizePhone } from './maratona-start';

export const MYUPLINE_EVENT = 'Lançamento Oficial da MyUpline';
export const MYUPLINE_FORM_ID = 'myupline_lancamento';
export const MYUPLINE_ENDPOINT = import.meta.env.PUBLIC_MYUPLINE_ENDPOINT || 'https://n8n.a2baceleradora.com.br/webhook/myupline-lancamento';
export const TICKET_STORAGE = 'myupline.ticket.v1';
const PENDING_STORAGE = 'myupline.pending.v1';
function newTicketCode() {
  // getRandomValues also works when previewing over local-network HTTP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `MU-${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export interface MyUplineTicket { nome: string; codigo: string; evento: string; emitido_em: string }
export const validTicket = (value: unknown): value is MyUplineTicket => {
  const t = value as MyUplineTicket | null;
  return !!t && typeof t.nome === 'string' && t.nome.length > 0 && t.nome.length <= 120
    && /^MU-[A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12}$/.test(t.codigo)
    && t.evento === MYUPLINE_EVENT && !Number.isNaN(Date.parse(t.emitido_em));
};
export function readTicket(): MyUplineTicket | null {
  try { const t = JSON.parse(localStorage.getItem(TICKET_STORAGE) || 'null'); return validTicket(t) ? t : null; }
  catch { return null; }
}
export function buildMyUplineRegistration(data: FormData, href: string, referrer: string) {
  const nome = String(data.get('nome') || '').trim();
  const email = String(data.get('email') || '').trim().toLowerCase();
  const whatsapp = normalizePhone(String(data.get('whatsapp') || ''));
  if (!nome || nome.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !whatsapp) throw new Error('Confira seu nome, e-mail e telefone com DDD.');
  let codigo = '';
  try { const pending = JSON.parse(sessionStorage.getItem(PENDING_STORAGE) || 'null'); if (pending?.email === email && /^MU-[A-F0-9-]{36}$/.test(pending.codigo)) codigo = pending.codigo; } catch {}
  if (!codigo) codigo = newTicketCode();
  try { sessionStorage.setItem(PENDING_STORAGE, JSON.stringify({ email, codigo })); } catch {}
  const ticket: MyUplineTicket = { nome, codigo, evento: MYUPLINE_EVENT, emitido_em: new Date().toISOString() };
  const payload = new URLSearchParams({ form_id: MYUPLINE_FORM_ID, nome, email, whatsapp, codigo, evento: ticket.evento, enviado_em: ticket.emitido_em, pagina: href, origem: referrer || 'acesso_direto' });
  const query = new URL(href).searchParams;
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'conjunto', 'anuncio']) { const value = query.get(key); if (value) payload.set(key, value); }
  return { ticket, payload };
}
export async function registerMyUpline(endpoint: string, payload: URLSearchParams, ticket: MyUplineTicket): Promise<MyUplineTicket> {
  if (!endpoint) throw new Error('As inscrições estarão disponíveis em breve. Tente novamente mais tarde.');
  const response = await fetch(endpoint, { method: 'POST', body: payload, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Não foi possível confirmar sua inscrição. Tente novamente.');
  const result = await response.json();
  if (result.ok !== true || !validTicket(result.ticket) || result.ticket.codigo !== ticket.codigo) throw new Error('Não foi possível confirmar sua inscrição. Tente novamente.');
  const confirmed = result.ticket;
  try { localStorage.setItem(TICKET_STORAGE, JSON.stringify(confirmed)); sessionStorage.removeItem(PENDING_STORAGE); } catch {}
  return confirmed;
}
export function ticketUrl(ticket: MyUplineTicket) {
  // The fragment stays in the browser and is not sent in HTTP requests/referrers.
  return '/myupline/obrigado/#' + new URLSearchParams({ nome: ticket.nome, codigo: ticket.codigo, emitido: ticket.emitido_em }).toString();
}
