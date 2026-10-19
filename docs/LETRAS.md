# Letras automáticas e pesquisa local

Ao abrir um catálogo, o Scratches inicia a consulta de letras no LRCLIB. Não é necessário colar uma letra para começar a pesquisar. A quantidade já disponível e o andamento aparecem na aplicação; as novas letras entram na pesquisa sem precisar recarregar a página.

O serviço é consultado pela API documentada, com identificação do aplicativo, chamadas sequenciais e espera entre consultas. Respostas 429 respeitam `Retry-After`. Nenhum conteúdo é publicado no LRCLIB. Apenas título, artista, álbum e duração são enviados para a busca; projetos e textos pessoais não acompanham a consulta.

Uma correspondência exige título, artista e duração com diferença máxima de dois segundos. Versões ao vivo, acústicas e remixes não são misturadas com a gravação de estúdio. Uma busca alternativa pode encontrar a mesma gravação em outro álbum, mas candidatos igualmente classificados com textos diferentes são recusados. Isso é uma associação por metadados, sem validação contra áudio ou ISRC. A referência da fonte fica junto à letra.

As letras ficam no espaço local, pesquisáveis por palavras e frases. Não há inferência semântica, treinamento de IA nem tradução nesta etapa. Instrumentais e músicas sem correspondência são contados separadamente das falhas de consulta. Ao fim da carga, consultas com falha recebem mais uma tentativa. Resultados ausentes ficam em cache por sete dias; falhas persistentes, por uma hora. Aberturas seguintes retomam os itens pendentes. Letras existentes, correções, projetos e seleções são preservados.

Antes de cada carga, uma cópia do espaço é guardada em `.scratches/antes-letras-<data>.json`. O relatório por música fica em `.scratches/lyrics-index.json`, sem repetir o corpo das letras. O espaço e os relatórios não entram nos commits nem nos pacotes de atualização. A alternativa de adicionar uma versão própria permanece opcional.

A API aberta não garante cobertura integral nem comprova uma licença para redistribuir um acervo de letras com o aplicativo. Esta integração consulta o serviço para a instalação local; publicar letras num pacote do GitHub ou num catálogo compartilhado exige tratar os direitos desse conteúdo separadamente. A licença do software do LRCLIB não deve ser confundida com a das composições.

Fonte: [documentação oficial do LRCLIB](https://lrclib.net/docs).
