# Adicionar músicas e corrigir informações

1. Em **Explorar**, clique em **Adicionar música**, ao lado de **Lista | Galeria**. No catálogo vazio também aparece **Adicionar a primeira música**.
2. Informe o título e, se souber, o artista. Clique em **Buscar metadados**.
3. Escolha a gravação correta pelos dados de título, artista, álbum e duração. A busca tenta primeiro o Deezer; se não houver resultado ou a consulta falhar, tenta a Apple (iTunes). Também é possível trocar a fonte pelos botões apresentados.
4. Confira e edite os campos antes de **Salvar música**. O cadastro abre a página da música, onde você pode adicionar a letra e começar a selecionar trechos.

Se a música não for encontrada, ou se você estiver sem internet, use **Preencher manualmente**. Somente título e artista são obrigatórios. Em Duração, digite até seis números, da direita para a esquerda, no formato **HH:MM:SS**: `1` resulta em `00:00:01`; `325`, em `00:03:25`. Excedentes são convertidos: `61` vira `00:01:01` e `6100`, `01:01:00`. O máximo é `99:59:59`. Backspace apaga o último dígito digitado; selecionar tudo permite substituir ou limpar o tempo. No BPM, use até três dígitos e duas casas decimais, com teto 400; vírgula e ponto são aceitos. Deixe os campos desconhecidos vazios. Nos selects, **Não informado** é apenas um placeholder: use o X para limpar uma escolha. **Voltar à busca** retorna à etapa anterior e preserva o preenchimento.

Artistas e gêneros são seleções em chips: pesquise, escolha uma opção ou use **Adicionar como novo** para criar um nome. As criações locais são oferecidas primeiro nas próximas pesquisas. Artistas consultam Deezer e tentam Apple (iTunes) se necessário; gêneros usam a lista disponível no Deezer e também aceitam nomes próprios.

**Álbum** oferece apenas álbuns criados por você nesta aplicação. Digite um título para criar um novo ou escolha um álbum próprio já salvo. Os álbuns públicos retornados na busca de músicas continuam como dados da gravação encontrada, mas não são oferecidos para acrescentar outras músicas. Álbuns próprios são separados de lançamentos externos mesmo quando têm o mesmo título e artista.

Um **Single** comporta uma única música e fica indisponível para acrescentar outra faixa. Para ampliar esse lançamento, edite primeiro o tipo da música existente. Um **EP** vira **Álbum** automaticamente quando recebe a oitava faixa ou quando a soma das durações ultrapassa 30 minutos. A conversão atualiza todas as músicas do lançamento. Sete músicas com exatamente 30 minutos continuam sendo um EP.

**Idiomas** apresenta sugestões ao abrir. Use **Todos os idiomas** para navegar pela lista ISO 639-3, carregada em partes conforme a rolagem, ou pesquise pelo nome ou código. O catálogo acompanha a aplicação e funciona sem internet; nomes novos também podem ser criados.

**Gravadora** consulta o MusicBrainz enquanto você digita, combinando os resultados com nomes já salvos no seu acervo. Use **Adicionar como nova gravadora** se preferir cadastrar um nome próprio. Falhas da fonte não impedem o preenchimento manual.

Ao salvar a música, artistas, álbuns, gêneros, idiomas e gravadoras ficam guardados no espaço local para as próximas adições, mesmo depois de fechar a aplicação. Sem internet, as opções já salvas e o preenchimento manual continuam disponíveis. Cancelar um cadastro não cria metadados no acervo.

Gêneros, idiomas e gravadoras já existentes devem ser selecionados; a ação de criar não aparece para um nome equivalente, mesmo com diferenças de caixa ou acentuação. Artistas e álbuns podem ter nomes iguais e identidades diferentes. A ação **Adicionar** usa o mesmo ícone e visual em todos os campos. Gêneros e gravadoras apresentam somente seus nomes nas opções.

## Catálogo único

Todas as músicas disponíveis nesta instalação aparecem no mesmo **Catálogo**, com pesquisa, filtros e visualizações Lista/Galeria. A divisão entre catálogo geral e pessoal foi retirada. Backups da versão que tinha essa divisão continuam aceitos; as antigas seleções pessoais não ocultam músicas.

**Excluir música** aparece somente para cadastros manuais que você controla. A exclusão pede confirmação e oferece **Desfazer**. Letras, trechos e metadados reutilizáveis permanecem guardados. Músicas provenientes dos serviços ou do catálogo distribuído não oferecem essa exclusão.

Em **Capa**, cole um endereço ou clique em **Escolher imagem**. São aceitos PNG, JPG e WebP de até 10 MB. A aplicação reduz a imagem no próprio navegador e a guarda junto da música, inclusive no backup; o arquivo enviado não é mandado às fontes de metadados.

Na página de qualquer música, **Editar metadados** abre o formulário de correção. Você também pode consultar as fontes novamente. A edição mantém o identificador da música, suas letras e os trechos já salvos nos projetos. Músicas com o mesmo ID ou ISRC são reconhecidas para evitar cadastro duplicado.

Os dados disponíveis dependem da fonte. A consulta Deezer tenta obter os detalhes do álbum e suas informações de gênero e gravadora. BPM ausente ou zero fica desconhecido. Tom e modo não são inferidos; podem ser preenchidos manualmente. A consulta Apple fornece metadados e link para a loja; seus assets promocionais e áudio não são incorporados.

Os dados adicionados e editados ficam no arquivo local do espaço de trabalho e entram em **Espaço local → Exportar backup**. Restaurar um backup substitui essas informações, os projetos e as letras atuais; a revisão mostra as quantidades antes da confirmação. Backups antigos sem músicas continuam aceitos, com aviso.

Somente a pesquisa digitada e os identificadores escolhidos são enviados às fontes de metadados. Projetos e letras não são enviados. Ao consultar uma gravação no Deezer, a aplicação também conserva os retratos dos artistas. Quando consegue carregar a capa e as fotos, guarda cópias junto dos metadados para reutilização e backup. Se a fonte de imagens estiver indisponível, preserva os endereços para uma nova tentativa; o cadastro continua disponível. Imagens que ainda não foram salvas dependem da disponibilidade da fonte e da internet. Este fluxo adiciona músicas específicas ao acervo local; o catálogo global de descoberta continua sendo uma integração separada.


Referências das fontes: [API de gravadoras do MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API/Search) e [catálogo ISO 639-3](https://github.com/wooorm/iso-639-3). A consulta de gravadoras usa identificação da aplicação, cache e intervalo mínimo de 1,1 segundo entre requisições.
