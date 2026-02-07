const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
const targetDir = path.resolve(__dirname, '..', 'src', 'environments');

if (!fs.existsSync(envPath)) {
  console.error('ERROR: .env file not found! Copy .env.example to .env and fill in your Firebase keys.');
  process.exit(1);
}

// Parse .env
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const fileContent = `// Auto-generated from .env — do not edit manually
export const environment = {
  production: false,
  firebase: {
    apiKey: '${env.FIREBASE_API_KEY}',
    authDomain: '${env.FIREBASE_AUTH_DOMAIN}',
    projectId: '${env.FIREBASE_PROJECT_ID}',
    storageBucket: '${env.FIREBASE_STORAGE_BUCKET}',
    messagingSenderId: '${env.FIREBASE_MESSAGING_SENDER_ID}',
    appId: '${env.FIREBASE_APP_ID}',
  },
};
`;

const prodContent = fileContent.replace('production: false', 'production: true');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(path.join(targetDir, 'environment.ts'), fileContent);
fs.writeFileSync(path.join(targetDir, 'environment.prod.ts'), prodContent);

console.log('✓ Environment files generated from .env');
