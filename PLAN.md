# Illusion Reader

Ambiente imersivo de luz e som para leitura de livros físicos. O celular controla, a TV ou o projetor renderiza.

## Conceito

O leitor escolhe o livro pela edição (ISBN-13), carrega um preset e avança página a página no app. A cada página, o receptor (TV/projetor) faz uma transição suave de luz, cor, movimento e som que reflete a cena do texto. O visual é abstrato de propósito: estimula a visão periférica sem competir com a leitura.

## Decisões centrais

- **Visual paramétrico, não imagem gerada.** Cada página descreve paleta, brilho, contraste, tipo de movimento e velocidade. O receptor renderiza shaders em tempo real. Transição entre páginas é interpolação de parâmetros.
- **Som em camadas.** Biblioteca fixa de loops licenciados pelo app, mixados com ganho por camada e crossfade. Nenhum upload de áudio pelo usuário no início.
- **A IA só produz JSON.** Ela lê o texto da página e devolve os parâmetros. Sem geração de mídia, custo por livro fica em poucos dólares.
- **Vocabulário fechado e compartilhado.** A taxonomia de sons e movimentos vive em `packages/schema` e é a única fonte de verdade para IA, editor, backend e receptor.
- **Texto do OCR é descartado.** Só o JSON derivado é armazenado. Evita problema de direitos autorais.
- **Preset é dado, não mídia.** Poucos KB por livro. Marketplace, offline e sincronização ficam triviais.

## Fluxo do usuário

1. Escaneia o código de barras do livro. App identifica título e edição.
2. Escolhe a origem do preset:
   - **Oficial** do app (domínio público, gerado em lote).
   - **Comunidade**, gratuito ou pago.
   - **Escanear**: fotografa as páginas que vai ler. OCR no celular, IA gera o JSON de cada página. Vira um preset próprio.
   - **Manual**: monta cada página com sliders e lista de sons.
3. Pareia o celular com o receptor (código na tela da TV).
4. Informa a página atual e dá play.
5. A cada virada, toca no app (ou botão de volume, controle Bluetooth). Receptor faz a transição.

## Arquitetura

```
celular (app)  --WebSocket-->  relay (api)  --WebSocket-->  receptor (TV/projetor)
     |                              |
     | texto OCR                    | catálogo de presets
     v                              v
   api  ----> IA (JSON da página)   Postgres
```

| Pacote | Papel | Fase |
|---|---|---|
| `packages/schema` | Zod: taxonomia, Page, Preset e protocolo de pareamento. Contrato de todo o sistema. | 1 |
| `packages/relay-client` | Cliente WebSocket do relay (reconexão, validação), usado por receptor e controle. | 2 |
| `apps/receiver` | Web app (WebGL + Web Audio). Roda em navegador de TV, laptop no projetor ou como receiver do Chromecast. | 1 |
| `apps/api` | Node/TS (Hono). Relay de pareamento e `POST /pages/analyze` (IA). Depois: catálogo, recibos de compra. | 2 |
| `apps/controller` | Controle web para celular. Valida pareamento e protocolo; o app React Native vai substituí-lo usando o mesmo protocolo. | 2 |
| `apps/mobile` | React Native (Expo SDK 57, Android). Biblioteca, ISBN, pareamento, leitura, escaneamento de páginas com OCR (ML Kit). | 2 |

## Contrato de dados (resumo)

```
Preset { version, id, isbn13, title, source, pageOffset, pages[] }
Page   { page, visual, sound[], transitionSeconds }
Visual { palette[3..5] hex, brightness 0..1, contrast 0..1, motion, speed 0..1 }
Sound  { id (SoundLayerId), gain 0..1 }   máx. 6 camadas por página
```

Definição completa em `packages/schema/src`. Exemplo em `apps/receiver/fixtures/sample-preset.json`.

## Fases

1. **Receptor.** Carrega um Preset, renderiza a página atual (shaders por `motion`, loops por `SoundLayerId`), interpola parâmetros na virada. Controle por teclado para teste. Valida se a experiência funciona antes de qualquer app.
2. **App + API.** ISBN, OCR, chamada à IA com saída estruturada validada pelo schema, pareamento e reprodução página a página.
3. **Editor manual e presets oficiais** (domínio público, gerados em lote).
4. **Marketplace** da comunidade com compras no app.

## Fora de escopo por agora

