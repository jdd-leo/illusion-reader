# Illusion Reader: do protótipo ao produto

Este documento complementa o `PLAN.md`. O `PLAN.md` descreve o que o sistema é e como está implementado. Este descreve como transformar o que existe em um produto testável com usuários reais e, depois, em um produto pago.

Revisado em 2026-09-21 para a direção por capítulo (ver "Mudança de direção" no `PLAN.md`). Estimativas assumem uma pessoa dedicada em tempo parcial.

---

## 1. Resumo executivo

- **O que é.** Ambiente imersivo de luz e som para leitura de livros físicos. O celular controla, a TV ou projetor renderiza. A IA entende o capítulo e devolve parâmetros de luz e som; nunca gera mídia nem mostra texto.
- **Promessa ao leitor.** Escaneie o livro, fotografe o sumário, ligue a TV e leia. Um toque por capítulo. Nada mais.
- **Onde estamos.** Receptor, relay, análise por IA e app Android funcionam ponta a ponta em rede local, no modelo página a página. A direção por capítulo está especificada e não implementada. Nada está publicado.
- **Próximo marco.** Beta fechado com 20 a 50 leitores em Android para validar se a ambientação por capítulo agrega valor e se o fluxo é entendido sem ajuda.
- **Monetização.** Plano gratuito generoso e uma assinatura única e barata. Sem créditos, sem moedas, sem modos pagos que o usuário precise entender. Cobrança só depois do beta.
- **Por que agora é viável.** Um livro inteiro custa centavos de IA e o resultado é compartilhado por todos os leitores da mesma edição. O custo marginal tende a zero conforme o catálogo cresce.

---

## 2. Experiência do usuário

Esta seção é o contrato de produto. Qualquer tela ou recurso que não caiba aqui precisa de justificativa.

### 2.1 Princípios

1. **Um caminho.** O usuário nunca escolhe modo, fonte ou estratégia. O app decide e pede o mínimo.
2. **Uma pergunta por tela.** Cada tela tem um título em forma de pergunta ou instrução curta e um botão principal. O resto é secundário e discreto.
3. **Nunca bloquear a leitura.** Tudo que pode acontecer em segundo plano acontece em segundo plano. Se a IA ainda não terminou, o leitor começa com o clima geral do livro e as cenas chegam sozinhas.
4. **Convidar, não exigir.** Fotografar a primeira página de um capítulo melhora a cena, e o app diz isso uma vez, com um botão pequeno. Se o leitor ignorar, nada acontece.
5. **Silêncio durante a leitura.** Tela escura, sem notificações, sem badges, sem sons do app. O celular vira um controle remoto que fica virado para baixo.
6. **Sem spoiler.** O leitor vê palavras de clima, nunca enredo.
7. **Erro em linguagem de gente.** "A TV desconectou. Abra tv.illusion na TV de novo." Nunca código de erro, nunca jargão.
8. **Recuperável.** Fechar o app, trocar de celular ou perder a conexão nunca perde o progresso. Reabrir o app volta para o mesmo capítulo.

### 2.2 Fluxo principal em cinco telas

**Tela 1: Biblioteca.** Lista de livros com capa e "Capítulo 7 de 23". Um botão grande: "Adicionar livro". Se a biblioteca está vazia, a tela inteira é o convite para adicionar o primeiro livro, com uma frase do que vai acontecer.

**Tela 2: Qual livro?** Câmera aberta no código de barras. Ao reconhecer, mostra capa e título e o botão "É esse". Se não achar, campo de busca por título. Nunca pede ISBN digitado.

**Tela 3: Preparar o ambiente.** Três desfechos, escolhidos pelo app:

- Já existe preset para a edição: "Pronto. Este livro já tem ambiente." Segue para a tela 4.
- Não existe: "Fotografe o sumário do livro" com uma ilustração de exemplo. Após a foto, lista de capítulos reconhecidos com título e página, editável por toque. Botão "Está certo". A geração das cenas começa em segundo plano; o leitor não espera.
- Sem sumário (o leitor toca em "Este livro não tem sumário"): o app usa o clima geral do livro e pergunta só quantos capítulos tem, ou segue sem isso. Nada trava.

