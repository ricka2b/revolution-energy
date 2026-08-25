/**
 * Camada de movimento — anime.js v4.
 *
 * Regras que este módulo segue (skills `emilkowalski-design` e `ui-ux-pro-max`):
 *
 * - só `transform` e `opacity` (sem layout, sem paint);
 * - entradas em `ease-out` com curva própria — nunca `ease-in`;
 * - micro-interação abaixo de 300ms, entrada de seção até 700ms;
 * - stagger curto (30–80ms) para o conjunto não parecer lento;
 * - entradas de conteúdo são sincronizadas e reversíveis (`repeat: true`):
 *   descendo elas montam, subindo elas retornam ao estado inicial;
 * - `prefers-reduced-motion` desliga tudo antes daqui (script inline no Layout);
 * - hover só em ponteiro fino, no CSS.
 *
 * Sem JavaScript a página aparece inteira: os estados iniciais dependem da
 * classe `.anim`, que este módulo remove se algo der errado.
 */
import {
  animate,
  createTimeline,
  cubicBezier,
  eases,
  onScroll,
  splitText,
  stagger,
  utils,
} from "animejs";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  pausarRolagemSuave,
  retomarRolagemSuave,
  sincronizarRolagemSuave,
} from "./smooth-scroll";

gsap.registerPlugin(ScrollTrigger);

const raiz = document.documentElement;

/**
 * Deslocamento vertical do `.grupo` da segunda dobra no estado final (já
 * assentado). `segundaDobra` calcula e escreve aqui; `aproximarSecaoSeguinte`
 * lê para simular esse estado ao medir a distância até a seção seguinte —
 * as duas funções rodam em sequência, mas são independentes.
 */
let deslocamentoFinalGrupoReconhecimento = 0;

/**
 * Curva de saída forte — a mesma de `--ease-out` no CSS.
 * A partir do anime.js v4 a curva vem da função, não de uma string.
 */
const EASE = cubicBezier(0.23, 1, 0.32, 1);

/** Desaceleração mais longa, para os números subirem sem parecer travados. */
const EASE_CONTAGEM = eases.outCubic;

/**
 * Curva mais macia, para a sequência da segunda dobra.
 * A `EASE` acima é forte de propósito em micro-interação; num trecho longo,
 * com o texto entrando letra a letra, ela lê como solavanco.
 */
const EASE_SUAVE = cubicBezier(0.33, 1, 0.68, 1);

/** Curva simétrica para animações raspadas: não salta no início nem no fim. */
const EASE_SCROLL = cubicBezier(0.45, 0, 0.55, 1);

/**
 * Velocidade constante.
 *
 * Atenção: o `linear` exportado pelo anime.js é uma *fábrica* de easing
 * (`linear(...)` devolve a curva), não a curva em si. Passá-lo direto faz o
 * cálculo do tween virar NaN e a animação não sai do lugar — a curva certa
 * é `eases.linear`.
 */
const EASE_LINEAR = eases.linear;

const formatador = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

function $$<T extends Element = HTMLElement>(
  sel: string,
  raiz: ParentNode = document,
) {
  return Array.from(raiz.querySelectorAll(sel)) as T[];
}

/* ------------------------------------------------------------------ *
 * Hero — entrada em cascata assim que a página abre.
 * ------------------------------------------------------------------ */

function hero() {
  const titulo = document.querySelector<HTMLElement>("[data-hero-title]");
  const itens = $$("[data-hero-item]");
  const chips = $$("[data-hero-chip]");

  const linha = createTimeline({ defaults: { ease: EASE } });

  if (titulo) {
    // Cada linha do título sobe de dentro da própria máscara.
    const partes = splitText(titulo, {
      lines: { wrap: "clip", class: "line-mask" },
      words: false,
      chars: false,
    });

    utils.set(titulo, { opacity: 1 });

    linha.add(
      partes.lines,
      {
        y: ["102%", "0%"],
        opacity: [0, 1],
        duration: 800,
      },
      stagger(80),
    );
  }

  if (itens.length) {
    linha.add(
      itens,
      { opacity: [0, 1], y: [14, 0], duration: 620 },
      stagger(90, { start: "-=480" }),
    );
  }

  if (chips.length) {
    linha.add(
      chips,
      { opacity: [0, 1], y: [10, 0], scale: [0.96, 1], duration: 520 },
      stagger(60, { start: "-=520" }),
    );
  }

  // Parallax discreto da foto — só onde a composição é em duas colunas.
  const foto = document.querySelector<HTMLElement>("[data-hero-media]");
  const heroEl = document.querySelector<HTMLElement>(".hero");
  if (foto && heroEl && window.matchMedia("(min-width: 60rem)").matches) {
    animate(foto, {
      y: [0, 72],
      ease: EASE_LINEAR,
      autoplay: onScroll({
        target: heroEl,
        enter: "top top",
        leave: "bottom top",
        sync: 0.2,
      }),
    });
  }
}

/* ------------------------------------------------------------------ *
 * Texto que entra letra por letra.
 * ------------------------------------------------------------------ */

/**
 * Divide o texto em letras animáveis.
 *
 * A máscara vai na **palavra**, não na letra. Mascarar letra a letra faz de
 * cada caractere um `inline-block` independente, e aí o navegador pode
 * quebrar a linha entre duas letras da mesma palavra — foi o que partiu
 * "conhece" ao meio. Com a máscara na palavra, a palavra nunca racha.
 *
 * O respiro embaixo de cada máscara existe porque `overflow: clip` corta o
 * que passa da linha de base: sem ele as descidas de "g", "q" e "ç" ficavam
 * decepadas.
 */
function dividirEmLetras(el: HTMLElement) {
  const divisao = splitText(el, {
    words: { wrap: "clip" },
    chars: true,
    lines: false,
  });

  for (const palavra of divisao.words as HTMLElement[]) {
    const mascara = palavra.parentElement;
    if (!mascara) continue;
    mascara.style.paddingTop = "0.2em";
    mascara.style.marginTop = "-0.2em";
    mascara.style.paddingBottom = "0.18em";
    mascara.style.marginBottom = "-0.18em";
  }

  return divisao.chars as HTMLElement[];
}

type Controlavel = {
  duration: number;
  seek: (tempo: number) => unknown;
};

type Vinculada = {
  animacao: Controlavel;
  alvo: HTMLElement;
  inicioViewport: number;
  fimViewport: number;
  usaFundo: boolean;
  topo: number;
  altura: number;
  ultimo: number;
};

const vinculadas: Vinculada[] = [];
let vinculadasIniciadas = false;
let frameVinculadas = 0;
let frameMedicaoVinculadas = 0;

function medirVinculadas() {
  for (const item of vinculadas) {
    const caixa = item.alvo.getBoundingClientRect();
    item.topo = caixa.top + window.scrollY;
    item.altura = caixa.height;
    item.ultimo = -1;
  }
}

function aplicarVinculadas() {
  frameVinculadas = 0;
  const alturaJanela = window.innerHeight;
  const rolagem = window.scrollY;

  for (const item of vinculadas) {
    const inicio = item.topo - alturaJanela * item.inicioViewport;
    const fim = item.usaFundo
      ? item.topo + item.altura - alturaJanela * item.fimViewport
      : item.topo - alturaJanela * item.fimViewport;
    const progresso = Math.min(1, Math.max(0, (rolagem - inicio) / (fim - inicio)));
    if (Math.abs(progresso - item.ultimo) < 0.0005) continue;
    item.ultimo = progresso;
    item.animacao.seek(item.animacao.duration * progresso);
  }
}

function agendarVinculadas() {
  if (frameVinculadas) return;
  frameVinculadas = requestAnimationFrame(aplicarVinculadas);
}

function agendarMedicaoVinculadas() {
  if (frameMedicaoVinculadas) return;
  frameMedicaoVinculadas = requestAnimationFrame(() => {
    frameMedicaoVinculadas = 0;
    medirVinculadas();
    aplicarVinculadas();
  });
}

/**
 * Registra uma timeline no controlador global. As medidas de layout ficam em
 * cache e só são refeitas no resize; durante a rolagem há um único RAF.
 */
function vincular(
  animacao: Controlavel,
  alvo: HTMLElement,
  opcoes: {
    inicio?: number;
    fim?: number;
    usaFundo?: boolean;
  } = {},
) {
  vinculadas.push({
    animacao,
    alvo,
    inicioViewport: opcoes.inicio ?? 0.8,
    fimViewport: opcoes.fim ?? 0.38,
    usaFundo: opcoes.usaFundo ?? false,
    topo: 0,
    altura: 0,
    ultimo: -1,
  });

  if (!vinculadasIniciadas) {
    vinculadasIniciadas = true;
    window.addEventListener("scroll", agendarVinculadas, { passive: true });
    window.addEventListener("resize", agendarMedicaoVinculadas, { passive: true });
    window.addEventListener("load", agendarMedicaoVinculadas, { once: true });
  }

  agendarMedicaoVinculadas();
}

/* ------------------------------------------------------------------ *
 * Segunda dobra.
 * ------------------------------------------------------------------ */

/**
 * O palco fica preso na tela e o percurso do trilho comanda a cena em dois
 * regimes:
 *
 *   - as duas primeiras frases são **disparadas**: a rolagem dá o start e as
 *     letras entram no tempo delas, para a frase aparecer inteira mesmo se a
 *     pessoa parar no meio;
 *   - da transição da pergunta em diante é tudo **raspado no scroll**: uma
 *     linha do tempo sem autoplay que é posicionada por `seek()` conforme o
 *     progresso. Encolher a pergunta, "Muito provavelmente:", cada tópico e a
 *     frase de fecho acontecem junto com o dedo, na ida e na volta.
 *
 * O progresso passa por uma suavização antes de virar `seek`: sem ela a cena
 * anda em degraus, no mesmo ritmo bruto da roda do mouse.
 */
