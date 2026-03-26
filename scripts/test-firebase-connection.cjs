const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function getDatabaseId() {
  if (process.env.FIRESTORE_DATABASE_ID) {
    return process.env.FIRESTORE_DATABASE_ID;
  }

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) return '(default)';

  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return cfg.firestoreDatabaseId || '(default)';
  } catch {
    return '(default)';
  }
}

async function main() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS não definido no .env.local');
  }
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Arquivo de credenciais não encontrado: ${credentialsPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const databaseId = getDatabaseId();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const db = databaseId === '(default)'
    ? getFirestore(admin.app())
    : getFirestore(admin.app(), databaseId);

  const docRef = db.collection('_healthcheck').doc('connection-test');
  await docRef.set(
    {
      ok: true,
      checkedAt: new Date().toISOString(),
      source: 'local-script',
    },
    { merge: true },
  );

  const snap = await docRef.get();

  console.log('[Firebase][ok] conexão Firestore válida');
  console.log('projectId:', serviceAccount.project_id);
  console.log('databaseId:', databaseId);
  console.log('docPath:', docRef.path);
  console.log('docExists:', snap.exists);
}

main().catch((error) => {
  console.error('[Firebase][erro]', error.message);
  process.exit(1);
});
