# Autoria e referências

Soccer Car é um projeto pessoal de Enzo Faroni Zon. A proposta é explorar futebol arcade com carros em uma aplicação web pequena e independente.

O site [Car Soccer](https://car-soccer.com/) foi consultado como referência funcional: treino, partida contra bot, garagem, câmera, teclado, controle e opções de desempenho. A análise usou os textos públicos da interface em 12/09/2026; não foi uma sessão jogada nem uma medição de desempenho do site. Nenhum código, modelo, textura, som ou logotipo desse site foi reutilizado.

A arena Terminal Arena e as carrocerias Pulse, Rally e Vector são montadas com geometria procedural própria. Sons são sintetizados pela Web Audio API. O jogo não é afiliado a Rocket League, Psyonix ou Epic Games e não reutiliza seus modelos. Desde a versão 0.2, a simulação usa constantes públicas de Rocket League com implementação própria; fontes e aproximações estão em [Física](FISICA.md).

## Componentes externos

- [Three.js](https://threejs.org/): renderização WebGL 2, licença MIT.
- [Vite](https://vite.dev/) e [TypeScript](https://www.typescriptlang.org/): desenvolvimento e compilação.
- [Playwright](https://playwright.dev/): testes em navegadores.
- [Barlow e Barlow Condensed](https://github.com/jpt/barlow): fontes de Jeremy Tribby, SIL Open Font License 1.1. Arquivos locais em `public/fonts`, com sua licença `OFL.txt`; distribuição original pelo Google Fonts.

As licenças das dependências acompanham seus respectivos pacotes. A licença MIT deste projeto cobre o código e a arte procedural próprios.