function segundaDobra() {
  const trilho = document.querySelector<HTMLElement>("[data-palco]");
  const palco = trilho?.querySelector<HTMLElement>(".palco");
  if (!trilho || !palco) return;

  const grupo = trilho.querySelector<HTMLElement>(".grupo");
  const intro = trilho.querySelector<HTMLElement>("[data-palco-intro]");
  const pergunta = trilho.querySelector<HTMLElement>("[data-palco-pergunta]");
  const provavelmente = trilho.querySelector<HTMLElement>("[data-palco-prov]");
  const fecho = trilho.querySelector<HTMLElement>("[data-palco-fecho]");
  const itens = $$("[data-palco-tile]", trilho);
  if (!grupo || !intro || !pergunta || !provavelmente || !fecho) return;

  const letrasIntro = dividirEmLetras(intro);
  const letrasPergunta = dividirEmLetras(pergunta);

  // No primeiro momento, a pergunta (e não a caixa completa, que já reserva
  // o espaço dos cards invisíveis) fica exatamente no centro do palco. Ao
  // encolher, o grupo retorna a `y: 0`: assim pergunta, lista e fecho formam
  // uma composição única, centralizada horizontal e verticalmente. Animar o
  // grupo inteiro também evita o salto que acontecia quando só uma parte da
  // composição mudava de posição.
  const caixaPalco = palco.getBoundingClientRect();
  const centroPalco = caixaPalco.top + caixaPalco.height / 2;
  const caixaPerguntaNatural = pergunta.getBoundingClientRect();
  const centroInicialPergunta =
    centroPalco - (caixaPerguntaNatural.top + caixaPerguntaNatural.height / 2);
  deslocamentoFinalGrupoReconhecimento = 0;

  utils.set([intro, pergunta], { opacity: 1 });
  utils.set(grupo, { y: centroInicialPergunta });
  utils.set([...letrasIntro, ...letrasPergunta], { y: "110%" });
  utils.set(provavelmente, { opacity: 0, y: 14 });
  utils.set(itens, { opacity: 0, y: 22 });
  utils.set(fecho, { opacity: 0, y: 18 });

  /* ---- regime 1: abertura, disparada de uma vez ---- */

  const CORPO_CHAMADA = 620;
  const PASSO_CHAMADA = 14;
  const CORPO_PERGUNTA = 700;
  const PASSO_PERGUNTA = 11;

  // A pergunta entra quando a chamada está em 80% do próprio percurso: as
  // duas frases se sobrepõem em vez de uma esperar a outra terminar.
  const percursoChamada =
    CORPO_CHAMADA + PASSO_CHAMADA * Math.max(0, letrasIntro.length - 1);
  const entradaPergunta = Math.round(percursoChamada * 0.8);

  const abertura = {
    // No celular a trava começa assim que o palco encosta no topo. Isso
    // impede que a inércia do primeiro gesto avance a cena antes de a
    // pergunta terminar de entrar e se estabilizar no centro.
    em: window.matchMedia("(max-width: 48rem)").matches ? 0 : 0.05,
    ativo: false,
    executando: false,
  };
  let failsafeAbertura: number | undefined;

  // Durante a abertura, o gesto não pode carregar o palco para a etapa
  // seguinte. O Lenis é interrompido junto com wheel/touch/teclado e só é
  // retomado quando a última letra da pergunta já parou no centro.
  const impedirRolagem = (evento: Event) => evento.preventDefault();
  const teclasDeRolagem = new Set([
    "ArrowDown",
    "ArrowUp",
    "PageDown",
    "PageUp",
    " ",
    "Home",
    "End",
  ]);
  const impedirTeclado = (evento: KeyboardEvent) => {
    if (teclasDeRolagem.has(evento.key)) evento.preventDefault();
  };

  const travarAbertura = () => {
    pausarRolagemSuave();
    window.addEventListener("wheel", impedirRolagem, {
      passive: false,
      capture: true,
    });
    window.addEventListener("touchmove", impedirRolagem, {
      passive: false,
      capture: true,
    });
    window.addEventListener("keydown", impedirTeclado, { capture: true });
    // Uma aba ocultada pode suspender o RAF do navegador e impedir o
    // `onComplete`. A trava nunca pode sobreviver indefinidamente.
    failsafeAbertura = window.setTimeout(liberarAbertura, 3500);
  };

  const liberarAbertura = () => {
    if (!abertura.executando) return;
    window.clearTimeout(failsafeAbertura);
    retomarRolagemSuave();
    window.removeEventListener("wheel", impedirRolagem, true);
    window.removeEventListener("touchmove", impedirRolagem, true);
    window.removeEventListener("keydown", impedirTeclado, true);
    abertura.executando = false;
  };

  const abrir = () => {
    abertura.executando = true;
    travarAbertura();
    animate(letrasIntro, {
      y: "0%",
      duration: CORPO_CHAMADA,
      ease: EASE_SUAVE,
      delay: stagger(PASSO_CHAMADA),
    });
    animate(letrasPergunta, {
      y: "0%",
      duration: CORPO_PERGUNTA,
      ease: EASE_SUAVE,
      delay: stagger(PASSO_PERGUNTA, { start: entradaPergunta }),
      onComplete: liberarAbertura,
    });
  };

  // A saída é mais curta que a entrada e começa pela última letra: desmonta
  // na ordem inversa de como montou, a pergunta saindo primeiro.
  const fechar = () => {
    animate(letrasPergunta, {
      y: "110%",
      duration: 460,
      ease: EASE_SUAVE,
      delay: stagger(6, { from: "last" }),
    });
    animate(letrasIntro, {
      y: "110%",
      duration: 460,
      ease: EASE_SUAVE,
      delay: stagger(8, { from: "last", start: 140 }),
    });
  };

  /* ---- regime 2: linha do tempo raspada no scroll ---- */

  // A raspagem só começa a reagir depois de um respiro (a pergunta grande
  // fica parada na tela até ali) e termina antes do fim do trilho de
  // propósito: o trecho que sobra é tempo de tela com a cena montada e a
  // frase de fecho já visível, para dar tempo de ler antes de o bloco
  // seguinte entrar.
  const INICIO_RASPADO = 0.34;
  const FIM_RASPADO = 0.86;

  /** Mede o corpo que o CSS daria à pergunta em cada estado. */
  const medirCorpo = (estadoFinal: boolean) => {
    const tinha = pergunta.classList.contains("pergunta--fim");
    const inline = pergunta.style.fontSize;
    pergunta.classList.toggle("pergunta--fim", estadoFinal);
    pergunta.style.fontSize = "";
    const corpo = parseFloat(getComputedStyle(pergunta).fontSize);
    pergunta.style.fontSize = inline;
    pergunta.classList.toggle("pergunta--fim", tinha);
    return corpo;
  };

  let raspada = criarRaspada();

  function criarRaspada() {
    // Solta a medida: com o corpo grande o texto segue em duas linhas e
    // assume uma linha só quando encolher o bastante para caber.
    utils.set(pergunta, { maxWidth: "100%" });

    const linha = createTimeline({
      autoplay: false,
      defaults: { ease: EASE_SUAVE },
    });

    linha.add(intro, { opacity: 0, y: -28, duration: 560 }, 0);
    linha.add(
      pergunta,
      { fontSize: [medirCorpo(false), medirCorpo(true)], duration: 760 },
      0,
    );
    linha.add(
      grupo,
      {
        y: [centroInicialPergunta, 0],
        // A subida percorre uma faixa maior da rolagem que a redução da
        // fonte. A curva simétrica evita tanto o arranque quanto a parada
        // brusca, mantendo a pergunta visualmente assentada durante o gesto.
        duration: 1280,
        ease: EASE_SCROLL,
      },
      0,
    );
    // Entrada longa com deslocamento curto: desliza em vez de pular.
    linha.add(provavelmente, { opacity: 1, y: 0, duration: 900 }, 760);
    // Passo largo entre os itens: um termina de entrar antes de o próximo
    // começar, em vez de todos borrarem juntos.
    linha.add(
      itens,
      { opacity: 1, y: 0, duration: 620, delay: stagger(340) },
      1560,
    );
    // A frase fecha a cena sem criar uma espera longa antes da seção seguinte.
    linha.add(fecho, { opacity: 1, y: 0, duration: 680 }, 4380);

    return linha;
  }

  /* ---- leitura da rolagem, com suavização ---- */

  let alvo = 0;
  let atual = 0;
  let animando = false;
  let agendado = false;

  const aplicar = (p: number) => {
    raspada.seek(raspada.duration * p);
    pergunta.classList.toggle("pergunta--fim", p > 0.92);
  };

  const suavizar = () => {
    // Aproximação exponencial: a cena persegue a posição da rolagem em vez
    // de saltar para ela. É o que tira a dureza do scrub.
    atual += (alvo - atual) * 0.14;
    if (Math.abs(alvo - atual) < 0.0004) {
      atual = alvo;
      animando = false;
    } else {
      requestAnimationFrame(suavizar);
    }
    aplicar(atual);
  };

  const conferir = () => {
    agendado = false;
    const caixa = trilho.getBoundingClientRect();
    const percurso = caixa.height - window.innerHeight;
    if (percurso <= 0) return;

    const progresso = -caixa.top / percurso;

    const abriu = progresso >= abertura.em;
    if (abriu !== abertura.ativo) {
      abertura.ativo = abriu;
      // Uma âncora pode carregar a página depois desta seção. Nesse caso a
      // abertura é montada fora da tela, sem sequestrar a rolagem da pessoa.
      if (abriu && progresso < INICIO_RASPADO) abrir();
      else if (abriu) utils.set([...letrasIntro, ...letrasPergunta], { y: "0%" });
      else fechar();
    }

    alvo = Math.min(
      1,
      Math.max(0, (progresso - INICIO_RASPADO) / (FIM_RASPADO - INICIO_RASPADO)),
    );

    if (!animando) {
      animando = true;
      requestAnimationFrame(suavizar);
    }
  };

  const agendar = () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(conferir);
  };

  // A medida da pergunta depende da largura: ao redimensionar, a linha do
  // tempo é refeita e reposicionada no ponto atual.
  let refazendo: number | undefined;
  const refazer = () => {
    window.clearTimeout(refazendo);
    refazendo = window.setTimeout(() => {
      raspada.revert();
      raspada = criarRaspada();
      aplicar(atual);
    }, 200);
  };

  window.addEventListener("scroll", agendar, { passive: true });
  window.addEventListener("resize", () => {
    refazer();
    agendar();
  });

  // `requestAnimationFrame` não roda em aba oculta: reconfere na volta.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) conferir();
  });

  conferir();
}

/* ------------------------------------------------------------------ *
 * Aproxima a seção seguinte do fim da sequência.
 * ------------------------------------------------------------------ */

/**
 * O palco tem 100svh e centraliza o grupo, então sobra um vazio embaixo que
 * não é margem de ninguém — é só palco. Sem corrigir, a seção seguinte fica
 * a "40px + esse vazio" da última frase, o que na tela vira um buraco.
 *
 * Aqui a sobra é medida no estado final da sequência (pergunta já encolhida,
 * que é quando o grupo tem a altura definitiva) e devolvida como `--puxar`.
 * O CSS desconta esse valor da margem, e a distância visível volta a ser 40px.
 *
 * A seção puxada fica atrás do palco enquanto ele está preso — daí o fundo
 * opaco no palco — e aparece no lugar certo assim que ele sai de cena.
 */
function aproximarSecaoSeguinte() {
  const trilho = document.querySelector<HTMLElement>("[data-palco]");
  const palco = trilho?.querySelector<HTMLElement>(".palco");
  // A referência é a última frase, não a caixa do grupo: é dela que a
  // distância precisa ser medida, e a caixa do grupo pode terminar alguns
  // pixels abaixo do texto.
  const ultimaFrase = trilho?.querySelector<HTMLElement>("[data-palco-fecho]");
  const pergunta = trilho?.querySelector<HTMLElement>("[data-palco-pergunta]");
  const grupo = trilho?.querySelector<HTMLElement>(".grupo");
  const secao = document.querySelector<HTMLElement>(".reconhecimento");
  if (!trilho || !palco || !ultimaFrase || !pergunta || !grupo || !secao) return;

  const medir = () => {
    // Mede o estado em que a seção seguinte encosta: pergunta já encolhida,
    // o grupo já na posição final (assentada) e a última frase na posição
    // de layout.
    //
    // `getBoundingClientRect` soma o `transform`, e a frase começa deslocada
    // 24px para baixo pela animação de entrada. Sem zerar o deslocamento, a
    // medida sai 24px curta e a seção seguinte sobe demais.
    const tinhaClasse = pergunta.classList.contains("pergunta--fim");
    const corpoInline = pergunta.style.fontSize;
    const deslocamentoFrase = ultimaFrase.style.transform;
    const deslocamentoGrupo = grupo.style.transform;

    pergunta.classList.add("pergunta--fim");
    pergunta.style.fontSize = "";
    ultimaFrase.style.transform = "none";
    grupo.style.transform = `translateY(${deslocamentoFinalGrupoReconhecimento}px)`;

    const sobra =
      palco.getBoundingClientRect().bottom -
      ultimaFrase.getBoundingClientRect().bottom;

    pergunta.classList.toggle("pergunta--fim", tinhaClasse);
    pergunta.style.fontSize = corpoInline;
    ultimaFrase.style.transform = deslocamentoFrase;
    grupo.style.transform = deslocamentoGrupo;

    secao.style.setProperty("--puxar", `${Math.max(0, Math.round(sobra))}px`);
  };

  medir();

  let agendado: number | undefined;
  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(agendado);
      agendado = window.setTimeout(medir, 200);
    },
    { passive: true },
  );
}

/* ------------------------------------------------------------------ *
 * Terceira seção — narrativa completa raspada no scroll.
 * ------------------------------------------------------------------ */

function terceiraSecao() {
  const secao = document.querySelector<HTMLElement>("[data-seq-section3]");
  if (!secao) return;

  const intro = secao.querySelector<HTMLElement>(".intro");
  const mecanismo = secao.querySelector<HTMLElement>(".mechanism");
  const eyebrow = secao.querySelector<HTMLElement>("[data-s3-eyebrow]");
  const titulo = secao.querySelector<HTMLElement>("[data-s3-title]");
  const esquerda = $$("[data-s3-left] > p", secao);
  const card = secao.querySelector<HTMLElement>("[data-s3-card]");
  const cardTitulo = secao.querySelector<HTMLElement>("[data-s3-card-title]");
  const cardItens = $$("[data-s3-card-list] > li", secao);
  const continuidadeBloco = secao.querySelector<HTMLElement>("[data-s3-continuity]");
  const continuidade = $$("[data-s3-continuity] > *", secao);
  const ponte = secao.querySelector<HTMLElement>(".bridge");
  const ponteTexto = secao.querySelector<HTMLElement>("[data-s3-bridge-copy]");
  const ponteImagem = secao.querySelector<HTMLElement>("[data-s3-bridge-image]");

  if (
    !intro ||
    !mecanismo ||
    !eyebrow ||
    !titulo ||
    !card ||
    !cardTitulo ||
    !continuidadeBloco ||
    !ponte ||
    !ponteTexto ||
    !ponteImagem
  ) return;

  // A palavra é a máscara; as letras nunca viram unidades de quebra de linha.
  const letrasTitulo = dividirEmLetras(titulo);

  utils.set(titulo, { opacity: 1 });
  utils.set(letrasTitulo, { opacity: 0, y: "108%" });
  utils.set(eyebrow, { opacity: 0, y: 16 });
  utils.set(esquerda, { opacity: 0, y: 20 });
  utils.set(card, { opacity: 0, y: 26, scale: 0.985 });
  utils.set(cardTitulo, { opacity: 0, y: 14 });
  utils.set(cardItens, { opacity: 0, y: 12 });
  utils.set(continuidade, { opacity: 0, y: 18 });
  utils.set([ponteTexto, ponteImagem], { opacity: 0, y: 24 });

  // Cada parte acompanha a própria posição na viewport. O início em 80%
  // reproduz o gatilho editorial "top 80%" e a faixa longa até o centro
  // impede entradas bruscas mesmo quando a roda do mouse avança bastante.
  const linhaIntro = createTimeline({
    defaults: { ease: EASE_SCROLL },
    autoplay: false,
  });

  linhaIntro.add(eyebrow, { opacity: 1, y: 0, duration: 760 }, 0);
  linhaIntro.add(
    letrasTitulo,
    {
      opacity: 1,
      y: "0%",
      duration: 760,
      delay: stagger(15),
    },
    520,
  );

  vincular(linhaIntro, intro, { inicio: 0.82, fim: 0.36 });

  const linhaMecanismo = createTimeline({
    defaults: { ease: EASE_SCROLL },
    autoplay: false,
  });

  linhaMecanismo.add(
    esquerda,
    { opacity: 1, y: 0, duration: 760, delay: stagger(360) },
    0,
  );
  linhaMecanismo.add(card, { opacity: 1, y: 0, scale: 1, duration: 860 }, 520);
  linhaMecanismo.add(cardTitulo, { opacity: 1, y: 0, duration: 680 }, 940);
  linhaMecanismo.add(
    cardItens,
    { opacity: 1, y: 0, duration: 620, delay: stagger(240) },
    1320,
  );

  vincular(linhaMecanismo, mecanismo, {
    inicio: 0.82,
    fim: 0.25,
  });

  const linhaContinuidade = createTimeline({
    defaults: { ease: EASE_SCROLL },
    autoplay: false,
  });

  linhaContinuidade.add(
    continuidade,
    { opacity: 1, y: 0, duration: 900, delay: stagger(440) },
    0,
  );

  vincular(linhaContinuidade, continuidadeBloco, {
    inicio: 0.7,
    fim: 0.28,
  });

  const linhaPonte = createTimeline({
    defaults: { ease: EASE_SCROLL },
    autoplay: false,
  });

  linhaPonte.add(
    [ponteTexto, ponteImagem],
    { opacity: 1, y: 0, duration: 1050, delay: stagger(120) },
    0,
  );

  vincular(linhaPonte, ponte, { inicio: 0.82, fim: 0.46 });
}