**Tela 4: Ligar a TV.** "Na TV, abra tv.illusion e digite aqui o código que aparecer." Campo de 6 caracteres. Ao conectar, a TV muda de cor e o app mostra "Conectado à sala". Nas próximas vezes, o app reconecta sozinho e esta tela só aparece se falhar. Botão secundário: "Ler sem TV" (o app apenas guarda o progresso).

**Tela 5: Leitura.** Fundo escuro. Em cima: título do livro, pequeno. No centro: "Capítulo 7" e as palavras de clima, por exemplo "chuva, madrugada, espera". Um botão grande: "Próximo capítulo". Abaixo, dois botões pequenos e discretos: "Não combina" e "Estou na página...". No canto, um ícone de câmera com o texto "Melhorar esta cena" que aparece só quando a confiança da IA é baixa. Botão de volume e controle Bluetooth acionam "Próximo capítulo". Tela não apaga, brilho reduzido.

### 2.3 Primeiro uso

Onboarding de três cartões, pulável, com uma frase cada:

1. "Escaneie o livro e fotografe o sumário. Só uma vez."
2. "Abra tv.illusion na sua TV e digite o código."
3. "Leia. A cada capítulo, um toque. O resto acontece sozinho."

Sem cadastro, sem e-mail, sem permissões além da câmera, pedida no momento do uso.

### 2.4 O que o usuário nunca vê

- A palavra "preset", "modo", "IA", "OCR", "token", "cota".
- O resumo ou a interpretação do capítulo.
- Escolha de modelo, esforço, fonte do preset.
- O modo página a página. Ele existe em Ajustes, dentro de "Avançado", com o nome "Cena por página (fotografa cada página)". Não aparece no fluxo, no onboarding nem na loja.

### 2.5 Como o app se comporta quando algo dá errado

| Situação | O que o leitor vê | O que acontece por baixo |
|---|---|---|
| IA ainda gerando as cenas | Leitura começa com o clima geral do livro | Cenas chegam por WebSocket e entram na próxima transição |
| IA não conhece o livro e não há sumário | Clima geral do livro, ícone de câmera visível | `confidence` baixa; primeira página do capítulo refina |
| Sumário ilegível | "Não consegui ler. Tente com mais luz ou toque em 'Este livro não tem sumário'" | Duas tentativas, depois fallback |
| TV desconectou | Faixa discreta "TV desconectada. Reconectando..." | Reconexão automática por 60 s, depois botão |
| Sem internet | "Sem internet. O ambiente continua na TV, mas novas cenas não serão geradas" | Preset em cache local continua funcionando com a TV na mesma rede |
| Limite do plano gratuito | "Você já preparou 2 livros este mês. Livros que outras pessoas já prepararam continuam livres" com botão para o plano | Cota no servidor |

---

## 3. O que precisamos validar

| # | Hipótese | Como medir no beta | O que fazer se falhar |
|---|---|---|---|
| H1 | A ambientação por capítulo melhora a leitura sem distrair | Pesquisa pós-sessão (1 a 5), retorno na semana seguinte | Reduzir intensidade, menos cenas por capítulo, revisar prompt |
| H2 | O fluxo é entendido sem ajuda | Testers que chegam à leitura sem perguntar no grupo; abandono por tela | Redesenhar a tela com maior abandono |
| H3 | Fotografar o sumário é aceitável e funciona | Taxa de sumários lidos corretamente, edições manuais na lista | Melhorar visão; pedir só o número de capítulos |
| H4 | A IA acerta o clima na maioria dos capítulos | Botão "Não combina" por capítulo e por modelo | Ajustar prompt, trocar modelo, pedir primeira página mais cedo |
| H5 | O avanço por tempo é percebido como natural | Uso de "Estou na página", pesquisa | Cenas mais longas, transições mais lentas |
| H6 | Existe disposição a pagar | Pergunta direta no fim do beta, lista de espera | Manter gratuito e buscar outro modelo |

