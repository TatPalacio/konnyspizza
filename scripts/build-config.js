/* Genera js/config.js para el navegador.
   Lee las mismas tres variables de dos sitios, sin dependencias:
   - process.env gana si el valor no está vacío (así sigue el build de Vercel).
   - Si no, usa el archivo .env de esta app (arranque local, gitignorado).
   El HTML no puede leer .env: por eso el resultado se vuelca a js/config.js.
   Ese archivo se versiona solo como plantilla vacía. No imprimas ni subas claves. */
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..');
const envPath = path.join(appDir, '.env');
const outPath = path.join(appDir, 'js', 'config.js');

/** Parser mínimo de .env (KEY=valor, comentarios # y comillas opcionales). */
function readDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const vars = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function pick(name, fileVars, fallback) {
  const fromProcess = process.env[name];
  if (fromProcess !== undefined && String(fromProcess).trim() !== '') return String(fromProcess).trim();
  const fromFile = fileVars[name];
  if (fromFile !== undefined && String(fromFile).trim() !== '') return String(fromFile).trim();
  return fallback;
}

const fileVars = readDotEnv(envPath);
const cfg = {
  SUPABASE_URL: pick('SUPABASE_URL', fileVars, ''),
  SUPABASE_ANON_KEY: pick('SUPABASE_ANON_KEY', fileVars, ''),
  ADMIN_PASSWORD: pick('ADMIN_PASSWORD', fileVars, 'konys2026'),
};

const banner = `/* Generado por scripts/build-config.js.
   Origen: process.env (Vercel) o, en local, el archivo .env de esta carpeta.
   SUPABASE_URL vacío = modo demo (localStorage). No subas este archivo con claves.
   ADMIN_PASSWORD solo oculta el panel. Nunca pongas aquí la service_role key. */
`;
fs.writeFileSync(outPath, `${banner}window.KONYS_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);

const modo = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? 'Supabase configurado' : 'modo demo (faltan SUPABASE_URL o SUPABASE_ANON_KEY)';
console.log('js/config.js generado:', modo);
if (cfg.SUPABASE_URL || cfg.SUPABASE_ANON_KEY) {
  console.log('Aviso: no hagas commit de js/config.js con claves. En git debe quedar la plantilla vacía.');
}
