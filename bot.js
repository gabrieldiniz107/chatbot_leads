const path = require('path');
const fs = require('fs');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const qrcode = require('qrcode-terminal');
const creds = require('./credentialsMaio.json');

// === CONFIG ===
const SPREADSHEET_ID = '11INgMPzX0_xBxhWS1OoTlwrNJBN6hUr85AFufIKB7xw';
const RANGE = 'numeros!A2:C'; // coluna A = nome, coluna B = número 1, coluna C = número 2 (opcional). ajuste para o nome EXATO da sua aba
const IMAGES_DIR = path.resolve(__dirname, 'images');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
let mensagem;
try {
  mensagem = require('./mensagem');
  if (typeof mensagem !== 'function') {
    throw new Error('mensagem exportada não é uma função válida (esperado: (nome) => string).');
  }
} catch (err) {
  console.error('❌ Não foi possível carregar a mensagem de ./mensagem.js:', err?.message || err);
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  }
});

// === Eventos úteis para depuração ===
client.on('qr', qr => {
  console.log('📲 Escaneie o QR Code:');
  qrcode.generate(qr, { small: true });
});

client.on('auth_failure', m => console.error('❌ Falha de autenticação:', m));
client.on('disconnected', r => console.warn('⚠️ Desconectado:', r));
client.on('change_state', s => console.log('ℹ️ Estado:', s));
client.on('loading_screen', (percent, msg) => console.log(`⏳ Carregando ${percent}% - ${msg}`));
client.on('authenticated', () => console.log('🔐 Autenticado, sincronizando...'));

client.once('ready', async () => {
  console.log('✅ WhatsApp conectado. Aguardando inicialização...');
  await sleep(5000); // aguarda módulos internos do WhatsApp Web carregarem
  console.log('📡 Lendo planilha...');

  let contatos = [];
  try {
    contatos = await fetchContatos();
  } catch (e) {
    console.error('❌ Erro ao ler a planilha:', e?.message || e);
    process.exit(1);
  }

  console.log(`📋 ${contatos.length} contatos obtidos.`);

  // Verifica se há imagens na pasta images/
  const imagePaths = findImages(IMAGES_DIR);
  let media = null;

  if (imagePaths.length > 0) {
    media = MessageMedia.fromFilePath(imagePaths[0]);
    console.log(`🖼️ Imagem encontrada: ${path.basename(imagePaths[0])}`);
    if (imagePaths.length > 1) {
      console.log(`ℹ️ ${imagePaths.length} imagens encontradas, usando a primeira: ${path.basename(imagePaths[0])}`);
    }
  } else {
    console.log('📝 Nenhuma imagem encontrada em images/. Enviando somente texto.');
  }

  for (const contato of contatos) {
    const nome = (contato.nome || '').toString().trim() || 'cliente';
    const textoMensagem = mensagem(nome);

    for (const raw of contato.numeros) {
      const limpo = (raw || '').toString().replace(/\D/g, '');
      if (!limpo) continue;

      // Normaliza: garante DDI 55
      const withDDI = limpo.startsWith('55') ? limpo : `55${limpo}`;

      let numberId = null;
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        try {
          numberId = await client.getNumberId(withDDI);
          break;
        } catch (e) {
          console.warn(`⚠️ Falha ao consultar ${withDDI} (tentativa ${tentativa + 1}/3): ${e?.message || e}`);
          await sleep(2000 * (tentativa + 1));
        }
      }

      if (!numberId) {
        console.warn(`❌ ${withDDI} não possui WhatsApp. Pulando...`);
        await sleep(1000);
        continue;
      }

      try {
        if (media) {
          await client.sendMessage(numberId._serialized, media, { caption: textoMensagem });
        } else {
          await client.sendMessage(numberId._serialized, textoMensagem);
        }
        console.log(`✅ Enviado para ${nome} (${withDDI})`);
        await sleep(1500); // pausa mais segura
      } catch (err) {
        console.error(`❌ Erro ao enviar para ${withDDI}: ${err?.message || err}`);
        await sleep(1500);
      }
    }
  }

  console.log('🏁 Envio finalizado.');
  process.exit(0);
});

async function fetchContatos() {
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE
  });

  // Coluna A = nome, colunas B e C = números (C é opcional). Ignora linhas sem nenhum número.
  return (res.data.values || [])
    .map(row => ({
      nome: (row[0] || '').toString().trim(),
      numeros: [row[1], row[2]]
        .map(v => (v || '').toString().trim())
        .filter(v => !!v)
    }))
    .filter(c => c.numeros.length > 0);
}

function findImages(dir) {
  try {
    const files = fs.readdirSync(dir);
    return files
      .filter(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .map(f => path.join(dir, f));
  } catch {
    return [];
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

client.initialize();
