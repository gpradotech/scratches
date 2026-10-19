# Scratches

Pesquisa para suas linhas de scratch. Explore músicas e letras e reúna trechos em projetos salvos no seu computador.

## Abrir a aplicação

É necessário ter Node.js 22.19 ou superior instalado. Extraia todos os arquivos do pacote antes de abrir a aplicação.

- **Windows:** abra `iniciar-app.cmd`.
- **macOS:** entre na pasta extraída pelo Terminal e execute `sh start.command`.
- **Terminal:** execute `npm start` na pasta extraída.

Acesse **http://127.0.0.1:5174**. O inicializador abre o navegador e reutiliza uma instância saudável já aberta desta mesma pasta. Mantenha o terminal que iniciou a aplicação aberto durante o uso. Para encerrar, use Ctrl+C nesse terminal.

O pacote inclui a interface compilada e o servidor local; não exige instalar dependências de desenvolvimento. Se a porta já estiver ocupada, confira se o Scratches está aberto em outra janela antes de iniciar uma segunda instância.

## Dados e backups

Suas músicas adicionadas ou editadas, projetos e letras ficam em `dados/prototipo-02/workspace.json`. Use **Espaço local → Exportar backup** para guardar uma cópia. A restauração substitui os dados atuais.

O acervo local é preservado durante atualizações. A versão 0.2.0 inclui um catálogo inicial de 951 músicas, com prioridade para rap e hip-hop brasileiro, além de outros gêneros e repertório internacional. As capas estão incluídas no download e carregam sem depender da conexão com o Deezer.

Seus projetos e dados pessoais não acompanham a distribuição. As letras são obtidas automaticamente pelo LRCLIB em cada instalação, conforme disponibilidade, e indexadas localmente; os textos completos não são redistribuídos no pacote. A primeira sincronização precisa de internet e a cobertura pode ser parcial.

Em **Explorar → Adicionar música**, busque o título e o artista, escolha uma versão e confira os metadados antes de salvar. A consulta tenta Deezer e Apple (iTunes). Se necessário, use **Preencher manualmente**. Metadados importados são protegidos; informações faltantes podem ser complementadas e ficam identificadas como registros manuais.

O link **Pesquisa avançada**, à esquerda do rodapé da caixa de busca, explica aspas, AND, OR, exclusões e os campos intitle:, inlyric:, album: e artist:.

## Atualizações

Use **Verificar atualizações** no rodapé. Quando houver uma versão disponível, você poderá atualizar ou escolher **Mais tarde**. A aplicação aguardará salvamentos e trechos pendentes e reconectará a página após o reinício.

Se a nova versão não iniciar, o inicializador restaura a anterior e o backup dos projetos e letras. Mantenha também seus próprios backups.

## Feedback

Use **Enviar feedback** no rodapé da aplicação ou abra uma [issue no GitHub](https://github.com/gpradotech/scratches/issues). O formulário reúne problemas e sugestões sem abrir seu aplicativo de e-mail e informa quando o serviço está indisponível.

## Solução de problemas

- Se `node` ou `npm` não for encontrado, instale Node.js 22.19 ou superior e reabra o terminal.
- Extraia o ZIP inteiro; abrir o inicializador dentro do arquivo compactado não instala a aplicação.
- Se o endereço não abrir, confira se o terminal continua aberto e se outra instância já está usando a porta 5174. Não apague os dados para liberar uma porta.
- Use uma pasta com permissão de escrita, pois os dados são salvos ao lado da aplicação.
- Os arquivos **Source code** do GitHub exigem `npm ci` e `npm run build`. O ZIP `scratches-0.2.0.zip` já inclui a interface compilada e o catálogo inicial.

O inicializador foi verificado no Windows. A execução em macOS ainda precisa de validação em um Mac real.

## Preview

![Explorar](docs/images/scratches-preview.png)

## Desenvolvimento

O código-fonte está em `app/`. Use `npm ci` e `npm run dev`. Para gerar a distribuição compilada e populada, execute `npm run build:release`. Os dados pessoais permanecem fora do Git.
