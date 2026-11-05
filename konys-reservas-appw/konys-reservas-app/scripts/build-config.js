/* Genera js/config.js en Vercel a partir de las variables de entorno
   SUPABASE_URL, SUPABASE_ANON_KEY y ADMIN_PASSWORD (sección 14.3 del documento).
   Vercel lo ejecuta automáticamente gracias a "buildCommand" en vercel.json.
   Ojo: el archivo generado es público. ADMIN_PASSWORD queda visible para
   cualquiera; solo es un filtro visual. Nunca uses aquí la service_role key. */
const fs = require('fs');
const path = require('path');
const cfg = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'konys2026',
};
const out = path.join(__dirname, '..', 'js', 'config.js');
fs.writeFileSync(out, `/* Generado en el despliegue. No editar. */\nwindow.KONYS_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
console.log('js/config.js generado', cfg.SUPABASE_URL ? '(Supabase configurado)' : '(modo demo: faltan variables de Supabase)');
