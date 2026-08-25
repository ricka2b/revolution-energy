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
 * travar o scroll de verdade (a sequência final da seção de números, por
 * exemplo) é preciso parar o Lenis também.
 *
 * Sem instância (ponteiro grosso, ou `prefers-reduced-motion`), a rolagem já
 * é 100% nativa e essas funções não fazem nada.
 */
export function pausarRolagemSuave() {
  instancia?.stop();
}

export function retomarRolagemSuave() {
  instancia?.start();
}

/** Mantém bibliotecas vinculadas ao scroll em sincronia com o RAF do Lenis. */
export function sincronizarRolagemSuave(callback: () => void) {
  instancia?.on("scroll", callback);
}
