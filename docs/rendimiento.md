# Medición de rendimiento

- **Fecha:** 8 de noviembre de 2026
- **Sitio:** https://konnyspizza.vercel.app/
- **Entorno:** Windows, Microsoft Edge 157.0.4341.42, ventana 1365 × 900.

## Método

Se hicieron cinco cargas nuevas por ruta (`/` y `/admin`) con caché del navegador desactivada y sin limitación artificial de red. Se midieron el evento `load`, First Contentful Paint (FCP), Largest Contentful Paint (LCP) y la duración de cada solicitud `fetch` a Supabase. El script `pruebas/medir_rendimiento.py` permite repetir la medición; usa Selenium Manager para resolver el driver de Edge.

La ruta `/admin` se midió sin iniciar sesión. Por eso sus tiempos cubren la pantalla de acceso, no la carga de datos del panel autenticado. Las llamadas de la página pública sí incluyen mesas, horarios, platos y ocupación.

## Resultados

- **Página pública — evento `load`:** mediana 1.203 s; rango 1.173–1.291 s.
- **Página pública — FCP/LCP:** mediana 0.680 s; rango 0.660–0.752 s.
- **Consultas públicas a Supabase:** 20 de 20 respondieron HTTP 200. La más lenta tardó 0.766 s.
- **Acceso `/admin` — evento `load`:** mediana 1.294 s; rango 1.205–1.423 s.
- **Acceso `/admin` — FCP/LCP:** mediana 1.356 s; rango 1.252–1.492 s.

## Evaluación

La especificación pide carga de página menor a 3 s y respuesta de consultas a Supabase menor a 1 s. Ambas metas se cumplieron en estas diez cargas de escritorio; no se justifican cambios de rendimiento a partir de esta medición. La prueba no simula móviles ni redes lentas y no demuestra el objetivo de disponibilidad anual del 99 %. Los resultados describen el despliegue y las condiciones del momento, no una garantía de servicio.

Para repetirlo, instala `pruebas/requirements.txt` y ejecuta `python pruebas/medir_rendimiento.py`. Puedes cambiar la URL o el número de intentos con `--url` y `--runs`.
