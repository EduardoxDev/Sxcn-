# Scxn

Salas privadas para compartilhar tela e conversar por voz. React/TypeScript no cliente, Socket.IO para sinalização e WebRTC para mídia real. Sem webcam, gravação ou armazenamento de áudio/vídeo.

## Iniciar

Requer **Node.js 20.19+** (recomendado 22 LTS ou superior) e npm.

```sh
npm install
npm run dev
```

Abra **http://localhost:5173**. O Vite encaminha `/socket.io` e `/api` para o servidor na porta 3001. Crie uma sala, informe um nome e entre. O microfone é opcional e só pede permissão ao ativá-lo. A tela exige ação explícita e seleção no navegador.

Para produção local:

```sh
npm run build
npm start
```

Abra **http://localhost:3001**. No Windows, após o build, `Iniciar Scxn.cmd` também inicia o servidor. O atalho usa Node do PATH ou o runtime local do Codex, se disponível. Mantenha o terminal aberto; Ctrl+C encerra.

## Fluxo e controles

- Criar sala gera código e convite `/room/HG3V-WPST`.
- Colar código ou link na home abre preparação de áudio, com nome, seleção de microfone, nível de entrada e teste da saída.
- Sala com sidebar recolhível (drawer abaixo de 1024px), convite, voz e uma transmissão simultânea.
- Quem transmite pode parar, pausar, ocultar a própria prévia e alterar resolução/FPS/otimização.
- Quem assiste pode ajustar/preencher, ampliar/arrastar, redefinir zoom, entrar em tela cheia e consultar estatísticas.
- Host pode remover participantes ou encerrar a sala para todos. Ao sair, o próximo participante assume.
- `M`: microfone; `S`: compartilhar/parar; `F`: tela cheia; `P`: participantes; `Esc`: fechar dialog/tela cheia. Atalhos são ignorados em campos de texto e dialogs.
- Áudio bloqueado pelo autoplay mostra um botão para ativá-lo. Preferência de redução de animações é respeitada junto à configuração do sistema.

## Estrutura

```text
client/src/
  App.tsx, main.tsx       # Inicialização e rotas
  pages/                 # Home, preparação e sala
  components/
    brand/               # Logo e loading
    room/, controls/     # Header e controles de chamada
    dialogs/             # Convite e configurações
    media/               # Stage, reprodução, áudio e estatísticas
    participants/        # Lista, sidebar e drawer
    feedback/, ui/       # Estados e componentes acessíveis Radix
  stores/                # Zustand: sala, mídia, preferências, interface
  services/
    session/             # RoomSession: coordena todo o ciclo da sessão
    signaling/           # Socket.IO tipado, acknowledgements e timeouts
    media/               # Captura, microfone e detecção de fala
    webrtc/              # PeerManager, PeerLink, StatsMonitor
server/src/
  rooms/RoomManager.ts   # Regras, limites, host, expiração e retomada
  socket/signaling.ts    # Validação, autorização, rate limiting e relay
  app.ts, config.ts      # Express, Socket.IO, configuração e headers
shared/src/              # Contratos, schemas Zod, sanitização e códigos
tests/                   # Domínio, integração e regressões
```

## Sinalização e mídia

O servidor mantém apenas metadados de salas e participantes em memória. `room:create`, `room:peek`, `room:join`, `room:leave`, `room:end` e `room:kick` usam respostas tipadas. Presença e estados são enviados por eventos `participant:*`, `screen:*` e `audio:state`. SDP e candidatos ICE passam por `webrtc:offer`, `webrtc:answer` e `webrtc:ice-candidate`, somente entre participantes da mesma sala.

Cada par tem uma `RTCPeerConnection` (mesh), com slots de áudio e vídeo e negociação concorrente _perfect negotiation_. Uma geração identifica reconstruções da conexão; o lado que acompanha uma reconstrução preserva sua geração para evitar ciclos. Tracks são substituídas sem recriar a sessão. A resolução/FPS desejados são limites: o navegador pode entregar menos conforme rede e hardware. Automática reduz o teto de bitrate por espectador à medida que a sala cresce.

As capturas continuam locais até a transmissão ser autorizada. Permissões ignoradas têm espera limitada (microfone: 30s; tela: 90s); streams recebidos depois de cancelamento/saída são encerrados. Encerrar pelo botão do navegador atualiza a sala.

Referência de negociação: [MDN — Perfect negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation). Motion/Radix atendem às microinterações existentes; não foi necessário adicionar efeitos React Bits.

## Configuração

Copie `.env.example` para `.env` **na raiz**. Nunca versione credenciais. `VITE_*` é incorporado ao bundle público; não coloque segredos nessas variáveis.

