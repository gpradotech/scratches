# Aplicação — exploração local

Interface navegável baseada nas telas de exploração de músicas/artistas. Funciona sem login, senha ou conta remota. O espaço local reúne projetos, letras adicionadas e trechos salvos.

## Abrir

Na raiz do projeto, execute `npm run dev` ou abra `iniciar-app.cmd`. Endereço: **http://127.0.0.1:5174**. Para encerrar, Ctrl + C no terminal. Node 22.19+ e as dependências do projeto são necessários; nesta máquina já estão instalados. Em outra instalação, executar `npm ci` antes.

A preparação padrão cria um catálogo vazio ou preserva o catálogo existente, mesmo quando há material privado de pesquisa na máquina. O corpus de desenvolvimento só é carregado explicitamente com `node app/scripts/preparar-catalogo.mjs --development`. Músicas adicionadas e edições são persistidas no espaço local. Use **Explorar → Adicionar música**, consulte Deezer/Apple (iTunes) ou preencha os campos manualmente. Na página de uma música importada, use **Complementar metadados**: os valores do serviço ficam protegidos, e campos ausentes preenchidos por você são identificados como registros manuais. Músicas cadastradas manualmente continuam com **Editar metadados**. A origem de cada campo é preservada no espaço local e no backup. Não há consulta ou download de Spotify em tempo de execução. O protótipo 01 permanece disponível com `npm run dev:01`, na porta 5173.

Ao adicionar uma versão própria da letra, origem/referência começa vazia e é opcional. Texto digitado desativa a importação; use Limpar texto para trocar de método. Um .txt importado aparece como prévia somente para leitura, com nome do arquivo e ação Remover arquivo para voltar à digitação ou escolher outro. A importação não preenche a origem automaticamente.

## Experimentar

1. Clique no campo de busca ou use Ctrl + K (Cmd + K no Mac). A lista se expande logo abaixo do próprio campo, sem modal ou bloqueio da página. A mesma consulta pesquisa artistas, títulos de músicas e trechos nas letras locais, sem escolher uma modalidade. Enter abre os resultados; as setas permitem escolher diretamente um artista, música ou trecho. Esc, clique fora ou Tab para outro controle recolhem a lista. Os filtros ativos são preservados. Nas demais páginas, Ctrl + K retorna a Explorar e foca o mesmo campo, sem criar outra barra.
2. Pesquise um artista ou título disponível no catálogo. Abra a música, o artista ou o álbum para explorar suas referências.
3. Abra a música para consultar a letra obtida automaticamente. Caso queira acrescentar uma versão própria, importe .txt ou cole o texto com uma referência de origem opcional. Em Informações opcionais para os filtros, use o select múltiplo Idiomas: pesquise por nome ou código e selecione quantos idiomas precisar. O catálogo internacional é local; se um nome não aparecer, use Adicionar para incluí-lo. Remova seleções pelo X ou limpe o campo. A música será encontrada ao filtrar por qualquer idioma selecionado. Sem seleção significa não informado. Letras antigas com um único idioma continuam compatíveis. Tema e clima também podem ser informados.
4. Selecione palavras/versos com o mouse e clique Adicionar seleção; alternativamente clique nos números das linhas. Shift + clique marca um intervalo. Adicione vários trechos, sem limite artificial de dois.
5. Clique Adicionar a projeto. Escolha um projeto existente ou crie um novo ao salvar. Repetir o mesmo intervalo na mesma versão da letra informa que ele já está salvo.
6. Abra Projetos e alterne Por música/Por trechos. Ver na letra retorna ao contexto; se a letra tiver mudado, a cópia do trecho guardado continua preservada.
7. Abra Espaço local para exportar ou restaurar um backup JSON. Restauração exibe uma conferência antes de substituir a coleção.

## Persistência e privacidade local

Os dados são gravados em `dados/prototipo-02/workspace.json`, fora do Git. O arquivo é compartilhado entre janelas/navegadores da mesma instalação. Não há contas individuais ou isolamento entre pessoas que acessam a máquina. A persistência não depende de localStorage e é separada do protótipo 01. A API só aceita acesso local e origem correspondente; gravações usam revisão e arquivo temporário para evitar sobrescrever alterações de uma janela desatualizada.

Se houver conflito, a tela mantém a seleção e oferece Recarregar arquivo; confira o espaço atualizado e salve novamente. Se um arquivo estiver inválido, ele não é apagado nem reinicializado automaticamente. Exportar backup é a forma de levar projetos e textos a outra instalação. O catálogo original deve acompanhar a instalação para conservar os metadados; trechos de músicas fora do catálogo continuam preservados no backup.

## Dados disponíveis e limites

- Catálogo de descoberta alimentado por consultas reais ao Deezer, com prioridade editorial para rap e hip-hop brasileiro e repertório de outros gêneros e países. A seleção e sua ampliação são descritas em [Popular catálogo](../docs/POPULAR-CATALOGO.md). Uma carga não representa discografias completas.
- Endereços de capas e retratos vêm da fonte; cópias locais já salvas são preservadas. A disponibilidade de imagens externas pode variar.
- BPM e outros campos só são preenchidos quando retornados pela fonte. Não há medição contra áudio nem inferência de tonalidade ou idioma. Gênero é do álbum, não uma inferência sobre cada faixa.
- Letras são obtidas automaticamente via LRCLIB, associadas por título, artista e duração, e pesquisadas localmente. A cobertura é parcial e aparece na aplicação. Veja [Letras automáticas](../docs/LETRAS.md). O cadastro de uma versão própria é opcional.
- Pesquisa de fragmentos é textual, tolerante a acentos, com suporte a frases que cruzam duas linhas. Não há motor semântico ou IA escondido atrás dessa busca.
- Sem áudio, waveform, timestamps presumidos, edição ou gravação de scratch.
- Backup até 8 MB; cada texto até 100 mil caracteres. Esses limites técnicos do experimento não impõem conexões em pares.

## Desenvolvimento

`npm run check`, `npm test` e `npm run build` na raiz. O preview usa `npm run preview` em http://127.0.0.1:4174 e inclui a API local; não abrir `dist/index.html` diretamente. O preview e o desenvolvimento compartilham o mesmo arquivo: usar apenas um servidor por vez para editar dados.

Referências e tokens estão em [DESIGN.md](DESIGN.md). As [premissas atuais](../planejamento/premissas-produto.md) substituem os antigos estados com login. Nenhum serviço de autenticação, conta em nuvem ou dependência de IA foi adicionado.
