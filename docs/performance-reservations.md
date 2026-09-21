# PDF bajo demanda y virtualización

Verificación local del 21-09-2026. Referencia anterior: `8b2cd43`.

## Comportamiento

- `jspdf` y `jspdf-autotable` se solicitan al generar un documento; abrir el modal de impresión no los carga.
- Los generadores y sus consumidores, incluido el despacho automático del servidor, esperan funciones asíncronas.
- La vista diaria conserva las columnas y botones horarios. Solo las tarjetas y bloqueos fuera del rango renderizado se desmontan; las reservas enfocadas o arrastradas permanecen montadas.
- La agenda mensual virtualiza filas adaptables. La cuadrícula del mes y los datos usados para exportar permanecen completos.

## Mediciones

Edge headless, builds de producción, CPU ralentizada 4 veces. Datos sintéticos, sin conexión a servicios externos ni envíos de correo.

Carga de la pantalla de acceso: viewport 390 × 844, caché nueva en cada ejecución, respuestas gzip, 1,6 Mbps de descarga y 80 ms de latencia. Dos ejecuciones por versión:

| Medida | Antes | Después |
| --- | ---: | ---: |
| JavaScript inicial transferido, incluidos encabezados de recursos | 652.145 bytes | 515.491 bytes |
| Solicitudes iniciales a `vendor-pdf` | 1 | 0 |
| FCP/LCP, ejecución 1 | 5.076 ms | 3.896 ms |
| FCP/LCP, ejecución 2 | 4.724 ms | 4.012 ms |

El manifiesto confirma además que `vendor-pdf` no pertenece al cierre de imports estáticos de la entrada. La reducción neta del JavaScript comprimido es de aproximadamente 136 KB (21 %).

Interacciones: vistas aisladas compiladas para producción, 2.100 reservas totales y 300 en el día seleccionado, altura del viewport 600 px. Medianas de tres ejecuciones; duración desde el clic hasta dos cuadros de animación:

| Medida | Antes | Después |
| --- | ---: | ---: |
| Tarjetas diarias montadas al inicio del horario | 300 | 195 |
| Tarjetas de agenda mensual, móvil 390 px | 300 | 4 |
| Tarjetas de agenda mensual, escritorio 1.200 px | 300 | 16 |
| Volver al día poblado, móvil | 676 ms | 413 ms |
| Expandir agenda mensual, móvil | 553 ms | 53 ms |
| Volver al día poblado, escritorio | 916 ms | 782 ms |
| Expandir agenda mensual, escritorio | 1.175 ms | 135 ms |

Estas muestras locales no representan métricas de usuarios reales ni garantizan porcentajes en producción. El DOM diario sigue dependiendo de la densidad de reservas simultáneas y del tamaño del viewport.

## Comprobaciones

- TypeScript y build del cliente/servidor.
- Pruebas de carga diferida, carga concurrente, reintentos, PDF de varias páginas, adjuntos base64 y cartas.
- Pruebas de virtualización con más de 2.000 reservas, foco por teclado, arrastre, fechas y reservas nocturnas.
- Pruebas de impresión con ventanas bloqueadas, fallo de PDF con alternativa HTML y conservación de URL mientras el visor está abierto.
- Descarga real en Edge: cero solicitudes PDF al abrir el modal y carga de ambas librerías al descargar la planilla.

Las comprobaciones usan datos locales. No verifican la entrega de correos reales ni la salida de una impresora física.
