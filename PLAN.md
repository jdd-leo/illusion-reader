# Illusion Reader

Ambiente imersivo de luz e som para leitura de livros físicos. O celular controla, a TV ou o projetor renderiza.

## Conceito

O leitor aponta a câmera para o código de barras do livro, fotografa o sumário uma única vez e começa a ler. A cada capítulo, o receptor (TV/projetor) muda suavemente de luz, cor, movimento e som para refletir o clima daquele trecho, com duas a seis cenas que avançam sozinhas ao longo do capítulo. O visual é abstrato de propósito: estimula a visão periférica e a imaginação sem competir com o texto nem ilustrá-lo.

O app não pede atenção durante a leitura. A única interação esperada é um toque ao começar um novo capítulo, e mesmo essa pode ser feita pelo botão de volume ou por um controle Bluetooth no bolso.

## Decisões centrais

- **Capítulo é a unidade, não a página.** A IA recebe o contexto do capítulo (título, posição no livro, o que se sabe da obra e, opcionalmente, a primeira página fotografada) e devolve uma sequência ordenada de cenas com o peso de cada uma. Poucas transições por hora de leitura: ambientação de fundo, não slideshow.
- **Um caminho só, sem modos.** O usuário nunca escolhe entre "oficial", "comunidade", "escanear" ou "manual". O app procura o melhor preset disponível para a edição, pede o mínimo necessário (uma foto do sumário) e completa o resto sozinho. Fotografar a primeira página de um capítulo é um convite opcional, nunca uma exigência. O modo página a página continua existindo como recurso avançado, fora do fluxo principal.
- **Avanço por tempo dentro do capítulo.** As cenas de um capítulo trocam sozinhas com base no número de páginas do capítulo e na velocidade de leitura do usuário, aprendida pelo app. O leitor pode adiantar ou voltar, mas não precisa.
- **Sem spoiler.** O resumo ou a inferência que a IA faz do capítulo nunca é mostrado ao leitor nem armazenado. O app exibe só palavras de clima ("noite, mar, tensão").
- **Visual paramétrico, não imagem gerada.** Cada cena descreve paleta, brilho, contraste, tipo de movimento e velocidade. O receptor renderiza shaders em tempo real. Transição é interpolação de parâmetros. Imagem abstrata gerada por IA fica como camada opcional futura, uma por capítulo.
- **Som em camadas.** Biblioteca fixa de loops CC0 mixados com ganho por camada e crossfade. Nenhum upload de áudio pelo usuário.
- **A IA só produz JSON.** Sem geração de mídia. Um livro inteiro custa uma chamada com o sumário e uma chamada de análise, mais refinamentos opcionais por capítulo. Centavos por livro, e o resultado é compartilhado entre todos os leitores da mesma edição.
- **Vocabulário fechado e compartilhado.** A taxonomia de sons e movimentos vive em `packages/schema` e é a única fonte de verdade para IA, editor, backend e receptor.
- **Texto do livro é descartado.** O OCR do sumário e de páginas só existe na requisição. Só o JSON derivado é armazenado. Evita problema de direitos autorais.
- **Preset é dado, não mídia.** Poucos KB por livro. Compartilhar por edição, sincronizar e funcionar offline é trivial.

## Fluxo do usuário

1. **Qual livro?** Escaneia o código de barras (ou digita o título). O app mostra capa e título.
2. **Preparar o ambiente.** Se já existe um preset para essa edição no servidor, pronto em um segundo. Se não, o app pede uma foto do sumário, mostra os capítulos reconhecidos para confirmação e gera as cenas de todos os capítulos em segundo plano. Sem sumário, o app usa o clima geral do livro e refina capítulo a capítulo conforme o leitor fotografa (ou não) a primeira página.
3. **Ligar a TV.** Abre `tv.<dominio>` na TV ou no navegador ligado ao projetor e digita o código de 6 caracteres no app. O app lembra a TV; nas próximas vezes reconecta sozinho.
4. **Ler.** Informa em que capítulo está (o app sugere o último lido) e toca em Começar. A tela escurece e mostra só o capítulo atual e as palavras de clima. As cenas avançam sozinhas.
5. **Novo capítulo.** Um toque no botão grande, no botão de volume ou no controle Bluetooth. Nada mais.

