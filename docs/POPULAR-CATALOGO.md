# Popular o catálogo para descoberta

Na cópia de desenvolvimento, execute:

```powershell
npm run catalogo:popular
npm run catalogo:popular -- --aplicar
```

O primeiro comando mostra o plano. O segundo busca metadados reais no Deezer e acrescenta músicas ao catálogo desta instalação. A seleção inicial de artistas está em `config/catalogo-inicial.json`: rap e hip-hop brasileiro têm prioridade, com repertório de outras épocas e gêneros brasileiros e internacionais. Os grupos dessa seleção são editoriais; não preenchem idioma ou nacionalidade presumidos nas músicas.

Para ampliar a quantidade buscada por artista:

```powershell
npm run catalogo:popular -- --aplicar --por-artista=30
```

Também é possível acrescentar artistas à configuração. Não há um teto total de músicas definido por essa preferência; a quantidade por artista controla cada carga. O serviço pode retornar menos resultados que os solicitados. Uma carga inicial não representa todo o acervo do Deezer nem discografias completas.

Cada gravação e álbum são consultados pelos identificadores retornados pela fonte. Título, artistas e participações, duração, edição, data, gênero do álbum, gravadora, ISRC, classificação explícita e links são guardados quando informados. BPM ausente ou zero permanece desconhecido. Tom e idioma não são inferidos. Essa carga importa os metadados; a aplicação consulta as letras automaticamente pelo fluxo descrito em [Letras automáticas](LETRAS.md). Áudio não é incorporado.

Duplicatas por identificador e ISRC são descartadas. Músicas e retratos já presentes no catálogo são preservados. Cadastros manuais, correções, letras e projetos do espaço de trabalho não são modificados. Cada execução guarda cópias anteriores, um catálogo candidato e um relatório com fontes, cobertura e falhas em `.scratches/catalogo-<data>/`. Uma alteração concorrente do catálogo impede sua substituição.

As consultas são espaçadas, usam cache local de 24 horas e repetem falhas temporárias com espera. Uma fonte indisponível pode deixar itens fora da carga; o relatório registra as falhas. Os endereços de capas e retratos vêm da fonte e sua disponibilidade pode variar. A importação não anuncia imagens como carregadas somente por existir uma URL.

Capas e retratos Deezer são guardados em `.scratches/artwork/` ao carregar na interface. A cópia local continua disponível após reiniciar e dispensa outra consulta ao CDN. A origem e os metadados importados permanecem intactos. Uploads e imagens já incorporadas continuam usando os dados locais existentes. Uma falha de rede não fica gravada como imagem: a interface tenta novamente após 35 segundos ou quando a conexão retorna.

Para preparar também as imagens das outras páginas, execute `npm run catalogo:capas`. O comando reaproveita o cache, limita o tamanho das imagens e interrompe a carga após quatro falhas consecutivas. Um erro 403 do provedor, inclusive por bloqueio de uma saída VPN, impede novos downloads; o cache só consegue preservar imagens que tenham sido recuperadas com sucesso. As imagens são privadas desta instalação e ficam fora dos pacotes públicos e atualizações.

Ao terminar, recarregue a aba do Scratches. A preparação e o build preservam o catálogo local. Essa operação não publica dados no GitHub e não muda automaticamente a distribuição pública vazia.