---

## 4. Definição do MVP

### 4.1 Público e formato

- Leitores de ficção com TV ou projetor no ambiente de leitura. Android. Brasil. Interface em português.
- 20 a 50 pessoas em beta fechado pelo Google Play. Recrutamento em comunidades de leitura e redes sociais.
- 4 a 6 semanas de uso, com questionário no início, no meio e no fim. Grupo de suporte no WhatsApp ou Telegram.

### 4.2 Escopo

**Entra:**

- As cinco telas da seção 2.2 e o onboarding da 2.3.
- Leitura do sumário por visão, análise do livro inteiro em uma chamada, refinamento opcional por primeira página.
- Avanço de cenas por tempo com aprendizado da velocidade de leitura.
- Próximo capítulo por toque, botão de volume e controle Bluetooth genérico.
- Receptor web em HTTPS com domínio curto, lembrado pelo app.
- Presets compartilhados por edição no servidor; biblioteca sincronizada na conta anônima do aparelho.
- "Não combina" e "Estou na página".
- Telemetria anônima mínima.
- Política de privacidade e termos publicados.

**Não entra:**

- iOS, Android TV nativo, Chromecast.
- Editor de cenas, marketplace, presets oficiais em lote.
- Cobrança real. A tela de plano existe como teste de intenção, sem pagamento.
- Imagem gerada por IA.
- Modo página a página no fluxo principal (fica em Ajustes, sem destaque).

### 4.3 Critérios de sucesso

| Métrica | Alvo |
|---|---|
| Testers que chegam à leitura no primeiro uso sem ajuda | 80% |
| Sumários reconhecidos sem edição manual | 70% |
| Testers com ao menos 3 sessões | 50% |
| Retorno na segunda semana | 40% |
| Capítulos por sessão (mediana) | 2 ou mais |
| Nota média da experiência (1 a 5) | 4,0 ou mais |
| Taxa de "Não combina" por capítulo | abaixo de 15% |
| Testers que dizem que pagariam | 30% |

---

## 5. Passo a passo até o beta

### Etapa 0. Validação de conceito com o que existe (1 semana)

Antes de escrever o modo capítulo, simular a experiência.

1. Escolher um livro conhecido. Gerar à mão, com o endpoint atual, uma cena por capítulo (usar o título do capítulo e um parágrafo como texto) e montar um preset com uma "página" por capítulo.
2. Ler três noites com esse preset, trocando "página" a cada capítulo.
3. Anotar se a ambientação estável por vinte minutos funciona melhor ou pior que a troca por página. Isso decide a granularidade padrão antes de investir.

**Pronto quando:** há uma decisão escrita sobre número de cenas por capítulo e duração mínima de cena.

### Etapa 1. Modo capítulo (3 a 4 semanas)

1. **Schema.** `Scene`, `Chapter`, `Preset.chapters`, protocolo `goto_scene` e `state` estendido. Fixture com um livro de exemplo em capítulos.
2. **Receptor.** Aceitar `goto_scene`. A renderização não muda.
3. **API.** `POST /books/toc` (visão, devolve capítulos e páginas), `POST /books/analyze` (livro inteiro, saída estruturada, paleta coerente), `POST /chapters/refine`. Prompt gerado da taxonomia, com instrução explícita de não usar nomes ou eventos em `mood`. Comparar Haiku 4.5, Sonnet 5 e Opus 5 em três livros: um clássico, um best-seller recente, um desconhecido.
4. **App.** Telas 3 e 5 da seção 2.2. Relógio de cenas com pausa em segundo plano. Botão de volume via módulo nativo ou config plugin. Modo página a página movido para Ajustes.
5. **Sumário.** Testar a leitura com dez livros reais de editoras diferentes: sumário em duas colunas, com partes, com números romanos, sem números de página.

**Pronto quando:** uma pessoa externa escaneia um livro, fotografa o sumário, liga a TV e lê um capítulo inteiro sem perguntar nada.

