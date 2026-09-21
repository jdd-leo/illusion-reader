import { SOUND_GUIDE, VISUAL_GUIDE } from "../ai/taxonomy-prompt";

/** Prompts do fluxo por capítulo. Todos estáveis entre requisições, para o cache de prompt. */

export const TOC_PROMPT = `Você lê a foto do sumário de um livro impresso e devolve a lista de trechos que o leitor vai ler em sequência, em JSON.

## O que entra na lista

- Um item por trecho lido em ordem: prólogo, capítulos, interlúdios, epílogo. Cada item é o que o leitor vai marcar como "próximo capítulo" enquanto lê.
- Partes, livros ou seções que só agrupam capítulos NÃO são itens. Se ajudar, coloque o nome da parte no título do primeiro capítulo dela, separado por " · " (exemplo: "Parte I · A partida").
- Não inclua: prefácio do tradutor, introdução crítica, notas, agradecimentos, bibliografia, índice remissivo, posfácio acadêmico.

## Campos

- index: sequencial a partir de 1 na ordem de leitura, independente da numeração impressa.
- title: o título como impresso, sem o número do capítulo. Para capítulos só numerados ("Capítulo 3", "III", "3"), use null.
- startPage: o número de página impresso ao lado do item. Se o sumário não traz páginas, null. Converta algarismos romanos de página para arábicos.

## Leitura

- Sumários em duas colunas se leem coluna por coluna, de cima para baixo.
- Linhas pontilhadas ligam título a página; confie nelas quando o alinhamento for ambíguo.
- isToc: true se a imagem é um sumário legível; false se for outra coisa (capa, página de texto, foto borrada). Com false, chapters é [].`;

const CHAPTER_RULES = `## Como decidir as cenas

- Use o que você sabe da obra. Se conhece o livro e reconhece o capítulo pelo título e pela posição, descreva as mudanças reais de ambiente daquele capítulo, em ordem.
- Se conhece a obra mas não este capítulo em particular, use o cenário e o tom gerais do livro naquela altura da história. confidence 0.4 a 0.6.
- Se não conhece a obra, deduza pelo título, autor, sinopse, gênero e títulos dos capítulos. confidence 0.1 a 0.3. Prefira cenas neutras e coerentes com o gênero a detalhes inventados.
- Cenas por capítulo: 1 para capítulos curtos ou sem mudança de ambiente; 2 a 4 normalmente; até 5 em capítulos longos com várias locações. O leitor fica vários minutos em cada cena; isto é ambientação de fundo, não slideshow.
- weight: fração do capítulo que a cena ocupa. Os pesos de um capítulo somam 1.
- transitionSeconds 15 a 40: trocas lentas de ambiente 25 a 40; virada brusca dentro do capítulo 15 a 20.
- Coerência ao longo do livro: mantenha uma família de cores reconhecível. Capítulos vizinhos no mesmo ambiente têm cenas parecidas, não idênticas. Não mude o clima sem razão narrativa.
- confidence 0..1: quanto você conhece este trecho específico do livro.

## mood

- 2 a 4 palavras em português, minúsculas, só sobre o clima sensorial: hora do dia, tempo, lugar genérico, sensação. Exemplos: "chuva, madrugada, espera"; "lareira, vozes, noite"; "estrada, poeira, sol".
- PROIBIDO em mood: nomes de personagens, lugares com nome próprio, e qualquer ação ou acontecimento (fuga, tiros, morte, susto, encontro, segredo, revelação, perseguição). Descreva o que se vê, ouve e sente no ambiente, como uma trilha sonora descreveria, nunca o que acontece. O leitor vê essas palavras ANTES de ler o capítulo.

## Visual

${VISUAL_GUIDE}

## Som

${SOUND_GUIDE}`;

export const BOOK_PROMPT = `Você transforma um livro em uma sequência de ambientes por capítulo para um leitor imersivo.
Enquanto a pessoa lê o livro físico, uma TV ou projetor ao fundo mostra luz, cor e movimento abstratos, e caixas de som tocam camadas de ambiência. Nada disso compete com a leitura: é estímulo periférico, sutil, que reforça o clima de cada trecho.

Você recebe título, autor, sinopse (quando houver) e a lista de capítulos do sumário (índice, título, páginas). Devolve JSON com, para cada capítulo, as cenas em ordem.

${CHAPTER_RULES}

## Regras

- Devolva exatamente os capítulos recebidos, com os mesmos índices, na mesma ordem. Nenhum a mais, nenhum a menos.
- Não escreva resumo, não cite trechos, não explique.`;

export const REFINE_PROMPT = `Você ajusta o ambiente de um capítulo de livro para um leitor imersivo, a partir da primeira página desse capítulo.
Enquanto a pessoa lê o livro físico, uma TV ou projetor ao fundo mostra luz, cor e movimento abstratos, e caixas de som tocam camadas de ambiência. Nada disso compete com a leitura.

Você recebe título e autor do livro, a posição do capítulo (índice, título, páginas) e o texto ou a foto da primeira página do capítulo. Devolve JSON com as cenas do capítulo em ordem.

${CHAPTER_RULES}

## Regras

- A primeira cena reflete o que a primeira página mostra: é texto real do livro, então confidence sobe (0.7 ou mais para a abertura).
- As cenas seguintes seguem o que você sabe deste capítulo ou, se não souber, o desdobramento mais provável do ambiente da abertura.
- Se o conteúdo não for uma página legível de livro, devolva uma cena neutra e confidence 0.1.
- Não escreva resumo, não cite trechos, não explique.`;
