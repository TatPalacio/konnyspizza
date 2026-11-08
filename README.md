# Konys Pizza · Sistema de Reservas de Mesas

Aplicación web para que los clientes de **Konys Pizza** (Cra. 36 con calle 41, Bucaramanga) consulten la disponibilidad de mesas y reserven en línea, y para que el administrador gestione mesas, horarios, reservas y la carta digital.

Proyecto académico · Universidad de Santander.

- **Aplicación desplegada:** _pendiente (URL de Vercel)_
- **Video explicativo:** _pendiente (enlace de YouTube o Drive)_

## Tecnologías

| Tecnología | Uso |
|---|---|
| HTML5, CSS3, JavaScript ES6+ (vanilla) | Interfaz, estilos responsive y lógica del cliente |
| Supabase (SDK JS v2) | Base de datos: mesas, horarios, reservas y platos |
| Vercel | Despliegue continuo desde GitHub |
| Figma | Diseño de alta fidelidad (`KONYS.fig`) |

## Estructura

```
konys-reservas-app/
├── index.html            # Página principal (cliente): mesas, reserva, confirmación, carta
├── admin.html            # Panel de administración (/admin en Vercel)
├── css/styles.css        # Design System (tokens del Figma) + componentes + responsive
├── js/
│   ├── config.js         # URL y anon key. En git va vacío. Lo cargan las dos páginas
│   ├── admin-config.js   # Contraseña del panel. Solo lo carga admin.html
│   ├── validacion.js     # Reglas compartidas por la interfaz y la capa de datos
│   ├── ui.js             # Iconos, ilustraciones, formatos, generación de horarios
│   ├── supabase.js       # Conexión con Supabase (o modo demo local)
│   ├── cliente.js        # Lógica del módulo cliente
│   └── admin.js          # Lógica del módulo administrador
├── supabase/schema.sql   # Tablas, reglas RLS, índice anti doble reserva y datos iniciales
├── scripts/build-config.js # Vuelca .env o las variables de Vercel a js/config.js
├── .env.example          # Plantilla de variables (copiar como .env)
├── docs/                 # Documento de proyecto
├── vercel.json
└── .gitignore            # Ignora .env, no js/config.js
```

## Ejecutar en local

El modo demo no necesita claves. `js/config.js` ya está en el repositorio con `SUPABASE_URL` y `SUPABASE_ANON_KEY` vacías. La contraseña del panel está en `js/admin-config.js`, que la página pública no carga.

1. Abre esta carpeta.
2. Abre `index.html` en el navegador (doble clic) o sírvela con un servidor estático.

Si `SUPABASE_URL` está vacío, la app funciona en **modo demo**: usa datos de ejemplo guardados en el navegador (localStorage) y muestra la etiqueta «Modo demo» abajo a la izquierda, con un botón para restablecer los datos. Así puedes probar todo sin backend.

- Panel de administración: `admin.html` · contraseña por defecto **`konys2026`**.

### Cuando tengas las claves

1. Copia `.env.example` como `.env` (ya puede existir, vacío).
2. Pega `SUPABASE_URL` y `SUPABASE_ANON_KEY` (la anon/public key, nunca la service_role). Si dejas `ADMIN_PASSWORD` vacío, el panel sigue usando `konys2026`.
3. Desde esta carpeta ejecuta `node scripts/build-config.js`. El script reescribe `js/config.js` (página pública, sin contraseña) y `js/admin-config.js` (solo el panel).
4. Recarga `index.html`. Si las dos claves de Supabase tienen valor, desaparece el modo demo.

`.env` no se sube a Git. `js/config.js` sí, pero solo como plantilla vacía: si el script escribió claves, no lo commitees así.

## Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor → New query** pega todo `supabase/schema.sql` y pulsa **Run**. Crea las tablas, las reglas de seguridad (RLS), las funciones `crear_reserva` y `ocupacion_reservas`, y los datos iniciales. El script es idempotente: puedes volver a ejecutarlo, y si falla no aplica nada.
3. En **Project Settings → API** copia la *Project URL* y la *anon public key* en `.env` y ejecuta `node scripts/build-config.js`.

### Seguridad y panel de administración