### Etapa 2. Backend público (2 semanas, em paralelo com a 1)

1. Postgres gerenciado (Neon, Supabase ou DigitalOcean). Tabelas: `users`, `books`, `presets`, `chapters`, `usage_events`, `scene_feedback`.
2. `GET /presets?isbn=` e sincronização da biblioteca. Presets gerados por um usuário ficam disponíveis para os próximos da mesma edição. Sumário confirmado também é compartilhado.
3. Proxy de ISBN com cache.
4. Deploy da API e do relay em serviço com WebSocket persistente (Fly.io, Railway ou droplet com Caddy).
5. Receptor estático em Cloudflare Pages, domínio curto do tipo `tv.<dominio>`.
6. Sons em Cloudflare R2 com URL base configurável.

**Pronto quando:** um celular em 4G pareia com uma TV em outra rede e lê.

### Etapa 3. Identidade, cota e proteção (1 semana)

1. Token anônimo por aparelho emitido pela API no primeiro uso. Login com Google só na primeira compra, no futuro.
2. Cota do plano gratuito: livros novos preparados por mês (proposta: 2). Livros já preparados por outros não contam. No beta, cota alta para não atrapalhar.
3. Limite de taxa por IP e por usuário; tamanho máximo de imagem.
4. Telemetria em `usage_events` sem texto e sem imagem.
5. Alerta e limite de gasto na conta da Anthropic.

**Pronto quando:** chamada sem token é recusada e uma consulta SQL mostra livros preparados e custo do dia.

### Etapa 4. Distribuição (1 semana mais revisão do Google)

1. Conta Google Play Developer. Contas pessoais novas precisam de teste fechado com 12 testers por 14 dias antes da produção; encaixa no beta.
2. EAS Build com perfil de produção; EAS Update para correções sem nova revisão.
3. Ficha da loja com a promessa da seção 1 em uma frase. Formulário de segurança de dados: câmera, envio de imagens do sumário e primeiras páginas para análise (não armazenadas), identificador de aparelho, telemetria. Declarar uso de IA generativa.
4. Política de privacidade e termos em URL pública.
5. Faixa de teste fechado.

**Pronto quando:** um tester instala pela Play Store e lê com a TV sem contato com a equipe.

### Etapa 5. Beta fechado (4 a 6 semanas)

1. Semana 1: onboarding, questionário inicial, observar o grupo. Cada pergunta feita ali é um defeito da interface.
2. Semanas 2 a 4: uso livre. Revisar "Não combina" e telemetria semanalmente. Correções via EAS Update.
3. Semana 3: questionário sobre H2, H3 e H5.
4. Semana 5 ou 6: questionário final com pergunta de preço e lista de espera.
5. Consolidar contra a seção 4.3 e decidir: monetizar, ajustar ou encerrar.

---

## 6. Custos

### 6.1 IA por livro

Premissas: sumário em imagem de cerca de 1.500 tokens de entrada e 800 de saída; análise do livro inteiro com prompt de sistema em cache (3 mil tokens), 1.500 tokens de contexto e 6 a 10 mil tokens de saída para 20 a 30 capítulos com 3 a 5 cenas cada; refinamento por primeira página com 700 tokens de entrada e 400 de saída. Preços da API da Anthropic em setembro de 2026, por milhão de tokens: Haiku 4.5 US$ 1 entrada e US$ 5 saída; Sonnet 5 US$ 2 e US$ 10; Opus 5 US$ 5 e US$ 25.

| Modelo | Sumário | Livro inteiro | Refinamento por capítulo | Livro completo com 10 refinamentos |
|---|---|---|---|---|
| `claude-haiku-4-5` | US$ 0,006 | US$ 0,04 a 0,06 | US$ 0,003 | US$ 0,08 a 0,10 |
| `claude-sonnet-5` | US$ 0,011 | US$ 0,08 a 0,12 | US$ 0,006 | US$ 0,15 a 0,20 |
| `claude-opus-5` | US$ 0,03 | US$ 0,20 a 0,35 | US$ 0,015 | US$ 0,40 a 0,55 |