function processoTravado() {
  const trilho = document.querySelector<HTMLElement>("[data-s3-process-track]");
  const processo = trilho?.querySelector<HTMLElement>("[data-s3-process]");
  const titulo = trilho?.querySelector<HTMLElement>("[data-s3-process-title]");
  const passos = trilho ? $$(".process__grid > .step", trilho) : [];
  const fim = trilho?.querySelector<HTMLElement>("[data-s3-process-end]");
  if (!trilho || !processo || !titulo || !passos.length || !fim) return;

  const ehMobile = window.matchMedia("(max-width: 48rem)").matches;

  if (ehMobile) {
    // No mobile o painel deixa de ser um carrossel/sticky: título, cards e
    // fechamento ocupam o fluxo vertical e cada item responde ao próprio
    // trecho de scroll, desaparecendo novamente ao subir.
    utils.set(processo, { opacity: 1, y: 0 });
    const elementos = [titulo, ...passos, fim];
    gsap.set(elementos, { autoAlpha: 0, y: 28, scale: .985 });

    elementos.forEach((elemento) => {
      gsap.to(elemento, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        ease: "power1.out",
        scrollTrigger: {
          trigger: elemento,
          start: "top 86%",
          end: "top 52%",
          scrub: 1.15,
          invalidateOnRefresh: true,
        },
      });
    });
    return;
  }

  // O painel fica presente durante o trecho sticky; o conteúdo é montado
  // exclusivamente pelo avanço do scroll e desmontado na volta.
  utils.set(processo, { opacity: 1, y: 0 });
  utils.set(titulo, { opacity: 0, y: 18 });
  utils.set(passos, { opacity: 0, y: 24, scale: 0.985 });
  utils.set(fim, { opacity: 0, y: 14 });

  const linha = createTimeline({
    defaults: { ease: EASE_SCROLL },
    autoplay: false,
  });

  linha.add(titulo, { opacity: 1, y: 0, duration: 620 }, 0);
  linha.add(
    passos,
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 680,
      delay: stagger(720),
    },
    760,
  );
  linha.add(fim, { opacity: 1, y: 0, duration: 620 }, 4300);

  // A timeline termina um pouco antes do fim do sticky, deixando uma pausa
  // curta com as quatro etapas e o fechamento totalmente visíveis.
  vincular(linha, trilho, { inicio: 0.18, fim: 1.06, usaFundo: true });
}

/* ------------------------------------------------------------------ *
 * Seção de números — palco fixo com 40 contas e counter de consumo.
 * ------------------------------------------------------------------ */

