# Scratches

Ferramenta local para DJs explorarem músicas e letras e organizarem trechos em projetos para suas linhas de scratch. O projeto está em desenvolvimento.

## Baixar e abrir

[Baixar Scratches 0.1.0 — ZIP limpo](https://github.com/gpradotech/scratches/releases/download/v0.1.0/scratches-0.1.0.zip) · [Versões e notas](https://github.com/gpradotech/scratches/releases)

Instale Node.js **22.19 ou superior**, extraia o ZIP inteiro em uma pasta com permissão de escrita e abra:

- **Windows:** `iniciar-prototipo.cmd`.
- **macOS:** no Terminal, entre na pasta extraída e execute `sh start.command`.
- **Qualquer sistema com Node.js:** execute `npm start` na pasta extraída.

Acesse **http://127.0.0.1:5174** no navegador. Mantenha o terminal aberto; encerre com Ctrl+C. O ZIP inclui a interface compilada e não exige `npm ci`, conta do GitHub ou token. O inicializador foi verificado no Windows; o macOS ainda não foi validado em hardware real.

Prefira o ZIP anexado à Release para usar a aplicação. Os arquivos automáticos **Source code** contêm o código para desenvolvimento e precisam de instalação de dependências e build.

## O que vem nesta versão

A distribuição começa **sem músicas, artistas, capas, letras, projetos, backups ou dados dos testes de desenvolvimento**. Explorar e Projetos abrem vazios. As integrações com APIs e a inclusão de um catálogo ainda estão em desenvolvimento; esta versão não pesquisa automaticamente um catálogo externo nem oferece cadastro de músicas pela interface. Adicionar letras e selecionar trechos dependem de músicas disponíveis em um catálogo fornecido separadamente.

A interface permite organizar trechos de letras em projetos e exportar/restaurar o espaço local quando houver conteúdo. A pesquisa de fragmentos é textual local. Não há busca semântica, download ou edição de áudio nesta versão.

## Seus dados

Projetos e letras ficam em `dados/prototipo-02/workspace.json`, criado conforme o uso. Use **Espaço local → Exportar backup** para guardar uma cópia. Restaurar um backup substitui os dados atuais. Catálogo, dados pessoais e estado de atualização ficam fora do Git e dos pacotes distribuídos.

Use **Verificar atualizações** no rodapé para consultar novas versões. A instalação oferece adiamento e preserva os dados locais. [Instalação e solução de problemas](docs/INSTALACAO.md) · [Atualizações](docs/ATUALIZACOES.md)

## Problemas e sugestões

Use **Enviar feedback** no rodapé ou abra uma [issue no GitHub](https://github.com/gpradotech/scratches/issues). O formulário envia somente os campos preenchidos; o endereço para resposta é opcional. Projetos, letras e arquivos não são anexados.

## Desenvolvimento

```sh
npm ci
npm run check
npm run build
npm test
npm run dev
```

O desenvolvimento usa http://127.0.0.1:5174; execute apenas uma instância por porta. Sem corpus local, a preparação cria um catálogo vazio e preserva um catálogo já existente. `npm run build:release` gera o pacote de atualização revisado por uma lista de arquivos permitidos e hashes SHA-256.

Somente arquivos necessários para manter e distribuir a aplicação entram neste repositório. Pesquisa, planejamento interno, referências visuais, dependências instaladas, credenciais e material pessoal permanecem fora dele.