Comparado ao modo página a página (US$ 4,50 a 10 por livro no Opus 5), a redução é de mais de dez vezes. E como o preset é compartilhado por edição, só o primeiro leitor de cada edição gera custo. Isso permite usar o Opus 5 em produção sem pressão de margem, se a comparação de qualidade justificar.

Custo do beta com 50 testers e 3 livros novos cada, no Opus 5: cerca de US$ 60 a 85 no período inteiro. No Sonnet 5, US$ 25 a 30.

### 6.2 Infra mensal

| Item | Opção | Custo mensal estimado |
|---|---|---|
| API e relay (Node, WSS) | Fly.io, Railway ou droplet básico | US$ 5 a 15 |
| Postgres gerenciado | Neon ou Supabase | US$ 0 a 25 |
| Receptor estático | Cloudflare Pages | US$ 0 |
| Sons em bucket com CDN | Cloudflare R2 | US$ 0 a 2 |
| Domínio | registro anual | US$ 1 a 2 |
| EAS Build e Update | plano gratuito do Expo | US$ 0 |
| **Total sem IA** | | **US$ 6 a 45** |

### 6.3 Custos únicos

- Conta Google Play Developer: US$ 25.
- Anel ou controle Bluetooth para testes: R$ 30 a 80.
- Conta Apple Developer só quando iOS entrar: US$ 99 por ano.

---

## 7. Monetização

### 7.1 Princípios

- **O leitor não deve precisar entender o modelo de cobrança.** Um plano gratuito e uma assinatura. Sem créditos, sem moedas, sem pacotes.
- **Cobrar pelo que é escasso.** O custo real é preparar livros novos. Livros já preparados por outros são gratuitos para todos, o que faz o catálogo crescer e o produto melhorar para quem não paga.
- **Nunca cobrar antes de entregar valor.** A tela de plano aparece só ao atingir o limite, e diz o que continua funcionando.
- **Preços em real.** Dólar só nos custos internos.

### 7.2 Modelos avaliados

| Modelo | Prós | Contras | Veredito |
|---|---|---|---|
| Assinatura única e barata | Simples de explicar, previsível, custo marginal por livro quase zero | Leitor ocasional pode não assinar | **Recomendado** |
| Compra por livro | Intuitivo | Custo de IA por livro é centavos; o preço pareceria arbitrário; mais decisões para o leitor | Descartado |
| Créditos de páginas | Alinhava com custo no modelo antigo | Não faz mais sentido com custo por capítulo; conceito que o usuário precisa aprender | Descartado |
| Anúncios | Sem barreira | Destrói a imersão | Descartado |
| Compra única do app | Simples | Não cobre custo recorrente de infra e IA | Descartado |

### 7.3 Recomendação

**Gratuito.**

- 2 livros novos preparados por mês.
- Ilimitado para livros que já têm ambiente (preparados por outros leitores ou oficiais).
- Todas as funções de leitura, TV e progresso.

**Illusion Plus: R$ 12,90 por mês ou R$ 99 por ano.**

- Livros novos ilimitados.
- Refinamento por primeira página em todos os capítulos.
- Camada de imagem abstrata por capítulo, quando existir (seção 8.2).
- Sincronização em vários aparelhos.

**Unidade econômica.** Custo de IA por livro novo no Opus 5: cerca de R$ 2,50 a 3,00 a câmbio de referência de R$ 5,50. Um assinante que prepara 4 livros novos por mês custa R$ 10 a 12, o que não fecha com a mensalidade após a taxa da loja de 15%. Mas a média será bem menor: leitores lêem 1 a 2 livros por mês e boa parte já estará no catálogo. Com Sonnet 5 o custo por livro cai para cerca de R$ 1, e a assinatura fecha mesmo para leitores intensos. A escolha do modelo é uma decisão de margem a ser tomada com os dados do beta. Opção intermediária: Opus 5 para o primeiro preparo da edição (que fica no catálogo para todos) e Sonnet 5 para refinamentos.

