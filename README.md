# Soccer Car

Futebol 3D com carros, feito para abrir o navegador e jogar. Projeto pessoal de **Enzo Faroni Zon**, desenvolvido com TypeScript, Three.js, HTML e CSS.

[Jogar no navegador](https://enzozon.github.io/soccer-car/) · [Código e histórico](https://github.com/enzozon/soccer-car) · [Verificações](https://github.com/enzozon/soccer-car/actions)

![Menu do Soccer Car](docs/screenshots/menu.png)

## O jogo

- **Duelo 1 × 1 contra bot**, com três dificuldades, partidas de 1, 3 ou 5 minutos e gol de ouro no empate.
- **Treino livre**, com turbo ilimitado e reposicionamento da bola e do carro.
- **Garagem** com Pulse, Rally e Vector: modelos próprios com a mesma física e cinco pinturas.
- Física a 120 Hz: salto variável, segundo salto, flips direcionais, controle aéreo, air roll e turbo na direção do carro.
- Rampas curvas, condução nas paredes, transição para o teto, colisões entre caixas orientadas e bola com giro.
- 28 pontos pequenos de turbo e seis grandes; relógio zerado espera a bola tocar o chão.
- Câmeras atrás do carro, seguindo a bola e visão geral.
- Teclado, controles com mapeamento padrão da Gamepad API e botões de toque.
- Gráficos **sempre em 3D**, com perfis automático, econômico e alto.
- Preferências locais, sons sintetizados, pausa ao perder foco e opção para reduzir movimento da câmera.

Experiência local para um jogador, com arena e carrocerias autorais. A física usa medições públicas de Rocket League como calibração, com solver próprio: **não representa equivalência exata ao motor proprietário ou à versão atual do jogo**. Veja [parâmetros e diferenças](docs/FISICA.md) e [origem e licenças](docs/ORIGEM.md). Não inclui multiplayer online nem demolições.

![Carro em manobra aérea](docs/screenshots/aereo.png)

## Executar localmente

Use Node.js **24 LTS** e npm. Não há backend, conta, chave de API ou banco de dados para configurar.

```bash
git clone https://github.com/enzozon/soccer-car.git
cd soccer-car
npm ci
npm run dev
```

Abra o endereço mostrado pelo Vite. Para gerar e conferir os arquivos estáticos:

```bash
npm run build
npm run preview
```

Sirva a pasta `dist/` por HTTP(S). Abrir `index.html` diretamente por `file://` não é suportado. O build usa caminhos relativos e pode ser hospedado em uma subpasta, como o GitHub Pages.

## Controles

| Ação                   | Teclado             | Controle padrão     |
| ---------------------- | ------------------- | ------------------- |
| Acelerar / ré          | W / S ou ↑ / ↓      | RT / LT             |
| Dirigir                | A / D ou ← / →      | Analógico esquerdo  |
| Turbo                  | Shift               | B / ○               |
| Salto / segundo salto  | Espaço              | A / ×               |
| Derrapar               | Ctrl                | X / □               |
| Inclinar / girar no ar | WASD                | Analógico esquerdo  |
| Air roll               | Q / E ou Ctrl + A/D | X ou LB + analógico |
| Trocar câmera          | C                   | Y / △               |
| Pausar                 | Esc / P             | Start / Options     |
| Reposicionar no treino | R                   | Back / Share        |

Segure o primeiro salto por até 0,2 s para subir mais. No segundo toque, escolha uma direção para executar um flip; sem direção, execute um salto duplo. No ar, incline o nariz e acione o turbo. As rampas nas bordas levam às paredes.

Conecte o controle e pressione um botão com a página em foco. Alguns navegadores só expõem o dispositivo após essa interação. Ajuste a zona morta se houver movimento involuntário. Teclado e toque continuam disponíveis quando a Gamepad API não é suportada ou está bloqueada. O suporte depende do navegador, do sistema e do mapeamento do controle; dispositivos físicos precisam de validação no computador do jogador.

## Compatibilidade e desempenho

O objetivo é atender computadores modestos e navegadores modernos; não há garantia de funcionamento em literalmente qualquer hardware ou navegador antigo. Requer **WebGL 2**. Sem esse recurso, exibe uma mensagem com nova tentativa; não inicia uma partida invisível. O perfil econômico reduz a resolução e preserva o 3D. Preferências antigas de modo 2D migram automaticamente.

- Física com passo fixo de 1/120 s e no máximo oito passos por quadro, para limitar trabalho acumulado.
- Modelos geométricos leves; sem download de texturas, modelos de terceiros ou arquivos de áudio.
- Resolução limitada por perfil gráfico e ajuste automático durante quedas de desempenho.
- Atualização do HUD a 10 Hz e renderização interrompida quando a página está oculta.
- Three.js carregado separadamente; arquitetura estática e pontos de turbo agrupados em instâncias.
- Fontes hospedadas junto do jogo, sem requisições a Google Fonts durante a partida.

Consulte [validação e limites](docs/VALIDACAO.md) para os testes realizados e como reproduzi-los. O contador de FPS mostra o desempenho do dispositivo atual.

## Verificar

```bash
npm run check
npx playwright install chromium firefox webkit
npm run test:browser
npm run benchmark
```

Os testes unitários usam `node:test`. Os testes de navegador exercitam garagem, persistência, movimentação, câmera, pausa, teclado, gamepad simulado e layout/toque em Chromium, Firefox e WebKit. A CI executa essas verificações; o workflow de publicação disponibiliza a versão aprovada no GitHub Pages.

## Estrutura

```text
src/
  simulation.ts   Bot, gols, recarga e ciclo de partida
  car-physics.ts  Movimento 3D, salto, flip e contato das rodas
  collisions.ts   Colisões da bola, carros e traves
  arena-physics.ts Superfícies e rampas da arena
  math.ts         Vetores e quaternions
  input.ts        Teclado, Gamepad API e toque
  renderer.ts     Arena e carros em Three.js
  main.ts         Menu, garagem, HUD e loop do jogo
  settings.ts     Validação e persistência local
  audio.ts        Efeitos sintetizados com Web Audio
tests/            Simulação, entrada, preferências e navegadores
```

Entrada, simulação e renderização são independentes. Os testes numéricos de física rodam sem GPU; a arena 3D lê posição e orientação dos mesmos corpos.

Licença [MIT](LICENSE). Fontes Barlow sob [SIL OFL 1.1](public/fonts/OFL.txt).