function numerosInterativos() {
  const trilho = document.querySelector<HTMLElement>("[data-num-track]");
  const palco = trilho?.querySelector<HTMLElement>(".numeros__stage");
  const titulo = trilho?.querySelector<HTMLElement>("[data-num-title]");
  const tituloInicial = trilho?.querySelector<HTMLElement>("[data-num-title-initial]");
  const tituloFinal = trilho?.querySelector<HTMLElement>("[data-num-title-final]");
  const chamada = trilho?.querySelector<HTMLElement>("[data-num-accounts]");
  const grade = trilho?.querySelector<HTMLElement>("[data-num-icons]");
  const icones = trilho ? $$<HTMLElement>("[data-num-icon]", trilho) : [];
  const consumo = trilho?.querySelector<HTMLElement>("[data-num-consumption]");
  const consumoLinha = consumo?.querySelector<HTMLElement>(".premissa__linha");
  const consumoFrase = consumo?.querySelector<HTMLElement>(".premissa__valor");
  const consumoValor = trilho?.querySelector<HTMLElement>("[data-num-counter]");
  const comissao = trilho?.querySelector<HTMLElement>("[data-num-commission]");

  const cena1 = trilho?.querySelector<HTMLElement>('[data-num-scene="1"]');
  const cena2 = trilho?.querySelector<HTMLElement>('[data-num-scene="2"]');
  const cena3 = trilho?.querySelector<HTMLElement>('[data-num-scene="3"]');
  const cena4 = trilho?.querySelector<HTMLElement>('[data-num-scene="4"]');

  const s2Intro = cena2?.querySelector<HTMLElement>("[data-s6-2-intro]");
  const s2Pill = cena2?.querySelector<HTMLElement>("[data-s6-2-pill]");
  const s2Contador = cena2?.querySelector<HTMLElement>("[data-s6-2-counter]");
  const s2Legenda = cena2?.querySelector<HTMLElement>("[data-s6-2-legenda]");

  const s3Header = cena3?.querySelector<HTMLElement>("[data-s6-3-header]");
  const s3Linha = cena3?.querySelector<HTMLElement>("[data-s6-3-linha]");
  const s3Icones = cena3 ? $$<HTMLElement>("[data-s6-3-icones] img", cena3) : [];
  const s3BonusValor = cena3?.querySelector<HTMLElement>("[data-s6-3-bonus-valor]");
  const s3BonusCounter = cena3?.querySelector<HTMLElement>("[data-s6-3-bonus-counter]");
  const s3Ouseja = cena3?.querySelector<HTMLElement>("[data-s6-3-ouseja]");
  const s3Coluna1 = cena3?.querySelector<HTMLElement>('[data-s6-3-coluna="1"]');
  const s3Coluna1Label = s3Coluna1?.querySelector<HTMLElement>("p");
  const s3PillCiclos = cena3?.querySelector<HTMLElement>("[data-s6-3-pill-ciclos]");
  const s3Coluna2 = cena3?.querySelector<HTMLElement>('[data-s6-3-coluna="2"]');
  const s3Coluna2Label = s3Coluna2?.querySelector<HTMLElement>("p");
  const s3Coluna2Pill = s3Coluna2?.querySelector<HTMLElement>(".s6-3__pill");
  const s3TotalCounter = cena3?.querySelector<HTMLElement>(
    "[data-s6-3-bonus-total-counter]",
  );
  const s3EmBonus = cena3?.querySelector<HTMLElement>("[data-s6-3-em-bonus]");

  const s4Titulo = cena4?.querySelector<HTMLElement>("[data-s6-4-titulo]");
  const s4Card1 = cena4?.querySelector<HTMLElement>('[data-s6-4-card="1"]');
  const s4Card1Label = cena4?.querySelector<HTMLElement>(
    '[data-s6-4-card-label="1"]',
  );
  const s4Card2 = cena4?.querySelector<HTMLElement>('[data-s6-4-card="2"]');
  const s4Card2Label = cena4?.querySelector<HTMLElement>(
    '[data-s6-4-card-label="2"]',
  );
  const s4Plus = cena4?.querySelector<HTMLElement>("[data-s6-4-plus]");
  const s4ContadoresCard = cena4
    ? $$<HTMLElement>("[data-s6-4-counter]", cena4)
    : [];
  const s4TotalValor = cena4?.querySelector<HTMLElement>(
    "[data-s6-4-total-valor]",
  );
  const s4TotalLabel = cena4?.querySelector<HTMLElement>(
    "[data-s6-4-total-label]",
  );
  const s4ContadorTotal = cena4?.querySelector<HTMLElement>(
    "[data-s6-4-counter-total]",
  );

  if (
    !trilho ||
    !palco ||
    !titulo ||
    !tituloInicial ||
    !tituloFinal ||
    !chamada ||
    !grade ||
    !icones.length ||
    !consumo ||
    !consumoLinha ||
    !consumoFrase ||
    !consumoValor ||
    !comissao ||
    !cena1 ||
    !cena2 ||
    !cena3 ||
    !cena4 ||
    !s2Intro ||
    !s2Pill ||
    !s2Contador ||
    !s2Legenda ||
    !s3Header ||
    !s3Linha ||
    !s3Icones.length ||
    !s3BonusValor ||
    !s3BonusCounter ||
    !s3Ouseja ||
    !s3Coluna1 ||
    !s3Coluna1Label ||
    !s3PillCiclos ||
    !s3Coluna2 ||
    !s3Coluna2Label ||
    !s3Coluna2Pill ||
    !s3TotalCounter ||
    !s3EmBonus ||
    !s4Titulo ||
    !s4Card1 ||
    !s4Card1Label ||
    !s4Card2 ||
    !s4Card2Label ||
    !s4Plus ||
    s4ContadoresCard.length !== 2 ||
    !s4TotalValor ||
    !s4TotalLabel ||
    !s4ContadorTotal
  ) return;

  const letras = dividirEmLetras(tituloInicial);
  const letrasChamada = dividirEmLetras(chamada);
  const caixaPalco = palco.getBoundingClientRect();
  const caixaTitulo = titulo.getBoundingClientRect();
  const caixaChamada = chamada.getBoundingClientRect();
  const caixaS3Header = s3Header.getBoundingClientRect();
  const caixaS4Titulo = s4Titulo.getBoundingClientRect();
  const centroPalco = caixaPalco.top + caixaPalco.height / 2;
  const deslocamentoInicialTitulo =
    centroPalco - (caixaTitulo.top + caixaTitulo.height / 2);
  const deslocamentoInicialChamada =
    centroPalco - (caixaChamada.top + caixaChamada.height / 2);
  const deslocamentoInicialS3Header =
    centroPalco - (caixaS3Header.top + caixaS3Header.height / 2);
  const deslocamentoInicialS4Titulo =
    centroPalco - (caixaS4Titulo.top + caixaS4Titulo.height / 2);
  const contador = { valor: 0 };
  const escreverConsumo = () => {
    consumoValor.textContent = `R$ ${formatador.format(Math.round(contador.valor))} mil`;
  };

  // Cada contador de dinheiro é o mesmo truque do consumo acima: um objeto
  // à parte animado pelo `onUpdate`, e não o `data-count` do IntersectionObserver
  // — porque aqui quem comanda o progresso é o scroll raspado, não a entrada em tela.
  const contadorS2 = { valor: 0 };
  const escreverS2 = () =>
    (s2Contador.textContent = `R$ ${formatador.format(Math.round(contadorS2.valor))}`);

  const contadorS3Bonus = { valor: 0 };
  const escreverS3Bonus = () =>
    (s3BonusCounter.textContent = `R$ ${formatador.format(Math.round(contadorS3Bonus.valor))}`);

  const contadorS3Total = { valor: 0 };
  const escreverS3Total = () =>
    (s3TotalCounter.textContent = `R$ ${formatador.format(Math.round(contadorS3Total.valor))}`);

  const contadoresS4 = s4ContadoresCard.map((el) => ({
    el,
    alvo: Number(el.getAttribute("data-s6-4-counter") ?? 0),
    valor: 0,
  }));
  const escreverS4Card = (item: (typeof contadoresS4)[number]) =>
    (item.el.textContent = `R$ ${formatador.format(Math.round(item.valor))}`);

  const contadorTotal = { valor: 0 };
  const escreverTotal = () =>
    (s4ContadorTotal.textContent = `R$ ${formatador.format(Math.round(contadorTotal.valor))}`);

  utils.set(titulo, { opacity: 1, y: deslocamentoInicialTitulo, scale: 1.65 });
  utils.set(tituloInicial, { opacity: 1 });
  utils.set(tituloFinal, { opacity: 0 });
  utils.set(letras, { opacity: 0, y: 42 });
  utils.set(chamada, { opacity: 1, y: deslocamentoInicialChamada, scale: 1 });
  utils.set(letrasChamada, { opacity: 0, y: 34, scale: 0.86 });
  utils.set(icones, { opacity: 0, scale: 0.2 });
  utils.set(consumoLinha, { opacity: 0, y: 24 });
  utils.set(consumoFrase, { opacity: 0, y: 20 });
  utils.set(comissao, { opacity: 0, y: 24 });
  escreverConsumo();

  utils.set(cena1, { opacity: 1, scale: 1 });
  utils.set(cena2, { opacity: 0, scale: 1 });
  utils.set(cena3, { opacity: 0, scale: 1 });
  utils.set(cena4, { opacity: 0, scale: 1 });

  utils.set(s2Intro, { opacity: 0, y: 20 });
  utils.set(s2Pill, { opacity: 0, scale: 0.88 });
  utils.set(s2Legenda, { opacity: 0, y: 20 });
  escreverS2();

  const letrasS3Header = dividirEmLetras(s3Header);
  const letrasS3Pill = dividirEmLetras(s3PillCiclos);

  utils.set(s3Header, {
    opacity: 1,
    y: deslocamentoInicialS3Header,
    scale: 1.32,
  });
  utils.set(letrasS3Header, { opacity: 0, y: 30 });
  utils.set(s3Linha, { opacity: 0, y: 20 });
  utils.set(s3Icones, { opacity: 0, scale: 0.3 });
  utils.set(s3BonusValor, { opacity: 0, y: 18 });
  escreverS3Bonus();
  utils.set(s3Ouseja, { opacity: 0, y: 16 });
  utils.set(s3Coluna1Label, { opacity: 0, y: 20 });
  utils.set(s3PillCiclos, { opacity: 0 });
  utils.set(letrasS3Pill, { opacity: 0, y: 20 });
  utils.set(s3Coluna2Label, { opacity: 0, y: 20 });
  utils.set(s3Coluna2Pill, { opacity: 0 });
  escreverS3Total();

  const letrasS3EmBonus = dividirEmLetras(s3EmBonus);
  utils.set(s3EmBonus, { opacity: 1 });
  utils.set(letrasS3EmBonus, { opacity: 0, y: 18 });

  const letrasS4Titulo = dividirEmLetras(s4Titulo);
  utils.set(s4Titulo, {
    opacity: 1,
    y: deslocamentoInicialS4Titulo,
    scale: 1.3,
  });
  utils.set(letrasS4Titulo, { opacity: 0, y: 26 });

  const letrasS4Card1Label = dividirEmLetras(s4Card1Label);
  utils.set(s4Card1, { opacity: 0, y: 24 });
  utils.set(s4Card1Label, { opacity: 1 });
  utils.set(letrasS4Card1Label, { opacity: 0, y: 16 });

  const letrasS4Card2Label = dividirEmLetras(s4Card2Label);
  utils.set(s4Card2, { opacity: 0, y: 24 });
  utils.set(s4Card2Label, { opacity: 1 });
  utils.set(letrasS4Card2Label, { opacity: 0, y: 16 });

  utils.set(s4Plus, { scale: 0, rotate: 360 });

  utils.set(s4TotalValor, { opacity: 0, y: 24 });

  const letrasS4TotalLabel = dividirEmLetras(s4TotalLabel);
  utils.set(s4TotalLabel, { opacity: 1 });
  utils.set(letrasS4TotalLabel, { opacity: 0, y: 18 });

  contadoresS4.forEach(escreverS4Card);
  escreverTotal();

  const linha = createTimeline({
    defaults: { ease: EASE_SCROLL },
    autoplay: false,
  });

  // ---- Cena 1: título, chamada, 40 contas e a comissão de 40% ----

  linha.add(
    letras,
    { opacity: 1, y: 0, duration: 650, delay: stagger(25) },
    0,
  );
  linha.add(
    titulo,
    { y: 0, scale: 1, duration: 900 },
    1500,
  );
  linha.add(tituloInicial, { opacity: 0, duration: 320 }, 1720);
  linha.add(tituloFinal, { opacity: 1, duration: 320 }, 1720);
  linha.add(
    letrasChamada,
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 700,
      delay: stagger(18),
    },
    2050,
  );
  linha.add(
    chamada,
    { y: 0, duration: 900 },
    3500,
  );
  linha.add(
    icones,
    {
      opacity: 1,
      scale: 1,
      duration: 360,
      delay: stagger(8),
    },
    4400,
  );
  linha.add(consumoLinha, { opacity: 1, y: 0, duration: 680 }, 5350);
  linha.add(
    contador,
    {
      valor: 15,
      duration: 950,
      onUpdate: escreverConsumo,
    },
    5800,
  );
  linha.add(consumoFrase, { opacity: 1, y: 0, duration: 850 }, 5800);
  linha.add(comissao, { opacity: 1, y: 0, duration: 760 }, 6200);

  // ---- Transição 1 → 2: a cena que sai dá zoom e some; a próxima aparece ----

  linha.add(cena1, { scale: 1.16, opacity: 0, duration: 720 }, 7300);
  linha.add(cena2, { opacity: 1, duration: 650 }, 7450);

  // ---- Cena 2: "Com esse volume... até R$ 6.000" ----

  linha.add(s2Intro, { opacity: 1, y: 0, duration: 560 }, 8100);
  linha.add(s2Pill, { opacity: 1, scale: 1, duration: 680 }, 8700);
  linha.add(
    contadorS2,
    { valor: 6000, duration: 680, onUpdate: escreverS2 },
    8700,
  );
  linha.add(s2Legenda, { opacity: 1, y: 0, duration: 560 }, 9420);

  // ---- Transição 2 → 3 ----

  linha.add(cena2, { scale: 1.16, opacity: 0, duration: 720 }, 10320);
  linha.add(cena3, { opacity: 1, duration: 650 }, 10470);

  // ---- Cena 3: bônus a cada dez contas ----

  // A chamada começa grande e centralizada, letra por letra, e depois sobe
  // para o lugar que já ocupa no layout — o mesmo truque do título da cena 1.
  linha.add(
    letrasS3Header,
    { opacity: 1, y: 0, duration: 560, delay: stagger(16) },
    11120,
  );
  linha.add(s3Header, { y: 0, scale: 1, duration: 620 }, 12664);

  // A partir daqui os três blocos (a frase, as 10 contas e a comissão) ficam
  // quase colados — pedido para acontecerem "quase juntos", mais fluido.
  linha.add(s3Linha, { opacity: 1, y: 0, duration: 500 }, 13564);
  linha.add(
    s3Icones,
    { opacity: 1, scale: 1, duration: 300, delay: stagger(18) },
    13814,
  );
  linha.add(s3BonusValor, { opacity: 1, y: 0, duration: 480 }, 14214);
  linha.add(
    contadorS3Bonus,
    { valor: 1000, duration: 620, onUpdate: escreverS3Bonus },
    14334,
  );
  linha.add(s3Ouseja, { opacity: 1, y: 0, duration: 480 }, 15336);

  // "40 contas cadastradas são" aparece, "4 ciclos de 10 contas" digita
  // letra por letra e só então a coluna do resultado entra: o valor sobe em
  // contador e, assim que ele termina, "em bônus" também digita letra por
  // letra — a mesma lógica que já usamos nos outros números da seção.
  linha.add(s3Coluna1Label, { opacity: 1, y: 0, duration: 480 }, 16196);
  linha.add(s3PillCiclos, { opacity: 1, duration: 260 }, 16476);
  linha.add(
    letrasS3Pill,
    { opacity: 1, y: 0, duration: 420, delay: stagger(26) },
    16556,
  );
  linha.add(s3Coluna2Label, { opacity: 1, y: 0, duration: 480 }, 17870);
  linha.add(s3Coluna2Pill, { opacity: 1, duration: 260 }, 18150);
  linha.add(
    contadorS3Total,
    { valor: 4000, duration: 680, onUpdate: escreverS3Total },
    18150,
  );
  linha.add(
    letrasS3EmBonus,
    { opacity: 1, y: 0, duration: 340, delay: stagger(30) },
    18980,
  );

  // ---- Transição 3 → 4: o fade em si é quem troca o fundo pro claro ----

  linha.add(cena3, { scale: 1.16, opacity: 0, duration: 720 }, 19950);
  linha.add(cena4, { opacity: 1, duration: 650 }, 20100);

  const numerosNoMobile = window.matchMedia("(max-width: 57.999rem)").matches;

  // No mobile a cena final participa da mesma timeline raspada das três
  // anteriores. A antiga trava por eventos de toque podia ser atravessada
  // pela inércia do navegador antes que os listeners fossem ligados, o que
  // deixava toda a soma no estado invisível. Assim mantemos exatamente a
  // narrativa do desktop, mas vinculada diretamente ao gesto de rolagem:
  // título, primeiro valor, soma, segundo valor e total.
  if (numerosNoMobile) {
    const pausaFinalMobile = { progresso: 0 };

    linha.add(
      letrasS4Titulo,
      {
        opacity: 1,
        y: 0,
        duration: 620,
        delay: stagger(14),
      },
      20750,
    );
    linha.add(s4Titulo, { y: 0, scale: 1, duration: 760 }, 22050);

    linha.add(s4Card1, { opacity: 1, y: 0, duration: 620 }, 22950);
    linha.add(
      contadoresS4[0],
      {
        valor: contadoresS4[0].alvo,
        duration: 760,
        onUpdate: () => escreverS4Card(contadoresS4[0]),
      },
      22950,
    );
    linha.add(
      letrasS4Card1Label,
      { opacity: 1, y: 0, duration: 540, delay: stagger(16) },
      23100,
    );

    linha.add(s4Plus, { scale: 1, rotate: 0, duration: 680 }, 24250);
    linha.add(s4Card2, { opacity: 1, y: 0, duration: 620 }, 24250);
    linha.add(
      contadoresS4[1],
      {
        valor: contadoresS4[1].alvo,
        duration: 760,
        onUpdate: () => escreverS4Card(contadoresS4[1]),
      },
      24250,
    );
    linha.add(
      letrasS4Card2Label,
      { opacity: 1, y: 0, duration: 540, delay: stagger(16) },
      24400,
    );

    linha.add(s4TotalValor, { opacity: 1, y: 0, duration: 720 }, 25650);
    linha.add(
      contadorTotal,
      {
        valor: 10000,
        duration: 1500,
        ease: EASE_CONTAGEM,
        onUpdate: escreverTotal,
      },
      25650,
    );
    linha.add(
      letrasS4TotalLabel,
      { opacity: 1, y: 0, duration: 560, delay: stagger(16) },
      26000,
    );
    linha.add(
      pausaFinalMobile,
      { progresso: 1, duration: 1100, ease: EASE_LINEAR },
      27450,
    );

    vincular(linha, trilho, { inicio: 0, fim: 1.55, usaFundo: true });
    return;
  }

  vincular(linha, trilho, { inicio: 0, fim: 1.55, usaFundo: true });

  // ---- Cena 4: a soma final, sobre o fundo claro ----
  //
  // Daqui em diante não é mais raspado pelo scroll — é uma sequência de
  // etapas travadas: ao entrar na cena, a tela trava, o título aparece
  // grande e centralizado (letra por letra) e sobe para o lugar do layout.
  // A partir daí, cada rolagem dispara a etapa seguinte por inteiro; a tela
  // só destrava de novo depois que a última etapa termina (e um respiro).
  // Ver `sequenciaFinalTravada`.

  sequenciaFinalTravada({
    trilho,
    linha,
    pontoMs: 20750,
    etapas: [
      // Etapa 0 — dispara sozinha, assim que a cena 4 termina de entrar: as
      // letras digitam e só depois o título sobe (uma coisa de cada vez).
      () =>
        novaPromessa((r) =>
          animate(letrasS4Titulo, {
            opacity: 1,
            y: 0,
            duration: 520,
            ease: EASE_SCROLL,
            delay: stagger(14),
            onComplete: r,
          }),
        ).then(() =>
          novaPromessa((r) =>
            animate(s4Titulo, {
              y: 0,
              scale: 1,
              duration: 620,
              ease: EASE_SCROLL,
              onComplete: r,
            }),
          ),
        ),
      // Etapa 1 — o cartão do 6.000 e o rótulo dele, juntos.
      () =>
        Promise.all([
          novaPromessa((r) =>
            animate(s4Card1, {
              opacity: 1,
              y: 0,
              duration: 500,
              ease: EASE_SCROLL,
              onComplete: r,
            }),
          ),
          novaPromessa((r) =>
            animate(contadoresS4[0], {
              valor: contadoresS4[0].alvo,
              duration: 620,
              ease: EASE_SCROLL,
              onUpdate: () => escreverS4Card(contadoresS4[0]),
              onComplete: r,
            }),
          ),
          novaPromessa((r) =>
            animate(letrasS4Card1Label, {
              opacity: 1,
              y: 0,
              duration: 460,
              ease: EASE_SCROLL,
              delay: stagger(16),
              onComplete: r,
            }),
          ),
        ]).then(() => {}),
      // Etapa 2 — o "+" (girando), o cartão do 4.000 e o rótulo, juntos.
      () =>
        Promise.all([
          novaPromessa((r) =>
            animate(s4Plus, {
              scale: 1,
              rotate: 0,
              duration: 620,
              ease: EASE_SCROLL,
              onComplete: r,
            }),
          ),
          novaPromessa((r) =>
            animate(s4Card2, {
              opacity: 1,
              y: 0,
              duration: 500,
              ease: EASE_SCROLL,
              onComplete: r,
            }),
          ),
          novaPromessa((r) =>
            animate(contadoresS4[1], {
              valor: contadoresS4[1].alvo,
              duration: 620,
              ease: EASE_SCROLL,
              onUpdate: () => escreverS4Card(contadoresS4[1]),
              onComplete: r,
            }),
          ),
          novaPromessa((r) =>
            animate(letrasS4Card2Label, {
              opacity: 1,
              y: 0,
              duration: 460,
              ease: EASE_SCROLL,
              delay: stagger(16),
              onComplete: r,
            }),
          ),
        ]).then(() => {}),
      // Etapa 3 — os R$ 10 mil contando, a caixa subindo e a legenda final
      // digitando, tudo junto: a última etapa da sequência.
      () =>
        Promise.all([
          novaPromessa((r) =>
            animate(s4TotalValor, {
              opacity: 1,
              y: 0,
              duration: 620,
              ease: EASE_SCROLL,
              onComplete: r,
            }),
          ),
          novaPromessa((r) =>
            animate(contadorTotal, {
              valor: 10000,
              duration: 1500,
              ease: EASE_CONTAGEM,
              onUpdate: escreverTotal,
              onComplete: r,
            }),
          ),
          novaPromessa((r) =>
            animate(letrasS4TotalLabel, {
              opacity: 1,
              y: 0,
              duration: 460,
              ease: EASE_SCROLL,
              delay: stagger(16),
              onComplete: r,
            }),
          ),
        ]).then(() => {}),
    ],
    reiniciar: () => {
      utils.set(s4Titulo, {
        y: deslocamentoInicialS4Titulo,
        scale: 1.3,
      });
      utils.set(letrasS4Titulo, { opacity: 0, y: 26 });
      utils.set(s4Card1, { opacity: 0, y: 24 });
      utils.set(letrasS4Card1Label, { opacity: 0, y: 16 });
      utils.set(s4Plus, { scale: 0, rotate: 360 });
      utils.set(s4Card2, { opacity: 0, y: 24 });
      utils.set(letrasS4Card2Label, { opacity: 0, y: 16 });
      utils.set(s4TotalValor, { opacity: 0, y: 24 });
      utils.set(letrasS4TotalLabel, { opacity: 0, y: 18 });
      contadoresS4.forEach((item) => {
        item.valor = 0;
        escreverS4Card(item);
      });
      contadorTotal.valor = 0;
      escreverTotal();
    },
  });
}