- Geração de imagens por IA.
- Upload de áudio pelo usuário.
- Acompanhamento automático da leitura (eye tracking, câmera contínua).
- Livro digital / EPUB.

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
| Biblioteca | `app/index.tsx` | Livros salvos, atalho para TV e servidor |
| Adicionar livro | `app/scan-isbn.tsx` | Código de barras EAN-13 com `expo-camera`, busca no Google Books, cadastro manual se não achar |
| Livro | `app/book/[isbn].tsx` | Cenas (presets) da edição, ler, remover, escanear páginas |
| Escanear páginas | `app/scan-pages/[isbn].tsx` | Foto por página, OCR local, análise em segundo plano, cenas acumuladas no preset de IA do livro |
| Leitura | `app/read/[presetId].tsx` | Página inicial, Play, Anterior/Próxima, página atual da TV |
| Conectar à TV | `app/pair.tsx` | Código de 6 caracteres, estado do pareamento |
| Servidor | `app/settings.tsx` | ip:porta da API/relay, teste de conexão |

Stores em `src/store`: `library` (livros e presets, persistido), `settings` (servidor, último código, persistido), `session` (conexão com o relay e estado da TV, em memória). Em desenvolvimento, o endereço do servidor assume o IP da máquina que serve o Metro.

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

## Pendências e próximos passos

Levantamento de 2026-09-10 comparando o plano com o código.

### Fase 2, o que ainda falta

- Virar página por botão de volume ou controle Bluetooth. Hoje só por toque na tela do app.
- Catálogo de presets e Postgres. A arquitetura desenha os dois, mas a API não persiste nada. Presets vivem só no SQLite do celular, sem exportar, compartilhar ou fazer backup.
- Busca de ISBN vai direto do celular para Open Library e Google Books. Deve migrar para a API com cache.
- `POST /pages/analyze` sem autenticação, cota ou limite de taxa. Qualquer um na rede gasta os tokens.
- Receptor como Chromecast receiver. Só roda em navegador.
- Sons: 45 dos 47 ids têm gravação real. `rain_light` e `choir_distant` caem na síntese.
- Os `.ogg` estão fora do git e não há bucket nem LFS para produção.

### Fase 3, nada iniciado

- Editor manual com sliders e lista de sons. O schema aceita `source: "manual"`, nenhuma tela usa.
- Presets oficiais de domínio público em lote. Existe só `scripts/analyze-samples.ts` com 6 trechos. Problema em aberto: texto digital não sabe onde cai cada página impressa, e `pageOffset` só corrige deslocamento constante.

### Fase 4, nada iniciado

- Marketplace, compras no app, presets da comunidade.

### Transversal

- Nenhum teste automatizado e nenhum CI. Candidatos: schema, salas do relay, normalização da resposta da IA, detecção de número de página.
- Nenhum deploy. Relay precisa de WSS público; receptor precisa de HTTPS para navegadores de TV liberarem áudio e câmera.

### Ordem recomendada

1. Validar em campo com dev build e livro real (`npm run dev:localtest`). Decide se a experiência funciona e se o prompt precisa de ajuste.
2. Fechar a fase 2: virada por botão físico, exportar e importar preset em JSON, proteção mínima no endpoint de análise (token do app e limite por IP), as duas gravações que faltam.
3. Persistência na API: Postgres, `GET /presets?isbn=` e proxy de ISBN com cache. Pré-requisito das fases 3 e 4.
4. Editor manual, começando no controle web, que já fala o protocolo, e depois no app.
5. Testes nos quatro pontos acima e ambiente público com WSS, HTTPS e sons servidos de bucket.

## Comandos

```bash
npm install
cp apps/api/.env.example apps/api/.env   # preencher ANTHROPIC_API_KEY
npm run dev              # api (relay + análise) :8787 + receptor :5173 + controle :5174, na rede local
npm run dev:receiver     # só o receptor
npm run dev:mobile       # Metro do app; abra no Expo Go ou no dev client (Android) na mesma rede
npm run android -w @illusion/mobile   # gera e instala o dev build com OCR (exige Android SDK)
npm run test:analyze -w @illusion/api    # com a api rodando: analisa os trechos de teste
npm run typecheck
```

Teste com celular na mesma rede: abra `http://<ip-do-pc>:5173` na TV ou no navegador ligado ao projetor, toque uma vez para liberar o áudio, e no celular abra `http://<ip-do-pc>:5174` e digite o código da tela.

Loops reais entram em `apps/receiver/public/sounds/<id>.ogg` e substituem a síntese automaticamente.
