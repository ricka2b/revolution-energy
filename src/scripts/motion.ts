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
  saltarParaAncora,
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

/** Padrão único para entradas e transições da landing. */
const EASE_INOUT = eases.inOutQuad;
const DURACAO_ENTRADA = 600;
const EASE_GSAP = "power1.inOut";
const DURACAO_GSAP = 0.6;

const EASE = EASE_INOUT;

/** Desaceleração mais longa, para os números subirem sem parecer travados. */
const EASE_CONTAGEM = eases.outCubic;

/**
 * Curva mais macia, para a sequência da segunda dobra.
 * A `EASE` acima é forte de propósito em micro-interação; num trecho longo,
 * com o texto entrando letra a letra, ela lê como solavanco.
 */
const EASE_SUAVE = EASE_INOUT;

/** Curva simétrica para animações raspadas: não salta no início nem no fim. */
const EASE_SCROLL = EASE_INOUT;

/** Um passo da abertura da sessão 6. Todos têm a mesma duração. */
const PASSO = DURACAO_ENTRADA;

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
        duration: DURACAO_ENTRADA,
      },
      stagger(80),
    );
  }

  if (itens.length) {
    linha.add(
      itens,
      { opacity: [0, 1], y: [14, 0], duration: DURACAO_ENTRADA },
      stagger(90, { start: "-=480" }),
    );
  }

  if (chips.length) {
    linha.add(
      chips,
      { opacity: [0, 1], y: [10, 0], scale: [0.96, 1], duration: DURACAO_ENTRADA },
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

  /* ---- uma linha do tempo só, tocada com a rolagem travada ----

     A cena inteira roda de uma vez: a chamada e a pergunta entram no centro
     da tela, esperam um segundo, e então a pergunta encolhe e sobe enquanto
     o resto aparece. No fim a rolagem é devolvida com a dica de que dá para
     seguir.

     Antes isto era raspado no scroll, e a velocidade do gesto decidia o
     ritmo: quem rolava rápido atravessava a cena sem ler nada. */

  const CORPO_CHAMADA = DURACAO_ENTRADA;
  const PASSO_CHAMADA = 14;
  const CORPO_PERGUNTA = DURACAO_ENTRADA;
  const PASSO_PERGUNTA = 11;

  // A pergunta entra quando a chamada está em 80% do próprio percurso: as
  // duas frases se sobrepõem em vez de uma esperar a outra terminar.
  const percursoChamada =
    CORPO_CHAMADA + PASSO_CHAMADA * Math.max(0, letrasIntro.length - 1);
  const entradaPergunta = Math.round(percursoChamada * 0.8);
  const fimDaAbertura =
    entradaPergunta +
    CORPO_PERGUNTA +
    PASSO_PERGUNTA * Math.max(0, letrasPergunta.length - 1);

  // O segundo de respiro pedido: a pergunta fica parada no centro, sozinha,
  // antes de a cena virar.
  const ESPERA_NO_CENTRO = 300;
  const VIRADA = fimDaAbertura + ESPERA_NO_CENTRO;

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

  // Solta a medida: com o corpo grande o texto segue em duas linhas e
  // assume uma linha só quando encolher o bastante para caber.
  utils.set(pergunta, { maxWidth: "100%" });

  const linha = createTimeline({
    autoplay: false,
    defaults: { ease: EASE_SUAVE },
  });

  /* Abertura, no centro da tela. */
  linha.add(
    letrasIntro,
    { y: "0%", duration: CORPO_CHAMADA, delay: stagger(PASSO_CHAMADA) },
    0,
  );
  linha.add(
    letrasPergunta,
    { y: "0%", duration: CORPO_PERGUNTA, delay: stagger(PASSO_PERGUNTA) },
    entradaPergunta,
  );

  /* A virada: a chamada sai, a pergunta encolhe e o grupo assenta. */
  linha.add(intro, { opacity: 0, y: -28, duration: DURACAO_ENTRADA }, VIRADA);
  linha.add(
    pergunta,
    { fontSize: [medirCorpo(false), medirCorpo(true)], duration: DURACAO_ENTRADA },
    VIRADA,
  );
  linha.add(
    grupo,
    {
      y: [centroInicialPergunta, 0],
      // A subida percorre uma faixa maior que a redução da fonte. A curva
      // simétrica evita tanto o arranque quanto a parada brusca.
      duration: DURACAO_ENTRADA,
    },
    VIRADA,
  );
  // Devolve o controle do corpo ao CSS assim que a redução termina.
  linha.add(
    { marca: 0 },
    {
      marca: 1,
      duration: DURACAO_GSAP,
      onBegin: () => pergunta.classList.add("pergunta--fim"),
    },
    VIRADA + DURACAO_ENTRADA,
  );

  /* O restante entra em sequência, um bloco de cada vez. */
  linha.add(provavelmente, { opacity: 1, y: 0, duration: DURACAO_ENTRADA }, VIRADA + DURACAO_ENTRADA);
  linha.add(
    itens,
    { opacity: 1, y: 0, duration: DURACAO_ENTRADA, delay: stagger(160) },
    VIRADA + 1300,
  );
  linha.add(fecho, { opacity: 1, y: 0, duration: DURACAO_ENTRADA }, VIRADA + 3200);

  // O gatilho é o trilho: quando o centro dele encontra o centro da tela, o
  // palco já preenche a viewport e a cena pode começar enquadrada.
  const resto = document.querySelector<HTMLElement>("[data-resto]");

  cenaTravada({
    gatilho: trilho,
    linha,
    inicio: "top top",
    // O box seguinte é puxado para dentro da área do palco pela margem
    // negativa. Só ganha opacidade quando a cena devolve a rolagem.
    aoLiberar: () => {
      if (resto) resto.dataset.liberado = "true";
    },
  });
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

  linhaIntro.add(eyebrow, { opacity: 1, y: 0, duration: DURACAO_ENTRADA }, 0);
  linhaIntro.add(
    letrasTitulo,
    {
      opacity: 1,
      y: "0%",
      duration: DURACAO_ENTRADA,
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
    { opacity: 1, y: 0, duration: DURACAO_ENTRADA, delay: stagger(360) },
    0,
  );
  linhaMecanismo.add(card, { opacity: 1, y: 0, scale: 1, duration: DURACAO_ENTRADA }, 520);
  linhaMecanismo.add(cardTitulo, { opacity: 1, y: 0, duration: DURACAO_ENTRADA }, 940);
  linhaMecanismo.add(
    cardItens,
    { opacity: 1, y: 0, duration: DURACAO_ENTRADA, delay: stagger(240) },
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
    { opacity: 1, y: 0, duration: DURACAO_ENTRADA, delay: stagger(440) },
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
    { opacity: 1, y: 0, duration: DURACAO_ENTRADA, delay: stagger(120) },
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
        ease: EASE_GSAP,
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

  linha.add(titulo, { opacity: 1, y: 0, duration: DURACAO_ENTRADA }, 0);
  linha.add(
    passos,
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: DURACAO_ENTRADA,
      delay: stagger(720),
    },
    760,
  );
  linha.add(fim, { opacity: 1, y: 0, duration: DURACAO_ENTRADA }, 4300);

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

  // ---- Abertura: cena travada, com a rolagem presa ----
  //
  // Esta parte não é raspada pelo scroll. Ao chegar no topo do trilho a tela
  // trava, a cena roda inteira no tempo dela e só então aparece o "Arraste
  // para continuar" — o mesmo padrão da segunda dobra.
  //
  // Um passo só termina para o seguinte começar: as marcas saem do
  // comprimento real de cada trecho (letras têm stagger, então duram mais
  // que os 500ms de cada tween). Assim as esperas pedidas são mesmo esperas
  // e nada encavala se a contagem de letras mudar.
  const linhaAbertura = createTimeline({
    defaults: { ease: EASE_INOUT, duration: PASSO },
    autoplay: false,
  });

  const ESPERA_TITULO = 1000;
  const ESPERA_CHAMADA = 1500;

  const fimLetrasTitulo = PASSO + 25 * (letras.length - 1);
  const sobeTitulo = fimLetrasTitulo + ESPERA_TITULO;
  const fimLetrasChamada = sobeTitulo + PASSO + 18 * (letrasChamada.length - 1);
  const sobeChamada = fimLetrasChamada + ESPERA_CHAMADA;
  // As contas só entram quando a chamada já chegou ao lugar dela, lá em cima.
  const entradaIcones = sobeChamada + PASSO;
  const fimIcones = entradaIcones + PASSO + 8 * (icones.length - 1);
  const consumoInicio = fimIcones + 150;

  // 1. "Vamos colocar números nisso?" entra letra por letra, grande e no
  //    centro exato da tela.
  linhaAbertura.add(letras, { opacity: 1, y: 0, delay: stagger(25) }, 0);

  // 2. Passada a espera, o título sobe para o lugar dele no layout e, no
  //    mesmo instante, a chamada aparece no centro.
  linhaAbertura.add(titulo, { y: 0, scale: 1 }, sobeTitulo);
  linhaAbertura.add(tituloInicial, { opacity: 0 }, sobeTitulo);
  linhaAbertura.add(tituloFinal, { opacity: 1 }, sobeTitulo);
  linhaAbertura.add(
    letrasChamada,
    { opacity: 1, y: 0, scale: 1, delay: stagger(18) },
    sobeTitulo,
  );

  // 3. Passada a segunda espera, a chamada sobe — e só depois de ela chegar
  //    lá em cima é que as 40 contas aparecem.
  linhaAbertura.add(chamada, { y: 0 }, sobeChamada);
  linhaAbertura.add(icones, { opacity: 1, scale: 1, delay: stagger(8) }, entradaIcones);

  // 4. E então o consumo e a comissão, um depois do outro.
  linhaAbertura.add(consumoLinha, { opacity: 1, y: 0 }, consumoInicio);
  linhaAbertura.add(consumoFrase, { opacity: 1, y: 0 }, consumoInicio + PASSO);
  linhaAbertura.add(
    contador,
    { valor: 15, onUpdate: escreverConsumo },
    consumoInicio + PASSO,
  );
  linhaAbertura.add(comissao, { opacity: 1, y: 0 }, consumoInicio + 2 * PASSO);

  // ---- Cenas 2, 3 e 4: cada uma é a próxima cena travada da fila ----
  //
  // A seção inteira roda no regime de cena travada: a tela prende no topo do
  // trilho e cada arrasto toca uma cena por inteiro, do zoom de saída da
  // anterior até a última linha da nova. Nada aqui é raspado pelo scroll, e
  // por isso o trilho não tem mais percurso nenhum.

  const novaCena = () =>
    createTimeline({
      defaults: { ease: EASE_INOUT, duration: PASSO },
      autoplay: false,
    });

  // A cena que entra começa a aparecer ainda durante o zoom da que sai.
  const ENTRADA = 150;
  const DEPOIS_DA_TROCA = PASSO + ENTRADA;

  // ---- Cena 2: "Com esse volume... até R$ 6.000" ----

  const linhaCena2 = novaCena();
  linhaCena2.add(cena1, { scale: 1.16, opacity: 0 }, 0);
  linhaCena2.add(cena2, { opacity: 1 }, ENTRADA);
  linhaCena2.add(s2Intro, { opacity: 1, y: 0 }, DEPOIS_DA_TROCA);
  linhaCena2.add(s2Pill, { opacity: 1, scale: 1 }, DEPOIS_DA_TROCA + PASSO);
  linhaCena2.add(
    contadorS2,
    { valor: 6000, onUpdate: escreverS2 },
    DEPOIS_DA_TROCA + PASSO,
  );
  linhaCena2.add(s2Legenda, { opacity: 1, y: 0 }, DEPOIS_DA_TROCA + 2 * PASSO);

  // ---- Cena 3: o bônus a cada dez contas ----

  const linhaCena3 = novaCena();
  linhaCena3.add(cena2, { scale: 1.16, opacity: 0 }, 0);
  linhaCena3.add(cena3, { opacity: 1 }, ENTRADA);

  // A chamada entra grande e centralizada, letra por letra, e só sobe para o
  // lugar dela no layout quando a última letra chega — o mesmo da abertura.
  const fimLetrasS3Header =
    DEPOIS_DA_TROCA + PASSO + 16 * (letrasS3Header.length - 1);
  linhaCena3.add(
    letrasS3Header,
    { opacity: 1, y: 0, delay: stagger(16) },
    DEPOIS_DA_TROCA,
  );
  linhaCena3.add(s3Header, { y: 0, scale: 1 }, fimLetrasS3Header);

  const s3Bloco = fimLetrasS3Header + PASSO;
  const fimIconesS3 = s3Bloco + 2 * PASSO + 18 * (s3Icones.length - 1);
  linhaCena3.add(s3Linha, { opacity: 1, y: 0 }, s3Bloco);
  linhaCena3.add(
    s3Icones,
    { opacity: 1, scale: 1, delay: stagger(18) },
    s3Bloco + PASSO,
  );
  linhaCena3.add(s3BonusValor, { opacity: 1, y: 0 }, fimIconesS3);
  linhaCena3.add(
    contadorS3Bonus,
    { valor: 1000, onUpdate: escreverS3Bonus },
    fimIconesS3,
  );
  linhaCena3.add(s3Ouseja, { opacity: 1, y: 0 }, fimIconesS3 + PASSO);

  // "40 contas cadastradas são" aparece, "4 ciclos de 10 contas" digita letra
  // por letra, e só então entra a coluna do resultado: o valor sobe em
  // contador e "em bônus" digita logo atrás.
  const s3Coluna = fimIconesS3 + 2 * PASSO;
  const s3Resultado = s3Coluna + 2 * PASSO + 26 * (letrasS3Pill.length - 1);
  linhaCena3.add(s3Coluna1Label, { opacity: 1, y: 0 }, s3Coluna);
  linhaCena3.add(s3PillCiclos, { opacity: 1 }, s3Coluna + PASSO);
  linhaCena3.add(
    letrasS3Pill,
    { opacity: 1, y: 0, delay: stagger(26) },
    s3Coluna + PASSO,
  );
  linhaCena3.add(s3Coluna2Label, { opacity: 1, y: 0 }, s3Resultado);
  linhaCena3.add(s3Coluna2Pill, { opacity: 1 }, s3Resultado + PASSO);
  linhaCena3.add(
    contadorS3Total,
    { valor: 4000, onUpdate: escreverS3Total },
    s3Resultado + PASSO,
  );
  linhaCena3.add(
    letrasS3EmBonus,
    { opacity: 1, y: 0, delay: stagger(30) },
    s3Resultado + 2 * PASSO,
  );

  // ---- Cena 4: a soma final, sobre o fundo claro ----
  //
  // O fade desta troca **é** a mudança de fundo escuro → claro: a cena 4
  // carrega o próprio `background`. Não existe tween em `background-color`.

  const linhaCena4 = novaCena();
  linhaCena4.add(cena3, { scale: 1.16, opacity: 0 }, 0);
  linhaCena4.add(cena4, { opacity: 1 }, ENTRADA);

  const fimLetrasS4Titulo =
    DEPOIS_DA_TROCA + PASSO + 14 * (letrasS4Titulo.length - 1);
  linhaCena4.add(
    letrasS4Titulo,
    { opacity: 1, y: 0, delay: stagger(14) },
    DEPOIS_DA_TROCA,
  );
  linhaCena4.add(s4Titulo, { y: 0, scale: 1 }, fimLetrasS4Titulo);

  // Primeiro cartão, o "+" girando com o segundo, e então o total.
  const s4Cartao1 = fimLetrasS4Titulo + PASSO;
  const s4Cartao2 = s4Cartao1 + PASSO + 16 * (letrasS4Card1Label.length - 1);
  const s4Total = s4Cartao2 + PASSO + 16 * (letrasS4Card2Label.length - 1);

  linhaCena4.add(s4Card1, { opacity: 1, y: 0 }, s4Cartao1);
  linhaCena4.add(
    contadoresS4[0],
    {
      valor: contadoresS4[0].alvo,
      onUpdate: () => escreverS4Card(contadoresS4[0]),
    },
    s4Cartao1,
  );
  linhaCena4.add(
    letrasS4Card1Label,
    { opacity: 1, y: 0, delay: stagger(16) },
    s4Cartao1,
  );

  linhaCena4.add(s4Plus, { scale: 1, rotate: 0 }, s4Cartao2);
  linhaCena4.add(s4Card2, { opacity: 1, y: 0 }, s4Cartao2);
  linhaCena4.add(
    contadoresS4[1],
    {
      valor: contadoresS4[1].alvo,
      onUpdate: () => escreverS4Card(contadoresS4[1]),
    },
    s4Cartao2,
  );
  linhaCena4.add(
    letrasS4Card2Label,
    { opacity: 1, y: 0, delay: stagger(16) },
    s4Cartao2,
  );

  linhaCena4.add(s4TotalValor, { opacity: 1, y: 0 }, s4Total);
  linhaCena4.add(
    contadorTotal,
    { valor: 10000, onUpdate: escreverTotal },
    s4Total,
  );
  linhaCena4.add(
    letrasS4TotalLabel,
    { opacity: 1, y: 0, delay: stagger(16) },
    s4Total,
  );

  cenasTravadasEmSequencia({
    gatilho: trilho,
    linhas: [linhaAbertura, linhaCena2, linhaCena3, linhaCena4],
    inicio: "top top",
  });
}

/* ------------------------------------------------------------------ *
 * Trava de rolagem reutilizável.
 * ------------------------------------------------------------------ */

/**
 * Prende a rolagem e devolve a função que a solta. Chamar a função de volta
 * mais de uma vez é seguro — a segunda chamada não faz nada.
 *
 * Bloquear os eventos não basta: o Lenis tem listener de roda e motor de
 * rolagem próprios, e continuaria interpolando por conta dele. Por isso ele
 * é parado junto.
 */
function travarRolagem() {
  const teclasBloqueadas = new Set([
    "ArrowDown",
    "ArrowUp",
    "PageDown",
    "PageUp",
    " ",
    "Home",
    "End",
  ]);

  const barrar = (evento: Event) => evento.preventDefault();
  const barrarTeclado = (evento: KeyboardEvent) => {
    if (teclasBloqueadas.has(evento.key)) evento.preventDefault();
  };

  pausarRolagemSuave();
  window.addEventListener("wheel", barrar, { passive: false });
  window.addEventListener("touchmove", barrar, { passive: false });
  window.addEventListener("keydown", barrarTeclado);

  let solto = false;
  return () => {
    if (solto) return;
    solto = true;
    window.removeEventListener("wheel", barrar);
    window.removeEventListener("touchmove", barrar);
    window.removeEventListener("keydown", barrarTeclado);
    retomarRolagemSuave();
  };
}

/* ------------------------------------------------------------------ *
 * Cena travada + dica "arraste para continuar".
 * ------------------------------------------------------------------ */

/**
 * A dica é um elemento só, criado na primeira vez e reaproveitado por todas
 * as cenas. Fica `fixed` no rodapé da janela — como a cena está presa na
 * tela quando ela aparece, o rodapé da janela é o rodapé da cena.
 *
 * Não é `aria-hidden`: a trava também bloqueia as setas do teclado, então
 * quem navega sem mouse precisa ser avisado de que a espera acabou.
 */
let elementoDica: HTMLElement | null = null;

function obterDica() {
  if (elementoDica) return elementoDica;
  const el = document.createElement("div");
  el.className = "dica-arraste";
  el.setAttribute("role", "status");
  el.innerHTML =
    "<span>Arraste para continuar</span>" +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" stroke-width="2.4"' +
    ' stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild(el);
  elementoDica = el;
  return el;
}

function mostrarDica() {
  obterDica().dataset.visivel = "true";
}

function esconderDica() {
  if (elementoDica) delete elementoDica.dataset.visivel;
}

/**
 * Prende a rolagem, toca a linha inteira e **mantém a tela presa** depois
 * que ela termina: aparece a dica, e só o gesto seguinte libera a cena.
 *
 * A trava não se solta sozinha de propósito. Soltar no fim da animação
 * devolvia o controle no meio de uma inércia que já estava em curso, e a
 * cena escapava sem a pessoa ter lido nada.
 *
 * `once: true` porque a cena conta uma história: repetir a cada passagem
 * prenderia a pessoa de novo num conteúdo que ela já viu.
 */
type LinhaTocavel = {
  play: () => unknown;
  pause?: () => unknown;
  duration: number;
  seek: (tempo: number) => unknown;
};

const cenasNavegaveis: Array<{ gatilho: HTMLElement; concluir: () => void; ativa: () => boolean }> = [];

function alvoDaAncora() {
  try {
    return document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
  } catch {
    return null;
  }
}

function vemAntesDoAlvo(gatilho: HTMLElement, alvo: HTMLElement) {
  return !gatilho.contains(alvo) && Boolean(gatilho.compareDocumentPosition(alvo) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function navegarParaAncora(alvo: HTMLElement) {
  for (const cena of cenasNavegaveis) {
    if (cena.ativa() || vemAntesDoAlvo(cena.gatilho, alvo)) cena.concluir();
  }
  esconderDica();
  ScrollTrigger.refresh();
  saltarParaAncora(alvo);
  ScrollTrigger.update();
}

function configurarAncoras() {
  document.addEventListener("click", (evento) => {
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    const link = (evento.target as Element)?.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
    let alvo: HTMLElement | null = null;
    try { alvo = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return; }
    if (!alvo) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    history.pushState(null, "", url.hash);
    navegarParaAncora(alvo);
  }, true);
  window.addEventListener("hashchange", () => {
    const alvo = alvoDaAncora();
    if (alvo) navegarParaAncora(alvo);
  });
  const posicionar = () => {
    const alvo = alvoDaAncora();
    if (alvo) navegarParaAncora(alvo);
  };
  posicionar();
  // Fontes e imagens podem mudar a posição final depois do primeiro layout.
  if (document.readyState !== "complete") window.addEventListener("load", posicionar, { once: true });
  document.fonts.ready.then(posicionar);
}

/**
 * Toca uma fila de cenas com a rolagem presa, uma por gesto.
 *
 * Ao cruzar o gatilho a tela trava e a primeira linha do tempo roda por
 * inteiro. Quando ela acaba aparece a dica "Arraste para continuar" e o
 * primeiro gesto depois disso **não devolve a rolagem**: ele toca a próxima
 * cena da fila. A rolagem só volta depois da última.
 *
 * A trava é uma só do começo ao fim — nada de soltar e retravar entre cenas,
 * o que deixaria a inércia do Lenis atravessar a troca.
 */
function cenasTravadasEmSequencia(opcoes: {
  gatilho: HTMLElement;
  linhas: LinhaTocavel[];
  inicio?: string;
  /** Chamado quando a última cena termina e a rolagem é devolvida. */
  aoLiberar?: () => void;
}) {
  const { gatilho, linhas, inicio = "center center", aoLiberar } = opcoes;
  if (!linhas.length) return;

  let concluida = false;
  let liberar: (() => void) | undefined;
  let limparEspera: (() => void) | undefined;
  let trigger: ScrollTrigger | undefined;
  const concluir = () => {
    if (concluida) return;
    concluida = true;
    limparEspera?.();
    liberar?.();
    liberar = undefined;
    for (const linha of linhas) {
      linha.pause?.();
      linha.seek(linha.duration);
    }
    trigger?.kill();
    aoLiberar?.();
  };
  cenasNavegaveis.push({ gatilho, concluir, ativa: () => Boolean(liberar) });

  // Recarregar a página numa âncora abaixo desta seção deixaria as cenas
  // presas no estado inicial, invisíveis para sempre — o gatilho só dispara
  // ao ser cruzado. Aqui elas já nascem montadas, sem travar nada.
  const destinoInicial = alvoDaAncora();
  if ((destinoInicial && vemAntesDoAlvo(gatilho, destinoInicial)) || gatilho.getBoundingClientRect().bottom < 0) {
    concluir();
    return;
  }

  trigger = ScrollTrigger.create({
    trigger: gatilho,
    start: inicio,
    once: true,
    onEnter: () => {
      if (concluida) return;
      if (gatilho.getBoundingClientRect().bottom <= 0) {
        concluir();
        return;
      }
      const soltarRolagem = travarRolagem();
      liberar = soltarRolagem;

      const tocar = (indice: number) => {
        const linha = linhas[indice];

        let avancou = false;
        const avancar = () => {
          if (avancou || concluida) return;
          avancou = true;
          window.removeEventListener("wheel", avancar);
          window.removeEventListener("touchmove", avancar);
          window.removeEventListener("keydown", avancar);
          esconderDica();

          if (indice + 1 < linhas.length) {
            tocar(indice + 1);
            return;
          }
          soltarRolagem();
          liberar = undefined;
          concluida = true;
          aoLiberar?.();
        };

        let terminou = false;
        const aoTerminar = () => {
          if (terminou || concluida) return;
          terminou = true;
          mostrarDica();
          // A cena continua presa. O primeiro gesto depois da dica é que
          // avança — é ele o "arraste para continuar".
          window.addEventListener("wheel", avancar, { passive: true });
          window.addEventListener("touchmove", avancar, { passive: true });
          window.addEventListener("keydown", avancar, { passive: true });
        };

        // Rede de segurança: se a linha não avisar que terminou, a dica
        // aparece assim mesmo. Prender para sempre seria pior que o defeito.
        const resgate = window.setTimeout(aoTerminar, linha.duration + 4000);
        limparEspera = () => {
          window.clearTimeout(resgate);
          window.removeEventListener("wheel", avancar);
          window.removeEventListener("touchmove", avancar);
          window.removeEventListener("keydown", avancar);
        };

        Promise.resolve(linha.play() as PromiseLike<unknown>).then(() => {
          window.clearTimeout(resgate);
          // Um respiro com a cena montada antes de convidar a seguir.
          window.setTimeout(aoTerminar, 500);
        });
      };

      tocar(0);
    },
  });
}

/** Uma cena travada só — o caso de uma fila de um item. */
function cenaTravada(opcoes: {
  gatilho: HTMLElement;
  linha: LinhaTocavel;
  inicio?: string;
  /** Chamado quando a pessoa arrasta e a cena devolve a rolagem. */
  aoLiberar?: () => void;
}) {
  const { linha, ...resto } = opcoes;
  cenasTravadasEmSequencia({ ...resto, linhas: [linha] });
}

/* ------------------------------------------------------------------ *
 * Sessão 7 — renda recorrente, narrativa raspada no scroll.
 * ------------------------------------------------------------------ */

function recorrenciaInterativa() {
  const secao = document.querySelector<HTMLElement>("[data-rec-section]");
  if (!secao) return;

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

  const letrasLabel = dividirEmLetras(label);
  const letrasPill = palavrasPill.flatMap(dividirEmLetras);
  const letrasParagrafos = paragrafos.map(dividirEmLetras);
  const letrasTituloEscala = dividirEmLetras(tituloEscala);
  const letrasTituloVirada = dividirEmLetras(tituloVirada);
  const letrasTextosVirada = textosVirada.map(dividirEmLetras);

  utils.set([label, pill, ...paragrafos, tituloEscala, tituloVirada], { opacity: 1 });
  utils.set(
    [
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

  /* Card branco, narrativa e troca energia → recorrência. */
  const linhaCard = createTimeline({
    autoplay: false,
    defaults: { ease: EASE_SCROLL },
  });

  linhaCard.add(
    card,
    { opacity: 1, y: 0, scale: 1, duration: DURACAO_ENTRADA },
    0,
  );
  linhaCard.add(
    letrasLabel,
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(10) },
    700,
  );

  linhaCard.add(
    pill,
    { scale: 1, duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    1900,
  );
  linhaCard.add(
    letrasPill,
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(9) },
    2000,
  );

  // "Imagine que você conquistou…" conclui a primeira cadeia textual e
  // revela o novo cliente ao lado no mesmo instante.
  linhaCard.add(
    letrasParagrafos[0],
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(9) },
    3200,
  );
  linhaCard.add(
    base,
    { scale: 1, rotate: 0, duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    3300,
  );
  linhaCard.add(user, { scale: 1, duration: DURACAO_ENTRADA, ease: EASE_SUAVE }, 3420);
  linhaCard.add(
    energia,
    { scale: 1, y: 0, duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    3540,
  );

  linhaCard.add(
    letrasParagrafos[1],
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(8) },
    5200,
  );

  // "No outro também…": o raio sai e o símbolo de renovação o substitui.
  linhaCard.add(
    letrasParagrafos[2],
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(9) },
    7000,
  );
  linhaCard.add(
    energia,
    { opacity: 0, scale: 0, duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    7000,
  );
  linhaCard.add(
    renew,
    {
      opacity: 1,
      scale: 1,
      rotate: 0,
      duration: DURACAO_ENTRADA,
      ease: EASE_SUAVE,
    },
    7250,
  );

  linhaCard.add(
    letrasParagrafos[3],
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(7) },
    8500,
  );

  // Esta é a única cena travada da seção em todos os breakpoints. A abertura
  // permanece fixa; ao chegar no card a pessoa assiste à narrativa completa
  // e só avança depois de "Arraste para continuar".
  cenaTravada({
    gatilho: card,
    linha: linhaCard,
    inicio: "center center",
  });

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
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(9) },
    0,
  );
  linhaConclusao.add(
    boxes,
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: DURACAO_ENTRADA,
      delay: stagger(340),
    },
    1050,
  );

  // O conjunto 10–200 sai como uma única composição, com zoom e fade.
  linhaConclusao.add(
    escala,
    { opacity: 0, scale: 1.12, duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    3200,
  );

  // Parte 2: o título nasce grande no centro e só depois assume sua posição
  // final do Figma, antes de revelar pergunta e resposta.
  linhaConclusao.add(
    letrasTituloVirada,
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(10) },
    3650,
  );
  linhaConclusao.add(
    tituloVirada,
    { y: 0, scale: 1, duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    5200,
  );
  linhaConclusao.add(partesVirada[0], { opacity: 1, duration: DURACAO_ENTRADA }, 6350);
  linhaConclusao.add(
    letrasTextosVirada[0],
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(10) },
    6400,
  );
  linhaConclusao.add(
    letrasTextosVirada[1],
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(9) },
    7250,
  );

  // Parte 3: a pergunta anterior se aproxima e dissolve, o fundo muda e o
  // mesmo título permanece no alto enquanto a nova ideia surge no centro.
  linhaConclusao.add(
    partesVirada[0],
    { opacity: 0, scale: 1.08, duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    9000,
  );
  linhaConclusao.add(
    fundoFinal,
    { opacity: 1, duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    9250,
  );
  linhaConclusao.add(
    tituloVirada,
    { color: "#ffffff", duration: DURACAO_ENTRADA, ease: EASE_SUAVE },
    9250,
  );
  linhaConclusao.add(partesVirada[1], { opacity: 1, duration: DURACAO_ENTRADA }, 10100);
  linhaConclusao.add(
    letrasTextosVirada[2],
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(10) },
    10150,
  );
  linhaConclusao.add(
    letrasTextosVirada[3],
    { y: "0%", duration: DURACAO_ENTRADA, delay: stagger(8) },
    11000,
  );

  cenaTravada({
    gatilho: trilhoConclusao,
    linha: linhaConclusao,
    inicio: "top top",
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
      duration: DURACAO_ENTRADA,
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
          duration: DURACAO_GSAP,
          stagger: .018,
          ease: EASE_GSAP,
        });
      }

      linha.to(
        letrasHeadline,
        {
          autoAlpha: 1,
          yPercent: 0,
          duration: DURACAO_GSAP,
          stagger: .014,
          ease: EASE_GSAP,
        },
        letrasPre.length ? ">.18" : 0,
      );

      if (apoio) {
        linha.to(apoio, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.18");
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
      .to(letrasPre, { autoAlpha: 1, yPercent: 0, duration: DURACAO_GSAP, stagger: .02, ease: EASE_GSAP })
      .to(letrasHeadline, { autoAlpha: 1, yPercent: 0, duration: DURACAO_GSAP, stagger: .014, ease: EASE_GSAP }, ">.2")
      .to(sub, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.2");
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
        .to(card, { autoAlpha: 1, y: 0, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP })
        .to(icon, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.08")
        .to(title, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.06")
        .to(texto, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.06");
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
      .to(frase, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP })
      .to(bullets, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, stagger: .22, ease: EASE_GSAP }, ">.16")
      .to(fluxo, { autoAlpha: 1, y: 0, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.18")
      .to(fluxoItens, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, stagger: .16, ease: EASE_GSAP }, ">.1");
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
      .to(pre, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP })
      .to(letras, { autoAlpha: 1, duration: .08, stagger: .04, ease: "none" }, ">.12")
      .to(cursor, { autoAlpha: 0, scaleY: .65, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.12");
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
      .to(respostaIntro, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP })
      .to(topicos, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, stagger: .28, ease: EASE_GSAP }, ">.18");
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
      .to(fechoTitulo, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP })
      .to(fechoTexto, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.14")
      .to(fluxo, { autoAlpha: 1, y: 0, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.14")
      .to(itensFluxo, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, stagger: .2, ease: EASE_GSAP }, ">.08");
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
      .to(letrasChamada, { autoAlpha: 1, yPercent: 0, duration: DURACAO_GSAP, stagger: .018, ease: EASE_GSAP })
      .to(letrasApoio, { autoAlpha: 1, yPercent: 0, duration: DURACAO_GSAP, stagger: .014, ease: EASE_GSAP }, ">.18")
      .to(contatos, { autoAlpha: 1, y: 0, scale: 1, duration: DURACAO_GSAP, stagger: .2, ease: EASE_GSAP }, ">.2");
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
    .to(frame, { autoAlpha: 1, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP })
    .to(chatPassos, { autoAlpha: 1, y: 0, scale: 1, duration: DURACAO_GSAP, stagger: .1, ease: EASE_GSAP }, ">.08")
    .to(letrasTitulo, { autoAlpha: 1, yPercent: 0, duration: DURACAO_GSAP, stagger: .016, ease: EASE_GSAP }, ">.22")
    .to(letrasTextoUm, { autoAlpha: 1, yPercent: 0, duration: DURACAO_GSAP, stagger: .011, ease: EASE_GSAP }, ">.16")
    .to(letrasTextoDois, { autoAlpha: 1, yPercent: 0, duration: DURACAO_GSAP, stagger: .014, ease: EASE_GSAP }, ">.14")
    .to(pagarMenos, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.16")
    .to(mudaTudo, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.14")
    .to(pausa, { progresso: 1, duration: DURACAO_GSAP, ease: "none" }, ">.2");
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
      duration: DURACAO_GSAP,
      stagger: .28,
      ease: EASE_GSAP,
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
      .to(label, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP })
      .to(fluxo, { autoAlpha: 1, y: 0, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.14")
      .to(itens, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, stagger: .2, ease: EASE_GSAP }, ">.08")
      .to(fim, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.16");
  }
}

/* ------------------------------------------------------------------ *
 * Sessão 14 — abertura central, redução e cenários digitados no scroll.
 * ------------------------------------------------------------------ */

function dozeMesesSequencial() {
  const transicao = document.querySelector<HTMLElement>("[data-doze-transicao]");
  const estados = transicao ? $$<HTMLElement>("[data-doze-estado]", transicao) : [];
  if (!transicao || estados.length !== 2) return;

  // A narrativa usa o mesmo palco em desktop e mobile. O conteúdo de cada
  // cena roda por completo antes de aceitar o próximo gesto.
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

  const linhaCenarioUm = gsap.timeline({ paused: true });

  linhaCenarioUm
    .to(cabecalhoUm, { autoAlpha: 1, duration: DURACAO_GSAP, ease: EASE_GSAP })
    .to({}, { duration: DURACAO_GSAP }, ">.08")
    .to(cabecalhoUm, { y: 0, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.12")
    .to(etiquetaUm, { autoAlpha: 1, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.22")
    .to(letrasEtiqueta, { autoAlpha: 1, duration: .08, stagger: .04, ease: "none" }, "<.04");

  letrasParagrafos.forEach((letras) => {
    linhaCenarioUm.to(letras, { autoAlpha: 1, duration: .08, stagger: .018, ease: "none" }, ">.2");
  });

  const linhaCenarioDois = gsap.timeline({ paused: true });

  linhaCenarioDois
    .to(estadoUm, { autoAlpha: 0, scale: .985, duration: DURACAO_GSAP, ease: "power1.inOut" }, ">.08")
    .to(estadoDois, { autoAlpha: 1, scale: 1, duration: DURACAO_GSAP, ease: "power1.inOut" }, "<")
    .to({}, { duration: DURACAO_GSAP }, ">.12")
    .to(cabecalhoDois, { y: 0, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.1")
    .to(etiquetaDois, { autoAlpha: 1, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.22")
    .to(letrasEtiquetaDois, { autoAlpha: 1, duration: .08, stagger: .04, ease: "none" }, "<.04");

  letrasParagrafosDois.forEach((letras) => {
    linhaCenarioDois.to(letras, { autoAlpha: 1, duration: .08, stagger: .018, ease: "none" }, ">.2");
  });

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

  const linhaResultado = gsap.timeline({ paused: true });

  linhaResultado
    .to(tituloResultado, { autoAlpha: 1, duration: DURACAO_GSAP, ease: EASE_GSAP })
    .to({}, { duration: .5 }, ">.08")
    .to(tituloResultado, { y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.12");

  valores.forEach((valor, indice) => {
    const contador = contadoresResultado[indice];
    linhaResultado
      .to(valor, { autoAlpha: 1, y: 0, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.16")
      .to(
        contador,
        {
          valor: alvos[indice],
          duration: DURACAO_GSAP,
          ease: EASE_GSAP,
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

  const adaptarLinhaGsap = (linha: gsap.core.Timeline): LinhaTocavel => ({
    duration: Math.max(1, linha.duration() * 1000),
    seek: (tempo) => linha.pause().seek(tempo / 1000),
    play: () =>
      new Promise<void>((resolver) => {
        linha.eventCallback("onComplete", resolver);
        linha.play(0);
      }),
  });

  cenasTravadasEmSequencia({
    gatilho: transicao,
    linhas: [adaptarLinhaGsap(linhaCenarioUm), adaptarLinhaGsap(linhaCenarioDois)],
    inicio: "top top",
  });

  cenaTravada({
    gatilho: painelResultado,
    linha: adaptarLinhaGsap(linhaResultado),
    inicio: "center center",
  });
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
        duration: DURACAO_GSAP,
        ease: EASE_GSAP,
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
        { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP },
      )
      .fromTo(
        filhos[1],
        { autoAlpha: 0, y: 28 },
        { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP },
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
      .fromTo(filhos[0], { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP })
      .fromTo(filhos[1], { autoAlpha: 0, scale: .72 }, { autoAlpha: 1, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.12")
      .fromTo(filhos[2], { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.16")
      .fromTo(filhos[3], { autoAlpha: 0, scale: .72 }, { autoAlpha: 1, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.12")
      .fromTo(filhos[4], { autoAlpha: 0, y: 42, scale: .975 }, { autoAlpha: 1, y: 0, scale: 1, duration: DURACAO_GSAP, ease: EASE_GSAP }, ">.16");
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
          duration: DURACAO_GSAP,
          stagger: .14,
          ease: EASE_GSAP,
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
      duration: DURACAO_ENTRADA,
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
    configurarAncoras();
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