- Los visitantes **no** pueden leer nombres ni teléfonos de las reservas ni modificar mesas, horarios o platos. Reservan con `crear_reserva()`, que valida en el servidor el horario, la capacidad, la mesa activa y la superposición.
- La contraseña que termina en `js/admin-config.js` **no es seguridad**: quien abre ese archivo la ve. Solo oculta la interfaz del panel y, en modo demo, la capa de datos vuelve a exigir esa sesión antes de mostrar teléfonos o guardar cambios. La página pública no carga ese archivo.
- Por eso, conectado a Supabase, el panel muestra un aviso y la base de datos rechaza sus cambios hasta que exista un inicio de sesión real con **Supabase Auth**. Los pasos están en la sección 7 de `schema.sql`. Para una presentación académica, la sección 8 trae un modo opcional sin autenticación, documentado como inseguro.
- El **modo demo** funciona igual que antes.

## Desplegar en Vercel

1. Sube el repositorio a GitHub. `.env` queda fuera por `.gitignore`. `js/config.js` sí va, con las claves vacías.
2. En Vercel: **Add New → Project →** importa el repositorio (framework: *Other*).
3. En **Settings → General → Root Directory** elige `konys-reservas-appw/konys-reservas-app`. Si la raíz queda en el repo, Vercel no ve `index.html` ni `vercel.json`.
4. En **Settings → Environment Variables** agrega `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `ADMIN_PASSWORD`.
5. Vercel ejecuta `node scripts/build-config.js`. En el build manda `process.env` (no hace falta subir `.env`) y reescribe `js/config.js` y `js/admin-config.js`. El panel queda disponible en `/admin`. `vercel.json` añade cabeceras de seguridad (nosniff, anti-clickjacking y una CSP compatible con fuentes, el SDK y Supabase).

> La clave *anon* de Supabase es pública por diseño: la protección real la dan las reglas RLS de `schema.sql`. No uses nunca la *service_role key* en el front-end.

## Funcionalidades (trazabilidad)

| Requisito | Dónde |
|---|---|
| RF-01 Visualización de mesas (nombre, zona, capacidad, estado) | `index.html#mesas` · `cliente.js › renderMesas` |
| RF-02 Selección de mesa | Botón *Reservar / Ver horarios* → modal de reserva |
| RF-03 Elección de fecha (solo días habilitados) | Calendario (escritorio) y tira de días (móvil) |
| RF-04 Slots disponibles y ocupados | `ui.js › generarSlots` (cada 30 min según jornada y duración) |
| RF-05 Reserva con nombre, personas (≤ capacidad) y contacto opcional | Formulario + validaciones + `supabase.js › crearReserva` |
| RF-06 Confirmación con los datos y código | Vista *Reserva confirmada* (permite imprimir el comprobante) |
| RF-07 Carta por categorías (oculta los no disponibles) | `index.html#carta` |
| RF-08 Acceso con contraseña | `admin.html` |
| RF-09 / RF-10 Registro y listado de mesas | Panel › Mesas |
| RF-11 Horarios por día y duración | Panel › Horarios (con vista previa de slots) |
| RF-12 Reservas con filtros por fecha y mesa | Panel › Reservas |
| RF-13 Activar / desactivar mesas | Toggle en Panel › Mesas |
| RF-14 Agregar, editar, ocultar y eliminar platos | Panel › Carta |

**Estados de error contemplados:** horario tomado por otra persona antes de confirmar (verificación en el servidor + restricción de exclusión que impide reservas superpuestas), capacidad excedida, días u horarios sin disponibilidad, campos obligatorios y teléfono con formato inválido, contraseña incorrecta y validaciones en los formularios del panel.

**Responsive:** escritorio (≥ 1280 px), portátil, tablet (≤ 1023 px: menú hamburguesa y panel lateral desplegable) y móvil (≤ 639 px: tarjetas horizontales, reserva a pantalla completa con botón fijo, tablas con desplazamiento).

## Decisiones fuera del documento

- La tabla `platos` incluye una columna opcional `imagen` (URL o clave de ilustración) para mostrar la imagen del diseño de Figma. El modelo del documento no la define.
- La foto de la mesa se registra como URL (`foto_url`). No se implementó la subida de archivos.
- Las pantallas de compra en línea del archivo de Figma (carrito, entrega y pago) **no se implementaron** porque los pagos y los pedidos a domicilio están fuera del alcance del documento (sección 4.2).

## Plan de commits sugerido

1. `chore: estructura inicial del proyecto y README`
2. `docs: agregar documento de proyecto y mockups`
3. `feat: página principal con tarjetas de mesas`
4. `feat: flujo de reserva con fecha, horarios y formulario`
5. `feat: integración con Supabase`
6. `feat: panel de administración (mesas, horarios, reservas, carta)`
7. `fix: validación de doble reserva y responsividad`
8. `chore: configuración de despliegue en Vercel`
