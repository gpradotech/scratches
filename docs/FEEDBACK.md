# Feedback sem exposição do destinatário

O formulário do rodapé envia tipo, mensagem e, opcionalmente, o endereço de resposta informado pelo usuário. Projetos, letras, catálogo, arquivos e histórico não são anexados. O rascunho permanece na janela ao fechar o modal e em caso de falha. Uma tentativa repetida sem editar os campos usa a mesma chave de idempotência.

## Separação entre aplicação e servidor hospedado

- A aplicação distribuída usa `/api/feedback`, implementado em `lib/feedback-api.mjs`, para encaminhar a solicitação ao receptor HTTPS público.
- Apenas a URL pública do receptor entra em `lib/feedback-config.mjs`. Em desenvolvimento também é possível usar `SCRATCHES_FEEDBACK_ENDPOINT` no processo do servidor local.
- O receptor separado está em `servicos/feedback/server.mjs`. Ele usa a API do Resend e não faz parte do pacote de atualização local.
- `RESEND_API_KEY`, `FEEDBACK_FROM` e `FEEDBACK_TO` são definidos exclusivamente nas variáveis privadas da hospedagem. Nunca usar prefixo `VITE_`, preencher arquivos versionados ou colocar esses valores na aplicação distribuída.

O receptor pode iniciar com `node servicos/feedback/server.mjs` no servidor hospedado, atrás de HTTPS, usando `PORT` fornecida pelo ambiente. A hospedagem deve configurar limites de tráfego no proxy; o receptor inclui um limite adicional de cinco tentativas por dez minutos por endereço de conexão. A configuração da hospedagem, o domínio remetente verificado e a chave de envio do Resend são necessários antes de ativar o envio real.

### Hospedagem PHP

`servicos/feedback/php/` oferece o mesmo contrato em PHP 8.2 ou superior, com as extensões cURL e mbstring. Isso permite usar hospedagens sem um processo Node.js permanente. O arquivo público de implantação contém somente `index.php`, `receiver.php` e `.htaccess`.

A configuração real deve ficar em `$HOME/.scratches-feedback/config.php`, fora de todas as pastas públicas, com as chaves `api_key`, `from` e `to`. `config.example.php` contém apenas o formato vazio e não entra no pacote público. Outra localização privada pode ser indicada por `SCRATCHES_FEEDBACK_CONFIG`; a entrada HTTP recusa arquivos de configuração dentro da raiz pública do serviço. O diretório privado precisa permitir gravação pelo PHP para manter o limite entre requisições e processos, com um arquivo protegido por lock. Ele guarda somente identificadores derivados do endereço de conexão e contadores temporários, sem mensagens.

O endereço de conexão usado para esse limite é `REMOTE_ADDR`; cabe verificar o comportamento do proxy da hospedagem antes da ativação. Cabeçalhos encaminhados pelo cliente não são usados para contornar o limite.

Validação local do receptor: `php tests/feedback-php.php`. A verificação HTTP usa `node tests/feedback-php-http.mjs`, com `PHP_BINARY` e, quando necessário, `PHP_EXTENSION_DIR` apontando para um runtime local. Os testes usam um provedor simulado e não enviam e-mails reais.

`GET /api/feedback` informa somente `{available: boolean}`. `POST /api/feedback` aceita apenas `id`, `kind`, `message` e `email`, valida o conteúdo e envia texto simples ao Resend. O cliente nunca escolhe destinatário ou remetente. Somente uma resposta bem-sucedida com identificador do Resend gera `{accepted: true}`. Erros do provedor e valores privados não são repassados ao navegador nem registrados em logs da aplicação.

Sem receptor configurado ou disponível, o modal informa que a mensagem não foi enviada e mantém o botão de envio desabilitado. Isso não representa uma entrega de e-mail testada.

## Identidade e publicação

Use a identidade privada `noreply` do GitHub nos metadados de autoria e de commit. Não publique endereços pessoais em documentos, interface, pacotes ou mensagens de commit. Backups de histórico e configurações privadas ficam em `.scratches/`, que é ignorado pelo Git e excluído dos pacotes.

`npm run check:privacy` procura o endereço pessoal configurado globalmente nesta máquina nos arquivos públicos, no build e nos metadados do commit atual. `build:release` exige essa conferência antes de gerar o pacote. `npm run check:privacy:history` audita também os metadados do histórico alcançável por branches e tags. O histórico público inicial foi preservado por decisão do responsável: remover o endereço da versão atual não o elimina de commits antigos nem de caches. Isso é uma proteção adicional local e não substitui a revisão dos arquivos que serão publicados.

Referências: [API de envio do Resend](https://resend.com/docs/api-reference/emails/send-email) e [privacidade do endereço de commit no GitHub](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address).
