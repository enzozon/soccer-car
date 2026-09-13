# Validação e limites

Registro da versão 0.2 em 13/09/2026. As execuções remotas ficam em [GitHub Actions](https://github.com/enzozon/soccer-car/actions).

## Verificações

- TypeScript estrito e build de produção.
- **20 testes de lógica**: entrada, preferências, gravidade, aceleração, velocidades, frenagem, consumo, saltos, flips, air roll, voo, paredes, teto, impulso externo, traves, gols e empate no último instante.
- Duas simulações idênticas comparadas por 30.000 passos; verificação de que o bot alcança a bola.
- **24 cenários de navegador**: oito fluxos em Chromium, Firefox e WebKit. Garagem/treino/câmera/pausa/persistência; duelo; gamepad simulado; toque; WebGL indisponível; recuperação após perda do contexto; migração da preferência antiga; subida e salto da parede.
- Os testes interativos usam o build de produção no Vite Preview. A renderização Chromium usa SwiftShader. Os cenários de partida verificam explicitamente o modo 3D.

| Motor local | Versão                           | Cobertura                             |
| ----------- | -------------------------------- | ------------------------------------- |
| Chromium    | Chrome for Testing 153.0.8010.12 | Arena 3D, controles e falhas gráficas |
| Firefox     | 155.0                            | Arena 3D, controles e falhas gráficas |
| WebKit      | 26.6                             | Arena 3D, controles e falhas gráficas |

Se Firefox/WebKit de um executor não oferecer WebGL 2, os cenários de partida são marcados como indisponíveis; o teste dedicado ainda exige o erro visível. Chromium deve renderizar 3D para a verificação passar. WebKit no Windows não equivale a um dispositivo Apple real. Gamepad e toque são simulados, sem validação de controles físicos ou telefones.

## Medida reproduzível de CPU

```bash
npm run benchmark
```

Windows, Node.js 24.19.0, AMD Ryzen 5 5600X. Seis rodadas de 120.000 passos de duelo: uma de aquecimento e mediana das cinco seguintes.

| Medida                                  | Resultado local |
| --------------------------------------- | --------------- |
| 120.000 passos de física e bot          | 808,62 ms       |
| Custo médio por passo na rodada mediana | 6,739 μs        |
| JavaScript principal, gzip              | 20.340 bytes    |
| Motor 3D, gzip                          | 134.230 bytes   |
| CSS, gzip                               | 5.185 bytes     |

Esse benchmark mede CPU da simulação e tamanho dos arquivos. Não mede FPS, GPU ou download completo; fontes locais são separadas. Capturas de testes com relógio controlado também não constituem benchmark de FPS.

## Desempenho e recuperação

- Geometria estática agrupada e materiais compartilhados. Os 34 pontos de turbo usam duas chamadas de desenho com instâncias.
- Sem sombras dinâmicas, pós-processamento ou modelos/texturas baixados durante a partida.
- Econômico limita a resolução a 0,8 vezes o tamanho CSS; Automático reduz a resolução durante quedas prolongadas.
- Passo fixo com até oito passos por quadro, HUD a 10 Hz e pausa ao perder foco. Abaixo de aproximadamente 15 FPS, a simulação pode desacelerar.
- Perda do contexto gráfico pausa a partida e oferece reconstrução da arena. Sem WebGL 2, aparece uma mensagem; o jogo não troca para 2D.

Use o perfil Econômico em máquinas modestas. Não há promessa de 60 FPS em qualquer dispositivo. As aproximações da física estão em [FISICA.md](FISICA.md).
