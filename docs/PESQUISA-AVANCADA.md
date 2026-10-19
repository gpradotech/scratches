# Pesquisa avançada

Os operadores funcionam no campo principal de busca, nas sugestões e na página de resultados. O link **Pesquisa avançada**, à esquerda no rodapé da caixa de pesquisa, abre os exemplos na aplicação. Os atalhos de teclado ficam à direita.

| Operador | Exemplo | Resultado |
| --- | --- | --- |
| Aspas | `"amor e paz"` | Frase consecutiva, na ordem informada e com limites de palavras. |
| OR | `amor OR paz` | Um dos termos ou ambos. |
| AND | `amor AND paz` | Os dois termos na mesma música; podem estar em versos diferentes. |
| Exclusão | `amor -guerra` ou `amor -"frase exata"` | Exclui músicas com o termo ou a frase. |
| intitle: | `intitle:amor` | Título da música. |
| inlyric: | `inlyric:amor` | Texto das letras já indexadas. |
| album: | `album:"Sobrevivendo no Inferno"` | Título do álbum, EP, single ou outro lançamento. |
| artist: | `artist:Djonga` | Nomes dos artistas, incluindo participações. |

Exemplo combinado: `artist:Djonga AND inlyric:amor -inlyric:guerra`.

AND e OR precisam estar em maiúsculas. Prefixos de campos aceitam maiúsculas ou minúsculas. AND tem prioridade sobre OR: `intitle:amor OR artist:Djonga AND inlyric:paz` aceita título com amor, ou uma música de Djonga cuja letra contenha paz. Em consultas com operadores, termos separados por espaços também usam AND. Os filtros opcionais continuam sendo aplicados a todos os resultados.

Consultas comuns, sem operadores, preservam a busca por texto anterior: título e artistas no catálogo, texto nas letras. Prefixos permitem consultar o álbum ou combinar dados da música com a letra. Uma consulta exclusivamente de metadados não gera trechos sem correspondência na letra. Exclusões sem prefixo abrangem título, artistas, álbum e letra; exclusões com prefixo limitam-se ao campo indicado.

Maiúsculas e acentos não diferenciam resultados. Aspas também aceitam a forma tipográfica `“frase”`. Espaços e quebras de linha são equivalentes dentro de uma frase; a pontuação permanece literal. Uma frase não corresponde à ordem invertida nem a uma parte de outra palavra. Aspas abertas, campos vazios e operadores incompletos mostram uma orientação e não ampliam a pesquisa silenciosamente.

Trechos usam os intervalos do texto original, inclusive em frases que atravessam linhas e textos com acentos decompostos ou emoji. Refrões repetidos continuam agrupados por música. As letras e os metadados não são alterados pela busca.