Correções são discretas: "Não combina" troca a cena atual por uma versão mais neutra e registra o feedback; "Estou na página..." recalibra o tempo.

## Arquitetura

```
celular (app)  --WebSocket-->  relay (api)  --WebSocket-->  receptor (TV/projetor)
     |                              |
     | sumário (foto) /             | catálogo de presets por ISBN
     | contexto do capítulo         v
     v                           Postgres
   api  ----> IA (JSON de cenas por capítulo)
```

| Pacote | Papel | Fase |
|---|---|---|
| `packages/schema` | Zod: taxonomia, Scene, Chapter, Preset e protocolo de pareamento. Contrato de todo o sistema. | 1, revisado na 3 |
| `packages/relay-client` | Cliente WebSocket do relay (reconexão, validação), usado por receptor e controle. | 2 |
| `apps/receiver` | Web app (WebGL + Web Audio). Renderiza uma cena por vez; não sabe o que é capítulo ou tempo. | 1 |
| `apps/api` | Node/TS (Hono). Relay, leitura do sumário, análise de capítulos, catálogo por ISBN. | 2 e 3 |
| `apps/controller` | Controle web para celular. Valida pareamento e protocolo. | 2 |
| `apps/mobile` | React Native (Expo, Android). Fluxo único: livro, sumário, TV, leitura por capítulo com avanço por tempo. | 2 e 3 |

## Contrato de dados (alvo da fase 3)

```
Preset  { version, id, isbn13, title, source, chapters[], pages?[] }
Chapter { index, title?, startPage?, endPage?, confidence, scenes[] }
Scene   { weight 0..1, mood[2..4] string, visual, sound[], transitionSeconds }
Visual  { palette[3..5] hex, brightness 0..1, contrast 0..1, motion, speed 0..1 }
Sound   { id (SoundLayerId), gain 0..1 }   máx. 6 camadas por cena
```

- `weight` é a fração do capítulo que a cena ocupa; a soma por capítulo é 1. O app converte em tempo com `(endPage - startPage) × minutosPorPágina`.
- `mood` é o único texto que o leitor vê. Palavras de clima, nunca enredo.
- `confidence` baixa faz a IA devolver cenas do clima geral do livro em vez de inventar detalhes; o app usa isso para convidar a fotografar a primeira página.
- `pages[]` é o formato atual, mantido para o modo avançado página a página. Um preset tem `chapters` ou `pages`, nunca os dois vazios.
- `Page` (formato atual) equivale a uma `Scene` com `weight` implícito; o receptor renderiza os dois do mesmo jeito.

Definição completa em `packages/schema/src`. Exemplo do formato atual em `apps/receiver/fixtures/sample-preset.json`.

## Fases

1. **Receptor.** Carrega um Preset, renderiza a cena atual, interpola parâmetros na troca. Feito.
2. **App + API, página a página.** ISBN, OCR, análise por página, pareamento e reprodução. Feito como estrutura; vira o modo avançado.
3. **Modo capítulo.** Schema com Chapter e Scene, leitura do sumário por visão, análise de todos os capítulos em uma chamada, refinamento opcional por primeira página, avanço por tempo no app, catálogo por ISBN no servidor. É o fluxo principal do MVP.
4. **Presets oficiais** de domínio público, gerados em lote por capítulo, mapeados à edição pelo sumário.
5. **Editor e comunidade.** Ajuste manual de cenas, publicação de presets, marketplace.

## Fora de escopo por agora

- Geração de imagens por IA (candidata a camada opcional depois da fase 3).
- Upload de áudio pelo usuário.
- Acompanhamento automático da leitura (eye tracking, câmera contínua).
- Livro digital / EPUB.
- iOS, Android TV nativo, Chromecast.

## Estado atual

Fase 1 implementada em `apps/receiver`:

- `visual/fragment.ts`: um fragment shader com os 10 motions. Ruído de gradiente com domain warping, partículas e traços em paralaxe. Cada motion devolve `(base, glow)`: base escolhe a cor na paleta, glow adiciona luz da cor mais clara. Dois motions misturados por `uMix` na transição. Grão, vinheta e tone mapping leve no final.
- `visual/renderer.ts`: WebGL2, quad fullscreen, DPR limitado a 1.5 para TVs.
- `player.ts`: página atual e interpolação de paleta, brilho, contraste e velocidade.
- `audio/mixer.ts`: uma camada por `SoundLayerId` com ganho próprio e envio para um reverb compartilhado (convolução). Master passa por compressor. Procura `/sounds/<id>.ogg` e, se não existir, monta a camada com `audio/recipes.ts`.
- `audio/generators.ts`: primitivas em tempo real: ruído colorido filtrado com passeios aleatórios de frequência e ganho, drones com vozes desafinadas e LFO no filtro, e eventos agendados (gotas, crepitar, pios, batidas, sinos, pizzicatos, sopros).
- `audio/recipes.ts`: receita para cada um dos 47 ids combinando essas primitivas. É o fallback até existir a biblioteca de loops reais.
- `fixtures/sample-preset.json`: cena de testes com 10 páginas, uma por motion.

Som: o master passa por um shelf de -5 dB acima de 3 kHz e um passa-baixas em 6,5 kHz. Síntese por ruído cansa o ouvido no extremo agudo, e ambiência de fundo não precisa dessa região. Água e chuva usam corpo grave marrom com textura rosa filtrada e respiração lenta, nunca ruído fixo.

Limite conhecido da síntese: água corrente, pássaros, multidão e mar ficam reconhecíveis mas artificiais. Eventos tonais usam ruído por filtro ressonante, nunca senoide pura, que soa a videogame. O caminho de qualidade é gravação real em `apps/receiver/public/sounds/<id>.ogg`, que o mixer prefere automaticamente, com loop por crossfade e volume normalizado por RMS na própria TV.

`npm run fetch:sounds -w @illusion/receiver` baixa uma gravação CC0 do Freesound por id (consultas em `scripts/sound-queries.json`, origem em `public/sounds/manifest.json`). Exige `FREESOUND_API_KEY`, chave gratuita em https://freesound.org/apiv2/apply. Os `.ogg` ficam fora do git; para produção, servir de um bucket ou usar Git LFS.

Convenção de paleta: da cor mais escura para a mais clara. A última cor é a "luz" (brasas, estrelas, relâmpagos).

Controles do receptor por teclado (testes): `→` `espaço` próxima, `←` anterior, `Home` primeira, `1..9` pula para a N-ésima página, `L` carrega o preset de exemplo. Em dev, `window.illusionDebug` expõe nível RMS, camadas ativas, página e código.

### Pareamento (fase 2, implementado)

```
receptor  --register-->  relay  <--join(código)--  controle
receptor  <--registered(código)--
receptor  <--peer_joined--            --joined-->  controle
receptor  <--load_preset/goto/next/prev-- (encaminhado)
receptor  --state(título, página)-->   (encaminhado para os controles)
```

- O receptor pede registro ao conectar e exibe o código de 6 caracteres (sem 0/O/1/I) no canto da tela até um controle entrar.
- O relay (`apps/api`) mantém salas em memória: uma TV, N controles. Valida toda mensagem com o schema. Heartbeat de 30 s derruba conexões mortas. Se a TV cai, a sala morre e os controles recebem `peer_left`.
- `load_preset` leva o preset inteiro (poucos KB) e a página impressa inicial. `goto` usa página impressa; se ela não estiver no preset, o receptor usa a última página anterior a ela. `pageOffset` é aplicado no receptor.
- URL do relay: mesmo host da página, porta 8787, ou `VITE_RELAY_URL`.

### App Android (fase 2, estrutura implementada)

Tudo que não é audiovisual acontece no app; a TV só recebe e exibe. Expo com Expo Router, `zustand` com persistência em `expo-sqlite/kv-store`, e os pacotes `@illusion/schema` e `@illusion/relay-client` reaproveitados sem alteração.

