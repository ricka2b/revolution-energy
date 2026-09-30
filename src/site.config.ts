/**
 * Configuração central da landing — Hive Energy / Consultor de Energia.
 *
 * Tudo que depende de uma decisão comercial ou de infraestrutura fica aqui,
 * para não precisar caçar string espalhada pelos componentes.
 */

/** Âncora do formulário de aplicação. Todos os CTAs apontam para cá. */
export const CTA_ANCHOR = "#aplicacao";

/** Webhook do cenário Make que recebe os leads da landing. */
export const FORM_ENDPOINT =
  "https://hook.us2.make.com/s71v7yvwjbbaau8nfsb96le1lihxc9q8";

/** Web App do Google Apps Script usado somente pela confirmação do evento. */
export const CONFIRMATION_FORM_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxiWMZ_XPwKxGaybTcWr_0pf-eIngeqYePTobF1xinAHKujH0m3di8AKcZbmS-JZ9sr/exec";

/** Método HTTP do formulário. */
export const FORM_METHOD = "POST";

/** Página exibida somente depois que o lead é entregue ao webhook. */
export const FORM_SUCCESS_PATH = "/obrigado/";

/** Container responsável pelo Pixel e pelos demais eventos de marketing. */
export const GTM_ID = "GTM-NDPR7DB7";

/** Links institucionais. PENDENTE: publicar as páginas reais. */
export const LINKS = {
  privacidade: "/politica-de-privacidade/",
  termos: "",
  site: "https://behive.global",
};

/** Metadados de SEO da página. */
export const SEO = {
  // Extraídos da própria carta (sobrancelha fixa + Hero).
  title:
    "Descubra como ganhar de 3 a 15 mil reais todos os meses | Consultor de Energia Hive",
  description:
    "Consultor de energia: a nova profissão que gera renda recorrente oferecendo apenas um benefício. Sem instalar placa solar. Sem precisar entender de energia.",
};
