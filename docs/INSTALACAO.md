# Scratches

Pesquisa para suas linhas de scratch. Explore músicas e letras e reúna trechos em projetos salvos no seu computador.

## Abrir a aplicação

É necessário ter Node.js 22.19 ou superior instalado. Extraia todos os arquivos do pacote antes de abrir a aplicação.

- **Windows:** abra `iniciar-prototipo.cmd`.
- **macOS:** entre na pasta extraída pelo Terminal e execute `sh start.command`.
- **Terminal:** execute `npm start` na pasta extraída.

Acesse **http://127.0.0.1:5174**. Mantenha o processo aberto enquanto usar a aplicação. Para encerrar, use Ctrl+C no terminal.

O pacote inclui a interface compilada e o servidor local; não exige instalar dependências de desenvolvimento. Se a porta já estiver ocupada, confira se o Scratches está aberto em outra janela antes de iniciar uma segunda instância.

## Dados e backups

Seus projetos e letras ficam em `dados/prototipo-02/workspace.json`. Use **Espaço local → Exportar backup** para guardar uma cópia. A restauração substitui os dados atuais.

O catálogo é separado do código e preservado durante atualizações. Uma instalação sem catálogo abre com uma coleção vazia. As integrações com APIs serão disponibilizadas em versões futuras, conforme forem concluídas e revisadas.

Esta distribuição começa sem músicas, artistas, capas, letras e projetos de desenvolvimento. Ainda não há cadastro de músicas pela interface nem pesquisa automática em um catálogo externo. Adicionar letras e selecionar trechos dependem de músicas de um catálogo fornecido separadamente. A primeira abertura vazia é o comportamento esperado.

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
- Os arquivos **Source code** do GitHub exigem `npm ci` e `npm run build`. O ZIP `scratches-0.1.0.zip` já inclui a interface compilada.

O inicializador foi verificado no Windows. A execução em macOS ainda precisa de validação em um Mac real.