| Tela | Arquivo | Papel |
|---|---|---|
| Boas-vindas | `app/welcome.tsx` | Três cartões, uma vez |
| Biblioteca | `app/index.tsx` | Livros com "Capítulo X de Y", estado da TV, adicionar livro |
| Qual livro? | `app/scan-isbn.tsx` | Código de barras EAN-13 com `expo-camera`, busca Open Library e Google Books, cadastro manual se não achar |
| Livro | `app/book/[isbn].tsx` | Preparar ambiente, Ler ou Continuar; seção avançada por página só se ativada em Ajustes |
| Preparar o ambiente | `app/toc/[isbn].tsx` | Foto do sumário, lista de capítulos editável, ou sem sumário; geração em segundo plano |
| Leitura | `app/read/[presetId].tsx` | `book-<isbn>` abre `ChapterReader`; outro id abre `PageReader` (avançado) |
| Melhorar a cena | `app/refine/[isbn].tsx` | Foto da primeira página do capítulo, refaz as cenas dele |
| Cena por página | `app/scan-pages/[isbn].tsx` | Modo avançado: foto por página, OCR local, análise por página |
| Ligar a TV | `app/pair.tsx` | Código de 6 caracteres; a TV lembrada reconecta sozinha ao abrir o app |
| Ajustes | `app/settings.tsx` | Velocidade de leitura aprendida, modo avançado, servidor, importar amostras |

Stores em `src/store`: `library` (livros, presets, progresso por livro e feedback "não combina", persistido), `settings` (servidor, último código, velocidade de leitura, modo avançado, boas-vindas, persistido), `session` (conexão com o relay e estado da TV, em memória), `preparation` (geração do ambiente em segundo plano, em memória). Em desenvolvimento, o endereço do servidor assume o IP da máquina que serve o Metro.

**Escaneamento de páginas.** Foto com `expo-camera` → OCR no aparelho (`@react-native-ml-kit/text-recognition`, script latino) → número de página detectado por uma linha só de dígitos no topo ou rodapé (`src/lib/pageNumber.ts`), que corrige o campo "página desta foto" → texto para `POST /pages/analyze` → a `Page` devolvida entra no preset `ai-<isbn>` do livro (`upsertAiPage`), substituindo a página de mesmo número se já existir. Até 3 análises em paralelo, sem travar a câmera.

Fallback por imagem: se o OCR devolver menos de 80 caracteres, ou se o OCR não existir (Expo Go), a foto é reduzida a 1000 px de largura (`expo-image-manipulator`) e vai em base64. Custa 1,5 a 2 vezes mais tokens, mas permite testar o fluxo inteiro no Expo Go.

**Dev build.** ML Kit é módulo nativo, então o app com OCR exige dev build: `npm run android -w @illusion/mobile` (precisa de Android Studio, SDK e JDK 17 na máquina; alternativa é EAS Build com perfil development). Depois do build, `npm run dev:mobile` abre no dev client em vez do Expo Go. No Expo Go tudo funciona, mas a análise vai sempre por imagem.

**Amostras sem OCR (dev).** `GET /dev/presets` na API serve o preset gerado por `npm run test:analyze -w @illusion/api` (`scripts/out/preset.json`). No app, tela Servidor, seção Desenvolvimento, o botão "Importar amostras do servidor" cadastra o livro fictício e o preset na biblioteca. Rodar o `test:analyze` de novo e reimportar substitui o preset.

### Análise de página via IA (fase 2, implementado)

Divisão: **OCR no dispositivo, chamada ao modelo no backend**. A chave nunca vai para o app; cota, custo, prompt e validação ficam no servidor.

```
app: foto → OCR → POST /pages/analyze { isbn13?, page?, text? | image? }
api: valida (AnalyzeRequestSchema) → Claude com saída estruturada → normaliza → PageSchema.parse
     → { page, detectedPage, summary, model, usage }
```

- `apps/api/src/analyze/prompt.ts`: prompt do sistema gerado a partir da taxonomia do schema (ids de som e motions nunca saem de sincronia). Vai inteiro para o cache de prompt.
- `apps/api/src/analyze/analyzer.ts`: modelo em `ANALYZE_MODEL` (padrão `claude-opus-5`, `claude-haiku-4-5` é a opção barata), esforço em `ANALYZE_EFFORT` (padrão `medium`). Fallback servidor-lado para recusas do classificador. O modelo devolve uma forma solta; números são limitados a 0..1, camadas deduplicadas e limitadas a 6, e só então o `PageSchema` valida. Recusa, truncamento ou formato inválido viram 502; sem chave, 503; sem conexão, 503; limite de taxa, 429.
- O texto da página só existe na requisição. Nada é persistido.
- Aceita `image` (base64) além de `text`: permite testar pelo navegador do celular antes do app com OCR, e serve de fallback quando o OCR falhar. Custa duas a três vezes mais tokens por página.
- `apps/api/scripts/analyze-samples.ts`: seis trechos de cena (`samples.json`) enviados ao endpoint; imprime a cena escolhida e grava um preset em `scripts/out/preset.json` para carregar no receptor.