/** Envolve uma chamada com `onComplete` num `Promise` — só açúcar sintático. */
function novaPromessa(executor: (resolver: () => void) => unknown) {
  return new Promise<void>((resolver) => {
    executor(resolver);
  });
}

/* ------------------------------------------------------------------ *
 * Sequência final da seção de números — não raspa com o scroll.
 * ------------------------------------------------------------------ */

/**
 * Ao alcançar `pontoMs` da timeline raspada, a tela trava por completo: cada
 * rolagem (roda, toque ou teclado) dispara a próxima etapa da lista, do
 * início ao fim — nunca duas de uma vez, e a etapa sempre termina por
 * inteiro antes de aceitar a próxima rolagem. Depois de cada etapa fica um
 * respiro travado (`RESPIRO_ENTRE_ETAPAS`); depois da última, mais um
 * respiro antes de devolver o scroll de vez, para a transição para a seção
 * seguinte não vir colada.
 *
 * A primeira etapa dispara sozinha, assim que a cena alcança `pontoMs` — as
 * demais só avançam com uma rolagem para frente.
 */
function sequenciaFinalTravada(opcoes: {
  trilho: HTMLElement;
  linha: ReturnType<typeof createTimeline>;
  pontoMs: number;
  etapas: Array<() => Promise<void>>;
  reiniciar: () => void;
}) {
  const { trilho, linha, pontoMs, etapas, reiniciar } = opcoes;

  const RESPIRO_ENTRE_ETAPAS = 650;

  const caixa = trilho.getBoundingClientRect();
  const topo = caixa.top + window.scrollY;
  const altura = caixa.height;

  function scrollDoGatilho() {
    const fim = topo + altura - window.innerHeight * 1.55;
    return topo + (pontoMs / linha.duration) * (fim - topo);
  }

  let entrou = false;
  let etapaAtual = -1;
  let tocando = false;
  let podeAvancar = false;

  function bloquear(evento: Event) {
    evento.preventDefault();
  }

  function avancar(direcao: 1 | -1) {
    if (!entrou || tocando || !podeAvancar || direcao < 0) return;
    const proxima = etapaAtual + 1;
    if (proxima >= etapas.length) return;
    tocarEtapa(proxima);
  }

  function bloquearComGesto(evento: WheelEvent) {
    evento.preventDefault();
    avancar(evento.deltaY > 0 ? 1 : -1);
  }

  let toqueInicioY = 0;
  function tocarInicioToque(evento: TouchEvent) {
    toqueInicioY = evento.touches[0]?.clientY ?? 0;
  }
  function tocarFimToque(evento: TouchEvent) {
    const fimY = evento.changedTouches[0]?.clientY ?? toqueInicioY;
    const delta = toqueInicioY - fimY; // arrastar pra cima = intenção de ir pra frente
    if (Math.abs(delta) > 24) avancar(delta > 0 ? 1 : -1);
  }

  const teclasBloqueadas = new Set([
    "ArrowDown",
    "ArrowUp",
    "PageDown",
    "PageUp",
    " ",
    "Home",
    "End",
  ]);

  function bloquearTeclado(evento: KeyboardEvent) {
    if (!teclasBloqueadas.has(evento.key)) return;
    evento.preventDefault();
    if (evento.key === "ArrowDown" || evento.key === "PageDown" || evento.key === " ") {
      avancar(1);
    }
  }

  function ligarBloqueio() {
    // O Lenis tem a própria animação de rolagem: sem pará-lo aqui, ele
    // continua interpolando o scroll por conta própria e a pessoa passa
    // batido pela sequência inteira, apesar do `preventDefault` abaixo.
    pausarRolagemSuave();
    window.addEventListener("wheel", bloquearComGesto, { passive: false });
    window.addEventListener("touchmove", bloquear, { passive: false });
    window.addEventListener("touchstart", tocarInicioToque, { passive: true });
    window.addEventListener("touchend", tocarFimToque);
    window.addEventListener("keydown", bloquearTeclado);
  }

  function desligarBloqueio() {
    retomarRolagemSuave();
    window.removeEventListener("wheel", bloquearComGesto);
    window.removeEventListener("touchmove", bloquear);
    window.removeEventListener("touchstart", tocarInicioToque);
    window.removeEventListener("touchend", tocarFimToque);
    window.removeEventListener("keydown", bloquearTeclado);
  }

  // Rede de segurança: se por algum motivo a Promise de uma etapa nunca se
  // resolver (uma animação que não dispara o `onComplete`, por exemplo), a
  // sequência travaria pra sempre — a tela presa, sem reagir a mais nenhuma
  // rolagem. Isso força a continuação de qualquer forma depois de um tempo.
  const FAILSAFE_MS = 3500;

  function tocarEtapa(indice: number) {
    etapaAtual = indice;
    tocando = true;
    podeAvancar = false;

    const comFailsafe = new Promise<void>((resolver) => {
      window.setTimeout(resolver, FAILSAFE_MS);
    });

    Promise.race([etapas[indice](), comFailsafe]).then(() => {
      window.setTimeout(() => {
        tocando = false;
        if (etapaAtual < etapas.length - 1) {
          podeAvancar = true;
        } else {
          desligarBloqueio();
        }
      }, RESPIRO_ENTRE_ETAPAS);
    });
  }

  function verificarEntrada() {
    if (entrou) return;
    if (window.scrollY >= scrollDoGatilho()) {
      entrou = true;
      ligarBloqueio();
      tocarEtapa(0);
    }
  }

  // Se a pessoa recarregar a página já rolada para depois deste ponto (ou
  // voltar por aqui vindo de uma âncora), a sequência entra travada direto
  // no estado inicial — sem isso ela ficaria destravada com o conteúdo
  // final ainda invisível.
  if (window.scrollY < scrollDoGatilho()) reiniciar();

  window.addEventListener("scroll", verificarEntrada, { passive: true });
  verificarEntrada();
}

/* ------------------------------------------------------------------ *
 * Sessão 7 — renda recorrente, narrativa raspada no scroll.
 * ------------------------------------------------------------------ */

function recorrenciaInterativa() {
  const secao = document.querySelector<HTMLElement>("[data-rec-section]");
  if (!secao) return;

  const cabecalho = secao.querySelector<HTMLElement>("[data-rec-header]");
  const textosCabecalho = $$<HTMLElement>("[data-rec-header-text]", secao);
  const trilhoCard = secao.querySelector<HTMLElement>("[data-rec-card-track]");
  const card = secao.querySelector<HTMLElement>("[data-rec-card]");
  const label = secao.querySelector<HTMLElement>("[data-rec-label]");
  const pill = secao.querySelector<HTMLElement>("[data-rec-pill]");
  const palavrasPill = $$<HTMLElement>("[data-rec-pill-word]", secao);
  const paragrafos = $$<HTMLElement>("[data-rec-paragraph]", secao);
  const ilustracao = secao.querySelector<HTMLElement>("[data-rec-illustration]");
  const trilhoConclusao = secao.querySelector<HTMLElement>("[data-rec-conclusion-track]");
  const palcoConclusao = secao.querySelector<HTMLElement>("[data-rec-conclusion-stage]");
  const escala = secao.querySelector<HTMLElement>("[data-rec-scale]");
  const tituloEscala = secao.querySelector<HTMLElement>("[data-rec-scale-title]");
  const boxes = $$<HTMLElement>("[data-rec-boxes] > li", secao);
  const fundoFinal = secao.querySelector<HTMLElement>("[data-rec-final-bg]");
  const tituloVirada = secao.querySelector<HTMLElement>("[data-rec-turn-title]");
  const partesVirada = $$<HTMLElement>("[data-rec-turn-part]", secao);
  const textosVirada = $$<HTMLElement>("[data-rec-turn-text]", secao);

  const base = ilustracao?.querySelector<SVGGraphicsElement>("#base");
  const user = ilustracao?.querySelector<SVGGElement>("#user");
  const energia = ilustracao?.querySelector<SVGGraphicsElement>("#energia");
  const renew = ilustracao?.querySelector<SVGGraphicsElement>("#renew");

  if (
    !cabecalho ||
    !textosCabecalho.length ||
    !trilhoCard ||
    !card ||
    !label ||
    !pill ||
    !palavrasPill.length ||
    paragrafos.length < 4 ||
    !base ||
    !user ||
    !energia ||
    !renew ||
    !trilhoConclusao ||
    !palcoConclusao ||
    !escala ||
    !tituloEscala ||
    !boxes.length ||
    !fundoFinal ||
    !tituloVirada ||
    partesVirada.length < 2 ||
    textosVirada.length < 4
  ) {
    return;
  }

  const letrasCabecalho = textosCabecalho.map(dividirEmLetras);
  const letrasLabel = dividirEmLetras(label);
  const letrasPill = palavrasPill.flatMap(dividirEmLetras);
  const letrasParagrafos = paragrafos.map(dividirEmLetras);
  const letrasTituloEscala = dividirEmLetras(tituloEscala);
  const letrasTituloVirada = dividirEmLetras(tituloVirada);
  const letrasTextosVirada = textosVirada.map(dividirEmLetras);

  utils.set(textosCabecalho, { opacity: 1 });
  utils.set([label, pill, ...paragrafos, tituloEscala, tituloVirada], { opacity: 1 });
  utils.set(
    [
      ...letrasCabecalho.flat(),
      ...letrasLabel,
      ...letrasPill,
      ...letrasParagrafos.flat(),
      ...letrasTituloEscala,
      ...letrasTituloVirada,
      ...letrasTextosVirada.flat(),
    ],
    { y: "110%" },
  );

  utils.set(card, { opacity: 0, y: 28, scale: 0.99 });
  utils.set(pill, { scale: 0 });
  utils.set(boxes, { opacity: 0, y: 22, scale: 0.94 });
  utils.set(partesVirada, { opacity: 0 });
  utils.set(fundoFinal, { opacity: 0 });

  // Estados pedidos para a ilustração. Como o SVG é o arquivo original do
  // Figma, cada alvo é o próprio path/grupo identificado no documento.
  utils.set(base, { opacity: 1, scale: 0, rotate: -45 });
  utils.set(user, { opacity: 1, scale: 0 });
  utils.set(energia, { opacity: 1, scale: 0, y: -10 });
  utils.set(renew, { opacity: 0, scale: 0, rotate: 360 });

  /* 1. Pré-título, título e apoio, todos letra por letra. */
  const linhaCabecalho = createTimeline({
    autoplay: false,
    defaults: { ease: EASE_SCROLL },
  });

  let cursorCabecalho = 0;
  letrasCabecalho.forEach((letras, indice) => {
    const passo = indice === 1 ? 8 : 10;
    linhaCabecalho.add(
      letras,
      { y: "0%", duration: 680, delay: stagger(passo) },
      cursorCabecalho,
    );
    cursorCabecalho += 680 + passo * Math.max(0, letras.length - 1) + 100;
  });

  vincular(linhaCabecalho, cabecalho, { inicio: 0.88, fim: 0.3 });

  /* 2. Card branco, narrativa e troca energia → recorrência. */
  const linhaCard = createTimeline({
    autoplay: false,
    defaults: { ease: EASE_SCROLL },
  });

  linhaCard.add(
    card,
    { opacity: 1, y: 0, scale: 1, duration: 720 },
    0,
  );
  linhaCard.add(
    letrasLabel,
    { y: "0%", duration: 680, delay: stagger(10) },
    700,
  );

  linhaCard.add(
    pill,
    { scale: 1, duration: 760, ease: EASE_SUAVE },
    1900,
  );
  linhaCard.add(
    letrasPill,
    { y: "0%", duration: 650, delay: stagger(9) },
    2000,
  );

  // "Imagine que você conquistou…" conclui a primeira cadeia textual e
  // revela o novo cliente ao lado no mesmo instante.
  linhaCard.add(
    letrasParagrafos[0],
    { y: "0%", duration: 680, delay: stagger(9) },
    3200,
  );
  linhaCard.add(
    base,
    { scale: 1, rotate: 0, duration: 900, ease: EASE_SUAVE },
    3300,
  );
  linhaCard.add(user, { scale: 1, duration: 760, ease: EASE_SUAVE }, 3420);
  linhaCard.add(
    energia,
    { scale: 1, y: 0, duration: 720, ease: EASE_SUAVE },
    3540,
  );

  linhaCard.add(
    letrasParagrafos[1],
    { y: "0%", duration: 680, delay: stagger(8) },
    5200,
  );

  // "No outro também…": o raio sai e o símbolo de renovação o substitui.
  linhaCard.add(
    letrasParagrafos[2],
    { y: "0%", duration: 680, delay: stagger(9) },
    7000,
  );
  linhaCard.add(
    energia,
    { opacity: 0, scale: 0, duration: 460, ease: EASE_SUAVE },
    7000,
  );
  linhaCard.add(
    renew,
    {
      opacity: 1,
      scale: 1,
      rotate: 0,
      duration: 820,
      ease: EASE_SUAVE,
    },
    7250,
  );

  linhaCard.add(
    letrasParagrafos[3],
    { y: "0%", duration: 700, delay: stagger(7) },
    8500,
  );

  // O card só fica preso no desktop — o `position: sticky` e a altura extra
  // do trilho vivem num `@media (min-width: 68.0625rem)`. Abaixo disso o
  // trilho é do tamanho do próprio card, e raspar a história nele daria
  // ~256px de rolagem para quase 9s de animação: um toque do dedo atravessa
  // tudo antes de qualquer texto terminar de entrar.
  //
  // Prender o card no celular não resolve: ele tem ~762px e num aparelho de
  // 667px de altura sobrariam 627px úteis — cortaria 135px. Então no mobile
  // a história é **disparada** e roda no tempo dela, como as frases de
  // abertura da segunda dobra.
  const CARD_PRESO = window.matchMedia("(min-width: 68.0625rem)");

  if (CARD_PRESO.matches) {
    // O trilho mantém o card fixo no centro até o último texto terminar. A
    // cena só devolve a rolagem à seção quando a história ficou inteira visível.
    vincular(linhaCard, trilhoCard, {
      inicio: 0.22,
      fim: 0.83,
      usaFundo: true,
    });
  } else {
    ScrollTrigger.create({
      trigger: card,
      start: "top 78%",
      once: true,
      onEnter: () => {
        linhaCard.play();
      },
    });
  }

  /* 3. Um único palco para a escala e as duas viradas do Figma. Assim o
     primeiro bloco não gruda no teto e todas as trocas preservam exatamente
     o mesmo centro visual. */
  const centroTituloVirada =
    palcoConclusao.offsetHeight / 2 -
    (tituloVirada.offsetTop + tituloVirada.offsetHeight / 2);

  utils.set(tituloVirada, {
    y: centroTituloVirada,
    scale: 1.28,
    transformOrigin: "50% 50%",
  });

  const linhaConclusao = createTimeline({
    autoplay: false,
    defaults: { ease: EASE_SCROLL },
  });

  linhaConclusao.add(
    letrasTituloEscala,
    { y: "0%", duration: 680, delay: stagger(9) },
    0,
  );
  linhaConclusao.add(
    boxes,
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 620,
      delay: stagger(340),
    },
    1050,
  );

  // O conjunto 10–200 sai como uma única composição, com zoom e fade.
  linhaConclusao.add(
    escala,
    { opacity: 0, scale: 1.12, duration: 900, ease: EASE_SUAVE },
    3200,
  );

  // Parte 2: o título nasce grande no centro e só depois assume sua posição
  // final do Figma, antes de revelar pergunta e resposta.
  linhaConclusao.add(
    letrasTituloVirada,
    { y: "0%", duration: 720, delay: stagger(10) },
    3650,
  );
  linhaConclusao.add(
    tituloVirada,
    { y: 0, scale: 1, duration: 1100, ease: EASE_SUAVE },
    5200,
  );
  linhaConclusao.add(partesVirada[0], { opacity: 1, duration: 180 }, 6350);
  linhaConclusao.add(
    letrasTextosVirada[0],
    { y: "0%", duration: 680, delay: stagger(10) },
    6400,
  );
  linhaConclusao.add(
    letrasTextosVirada[1],
    { y: "0%", duration: 720, delay: stagger(9) },
    7250,
  );

  // Parte 3: a pergunta anterior se aproxima e dissolve, o fundo muda e o
  // mesmo título permanece no alto enquanto a nova ideia surge no centro.
  linhaConclusao.add(
    partesVirada[0],
    { opacity: 0, scale: 1.08, duration: 850, ease: EASE_SUAVE },
    9000,
  );
  linhaConclusao.add(
    fundoFinal,
    { opacity: 1, duration: 900, ease: EASE_SUAVE },
    9250,
  );
  linhaConclusao.add(
    tituloVirada,
    { color: "#ffffff", duration: 900, ease: EASE_SUAVE },
    9250,
  );
  linhaConclusao.add(partesVirada[1], { opacity: 1, duration: 180 }, 10100);
  linhaConclusao.add(
    letrasTextosVirada[2],
    { y: "0%", duration: 680, delay: stagger(10) },
    10150,
  );
  linhaConclusao.add(
    letrasTextosVirada[3],
    { y: "0%", duration: 760, delay: stagger(8) },
    11000,
  );

  vincular(linhaConclusao, trilhoConclusao, {
    inicio: 0.08,
    fim: 0.88,
    usaFundo: true,
  });
}

