# ChatBot Leads

Automação para enviar uma imagem com legenda via WhatsApp para uma lista de números lida de uma planilha do Google Sheets sem utilizar a API oficial do WhatsApp.

## Como Funciona
- Usa `whatsapp-web.js` com autenticação local (`LocalAuth`). Na primeira execução, mostra um QR Code no terminal para parear com o WhatsApp.
- Lê números de telefone do Google Sheets em modo somente leitura (Conta de Serviço do Google).
- Normaliza os números para incluir o DDI do Brasil (`55`) quando ausente e verifica se possuem WhatsApp antes do envio.
- Envia uma imagem (`images/foto.jpeg`) com a legenda definida em `mensagem.js`.
- Registra logs de progresso e aplica pequenas pausas entre envios.

## Requisitos
- Node.js 18+ e npm.
- Acesso ao WhatsApp do celular para escanear o QR Code.
- Uma planilha no Google Sheets com a coluna A contendo os números (um por linha), a partir da linha 2.
- Uma Conta de Serviço do Google com acesso de leitura à planilha e um arquivo de credenciais JSON local (não versionado).

## Instalação
1. Instale as dependências:
   ```bash
   npm install
   ```

## Configuração
- Credenciais Google: salve o JSON da Conta de Serviço como `credentialsSetembro.json` na raiz do projeto (não publique este arquivo).
- Compartilhe a planilha com o e-mail da sua Conta de Serviço (permissão de leitura).
- Em `bot.js`:
  - `SPREADSHEET_ID`: ID da planilha (trecho da URL entre `/d/` e `/edit`).
  - `RANGE`: intervalo a ser lido (ex.: `numeros!A2:A`), respeitando exatamente o nome da aba.
  - `IMAGE_PATH`: caminho da imagem enviada (padrão: `images/foto.jpeg`).
- Mensagem: edite o texto em `mensagem.js` (exporta uma string via `module.exports`).

## Execução
- Inicie o bot:
  ```bash
  npm start
  ```
- Escaneie o QR Code no terminal (WhatsApp > Aparelhos conectados > Conectar um aparelho).
- Após conectar, o bot lê a planilha e começa os envios, exibindo logs.

## Formato da Planilha
- Coluna A (a partir da linha 2): números, com ou sem DDI/DDD. Exemplos:
  - `11987654321`
  - `5511987654321`
- O código remove caracteres não numéricos e insere `55` se estiver ausente.

## Comportamento de Envio
- Verificação: usa `getNumberId` para confirmar se o número possui WhatsApp antes de enviar.
- Intervalos: faz uma pausa curta entre envios para reduzir risco de bloqueio.
- Mídia: envia a imagem configurada com a legenda de `mensagem.js`.

## Estrutura do Projeto (resumo)
```
.
├─ bot.js               # Lógica principal
├─ mensagem.js          # Texto da legenda (module.exports)
├─ credentialsSetembro.json  # Credenciais (local, não versionar)
├─ images/
│  └─ foto.jpeg         # Mídia enviada
├─ package.json
└─ README.md
```

## Boas Práticas e Considerações
- Consentimento: envie apenas para contatos que autorizaram o recebimento.
- Limites: evite grandes rajadas; aumente intervalos se necessário e faça testes com poucos números primeiro.
- Confiabilidade: confirme o compartilhamento da planilha com a Conta de Serviço e valide `SPREADSHEET_ID`/`RANGE`.
- Sessão WhatsApp: a autenticação local persiste entre execuções. Para reconectar do zero, apague a pasta de sessão criada pelo `whatsapp-web.js` e pareie novamente.

## Solução de Problemas
- Falha de autenticação: remova a pasta de sessão local e faça o pareamento de novo; garanta internet no celular.
- Número sem WhatsApp: o log indicará e o envio será pulado.
- Erro ao ler planilha: verifique `SPREADSHEET_ID`, `RANGE`, compartilhamento e a existência do arquivo de credenciais.
- Erro ao carregar mensagem: confira se `mensagem.js` exporta uma string (`module.exports = '...'`).
- Erro ao carregar imagem: revise o caminho em `IMAGE_PATH` e se o arquivo existe.

## Personalização
- Imagem: altere `IMAGE_PATH` em `bot.js`.
- Mensagem: edite `mensagem.js` ou adapte o código para ler de outro local (ex.: variável de ambiente, banco, etc.).
- Intervalos/logs: ajuste os `sleep` e mensagens de log em `bot.js` conforme a necessidade.

> Importante: não armazene nem publique credenciais em repositórios públicos.