### 7.4 Cobrança

- Google Play Billing obrigatório para assinatura consumida no app. Taxa de 15% no programa para receita até US$ 1 milhão por ano.
- RevenueCat para gerenciar a assinatura, validar recibos e informar o plano à API por webhook. Plano gratuito cobre o início.
- Login com Google na primeira assinatura, para recuperar o plano ao trocar de aparelho. O usuário anônimo é vinculado à conta.
- Decidir antes de ativar a cobrança se opera como MEI ou empresa e como emite nota. Consultar um contador.

### 7.5 Quando ligar

Somente após o beta atingir a seção 4.3. Sequência: publicar em produção com plano gratuito e Plus; dar Plus por 3 meses aos testers; medir conversão, custo por assinante e churn por 3 meses; então decidir sobre marketplace e outras camadas.

---

## 8. Projeto futuro

### 8.1 Presets oficiais de domínio público

Gerar em lote, a partir do texto integral (Gutenberg, Domínio Público), presets por capítulo para clássicos em português e traduções clássicas. Mapeamento à edição impressa vem do sumário fotografado pelo primeiro leitor de cada edição, exatamente como no fluxo normal. O leitor não percebe diferença entre oficial e gerado; só percebe que "já estava pronto".

### 8.2 Camada de imagem abstrata

Uma imagem por capítulo, gerada por IA, sempre abstrata ou desfocada, sem rostos, objetos ou cenas reconhecíveis, com movimento lento de câmera e o shader atual por cima. Custo de menos de um dólar por livro, amortizado por edição. Vantagem do plano Plus. Só depois de H1 confirmada, porque imagem figurativa é o caminho mais rápido para competir com a imaginação do leitor, que é o oposto do produto.

### 8.3 Luz física

Sincronizar a paleta com lâmpadas inteligentes (Philips Hue, WLED, Govee) e fitas de LED. É a evolução natural da visão periférica: a sala inteira muda de cor com o capítulo, sem tela nenhuma. Possível linha de receita por parceria ou hardware próprio.

### 8.4 Receptor nativo

Android TV e Google TV, depois receiver do Chromecast e Apple TV. Elimina abrir navegador na TV e permite pareamento automático na mesma rede.

### 8.5 Editor e comunidade

Ajustar cenas de um capítulo com sliders e lista de sons. Publicar versões alternativas de um livro. Marketplace com divisão 70/30 sobre o valor líquido, moderação e verificação de que o preset não contém texto. Só com base ativa de milhares de usuários.

### 8.6 iOS

Expo já permite; falta OCR nativo (Vision), conta Apple e revisão. Quando o Android mostrar retenção.

### 8.7 Livro digital e B2B

EPUB e e-readers eliminam o sumário fotografado, mas mudam o produto. Livrarias, cafés, bibliotecas e escolas com projetor são um ciclo de venda diferente; explorar só com demanda espontânea.

---

## 9. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| IA inventa clima errado para livros pouco conhecidos | Alto: quebra a imersão | `confidence` baixa devolve clima geral, não detalhes; convite à primeira página; "Não combina" troca por cena neutra |
| Sumário mal reconhecido | Médio: lista errada de capítulos | Confirmação editável; testar dez layouts de editoras; fallback "sem sumário" |
| Avanço por tempo fora de sincronia | Médio: cena errada no meio do capítulo | Cenas longas, transições lentas, última cena espera o toque, "Estou na página" |
| Spoiler vaza em `mood` | Alto: confiança | Instrução no prompt, validação por lista de palavras proibidas (nomes próprios), revisão amostral |
| Custo de IA acima da assinatura para leitores intensos | Médio: margem | Catálogo compartilhado, Sonnet 5 para refinamentos, cota do gratuito, alerta de gasto |
| Navegador da TV não toca áudio ou WebGL mal | Médio | Lista de TVs testadas, recomendar Chromecast ou laptop, receptor nativo (8.4) |
| Google Play rejeita por câmera ou IA | Médio: atraso | Ficha e política claras, declaração de IA generativa |
| Licença de som errada | Baixo | Script que valida CC0 no build, página de créditos no receptor |
| Dependência de um provedor de IA | Baixo | Prompt e normalização isolados em `analyzer.ts` |