/* ------------------------------------------------------------------ *
 * Títulos que entram letra por letra fora do palco.
 * ------------------------------------------------------------------ */

function titulosPorLetra() {
  $$("[data-letras]").forEach((el) => {
    const letras = dividirEmLetras(el);

    utils.set(el, { opacity: 1 });
    utils.set(letras, { y: "110%" });

    const entrada = animate(letras, {
      y: ["110%", "0%"],
      duration: 700,
      ease: EASE_SCROLL,
      delay: stagger(12),
      autoplay: false,
    });
    vincular(entrada, el);
  });
}

/* ------------------------------------------------------------------ *
 * Padrão editorial — pré-headline + headline, sem partir palavras.
 * ------------------------------------------------------------------ */

function cabecalhosEditoriais() {
  const configuracoes = [
    [".carteira__header", ":scope > p", "h2", null],
    [".provas__cabecalho", ":scope > p", "h2", null],
    [".primeiros__cabecalho", ":scope > div > p", "h2", ":scope > p"],
    [".rotina__intro", ":scope > p", "h2", null],
    [".timing__top", null, "h2", ":scope > p"],
    [".fechamento__top header", null, "h2", ":scope > p"],
  ] as const;

  for (const [containerSel, preSel, headlineSel, apoioSel] of configuracoes) {
    $$<HTMLElement>(containerSel).forEach((container) => {
      const pre = preSel ? container.querySelector<HTMLElement>(preSel) : null;
      const headline = container.querySelector<HTMLElement>(headlineSel);
      const apoio = apoioSel ? container.querySelector<HTMLElement>(apoioSel) : null;
      if (!headline) return;

      container.dataset.editorialGsap = "";
      gsap.set(container, { autoAlpha: 1 });

      const letrasPre = pre ? dividirEmLetras(pre) : [];
      const letrasHeadline = dividirEmLetras(headline);
      gsap.set([pre, headline].filter(Boolean), { autoAlpha: 1 });
      gsap.set([...letrasPre, ...letrasHeadline], { autoAlpha: 0, yPercent: 112 });
      if (apoio) gsap.set(apoio, { autoAlpha: 0, y: 24 });

      const linha = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top 80%",
          end: "top 30%",
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      });

      if (letrasPre.length) {
        linha.to(letrasPre, {
          autoAlpha: 1,
          yPercent: 0,
          duration: 1,
          stagger: .018,
          ease: "power1.out",
        });
      }

      linha.to(
        letrasHeadline,
        {
          autoAlpha: 1,
          yPercent: 0,
          duration: 1.15,
          stagger: .014,
          ease: "power1.out",
        },
        letrasPre.length ? ">.18" : 0,
      );

      if (apoio) {
        linha.to(apoio, { autoAlpha: 1, y: 0, duration: .9, ease: "power1.out" }, ">.18");
      }
    });
  }
}

/* ------------------------------------------------------------------ *
 * Sessão 4 — narrativa elemento por elemento no centro da viewport.
 * ------------------------------------------------------------------ */

