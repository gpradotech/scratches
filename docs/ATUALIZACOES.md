# Atualizações do Scratches

O Scratches consulta as Releases estáveis de `gpradotech/scratches`, sem exigir conta ou token de quem usa a aplicação. A consulta ocorre ao abrir e a cada seis horas enquanto o servidor estiver aberto. O rodapé permite verificar manualmente; consultas consecutivas respeitam um intervalo mínimo de um minuto, ETag e os prazos de rate limit do GitHub.

## Uso

- O aviso de nova versão oferece as notas, **Atualizar e reiniciar** e **Mais tarde**. O adiamento é lembrado por versão.
- O pacote é baixado e conferido antes de alterar a instalação. É possível cancelar durante o download ou a espera por trabalho pendente.
- A instalação espera os salvamentos e as seleções ainda não guardadas, além dos formulários abertos nas janelas conectadas. Janelas suspensas que tenham declarado trabalho pendente continuam bloqueando o reinício; fechar uma janela normalmente encerra sua sessão.
- Durante a troca, o servidor deixa de aceitar gravações. O inicializador aplica o pacote, inicia a nova versão na mesma porta e confirma somente depois do sinal de prontidão. A página reconecta automaticamente.
- Se a nova versão não iniciar, são restaurados os arquivos anteriores, suas dependências e o backup de projetos e letras. Isso detecta falhas de inicialização, não todos os defeitos funcionais posteriores.
- Uma cópia com `.git` é uma cópia de desenvolvimento: permite consultar versões, mas recusa a instalação pelo aplicativo. Isso protege alterações em andamento.
- Sem uma Release publicada, a interface informa essa ausência; não afirma que a cópia está atualizada.

## Inicialização

Para desenvolver, continue usando `npm run dev`. Para testar a distribuição, extraia o ZIP em outra pasta e use `npm start`. Os inicializadores `iniciar-app.cmd`, `start.command` e `npm start` usam `scripts/open-app.mjs`: mantêm o modo de desenvolvimento quando encontram `.git` e usam o processo supervisionado nas cópias de distribuição. O inicializador abre o navegador somente depois de conferir a página e a identidade da instalação; uma instância saudável da mesma pasta, versão e modo é reutilizada. Outra aplicação, instalação ou instância antiga na porta produz uma orientação e não é encerrada automaticamente. O encerramento da distribuição pelo inicializador é repassado ao supervisor e ao servidor para liberar a porta. No macOS, esse launcher ainda precisa de validação em um Mac real. Node.js 22.19 ou superior é necessário.

Projetos e letras continuam em `dados/prototipo-02/workspace.json`. O estado do atualizador fica em `.scratches/updates/`. Nenhuma dessas pastas faz parte do pacote de atualização. O catálogo local também fica fora do pacote e é preservado. Uma instalação nova, sem catálogo fornecido separadamente, abre com catálogo vazio. A integração com as futuras APIs será desenvolvida em outra etapa.

## Formato e recuperação

O pacote usa JSON comprimido com gzip, versão do protocolo e SHA-256 por arquivo. Só é aceita uma tag estável `vMAJOR.MINOR.PATCH` mais recente, com asset `scratches-VERSAO.update.json.gz`, URL do repositório esperado e digest SHA-256 informado pelo GitHub. O pacote tem limite de 32 MiB comprimidos e 96 MiB descompactados. Caminhos absolutos, travessia, atalhos, colisões de caixa e arquivos pessoais são recusados.

A origem é autenticada pelo repositório fixo e HTTPS. Os hashes verificam integridade; não constituem assinatura digital independente. Não se desativa a verificação TLS para contornar erros de rede.

Pacotes, backups e diário ficam em `.scratches/updates/`. Uma instalação interrompida é restaurada antes da próxima inicialização. Backups são preservados; não há limpeza automática. Se a preparação de dependências falhar, a instalação anterior permanece no lugar. A publicação de futuras migrações de dados exige testes de ida e restauração; o protocolo atual guarda o arquivo completo antes da troca.

## Preparar uma versão

### Estrutura do código e compatibilidade com a primeira distribuição

A aplicação atual fica em `app/`, na raiz do código-fonte. A Release v0.1.0 já publicada conserva a estrutura anterior; seus arquivos e hashes não devem ser substituídos. O caminho dos dados pessoais continua em `dados/prototipo-02/workspace.json` para preservar as instalações existentes.

O atualizador incluído na v0.1.0 valida uma lista de caminhos da estrutura anterior. A versão 0.2.0 gera um pacote compatível com essa lista, mantendo os caminhos antigos apenas no runtime distribuído. O código-fonte continua em `app/`. O pacote foi validado com o decoder e instalador reais da v0.1.0, incluindo inicialização, restauração e preservação de catálogo e workspace. O ZIP usa `iniciar-app.cmd`; a atualização mantém e atualiza o nome de inicializador permitido pela instalação antiga.

O catálogo inicial público fica em `lib/seed/catalog.json`, com as imagens em `lib/seed/artwork/`. O servidor combina o catálogo inicial com os registros locais por ID, dando preferência aos registros locais e sem regravar o arquivo pessoal. Letras completas, projetos, workspace e caches pessoais continuam fora do pacote. As letras são obtidas automaticamente em cada instalação.

### Conferência para publicação

1. Revisar código, APIs, textos, dados distribuíveis e notas da versão. Atualizar `package.json` e `package-lock.json`, incluindo `packages[""].version`.
2. Executar `npm run check`, `npm test` e `npm run build:release`.
3. Conferir o manifesto produzido em `dist/scratches-VERSAO.update.manifest.json`. O ZIP para download, `dist/scratches-VERSAO.zip`, contém exatamente os mesmos arquivos validados do pacote de atualização, dentro de uma pasta com o nome da versão. Ambos têm um arquivo `.sha256`. O empacotador usa uma lista de arquivos permitidos: runtime, frontend compilado, manifestos de dependências, inicializadores e documentação de atualização. Não inclui pesquisa, planejamento, referências visuais, protótipo 01, testes de desenvolvimento, mapas de código, `.env`, Git, caches, `node_modules`, catálogo pessoal, projetos ou letras.
4. Revisar os arquivos selecionados para publicação. Não usar `git add .` ou enviar a pasta local inteira. Um arquivo ignorado pelo Git ainda precisa ser excluído pelo empacotador; os dois controles são independentes.
5. Só após essa revisão, publicar o código correspondente e criar uma Release em rascunho. Anexar o ZIP, o pacote de atualização e seus arquivos `.sha256`; comparar o digest de cada asset com o hash local. Extrair o ZIP em outra pasta e conferir a primeira abertura sem dependências ou dados de desenvolvimento.
6. Publicar a Release como estável e latest somente quando os arquivos e testes estiverem completos. Conferir o endpoint público. Um push em `main` não anuncia atualização automática.

O repositório público contém o código revisado e o catálogo inicial de metadados públicos autorizado para distribuição. O histórico de pesquisa e os dados pessoais de desenvolvimento não são enviados. A versão 0.1.0 abria vazia; a versão 0.2.0 inclui 951 músicas e capas, preservando o espaço pessoal de cada instalação.