---

## 10. Jurídico e conformidade

- **Direitos autorais.** Sumário e primeiras páginas existem só na requisição e são descartados. O JSON derivado (paleta, movimento, sons, palavras de clima) não reproduz a obra. O raciocínio da IA sobre o enredo nunca é persistido. Manter explícito nos termos e no código.
- **LGPD.** Dados coletados: identificador de aparelho, ISBNs, progresso de leitura, eventos de uso. Imagens não são armazenadas. Informar processamento por provedor de IA nos EUA. Oferecer exclusão de conta e dados pelo app.
- **Licenças de som.** Todas as gravações em `public/sounds/manifest.json` devem ser CC0; script que falha o build se não forem. Página de créditos no receptor.
- **Google Play.** Formulário de segurança de dados coerente com a política, justificativa da câmera, declaração de IA generativa.
- **Termos de uso.** Uso pessoal, sem garantia de precisão da IA, reembolso alinhado ao Google Play.

---

## 11. Métricas

**Uso.** Sessões por usuário por semana; capítulos por sessão; livros novos preparados por usuário; tempo da foto do sumário até a confirmação.

**Compreensão.** Abandono por tela no primeiro uso; perguntas no grupo de suporte classificadas por tela; edições manuais na lista de capítulos.

**Qualidade.** "Não combina" por capítulo, por modelo e por `confidence`; uso de "Estou na página"; desconexões do relay; erros da API por tipo.

**Negócio** (após cobrança). Conversão gratuito para Plus; custo de IA por assinante; churn; reembolsos.

Para o beta, SQL direto no Postgres. PostHog ou similar na produção.

---

## 12. Checklist de lançamento do beta

**Produto**

- [ ] Cinco telas da seção 2.2 implementadas conforme especificado
- [ ] Onboarding de três cartões
- [ ] Leitura do sumário testada em dez livros de editoras diferentes
- [ ] Análise do livro inteiro em uma chamada, com `mood` sem nomes ou eventos
- [ ] Avanço por tempo com pausa em segundo plano e "Estou na página"
- [ ] Próximo capítulo por toque, volume e Bluetooth
- [ ] "Não combina" funcionando e registrado
- [ ] Reconexão automática com a TV
- [ ] Todas as mensagens de erro da seção 2.5 em linguagem de gente
- [ ] Modo página a página fora do fluxo, em Ajustes
- [ ] 47 sons com gravação real, revisados na TV

**Backend**

- [ ] API e relay públicos em HTTPS e WSS
- [ ] Receptor em HTTPS com domínio curto
- [ ] Sons em bucket com CDN
- [ ] Postgres com catálogo por ISBN, usuários e eventos
- [ ] Preset e sumário compartilhados por edição
- [ ] Proxy de ISBN com cache
- [ ] Token por aparelho, cota, limite de taxa
- [ ] Alerta de gasto na Anthropic
- [ ] Backup do Postgres

**Qualidade**

- [ ] Testes de schema, relay, normalização da IA, leitura do sumário e cálculo de tempo
- [ ] CI com typecheck e testes
- [ ] Comparação de modelos em três livros documentada, modelo do beta escolhido

**Distribuição e conformidade**

- [ ] Conta Google Play criada
- [ ] AAB via EAS Build, EAS Update configurado
- [ ] Ficha da loja e formulário de segurança de dados
- [ ] Política de privacidade e termos publicados
- [ ] Validação de licenças de som no build, página de créditos
- [ ] Faixa de teste fechado com 12 ou mais testers

**Operação**

- [ ] Grupo de suporte
- [ ] Questionários inicial, intermediário e final
- [ ] Consultas SQL para as métricas da seção 11
- [ ] Datas de início e fim definidas