## Mudança de direção: capítulo em vez de página (2026-09-21)

O fluxo página a página funciona, mas cria duas fricções: fotografar cada página antes de ler e tocar no celular a cada virada. As duas somem quando a unidade passa a ser o capítulo. Decisões e trabalho decorrente:

### Fontes de contexto, da mais barata para a mais precisa

| Fonte | O que o usuário faz | O que a IA recebe | Quando usar |
|---|---|---|---|
| ISBN | nada | título, autor, sinopse do Google Books | sempre, como base |
| Sumário | uma foto | títulos e páginas iniciais dos capítulos | padrão do fluxo principal |
| Primeira página do capítulo | uma foto opcional ao começar o capítulo | abertura real da cena | livros pouco conhecidos, `confidence` baixa |
| Texto de domínio público | nada | texto integral por capítulo | presets oficiais (fase 4) |
| Página a página | uma foto por página | texto da página | modo avançado, oculto em Ajustes |

A IA combina o que sabe da obra com essas âncoras. Para livros conhecidos, o sumário basta. Para desconhecidos, ela devolve `confidence` baixa e cenas do clima geral; a primeira página do capítulo, se fotografada, refina.

### Novos endpoints

```
POST /books/toc        { isbn13, image }                       → { chapters: [{ index, title?, startPage }] }
POST /books/analyze    { isbn13, title, author?, synopsis?, chapters: [{ index, title?, startPage?, endPage? }] }
                                                              → { chapters: Chapter[] }      uma chamada, livro inteiro
POST /chapters/refine  { isbn13, chapterIndex, text? | image? } → { chapter: Chapter }        primeira página, opcional
GET  /presets?isbn=    → preset compartilhado da edição, se existir
```

Analisar o livro inteiro em uma chamada mantém a paleta coerente entre capítulos e custa menos que trinta chamadas separadas. O resultado vai para o catálogo por ISBN: o segundo leitor da mesma edição não gera nada.

### Protocolo do relay

Acrescentar `goto_scene { chapter, scene }` e `state { chapter, scene, mood }`. `goto`, `next` e `prev` por página continuam para o modo avançado. O receptor continua sem noção de tempo: quem decide quando trocar de cena é o app, que sabe quando o leitor pausou.

### Avanço por tempo no app

- Velocidade inicial: 1,5 min por página. O app recalcula a cada "próximo capítulo" com `páginas do capítulo / minutos decorridos`, com média móvel.
- Duração de cada cena = `weight × páginas do capítulo × minutosPorPágina`. Transições de 20 a 40 s.
- App em segundo plano ou "Pausar" congela o relógio. Ao voltar, retoma da mesma cena.
- Última cena do capítulo nunca termina sozinha: fica até o toque de próximo capítulo. Se o leitor demorar muito além do estimado, o app ajusta a velocidade para baixo silenciosamente.
- "Estou na página N" reposiciona no capítulo e na cena correspondentes.

### Sem spoiler

A resposta da IA pode conter raciocínio sobre o enredo; nada disso persiste. Só `mood` (2 a 4 palavras de clima), `visual` e `sound` entram no preset. O prompt instrui explicitamente a não usar nomes de personagens ou eventos em `mood`.

## Pendências e próximos passos

Levantamento de 2026-09-21, após a mudança de direção.

### Fase 3, modo capítulo

Feito em 2026-09-21:

- Schema: `Scene`, `Chapter`, `Preset.chapters` (com `pages` opcional para o modo avançado), `load_preset` com posição inicial por capítulo e cena, `goto_scene`, `state` com `chapter`, `scene` e `mood`. Definição em `packages/schema/src/chapter.ts`.
- Receptor: `Player` renderiza uma lista achatada de cenas (`Cue`), vinda de capítulos ou de páginas; aceita `goto_scene`; HUD mostra capítulo e palavras de clima. Fixture em `apps/receiver/fixtures/sample-chapters.json`, tecla `K`.

