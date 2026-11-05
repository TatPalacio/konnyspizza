/* ==========================================================================
   Konys Pizza · configuración
   1. Copia este archivo como js/config.js
   2. Pega la Project URL y la anon/public key de tu proyecto en Supabase
      (Supabase → Project Settings → API).
   Si dejas SUPABASE_URL vacío, la app funciona en MODO DEMO con datos
   guardados en el navegador (útil para probar sin backend).

   Seguridad:
   - La anon key es pública por diseño. Lo que protege los datos son las
     reglas RLS de supabase/schema.sql, no el secreto de esta clave.
   - Nunca pongas aquí la service_role key: daría acceso total a la base.
   - ADMIN_PASSWORD NO es un mecanismo de seguridad. Este archivo se
     descarga en el navegador de cualquier visitante, así que la contraseña
     se puede leer con «Ver código fuente». Solo oculta la interfaz del
     panel en el modo demo. Con Supabase, los datos de clientes y los
     cambios administrativos están protegidos por RLS y requieren una
     sesión de Supabase Auth (ver supabase/schema.sql, sección 7).
   ========================================================================== */
window.KONYS_CONFIG = {
  SUPABASE_URL: '',            // ej. 'https://abcdefgh.supabase.co'
  SUPABASE_ANON_KEY: '',       // anon/public key
  ADMIN_PASSWORD: 'konys2026', // solo filtro visual del panel (RF-08), no protege datos
};