function movimentosSequenciais() {
  const secao = document.querySelector<HTMLElement>(".movimentos");
  if (!secao) return;

  const header = secao.querySelector<HTMLElement>(".movimentos__header");
  const pre = header?.querySelector<HTMLElement>(":scope > div > p");
  const headline = header?.querySelector<HTMLElement>("h2");
  const sub = header?.querySelector<HTMLElement>(".movimentos__sub");

  if (header && pre && headline && sub) {
    header.dataset.editorialGsap = "";
    gsap.set(header, { autoAlpha: 1 });
    const letrasPre = dividirEmLetras(pre);
    const letrasHeadline = dividirEmLetras(headline);
    gsap.set([pre, headline], { autoAlpha: 1 });
    gsap.set([...letrasPre, ...letrasHeadline], { autoAlpha: 0, yPercent: 112 });
    gsap.set(sub, { autoAlpha: 0, y: 26 });

    gsap.timeline({
      scrollTrigger: {
        trigger: header,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    })
      .to(letrasPre, { autoAlpha: 1, yPercent: 0, duration: 1, stagger: .02, ease: "power1.out" })
      .to(letrasHeadline, { autoAlpha: 1, yPercent: 0, duration: 1.2, stagger: .014, ease: "power1.out" }, ">.2")
      .to(sub, { autoAlpha: 1, y: 0, duration: .9, ease: "power1.out" }, ">.2");
  }

  const bento = secao.querySelector<HTMLElement>(".bento");
  const cards = bento ? Array.from(bento.children) as HTMLElement[] : [];
  if (bento && cards.length) {
    const linhaCards = gsap.timeline({
      scrollTrigger: {
        trigger: bento,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.25,
        invalidateOnRefresh: true,
      },
    });

    cards.forEach((card) => {
      const icon = card.querySelector<HTMLElement>(".bento__icon");
      const title = card.querySelector<HTMLElement>("h3");
      const texto = card.querySelector<HTMLElement>(":scope > p");
      gsap.set(card, { autoAlpha: 0, y: 38, scale: .985 });
      gsap.set([icon, title, texto].filter(Boolean), { autoAlpha: 0, y: 20 });

      linhaCards
        .to(card, { autoAlpha: 1, y: 0, scale: 1, duration: .8, ease: "power1.out" })
        .to(icon, { autoAlpha: 1, y: 0, duration: .55, ease: "power1.out" }, ">.08")
        .to(title, { autoAlpha: 1, y: 0, duration: .65, ease: "power1.out" }, ">.06")
        .to(texto, { autoAlpha: 1, y: 0, duration: .8, ease: "power1.out" }, ">.06");
    });
  }

  const fechamento = secao.querySelector<HTMLElement>(".movimentos__close");
  const frase = fechamento?.querySelector<HTMLElement>(".movimentos__frase");
  const bullets = fechamento ? $$(".movimentos__dispensa > li", fechamento) : [];
  const fluxo = fechamento?.querySelector<HTMLElement>(".movimentos__flow");
  const fluxoItens = fluxo ? Array.from(fluxo.children) as HTMLElement[] : [];

  if (fechamento && frase && fluxo) {
    fechamento.dataset.editorialGsap = "";
    gsap.set(fechamento, { autoAlpha: 1 });
    gsap.set(frase, { autoAlpha: 0, y: 30 });
    gsap.set(bullets, { autoAlpha: 0, y: 24 });
    gsap.set(fluxo, { autoAlpha: 0, y: 28, scale: .985 });
    gsap.set(fluxoItens, { autoAlpha: 0, y: 16 });

    const linhaFecho = gsap.timeline({
      scrollTrigger: {
        trigger: fechamento,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    });

    linhaFecho
      .to(frase, { autoAlpha: 1, y: 0, duration: 1, ease: "power1.out" })
      .to(bullets, { autoAlpha: 1, y: 0, duration: .75, stagger: .22, ease: "power1.out" }, ">.16")
      .to(fluxo, { autoAlpha: 1, y: 0, scale: 1, duration: .8, ease: "power1.out" }, ">.18")
      .to(fluxoItens, { autoAlpha: 1, y: 0, duration: .65, stagger: .16, ease: "power1.out" }, ">.1");
  }
}

/* ------------------------------------------------------------------ *
 * Sessão 9 — headline digitada, objeções e fluxo em sequência.
 * ------------------------------------------------------------------ */

function experienciaSequencial() {
  const pergunta = document.querySelector<HTMLElement>("[data-s9-typing]");
  const pre = pergunta?.querySelector<HTMLElement>(":scope > p");
  const headline = pergunta?.querySelector<HTMLElement>("h2");
  const cursor = pergunta?.querySelector<HTMLElement>(".experiencia__cursor");

  if (pergunta && pre && headline && cursor) {
    pergunta.dataset.editorialGsap = "";
    const letras = dividirEmLetras(headline);
    gsap.set(pergunta, { autoAlpha: 1 });
    gsap.set(pre, { autoAlpha: 0, y: 20 });
    gsap.set(headline, { autoAlpha: 1 });
    gsap.set(letras, { autoAlpha: 0 });
    gsap.set(cursor, { autoAlpha: 1, scaleY: 1 });

    gsap.timeline({
      scrollTrigger: {
        trigger: pergunta,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    })
      .to(pre, { autoAlpha: 1, y: 0, duration: .7, ease: "power1.out" })
      .to(letras, { autoAlpha: 1, duration: .08, stagger: .04, ease: "none" }, ">.12")
      .to(cursor, { autoAlpha: 0, scaleY: .65, duration: .3, ease: "power1.out" }, ">.12");
  }

  const resposta = document.querySelector<HTMLElement>("[data-s9-topicos]");
  const respostaIntro = resposta?.querySelector<HTMLElement>(":scope > p");
  const topicos = resposta ? $$<HTMLElement>(":scope > ul > li", resposta) : [];

  if (resposta && respostaIntro && topicos.length) {
    resposta.dataset.editorialGsap = "";
    gsap.set(resposta, { autoAlpha: 1 });
    gsap.set(respostaIntro, { autoAlpha: 0, y: 24 });
    gsap.set(topicos, { autoAlpha: 0, y: 22 });

    gsap.timeline({
      scrollTrigger: {
        trigger: resposta,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    })
      .to(respostaIntro, { autoAlpha: 1, y: 0, duration: .85, ease: "power1.out" })
      .to(topicos, { autoAlpha: 1, y: 0, duration: .75, stagger: .28, ease: "power1.out" }, ">.18");
  }

  const fecho = document.querySelector<HTMLElement>("[data-s9-fecho]");
  const fechoTitulo = fecho?.querySelector<HTMLElement>(":scope > h3");
  const fechoTexto = fecho?.querySelector<HTMLElement>(":scope > p");
  const fluxo = fecho?.querySelector<HTMLElement>("[data-s9-fluxo]");
  const itensFluxo = fluxo ? Array.from(fluxo.children) as HTMLElement[] : [];

  if (fecho && fechoTitulo && fechoTexto && fluxo && itensFluxo.length) {
    fecho.dataset.editorialGsap = "";
    gsap.set(fecho, { autoAlpha: 1 });
    gsap.set([fechoTitulo, fechoTexto], { autoAlpha: 0, y: 24 });
    gsap.set(fluxo, { autoAlpha: 0, y: 20, scale: .985 });
    gsap.set(itensFluxo, { autoAlpha: 0, y: 14 });

    gsap.timeline({
      scrollTrigger: {
        trigger: fecho,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    })
      .to(fechoTitulo, { autoAlpha: 1, y: 0, duration: .8, ease: "power1.out" })
      .to(fechoTexto, { autoAlpha: 1, y: 0, duration: .7, ease: "power1.out" }, ">.14")
      .to(fluxo, { autoAlpha: 1, y: 0, scale: 1, duration: .65, ease: "power1.out" }, ">.14")
      .to(itensFluxo, { autoAlpha: 1, y: 0, duration: .55, stagger: .2, ease: "power1.out" }, ">.08");
  }
}

/* ------------------------------------------------------------------ *
 * Sessão 10 — exercício por letras e conversa presa ao bottom.
 * ------------------------------------------------------------------ */

function primeirosClientesSequencial() {
  const exercicio = document.querySelector<HTMLElement>("[data-s10-exercicio]");
  const chamada = exercicio?.querySelector<HTMLElement>("h3");
  const apoio = exercicio?.querySelector<HTMLElement>("header p");
  const contatos = exercicio ? $$<HTMLElement>("[data-s10-contatos] > li", exercicio) : [];

  if (exercicio && chamada && apoio && contatos.length) {
    exercicio.dataset.editorialGsap = "";
    const letrasChamada = dividirEmLetras(chamada);
    const letrasApoio = dividirEmLetras(apoio);
    gsap.set(exercicio, { autoAlpha: 1 });
    gsap.set([chamada, apoio], { autoAlpha: 1 });
    gsap.set([...letrasChamada, ...letrasApoio], { autoAlpha: 0, yPercent: 108 });
    gsap.set(contatos, { autoAlpha: 0, y: 26, scale: .97 });

    gsap.timeline({
      scrollTrigger: {
        trigger: exercicio,
        start: "top 80%",
        end: "top 25%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    })
      .to(letrasChamada, { autoAlpha: 1, yPercent: 0, duration: .9, stagger: .018, ease: "power1.out" })
      .to(letrasApoio, { autoAlpha: 1, yPercent: 0, duration: .85, stagger: .014, ease: "power1.out" }, ">.18")
      .to(contatos, { autoAlpha: 1, y: 0, scale: 1, duration: .65, stagger: .2, ease: "power1.out" }, ">.2");
  }

  const mensagem = document.querySelector<HTMLElement>("[data-s10-mensagem]");
  const frame = mensagem?.querySelector<HTMLElement>(".primeiros__telefone-frame");
  const conversa = mensagem?.querySelector<HTMLElement>("[data-s10-conversa]");
  const fecho = mensagem?.querySelector<HTMLElement>("[data-s10-fecho]");
  if (!mensagem || !frame || !conversa || !fecho) return;

  mensagem.dataset.editorialGsap = "";
  const chatPassos = [
    conversa.querySelector<HTMLElement>(":scope > .primeiros__bolha"),
    conversa.querySelector<HTMLElement>(".primeiros__resposta-chat > p"),
    conversa.querySelector<HTMLElement>(".primeiros__resposta-chat > .primeiros__bolha"),
    conversa.querySelector<HTMLElement>(".primeiros__envio > p"),
    ...$$<HTMLElement>(".primeiros__envio > .primeiros__bolha", conversa),
  ].filter(Boolean) as HTMLElement[];

  const fechoTitulo = fecho.querySelector<HTMLElement>("h4");
  const textos = $$<HTMLElement>(".primeiros__texto > p", fecho);
  const pagarMenos = fecho.querySelector<HTMLElement>(".primeiros__destaque > strong");
  const mudaTudo = fecho.querySelector<HTMLElement>(".primeiros__destaque > span");
  if (!fechoTitulo || textos.length < 2 || !pagarMenos || !mudaTudo) return;

  const letrasTitulo = dividirEmLetras(fechoTitulo);
  const letrasTextoUm = dividirEmLetras(textos[0]);
  const letrasTextoDois = dividirEmLetras(textos[1]);

  gsap.set(mensagem, { autoAlpha: 1 });
  gsap.set(frame, { autoAlpha: 0, scale: .985, transformOrigin: "50% 100%" });
  gsap.set(chatPassos, { autoAlpha: 0, y: 18, scale: .985 });
  gsap.set([fechoTitulo, ...textos], { autoAlpha: 1 });
  gsap.set([...letrasTitulo, ...letrasTextoUm, ...letrasTextoDois], { autoAlpha: 0, yPercent: 108 });
  gsap.set([pagarMenos, mudaTudo], { autoAlpha: 0, y: 20 });

  const pausa = { progresso: 0 };
  const podePrender = window.matchMedia("(min-width: 769px) and (min-height: 720px)").matches;
  const linha = gsap.timeline({
    scrollTrigger: {
      trigger: mensagem,
      start: podePrender ? "bottom bottom" : "top 80%",
      end: podePrender ? "+=3400" : "bottom 20%",
      pin: podePrender,
      pinSpacing: podePrender,
      scrub: 1.2,
      anticipatePin: podePrender ? 1 : 0,
      invalidateOnRefresh: true,
    },
  });

  linha
    .to(frame, { autoAlpha: 1, scale: 1, duration: .45, ease: "power1.out" })
    .to(chatPassos, { autoAlpha: 1, y: 0, scale: 1, duration: .45, stagger: .1, ease: "power1.out" }, ">.08")
    .to(letrasTitulo, { autoAlpha: 1, yPercent: 0, duration: .85, stagger: .016, ease: "power1.out" }, ">.22")
    .to(letrasTextoUm, { autoAlpha: 1, yPercent: 0, duration: .9, stagger: .011, ease: "power1.out" }, ">.16")
    .to(letrasTextoDois, { autoAlpha: 1, yPercent: 0, duration: .8, stagger: .014, ease: "power1.out" }, ">.14")
    .to(pagarMenos, { autoAlpha: 1, y: 0, duration: .75, ease: "power1.out" }, ">.16")
    .to(mudaTudo, { autoAlpha: 1, y: 0, duration: .75, ease: "power1.out" }, ">.14")
    .to(pausa, { progresso: 1, duration: 1.2, ease: "none" }, ">.2");
}

/* ------------------------------------------------------------------ *
 * Sessão 11 — rotina e ciclo revelados passo a passo.
 * ------------------------------------------------------------------ */

function rotinaSequencial() {
  const apoio = document.querySelector<HTMLElement>("[data-s11-apoio]");
  const frases = apoio ? Array.from(apoio.children) as HTMLElement[] : [];

  if (apoio && frases.length) {
    gsap.set(frases, { autoAlpha: 0, y: 22 });
    gsap.to(frases, {
      autoAlpha: 1,
      y: 0,
      duration: .75,
      stagger: .28,
      ease: "power1.out",
      scrollTrigger: {
        trigger: apoio,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    });
  }

  const ciclo = document.querySelector<HTMLElement>("[data-s11-ciclo]");
  const label = ciclo?.querySelector<HTMLElement>(".ciclo__label");
  const fluxo = ciclo?.querySelector<HTMLElement>("[data-s11-fluxo]");
  const itens = fluxo ? Array.from(fluxo.children) as HTMLElement[] : [];
  const fim = ciclo?.querySelector<HTMLElement>(".ciclo__end");

  if (ciclo && label && fluxo && itens.length && fim) {
    ciclo.dataset.editorialGsap = "";
    gsap.set(ciclo, { autoAlpha: 1 });
    gsap.set(label, { autoAlpha: 0, y: 22 });
    gsap.set(fluxo, { autoAlpha: 0, y: 24, scale: .985 });
    gsap.set(itens, { autoAlpha: 0, y: 14 });
    gsap.set(fim, { autoAlpha: 0, y: 18 });

    gsap.timeline({
      scrollTrigger: {
        trigger: ciclo,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    })
      .to(label, { autoAlpha: 1, y: 0, duration: .7, ease: "power1.out" })
      .to(fluxo, { autoAlpha: 1, y: 0, scale: 1, duration: .7, ease: "power1.out" }, ">.14")
      .to(itens, { autoAlpha: 1, y: 0, duration: .55, stagger: .2, ease: "power1.out" }, ">.08")
      .to(fim, { autoAlpha: 1, y: 0, duration: .7, ease: "power1.out" }, ">.16");
  }
}

/* ------------------------------------------------------------------ *
 * Sessão 14 — abertura central, redução e cenários digitados no scroll.
 * ------------------------------------------------------------------ */

function dozeMesesSequencial() {
  const transicao = document.querySelector<HTMLElement>("[data-doze-transicao]");
  const estados = transicao ? $$<HTMLElement>("[data-doze-estado]", transicao) : [];
  if (!transicao || estados.length !== 2) return;

  const barra = document.querySelector<HTMLElement>(".bar");
  const alturaBarra = () => barra?.getBoundingClientRect().height ?? 0;
  // A narrativa de cenários usa o mesmo palco preso em desktop e mobile.
  // O único limite é uma altura mínima segura para o conteúdo não ser
  // recortado em aparelhos usados na horizontal.
  const podePrender = window.matchMedia("(min-height: 520px)").matches;
  const [estadoUm, estadoDois] = estados;
  const cabecalhoUm = estadoUm.querySelector<HTMLElement>("[data-doze-cabecalho]");
  const cenarioUm = estadoUm.querySelector<HTMLElement>("[data-doze-cenario]");
  const cabecalhoDois = estadoDois.querySelector<HTMLElement>("[data-doze-cabecalho]");
  const cenarioDois = estadoDois.querySelector<HTMLElement>("[data-doze-cenario]");
  const etiquetaUm = cenarioUm?.querySelector<HTMLElement>(":scope > span");
  const paragrafosUm = cenarioUm ? $$<HTMLElement>(":scope > div > p", cenarioUm) : [];
  const etiquetaDois = cenarioDois?.querySelector<HTMLElement>(":scope > span");
  const paragrafosDois = cenarioDois ? $$<HTMLElement>(":scope > div > p", cenarioDois) : [];

  if (
    !cabecalhoUm ||
    !cenarioUm ||
    !cabecalhoDois ||
    !cenarioDois ||
    !etiquetaUm ||
    !etiquetaDois ||
    !paragrafosUm.length ||
    !paragrafosDois.length
  ) return;

  [cabecalhoUm, cenarioUm, cabecalhoDois, cenarioDois].forEach((elemento) => {
    elemento.dataset.editorialGsap = "";
  });

  const letrasEtiqueta = dividirEmLetras(etiquetaUm);
  const letrasParagrafos = paragrafosUm.map((paragrafo) => dividirEmLetras(paragrafo));
  const letrasEtiquetaDois = dividirEmLetras(etiquetaDois);
  const letrasParagrafosDois = paragrafosDois.map((paragrafo) => dividirEmLetras(paragrafo));
  const deslocamentoCentral = () =>
    podePrender
      ? Math.max(0, (estadoUm.clientHeight - cabecalhoUm.offsetHeight) / 2 - cabecalhoUm.offsetTop)
      : 0;
  const deslocamentoCentralDois = () =>
    podePrender
      ? Math.max(0, (estadoDois.clientHeight - cabecalhoDois.offsetHeight) / 2 - cabecalhoDois.offsetTop)
      : 0;

  gsap.set(estadoUm, { autoAlpha: 1, scale: 1, transformOrigin: "50% 50%" });
  gsap.set(estadoDois, { autoAlpha: 0, scale: 1.018, transformOrigin: "50% 50%" });
  gsap.set(cabecalhoUm, {
    autoAlpha: 0,
    y: deslocamentoCentral,
    scale: podePrender ? 1.24 : 1,
    transformOrigin: "50% 0%",
  });
  gsap.set(cenarioUm, { autoAlpha: 1 });
  gsap.set(cabecalhoDois, {
    autoAlpha: 1,
    y: deslocamentoCentralDois,
    scale: podePrender ? 1.24 : 1,
    transformOrigin: "50% 0%",
  });
  gsap.set(cenarioDois, { autoAlpha: 1 });
  gsap.set(etiquetaUm, { autoAlpha: 0, scale: .98 });
  gsap.set(etiquetaDois, { autoAlpha: 0, scale: .98 });
  gsap.set([...paragrafosUm, ...paragrafosDois], { autoAlpha: 1 });
  gsap.set([...letrasEtiqueta, ...letrasParagrafos.flat()], { autoAlpha: 0 });
  gsap.set([...letrasEtiquetaDois, ...letrasParagrafosDois.flat()], { autoAlpha: 0 });

  const pausaInicial = { progresso: 0 };
  const pausaCenarioUm = { progresso: 0 };
  const pausaCenarioDois = { progresso: 0 };
  const linha = gsap.timeline({
    scrollTrigger: {
      trigger: transicao,
      start: podePrender ? () => `top top+=${alturaBarra()}` : "top 80%",
      end: podePrender ? "+=7200" : "bottom 20%",
      pin: podePrender,
      pinSpacing: podePrender,
      scrub: 1.2,
      anticipatePin: podePrender ? 1 : 0,
      invalidateOnRefresh: true,
    },
  });

  linha
    .to(cabecalhoUm, { autoAlpha: 1, duration: .75, ease: "power1.out" })
    .to(pausaInicial, { progresso: 1, duration: .55, ease: "none" }, ">.08")
    .to(cabecalhoUm, { y: 0, scale: 1, duration: 1.15, ease: "power1.out" }, ">.12")
    .to(etiquetaUm, { autoAlpha: 1, scale: 1, duration: .45, ease: "power1.out" }, ">.22")
    .to(letrasEtiqueta, { autoAlpha: 1, duration: .08, stagger: .04, ease: "none" }, "<.04");

  letrasParagrafos.forEach((letras) => {
    linha.to(letras, { autoAlpha: 1, duration: .08, stagger: .018, ease: "none" }, ">.2");
  });

  linha
    .to(pausaCenarioUm, { progresso: 1, duration: 1.05, ease: "none" }, ">.2")
    .to(estadoUm, { autoAlpha: 0, scale: .985, duration: 1.15, ease: "power1.inOut" }, ">.08")
    .to(estadoDois, { autoAlpha: 1, scale: 1, duration: 1.15, ease: "power1.inOut" }, "<")
    .to(pausaCenarioDois, { progresso: .25, duration: .7, ease: "none" }, ">.12")
    .to(cabecalhoDois, { y: 0, scale: 1, duration: 1.15, ease: "power1.out" }, ">.1")
    .to(etiquetaDois, { autoAlpha: 1, scale: 1, duration: .45, ease: "power1.out" }, ">.22")
    .to(letrasEtiquetaDois, { autoAlpha: 1, duration: .08, stagger: .04, ease: "none" }, "<.04");

  letrasParagrafosDois.forEach((letras) => {
    linha.to(letras, { autoAlpha: 1, duration: .08, stagger: .018, ease: "none" }, ">.2");
  });

  linha.to(pausaCenarioDois, { progresso: 1, duration: 1.35, ease: "none" }, ">.2");

  const painelResultado = document.querySelector<HTMLElement>(".doze__painel--tres");
  const resultado = painelResultado?.querySelector<HTMLElement>("[data-doze-resultado]");
  const tituloResultado = resultado?.querySelector<HTMLElement>(":scope > h2");
  const valores = resultado ? $$<HTMLElement>(".valores strong", resultado) : [];
  const fecho = resultado?.querySelector<HTMLElement>(".doze__fecho");
  const frasesFecho = fecho ? Array.from(fecho.children) as HTMLElement[] : [];

  if (!painelResultado || !resultado || !tituloResultado || valores.length !== 4 || frasesFecho.length !== 2) return;

  resultado.dataset.editorialGsap = "";
  const letrasFecho = frasesFecho.map((frase) => dividirEmLetras(frase));
  const deslocamentoTitulo = () => {
    if (!podePrender) return 0;
    const painelRect = painelResultado.getBoundingClientRect();
    const tituloRect = tituloResultado.getBoundingClientRect();
    const centroAtual = tituloRect.top - painelRect.top + tituloRect.height / 2;
    return Math.max(0, painelResultado.clientHeight / 2 - centroAtual);
  };

  gsap.set(resultado, { autoAlpha: 1 });
  gsap.set(tituloResultado, { autoAlpha: 0, y: deslocamentoTitulo });
  gsap.set(valores, { autoAlpha: 0, y: 24, scale: .98 });
  gsap.set(frasesFecho, { autoAlpha: 1 });
  gsap.set(letrasFecho.flat(), { autoAlpha: 0, yPercent: 108 });

  const alvos = [3, 5, 10, 15];
  const contadoresResultado = alvos.map(() => ({ valor: 0 }));
  valores.forEach((valor, indice) => {
    valor.textContent = indice === 3 ? "Até mesmo R$ 0 mil" : "R$ 0 mil";
  });

  const pausaResultado = { progresso: 0 };
  const linhaResultado = gsap.timeline({
    scrollTrigger: {
      trigger: painelResultado,
      start: podePrender ? () => `top top+=${alturaBarra()}` : "top 80%",
      end: podePrender ? "+=3400" : "bottom 20%",
      pin: podePrender,
      pinSpacing: podePrender,
      scrub: 1.2,
      anticipatePin: podePrender ? 1 : 0,
      invalidateOnRefresh: true,
    },
  });

  linhaResultado
    .to(tituloResultado, { autoAlpha: 1, duration: .75, ease: "power1.out" })
    .to(pausaResultado, { progresso: .25, duration: .5, ease: "none" }, ">.08")
    .to(tituloResultado, { y: 0, duration: 1.05, ease: "power1.out" }, ">.12");

  valores.forEach((valor, indice) => {
    const contador = contadoresResultado[indice];
    linhaResultado
      .to(valor, { autoAlpha: 1, y: 0, scale: 1, duration: .65, ease: "power1.out" }, ">.16")
      .to(
        contador,
        {
          valor: alvos[indice],
          duration: .8,
          ease: "power1.out",
          onUpdate: () => {
            const numero = Math.round(contador.valor);
            valor.textContent = indice === 3 ? `Até mesmo R$ ${numero} mil` : `R$ ${numero} mil`;
          },
        },
        "<.04",
      );
  });

  letrasFecho.forEach((letras) => {
    linhaResultado.to(letras, { autoAlpha: 1, yPercent: 0, duration: .08, stagger: .016, ease: "none" }, ">.2");
  });

  linhaResultado.to(pausaResultado, { progresso: 1, duration: 1, ease: "none" }, ">.2");
}

/* ------------------------------------------------------------------ *
 * Barra roxa — marquee contínuo só quando o texto não cabe.
 * ------------------------------------------------------------------ */

function marquee() {
  const trilho = document.querySelector<HTMLElement>("[data-marquee]");
  const original = trilho?.querySelector<HTMLElement>(".bar__text");
  if (!trilho || !original) return;

  let atual: ReturnType<typeof animate> | null = null;

  const parar = () => {
    atual?.pause();
    atual = null;
    utils.set(trilho, { x: 0 });
  };

  const aplicar = () => {
    if (!window.matchMedia("(max-width: 48rem)").matches) {
      parar();
      return;
    }

    // Distância em pixels: a largura de uma cópia mais o espaço entre elas.
    // Em px, e não em %, porque o deslocamento tem de casar exatamente com
    // o início da cópia para o laço não dar salto.
    const gap = parseFloat(getComputedStyle(trilho).columnGap) || 0;
    const passo = original.getBoundingClientRect().width + gap;
    if (!passo) return;

    parar();
    atual = animate(trilho, {
      x: [0, -passo],
      duration: passo * 22, // ~45px por segundo: leitura confortável.
      ease: EASE_LINEAR,
      loop: true,
    });
  };

  aplicar();

  let redimensionando: number | undefined;
  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(redimensionando);
      redimensionando = window.setTimeout(aplicar, 200);
    },
    { passive: true },
  );
}

/* ------------------------------------------------------------------ *
 * Indicador de leitura — preso à rolagem do documento.
 * ------------------------------------------------------------------ */

function progresso() {
  const barra = document.querySelector<HTMLElement>("[data-progress]");
  if (!barra) return;

  animate(barra, {
    scaleX: [0, 1],
    ease: EASE_LINEAR,
    autoplay: onScroll({
      target: document.body,
      enter: "top top",
      leave: "bottom bottom",
      sync: true,
    }),
  });
}

/* ------------------------------------------------------------------ *
 * Revelação de blocos e listas na rolagem.
 * ------------------------------------------------------------------ */

function revelacoes() {
  const gatilho = {
    start: "top 80%",
    end: "top 30%",
    scrub: 1.15,
    invalidateOnRefresh: true,
  } as const;

  const soltos = $$(".reveal").filter(
    (el) =>
      !el.closest("[data-seq-section3]") &&
      !el.closest(".movimentos") &&
      !el.closest("[data-editorial-gsap]") &&
      !el.hasAttribute("data-stagger") &&
      !el.parentElement?.hasAttribute("data-stagger"),
  );

  soltos.forEach((el) => {
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 34 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1,
        ease: "power1.out",
        scrollTrigger: { trigger: el, ...gatilho },
      },
    );
  });

  $$<HTMLElement>("[data-rule-sequence]").forEach((grupo) => {
    if (grupo.hasAttribute("data-carteira-gsap")) return;
    const filhos = Array.from(grupo.children) as HTMLElement[];
    if (filhos.length < 2) return;

    const sequencia = gsap.timeline({
      scrollTrigger: { trigger: grupo, ...gatilho },
    });

    sequencia
      .fromTo(
        filhos[0],
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: 1, ease: "power1.out" },
      )
      .fromTo(
        filhos[1],
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: 1, ease: "power1.out" },
        ">0.18",
      );
  });

  $$<HTMLElement>("[data-calc-sequence]").forEach((grupo) => {
    const filhos = Array.from(grupo.children) as HTMLElement[];
    if (filhos.length < 5) return;

    const sequencia = gsap.timeline({
      scrollTrigger: {
        trigger: grupo,
        start: "top 80%",
        end: "top 30%",
        scrub: 1.2,
        invalidateOnRefresh: true,
      },
    });

    sequencia
      .fromTo(filhos[0], { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power1.out" })
      .fromTo(filhos[1], { autoAlpha: 0, scale: .72 }, { autoAlpha: 1, scale: 1, duration: .65, ease: "power1.out" }, ">.12")
      .fromTo(filhos[2], { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power1.out" }, ">.16")
      .fromTo(filhos[3], { autoAlpha: 0, scale: .72 }, { autoAlpha: 1, scale: 1, duration: .65, ease: "power1.out" }, ">.12")
      .fromTo(filhos[4], { autoAlpha: 0, y: 42, scale: .975 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.2, ease: "power1.out" }, ">.16");
  });

  $$("[data-stagger]")
    .filter(
      (grupo) =>
        !grupo.closest("[data-seq-section3]") &&
        !grupo.closest(".movimentos") &&
        !grupo.hasAttribute("data-rule-sequence") &&
        !grupo.hasAttribute("data-calc-sequence"),
    )
    .forEach((grupo) => {
    const filhos = Array.from(grupo.children) as HTMLElement[];
    if (!filhos.length) return;

      gsap.fromTo(
        filhos,
        { autoAlpha: 0, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          stagger: .14,
          ease: "power1.out",
          scrollTrigger: { trigger: grupo, ...gatilho },
        },
      );
    });

  sincronizarRolagemSuave(() => ScrollTrigger.update());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
}

/* ------------------------------------------------------------------ *
 * Números que sobem quando entram na tela.
 * ------------------------------------------------------------------ */

function contadores() {
  $$("[data-count]").forEach((el) => {
    const texto = el.textContent ?? "";
    const achado = texto.match(/[\d.,]+/);
    if (!achado || achado.index === undefined) return;

    const prefixo = texto.slice(0, achado.index);
    const sufixo = texto.slice(achado.index + achado[0].length);
    const alvo = Number(achado[0].replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(alvo)) return;

    const contador = { valor: 0 };
    const escrever = (v: number) =>
      (el.textContent = prefixo + formatador.format(v) + sufixo);

    escrever(0);

    const entrada = animate(contador, {
      valor: [0, alvo],
      duration: 1100,
      ease: EASE_CONTAGEM,
      autoplay: false,
      onUpdate: () => escrever(Math.round(contador.valor)),
    });
    vincular(entrada, el);
  });
}

/* ------------------------------------------------------------------ *
 * Bootstrap.
 * ------------------------------------------------------------------ */

function iniciar() {
  try {
    hero();
    segundaDobra();
    aproximarSecaoSeguinte();
    terceiraSecao();
    processoTravado();
    numerosInterativos();
    recorrenciaInterativa();
    titulosPorLetra();
    cabecalhosEditoriais();
    movimentosSequenciais();
    experienciaSequencial();
    primeirosClientesSequencial();
    rotinaSequencial();
    dozeMesesSequencial();
    marquee();
    progresso();
    revelacoes();
    contadores();
    raiz.dataset.motionReady = "true";
  } catch (erro) {
    // Qualquer falha devolve a página ao estado estático e visível.
    raiz.classList.remove("anim");
    console.error("[motion]", erro);
  }
}

if (raiz.classList.contains("anim")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
}