| Variável                           | Padrão / finalidade                                                    |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `PORT`                             | 3001; porta HTTP e Socket.IO                                           |
| `CORS_ORIGINS`                     | Origens permitidas separadas por vírgula; vazio para mesma origem      |
| `TRUST_PROXY`                      | 0; use 1 somente atrás de um proxy confiável e inacessível diretamente |
| `MAX_PARTICIPANTS`                 | 8; limitado entre 2 e 12                                               |
| `MAX_ROOMS`                        | 500                                                                    |
| `RECONNECT_GRACE_MS`               | 30000; reserva do lugar após queda                                     |
| `STUN_URLS`                        | STUN Google/Cloudflare; lista separada por vírgula                     |
| `TURN_URLS`                        | URLs do relay TURN, inclusive `turns:` se necessário                   |
| `TURN_USERNAME`, `TURN_CREDENTIAL` | Credenciais para o relay                                               |
| `VITE_SIGNALING_URL`               | Vazio: mesma origem; URL alternativa exige build novo e CORS           |

Sala nunca usada expira em 10 minutos; sala vazia em 5 minutos. Códigos encerrados são lembrados por uma hora. Reiniciar o processo remove as salas. Preferências ficam no navegador; token de retomada é por aba. Código é um convite: qualquer pessoa que o possuir pode tentar entrar, dentro do limite. Não há contas, senha ou aprovação de entrada.

## Publicar

1. Configure `.env`, incluindo TURN para redes restritas.
2. Execute `npm ci` e `npm run build`.
3. Inicie com `NODE_ENV=production npm start` (PowerShell: `$env:NODE_ENV='production'; npm start`).
4. Exponha o servidor por um proxy **HTTPS**, com suporte a upgrade WebSocket. Sirva frontend e signaling na mesma origem.
5. Verifique `/api/health` e teste voz/tela em duas redes distintas.

`localhost` funciona para testes; HTTP com IP de rede não fornece contexto seguro para microfone/captura. Não basta enviar um convite `localhost` para outra pessoa: use a URL HTTPS publicada. TURN encaminha mídia quando conexão direta é impossível. Não há servidor TURN hospedado/configurado incluído neste repositório. Credenciais TURN fixas são disponibilizadas aos participantes; em serviço público use credenciais temporárias e quotas no provedor.

Um único processo gerencia as salas. Não execute múltiplas réplicas sem externalizar o estado e coordenar Socket.IO. Mesh exige uma cópia da tela por espectador: adequado a grupos pequenos; não é uma arquitetura de transmissão para grandes audiências.

O servidor valida nomes, códigos e eventos, limita salas/participantes e aplica rate limits. Mídia usa criptografia de transporte WebRTC; a aplicação não fornece verificação adicional de identidade entre participantes.

## Marca

O arquivo original da logo **não veio nos anexos desta continuação**. O componente e o símbolo provisório encontrados no projeto foram preservados. Para usar a arte oficial sem editar componentes, adicione `client/src/assets/brand/scxn-mark.svg` e/ou `scxn-logo.svg` (também aceita PNG/WebP). Substitua `client/public/favicon.svg` pela versão oficial correspondente. O componente aceita versão completa, símbolo e vários tamanhos. Não foi criada uma nova identidade.

## Verificação

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run format:check
```

Os testes cobrem códigos/nomes, salas cheias, reserva/expiração, host, uma tela por sala, isolamento do relay, validação e limite de requisições, retomada idempotente e cancelamento/timeout de microfone, troca para dispositivo padrão e recuperação de tela após nova identidade.

Teste de navegador opcional, com servidor de desenvolvimento ativo:

```sh
npm install --no-save playwright
npx playwright install chromium
node tests/browser-smoke.mjs
```

`TEST_URL` altera o endereço (padrão `http://127.0.0.1:5173`). `PLAYWRIGHT_MODULE` permite usar uma instalação externa de Playwright. O teste usa dois contextos Chromium isolados e **mídia sintética de teste do navegador**; a conexão WebRTC e o signaling são reais. Exercita voz, tela, pausa/retomada, troca de transmissor, refresh, recuperação de autoplay, responsividade e encerramento. Screenshots ficam em `test-artifacts/` (não versionado).

No build de produção, o teste verifica a restrição `camera=()` e adapta esse header somente nas respostas interceptadas dos contextos de teste: o dispositivo de tela sintético do Chromium usa internamente a câmera sintética. O servidor mantém a câmera bloqueada. O teste também concede acesso à rede local apenas nesses contextos isolados.

Ainda é necessário validar permissões nativas, dispositivos físicos, redes externas/TURN e comportamento de Safari/Firefox no ambiente de publicação. O teste local não prova qualidade de transmissão entre redes diferentes. Não há gravação, webcam nem áudio da aba/sistema: o áudio transmitido é o microfone.