- API: `POST /books/toc` (visão), `POST /books/analyze` (livro inteiro em uma chamada, saída estruturada, pesos renormalizados, `mood` filtrado contra nomes próprios) e `POST /chapters/refine` (primeira página). Contratos em `packages/schema/src/books.ts`; cliente, normalização e trechos de prompt da taxonomia compartilhados em `apps/api/src/ai`. `npm run test:book -w @illusion/api` analisa o livro de `scripts/book-sample.json` e grava `scripts/out/book-preset.json`, servido por `GET /dev/presets`. Testado com Opus 5: 10 capítulos, 21 cenas, 54 s, 4,5k tokens de saída.

- App: fluxo único por capítulo. Boas-vindas (3 cartões, uma vez), livro → "Preparar ambiente" (`app/toc/[isbn].tsx`: foto do sumário, lista de capítulos editável, ou "não tem sumário" com número de capítulos opcional), geração em segundo plano (`src/store/preparation.ts`), leitor por capítulo (`src/screens/ChapterReader.tsx`: relógio de cenas por páginas × velocidade aprendida, pausa automática em segundo plano, botão de volume via `react-native-volume-manager`, "Não combina" troca a cena por uma neutra e guarda o feedback, "Estou na página" recalibra, "Melhorar esta cena" quando a confiança é baixa → `app/refine/[isbn].tsx`). Progresso por livro persistido; TV lembrada reconecta sozinha. Modo página a página escondido em Ajustes → Avançado (`src/screens/PageReader.tsx`).

Falta:

- Testar o app em aparelho: o módulo de volume é nativo e exige novo `npm run android -w @illusion/mobile`; `POST /books/toc` ainda não foi testado com foto real.
- Catálogo: Postgres com `books`, `presets`, `chapters`, `users`, `usage_events`, `scene_feedback`; `GET /presets?isbn=`.

### Fase 2, pendências que continuam valendo

- Proteção do endpoint de análise: token por aparelho, cota, limite de taxa.
- Busca de ISBN migra do celular para a API com cache.
- Sons: `rain_light` e `choir_distant` ainda caem na síntese; `.ogg` fora do git e sem bucket.
- Receptor só em navegador.

### Fases 4 e 5, nada iniciado

- Presets oficiais de domínio público por capítulo.
- Editor de cenas, publicação, marketplace.

### Transversal

- Nenhum teste automatizado e nenhum CI. Candidatos: schema, salas do relay, normalização da resposta da IA, leitura do sumário, cálculo de tempo por cena.
- Nenhum deploy. Relay precisa de WSS público; receptor precisa de HTTPS.

### Ordem recomendada

1. Schema da fase 3 e receptor com `goto_scene`. Feito.
2. API por capítulo. Feito; falta testar `POST /books/toc` com fotos reais de sumário.
3. App por capítulo. Feito; falta rodar no aparelho.
4. Validar em campo com um livro conhecido e um desconhecido.
5. Catálogo por ISBN, proteção do endpoint, deploy. Detalhes de MVP, custos e monetização em `ROADMAP.md`.

## Comandos

```bash
npm install
cp apps/api/.env.example apps/api/.env   # preencher ANTHROPIC_API_KEY
npm run dev              # api (relay + análise) :8787 + receptor :5173 + controle :5174, na rede local
npm run dev:receiver     # só o receptor
npm run dev:mobile       # Metro do app; abra no Expo Go ou no dev client (Android) na mesma rede
npm run android -w @illusion/mobile   # gera e instala o dev build com OCR (exige Android SDK)
npm run test:analyze -w @illusion/api    # com a api rodando: analisa os trechos de teste (por página)
npm run test:book -w @illusion/api       # com a api rodando: analisa o livro de exemplo (por capítulo)
npm run typecheck
```

Teste com celular na mesma rede: abra `http://<ip-do-pc>:5173` na TV ou no navegador ligado ao projetor, toque uma vez para liberar o áudio, e no celular abra `http://<ip-do-pc>:5174` e digite o código da tela.

Loops reais entram em `apps/receiver/public/sounds/<id>.ogg` e substituem a síntese automaticamente.
