import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sincronizarRolagemSuave } from "./smooth-scroll";

gsap.registerPlugin(ScrollTrigger);

const raiz = document.querySelector<HTMLElement>(".pagina-estatica");
const MARCADORES = true;

if (raiz && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const numeros = raiz.querySelector<HTMLElement>(".numeros");
  if (numeros) {
    const cena1 = numeros.querySelector<HTMLElement>('[data-num-scene="1"]');
    const cena2 = numeros.querySelector<HTMLElement>('[data-num-scene="2"]');
    const cena3 = numeros.querySelector<HTMLElement>('[data-num-scene="3"]');
    const cena4 = numeros.querySelector<HTMLElement>('[data-num-scene="4"]');
    const titulo = numeros.querySelector<HTMLElement>("[data-num-title]");
    const tituloFinal = numeros.querySelector<HTMLElement>("[data-num-title-final]");
    const chamada = numeros.querySelector<HTMLElement>("[data-num-accounts]");
    const contas = Array.from(numeros.querySelectorAll<HTMLElement>("[data-num-icon]"));
    const consumoLinha = numeros.querySelector<HTMLElement>(".premissa__linha");
    const consumoValor = numeros.querySelector<HTMLElement>("[data-num-counter]");
    const comissaoAquisicao = numeros.querySelector<HTMLElement>("[data-num-commission]");

    const s2Intro = numeros.querySelector<HTMLElement>("[data-s6-2-intro]");
    const s2Pill = numeros.querySelector<HTMLElement>("[data-s6-2-pill]");
    const s2Counter = numeros.querySelector<HTMLElement>("[data-s6-2-counter]");
    const s2Legenda = numeros.querySelector<HTMLElement>("[data-s6-2-legenda]");

    const s3Eyebrow = numeros.querySelector<HTMLElement>(".s6-3__eyebrow");
    const s3Title = numeros.querySelector<HTMLElement>(".s6-3__title");
    const s3Linha = numeros.querySelector<HTMLElement>("[data-s6-3-linha]");
    const s3Contas = Array.from(
      numeros.querySelectorAll<HTMLElement>("[data-s6-3-icones] img"),
    );
    const s3Bonus = numeros.querySelector<HTMLElement>("[data-s6-3-bonus-valor]");
    const s3BonusCounter = numeros.querySelector<HTMLElement>("[data-s6-3-bonus-counter]");
    const s3Ouseja = numeros.querySelector<HTMLElement>("[data-s6-3-ouseja]");
    const s3Coluna1 = numeros.querySelector<HTMLElement>('[data-s6-3-coluna="1"]');
    const s3Coluna2 = numeros.querySelector<HTMLElement>('[data-s6-3-coluna="2"]');
    const s3TotalCounter = numeros.querySelector<HTMLElement>("[data-s6-3-bonus-total-counter]");

    const s4Titulo = numeros.querySelector<HTMLElement>("[data-s6-4-titulo]");
    const s4Card1 = numeros.querySelector<HTMLElement>('[data-s6-4-card="1"]');
    const s4Card2 = numeros.querySelector<HTMLElement>('[data-s6-4-card="2"]');
    const s4Plus = numeros.querySelector<HTMLElement>("[data-s6-4-plus]");
    const s4Total = numeros.querySelector<HTMLElement>("[data-s6-4-total]");
    const s4Counters = Array.from(numeros.querySelectorAll<HTMLElement>("[data-s6-4-counter]"));
    const s4TotalCounter = numeros.querySelector<HTMLElement>("[data-s6-4-counter-total]");

    const criarTimeline = (gatilho: HTMLElement) => gsap.timeline({
      scrollTrigger: {
        trigger: gatilho,
        start: "top 90%",
        end: "top 30%",
        markers: MARCADORES,
        scrub: 1,
        invalidateOnRefresh: true,
      },
      defaults: { duration: 0.6, ease: "power1.inOut" },
    });

    const contador = (
      timeline: gsap.core.Timeline,
      alvo: HTMLElement | null,
      valorFinal: number,
      formatar: (valor: number) => string,
      posicao: gsap.Position = "<",
    ) => {
      if (!alvo) return;
      const estado = { valor: 0 };
      alvo.textContent = formatar(0);
      timeline.to(estado, {
        valor: valorFinal,
        onUpdate: () => (alvo.textContent = formatar(Math.round(estado.valor))),
      }, posicao);
    };

    // Cena 1 — 40 contas e o consumo mensal.
    if (cena1) {
      gsap.set([titulo, chamada, consumoLinha, consumoValor, comissaoAquisicao].filter(Boolean), {
        autoAlpha: 0,
        y: 28,
      });
      gsap.set(tituloFinal, { autoAlpha: 0 });
      gsap.set(contas, { autoAlpha: 0, scale: 0.3 });
      const timeline = criarTimeline(cena1);
      if (titulo) timeline.to(titulo, { autoAlpha: 1, y: 0 }, 0);
      if (chamada) timeline.to(chamada, { autoAlpha: 1, y: 0 }, ">0.3");
      timeline.to(contas, { autoAlpha: 1, scale: 1, stagger: 0.045 }, ">0.3");
      if (consumoLinha) timeline.to(consumoLinha, { autoAlpha: 1, y: 0 }, ">0.3");
      if (consumoValor) {
        timeline.to(consumoValor, { autoAlpha: 1, y: 0 }, ">0.3");
        contador(timeline, consumoValor, 15, (valor) => `R$ ${valor} mil`);
      }
      if (comissaoAquisicao) timeline.to(comissaoAquisicao, { autoAlpha: 1, y: 0 }, ">0.3");
    }

    // Cena 2 — comissão relacionada ao volume cadastrado.
    if (cena2) {
      gsap.set([s2Intro, s2Pill, s2Legenda].filter(Boolean), { autoAlpha: 0, y: 28 });
      const timeline = criarTimeline(cena2);
      if (s2Intro) timeline.to(s2Intro, { autoAlpha: 1, y: 0 }, 0);
      if (s2Pill) {
        timeline.to(s2Pill, { autoAlpha: 1, y: 0, scale: 1 }, ">0.3");
        contador(timeline, s2Counter, 6000, (valor) => `R$ ${valor.toLocaleString("pt-BR")}`);
      }
      if (s2Legenda) timeline.to(s2Legenda, { autoAlpha: 1, y: 0 }, ">0.3");
    }

    // Cena 3 — bônus e total de bônus das 40 contas.
    if (cena3) {
      gsap.set(
        [s3Eyebrow, s3Title, s3Linha, s3Bonus, s3Ouseja, s3Coluna1, s3Coluna2].filter(Boolean),
        { autoAlpha: 0, y: 28 },
      );
      gsap.set(s3Contas, { autoAlpha: 0, scale: 0.3 });
      const timeline = criarTimeline(cena3);
      if (s3Eyebrow) timeline.to(s3Eyebrow, { autoAlpha: 1, y: 0 }, 0);
      if (s3Title) timeline.to(s3Title, { autoAlpha: 1, y: 0 }, ">0.3");
      if (s3Linha) timeline.to(s3Linha, { autoAlpha: 1, y: 0 }, ">0.3");
      timeline.to(s3Contas, { autoAlpha: 1, scale: 1, stagger: 0.08 }, ">0.3");
      if (s3Bonus) {
        timeline.to(s3Bonus, { autoAlpha: 1, y: 0 }, ">0.3");
        contador(timeline, s3BonusCounter, 1000, (valor) => `R$ ${valor.toLocaleString("pt-BR")}`);
      }
      if (s3Ouseja) timeline.to(s3Ouseja, { autoAlpha: 1, y: 0 }, ">0.3");
      if (s3Coluna1) timeline.to(s3Coluna1, { autoAlpha: 1, y: 0 }, ">0.3");
      if (s3Coluna2) {
        timeline.to(s3Coluna2, { autoAlpha: 1, y: 0 }, ">0.3");
        contador(timeline, s3TotalCounter, 4000, (valor) => `R$ ${valor.toLocaleString("pt-BR")}`);
      }
    }

    // Cena 4 — soma da comissão e do bônus.
    if (cena4) {
      gsap.set([s4Titulo, s4Card1, s4Plus, s4Card2, s4Total].filter(Boolean), {
        autoAlpha: 0,
        y: 28,
      });
      const timeline = criarTimeline(cena4);
      if (s4Titulo) timeline.to(s4Titulo, { autoAlpha: 1, y: 0 }, 0);
      if (s4Card1) {
        timeline.to(s4Card1, { autoAlpha: 1, y: 0 }, ">0.3");
        contador(timeline, s4Counters[0] ?? null, 6000, (valor) => `R$ ${valor.toLocaleString("pt-BR")}`);
      }
      if (s4Plus) timeline.to(s4Plus, { autoAlpha: 1, y: 0, scale: 1 }, ">0.3");
      if (s4Card2) {
        timeline.to(s4Card2, { autoAlpha: 1, y: 0 }, ">0.3");
        contador(timeline, s4Counters[1] ?? null, 4000, (valor) => `R$ ${valor.toLocaleString("pt-BR")}`);
      }
      if (s4Total) {
        timeline.to(s4Total, { autoAlpha: 1, y: 0 }, ">0.3");
        contador(timeline, s4TotalCounter, 10000, (valor) => `R$ ${valor.toLocaleString("pt-BR")}`);
      }
    }
  }

  const seletores = [
    "[data-hero-title]",
    "[data-hero-item]",
    "[data-hero-chip]",
    ".reveal",
    "[data-stagger] > *",
    "[data-palco-intro]",
    "[data-palco-pergunta]",
    "[data-palco-prov]",
    "[data-palco-tile]",
    "[data-palco-fecho]",
    "[data-s3-eyebrow]",
    "[data-s3-title]",
    "[data-s3-left] > p",
    "[data-s3-card]",
    "[data-s3-continuity] > *",
    "[data-s3-bridge-copy]",
    "[data-s3-bridge-image]",
    "[data-s3-process-title]",
    "[data-s3-process-end]",
    ".numeros__scene",
    "[data-rec-header-text]",
    "[data-rec-card]",
    "[data-rec-scale-title]",
    "[data-rec-boxes] > li",
    "[data-rec-turn-title]",
    "[data-rec-turn-part]",
  ];

  const vistos = new Set<Element>();
  const alvos = seletores.flatMap((seletor) =>
    Array.from(raiz.querySelectorAll<HTMLElement>(seletor)),
  ).filter((elemento) => {
    // A hero permanece estática nesta versão.
    if (elemento.closest(".hero")) return false;
    // A sessão de números tem counters e sequências próprias.
    if (elemento.closest(".numeros")) return false;
    // O box "O processo é simples" possui uma timeline própria abaixo.
    if (elemento.closest(".process")) return false;
    if (vistos.has(elemento)) return false;
    vistos.add(elemento);
    return true;
  });

  // Mantém a entrada original de cada elemento, que responde de forma mais
  // natural à rolagem. O escalonamento só entra em grupos que compartilham o
  // mesmo espaço visual (cards, bullets e listas), sem comprimir uma seção
  // inteira em uma única timeline longa.
  const atrasos = new Map<HTMLElement, number>();
  raiz.querySelectorAll<HTMLElement>("[data-stagger]").forEach((grupo) => {
    Array.from(grupo.children).forEach((filho, indice) => {
      if (filho instanceof HTMLElement) atrasos.set(filho, indice * 1);
    });
  });

  alvos.forEach((elemento) => {
    gsap.fromTo(
      elemento,
      { autoAlpha: 0, y: 32 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        delay: atrasos.get(elemento) ?? 0,
        ease: "power1.inOut",
        scrollTrigger: {
          trigger: elemento,
          start: "top 90%",
        end: "top 30%",
        markers: MARCADORES,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      },
    );
  });

  const processo = raiz.querySelector<HTMLElement>(".process");
  if (processo) {
    const titulo = processo.querySelector<HTMLElement>("[data-s3-process-title]");
    const etapas = Array.from(
      processo.querySelectorAll<HTMLElement>(".process__grid > li"),
    );
    const fecho = processo.querySelector<HTMLElement>("[data-s3-process-end]");

    // Todos os estados iniciais precisam existir antes de o bloco alcançar o
    // viewport. Sem isto, tweens posicionados mais à frente na timeline só
    // escondem seus elementos quando o playhead chega neles, causando o flash
    // dos cards antes do título.
    gsap.set(processo, { autoAlpha: 0, y: 32 });
    if (titulo) gsap.set(titulo, { autoAlpha: 0, y: 28 });
    gsap.set(etapas, { autoAlpha: 0, y: 28, scale: 0.985 });
    if (fecho) gsap.set(fecho, { autoAlpha: 0, y: 24 });

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: processo,
        start: "top 90%",
        end: "top 30%",
        markers: MARCADORES,
        // Um scrub um pouco mais longo filtra os degraus da roda/trackpad e
        // deixa a sequência acompanhar a rolagem de forma mais fluida.
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    timeline.to(processo, {
      autoAlpha: 1,
      y: 0,
      duration: 0.6,
      ease: "power1.inOut",
    });

    if (titulo) {
      timeline.to(titulo, {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        ease: "power1.inOut",
      }, ">0.6");
    }

    timeline.to(
      etapas,
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger: 1,
        ease: "power1.inOut",
      },
      ">0.6",
    );

    if (fecho) {
      timeline.to(fecho, {
        autoAlpha: 1,
        y: 0,
        duration: 0.6,
        ease: "power1.inOut",
      }, ">0.6");
    }
  }

  sincronizarRolagemSuave(() => ScrollTrigger.update());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}
