const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const qrcode = require('qrcode-terminal');
const creds = require('./credentialsMaio.json');

// === CONFIG ===
const SPREADSHEET_ID = '11INgMPzX0_xBxhWS1OoTlwrNJBN6hUr85AFufIKB7xw';
const RANGE = 'numeros!A2:A'; // ajuste para o nome EXATO da sua aba
const IMAGE_PATH = path.resolve(__dirname, 'images', 'foto.jpeg');
let mensagem;
try {
  mensagem = require('./mensagem');
  if (typeof mensagem !== 'string' || !mensagem.trim()) {
    throw new Error('mensagem exportada não é uma string válida.');
  }
} catch (err) {
  console.error('❌ Não foi possível carregar a mensagem de ./mensagem.js:', err?.message || err);
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/pedroslopez/whatsapp-web.js/main/web.js'
  },
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

client.once('ready', async () => {
  console.log('✅ WhatsApp conectado. Aguardando inicialização...');
  await sleep(3000); // aguarda módulos internos do WhatsApp Web carregarem
  console.log('📡 Lendo planilha...');

  let numeros = [];
  try {
    numeros = await fetchNumeros();
  } catch (e) {
    console.error('❌ Erro ao ler a planilha:', e?.message || e);
    process.exit(1);
  }

  console.log(`📋 ${numeros.length} números obtidos.`);

  // Verifica existência do arquivo de mídia
  const media = MessageMedia.fromFilePath(IMAGE_PATH);

  for (const raw of numeros) {
    const limpo = (raw || '').toString().replace(/\D/g, '');
    if (!limpo) continue;

    // Normaliza: garante DDI 55
    const withDDI = limpo.startsWith('55') ? limpo : `55${limpo}`;

    let numberId = null;
    try {
      numberId = await client.getNumberId(withDDI); // método mais estável
    } catch (e) {
      console.warn(`⚠️ Falha ao consultar ${withDDI}: ${e?.message || e}`);
      await sleep(1000);
      continue;
    }

    if (!numberId) {
      console.warn(`❌ ${withDDI} não possui WhatsApp. Pulando...`);
      await sleep(1000);
      continue;
    }

    try {
      await client.sendMessage(numberId._serialized, media, { caption: mensagem });
      console.log(`✅ Enviado para ${withDDI}`);
      await sleep(1500); // pausa mais segura
    } catch (err) {
      console.error(`❌ Erro ao enviar para ${withDDI}: ${err?.message || err}`);
      await sleep(1500);
    }
  }

  console.log('🏁 Envio finalizado.');
  process.exit(0);
});

async function fetchNumeros() {
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

  // Retorna a primeira coluna com trim, ignorando vazios
  return (res.data.values || [])
    .map(row => (row[0] || '').toString().trim())
    .filter(v => !!v);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

client.initialize();
