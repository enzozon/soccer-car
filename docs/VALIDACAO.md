# Validação e limites

Registro local de 12/09/2026. Os resultados de cada revisão enviada também ficam em [GitHub Actions](https://github.com/enzozon/soccer-car/actions).

## Funcionalidade

- TypeScript estrito e build de produção: aprovados.
- **9 testes de lógica**: configurações corrompidas, limites de entrada do controle, gols, colisão na abertura do gol, relógio, prorrogação, estado final, recarga, salto duplo e estabilidade determinística.
- A verificação prolongada compara duas simulações idênticas por 30.000 passos, além de conferir que o bot alcança a bola.
- **15 cenários de navegador**: cinco fluxos em cada um dos três motores. Garagem/treino/câmera/pausa/persistência; duelo e relógio; gamepad simulado; layout e toque; ausência de WebGL e armazenamento bloqueado.
- Os testes de navegador usam o **build de produção**, servido pelo Vite Preview.
- Inspeção visual das capturas de desktop 1440 × 900 e celular 390 × 844, com ajuste dos textos para caberem nos seletores menores.

| Motor automatizado | Versão instalada localmente | Verificação |
|---|---|---|
| Chromium | Chrome for Testing 153.0.8010.12 | Fluxos em 3D e 2D; WebGL por SwiftShader |
| Firefox | 155.0 | Fluxos de jogo e modo compatível |
| WebKit | 26.6 | Fluxos de jogo e modo compatível |

WebKit no Windows não equivale a testar um aparelho Apple real. O toque e o gamepad foram simulados; nenhum controle físico ou telefone real foi conectado durante esta validação. A compatibilidade de dispositivos precisa ser conferida no navegador do jogador. A simulação de gamepad valida a integração da API, não drivers USB/Bluetooth.

## Medida reproduzível de CPU

```bash
npm run benchmark
```

Resultado local: Windows, Node.js 24.19.0, AMD Ryzen 5 5600X. Foram executadas seis rodadas de 120.000 passos de duelo; a primeira é aquecimento, e o resultado é a mediana das cinco seguintes.

| Medida | Resultado local |
|---|---|
| 120.000 passos de física e bot | 56,85 ms |
| Custo médio por passo, na rodada mediana | 0,474 μs |
| JavaScript principal, gzip | 17.936 bytes |
| Motor 3D separado, gzip | 134.218 bytes |
| CSS, gzip | 5.031 bytes |

Essas medidas cobrem a CPU da simulação e os arquivos gerados. Não medem a GPU, o tempo de download completo ou os FPS de computadores modestos. As fontes locais são arquivos separados. Os tamanhos variam um pouco com revisões e parâmetros de compressão.

## Decisões de desempenho

- Geometria estática agrupada com `InstancedMesh`; materiais e geometrias compartilhados.
- Exportações explícitas do Three.js evitam carregar módulos que não são usados.
- Sem sombras dinâmicas caras, pós-processamento, texturas externas ou modelos baixados durante o jogo.
- Limite de resolução por qualidade, com redução automática quando o tempo por quadro aumenta.
- Passo fixo e limite de recuperação impedem uma fila ilimitada de física. Abaixo de aproximadamente 15 quadros/s, a simulação pode desacelerar; escolher o modo 2D reduz o custo de renderização.
- O contador FPS usa tempo real, separado do delta limitado da simulação.
- Ao perder o contexto WebGL, o jogo troca para Canvas 2D. Teclado, bot e regras continuam usando o mesmo estado.

O objetivo é boa compatibilidade, sem prometer 60 FPS em qualquer dispositivo. Use **Econômico** ou **Modo 2D compatível** se necessário. HTTPS ou localhost são recomendados para a Gamepad API.
