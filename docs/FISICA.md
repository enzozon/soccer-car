# Física do Soccer Car 0.2

Revisão de 13/09/2026. O jogo tem uma simulação tridimensional própria em TypeScript. As medidas abaixo aproximam mecânicas de Rocket League; não demonstram equivalência exata ao motor proprietário ou à versão atual. Car Soccer foi referência funcional, sem extração de código ou modelos.

## Escala e parâmetros

Um metro na cena corresponde a 100 unidades Unreal. Y aponta para cima; o nariz do carro aponta para −Z no seu referencial. O loop usa passos de 1/120 s, independentes da qualidade gráfica.

| Parâmetro                               | Valor utilizado                 |
| --------------------------------------- | ------------------------------- |
| Gravidade                               | 6,5 m/s²                        |
| Velocidade do carro / sem turbo         | 23 / 14,1 m/s                   |
| Limiar supersônico                      | 22 m/s                          |
| Aceleração do turbo, chão / ar          | 9,91666 / 10,58333 m/s²         |
| Consumo do turbo                        | 33,3 por segundo                |
| Frenagem / desaceleração livre          | 35 / 5,25 m/s²                  |
| Massas relativas, carro / bola          | 180 / 30                        |
| Raio / velocidade máxima da bola        | 0,9125 m / 60 m/s               |
| Restituição / arrasto da bola           | 0,6 / 0,030562                  |
| Velocidade angular máxima, carro / bola | 5,5 / 6 rad/s                   |
| Arena, largura × comprimento × altura   | 81,92 × 102,4 × 20,48 m         |
| Gol, largura × altura × profundidade    | 17,8551 × 6,42775 × 8,8 m       |
| Pontos pequenos / grandes               | 12 a cada 4 s / 100 a cada 10 s |

As medidas, curvas de direção e acelerações angulares vêm da [RLBot Wiki — valores medidos](https://wiki.rlbot.org/v5/botmaking/useful-game-values/). As massas são usadas pela razão entre corpos, em unidades consistentes do solver.

O salto aplica 2,91667 m/s na direção do teto do carro. Segurar adiciona 14,6 m/s² por até 0,2 s; há bônus mínimo de três passos e força de aderência inicial. Um segundo toque neutro repete o impulso; a janela depende da duração do primeiro salto. Referência: [RLBot — física dos saltos](https://wiki.rlbot.org/v5/botmaking/jumping-physics/).

O dodge usa impulso horizontal base de 5 m/s, ajuste lateral e para trás conforme a velocidade, torque durante 0,65 s e amortecimento vertical a partir de 0,15 s. Os parâmetros públicos foram consultados no projeto de medição [RLUtilities — dodge](https://github.com/samuelpmish/RLUtilities/blob/develop/src/mechanics/dodge.cc). A composição com nosso contato e amortecimento é própria.

## Comportamento implementado

Quaternions orientam o carro inteiro, incluindo o turbo no ar e os eixos de pitch, yaw e roll. O chão usa curva de direção dependente da velocidade e aderência lateral reduzida durante derrapagens. As rodas acompanham rampas e paredes; tocar o teto devolve a reserva de salto e permite cair para um novo dodge.

A bola colide com a caixa orientada do carro, recebe impulso e giro. Carros e traves usam caixas com teste de eixos separadores. Contatos da carroceria aplicam impulso no ponto de apoio para evitar equilíbrio artificial sobre quinas. Gols exigem a bola inteira além da linha; ao zerar o relógio, uma bola ainda no ar prolonga a jogada. Empates iniciam nova saída na prorrogação.

## Aproximações e limites conhecidos

- Rampas são quartos de círculo de raio 2,56 m e cantos chanfrados. A geometria original possui curvas diferentes; os encontros entre rampas são aproximados.
- Rodas usam contato e alinhamento simplificados, sem suspensão individual. A carroceria usa uma caixa comum de 1,18 × 0,842 × 0,362 m e centro a 0,25 m do piso. Os três modelos são cosméticos.
- Atrito, inércia, amortecimento aéreo, recuperação do flip e cancelamento têm calibração própria. A recuperação conserva mais giro durante 0,4 s após o torque para completar a aterrissagem neste solver.
- O contato bola/carro usa restituição e razão de massas, sem reproduzir todas as forças adicionais do jogo original. A posição dos pontos de turbo é própria; duelos começam com 100 de reserva.
- Não há demolição, suspensão por roda, flip reset na bola, replay de referência nem validação por telemetria de Rocket League. Técnicas avançadas podem ter resultados diferentes.

As regressões numéricas em `tests/physics.test.ts` e `tests/simulation.test.ts` verificam valores, trajetórias básicas, estabilidade, paredes, flips, colisões e relógio. Elas comprovam o comportamento deste projeto; uma comparação exata exigiria séries de entradas e estados da mesma versão do jogo de referência.
