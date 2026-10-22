/**
 * Rolagem suave global com Lenis.
 *
 * A suavização fica restrita a dispositivos com ponteiro fino. Em touch, a
 * rolagem continua 100% nativa — importante para não introduzir inércia
 * artificial no iOS e para preservar os gestos do sistema.
 */
import Lenis from "lenis";
import "lenis/dist/lenis.css";

const ponteiroFino = window.matchMedia("(pointer: fine)");
const movimentoReduzido = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

let instancia: Lenis | null = null;

if (ponteiroFino.matches && !movimentoReduzido.matches) {
  instancia = new Lenis({
    autoRaf: true,
    smoothWheel: true,
    syncTouch: false,
    lerp: 0.09,
    wheelMultiplier: 0.9,
    overscroll: true,
    anchors: {
      offset: -56,
      duration: 1,
    },
  });
}

/**
 * O Lenis tem o próprio listener de wheel e a própria animação de rolagem —
 * um `preventDefault` isolado em outro módulo não o impede de continuar. Para
 * travar o scroll de verdade é preciso parar o Lenis também.
 *
 * A contagem existe porque mais de uma cena pode pedir a pausa ao mesmo
 * tempo (ou em sequência, com sobreposição). Sem ela, a primeira que
 * terminasse chamaria `start()` e destravaria a rolagem por baixo das
 * outras — que continuariam achando que ainda estão segurando a tela.
 *
 * Sem instância (ponteiro grosso, ou `prefers-reduced-motion`), a rolagem já
 * é 100% nativa e estas funções não fazem nada.
 */
let pedidosDePausa = 0;

export function pausarRolagemSuave() {
  pedidosDePausa += 1;
  if (pedidosDePausa === 1) instancia?.stop();
}

export function retomarRolagemSuave() {
  if (pedidosDePausa === 0) return;
  pedidosDePausa -= 1;
  if (pedidosDePausa === 0) instancia?.start();
}

/** Mantém bibliotecas vinculadas ao scroll em sincronia com o RAF do Lenis. */
export function sincronizarRolagemSuave(callback: () => void) {
  instancia?.on("scroll", callback);
}

/** Saltos para âncoras não devem atravessar e ativar as cenas intermediárias. */
export function saltarParaAncora(alvo: HTMLElement) {
  const top = Math.max(0, window.scrollY + alvo.getBoundingClientRect().top - 56);
  if (instancia) {
    instancia.resize();
    instancia.scrollTo(top, { immediate: true, force: true });
  } else {
    window.scrollTo({ top, behavior: "instant" });
  }
}
