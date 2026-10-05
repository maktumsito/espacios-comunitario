# Corrección y optimización: resultados verificables

Referencia: `e4bcbeefd6d4f3da4973ec29469de8a029bfb806`. Repositorio: https://github.com/maktumsito/espacios-comunitario. Cambios locales, sin despliegue, publicación ni migración en producción.

**Ganancias locales medidas destacadas:** confirmación de 500 ocurrencias, 71,94 %; escritura en móvil con 10.000 reservas, 89,33 %; cambio de vista en escritorio con 10.000, 96,34 %; resumen de conflictos con 10.000, 99,06 %; transferencia inicial, 14,45 %. Son escenarios independientes. Hay degradaciones declaradas de validación y algunos p95 de escritorio.

## Resultado funcional

Se reprodujeron **6 fallas de persistencia antes del cambio**; los mismos seis escenarios pasan después. La comprobación final ejecutó **160 pruebas unitarias y 24 de integración, todas aprobadas**. La ejecución unitaria omite los 24 casos de emulador, que se ejecutan por separado; no se cuentan dos veces. TypeScript y build aprobados. La referencia tenía 135 pruebas unitarias aprobadas y cinco errores de tipado en fixtures; estos se corrigieron.

| Falla reproducida | Corrección comprobada |
|---|---|
| Un lote aceptaba reservas que chocaban con una existente | Validación transaccional frente al índice persistido |
| Un espacio compuesto no protegía sus salas constituyentes | Registro atómico de todos los espacios constituyentes |
| Una reserva nocturna no protegía el día siguiente | Intervalos comunes de validación y disponibilidad para ambos días |
| Una edición antigua sobrescribía una edición ajena | Verificación de versión persistida y aviso para recargar conservando el formulario |
| Una escritura rechazada aparecía en la caché confirmada | Actualización de caché únicamente con IDs confirmados |
| Mover una reserva mediante lote dejaba ocupada la fecha anterior | Retirada y creación de entradas junto con la reserva |

Los formularios esperan la confirmación antes de cerrar o borrar el borrador; bloquean envíos repetidos y conservan los datos ante un fallo. Preparación, fechas reales, horarios, alias, feriados y alcance de series usan reglas comunes. PDF, correo y auditoría posteriores no revierten reservas confirmadas.

Los grupos de escritura se limitan a 450 escrituras y 8 MB. Cada grupo conectado por disponibilidad es atómico; una operación puede quedar parcial entre grupos. Un registro local por usuario conserva payload, operación e IDs para reanudar sin duplicados y sin volver a escribir registros ya confirmados que otro cliente pudo editar. Un grupo indivisible demasiado grande se rechaza explícitamente.

Configuración, equipamiento, usuarios, bloqueos, calificaciones, eliminaciones y respaldos confirman antes de cambiar la caché o comunicar éxito. Los respaldos habituales consultan el historial remoto completo, incluso cuando la caché contiene solo parte. Restauración e importación usan las escrituras comunes. La limpieza conserva índices históricos ocupados. Se entrega una reconstrucción de disponibilidad con simulación, aplicación reanudable y verificación, probada únicamente en localhost.

## Método

Node v26.10.0; Edge headless con CPU limitada a 4×, ventanas de 390 y 1.200 px. Firestore local aislado `demo-espacios`, correo simulado y conexiones del navegador fuera de su origen local bloqueadas. Tres calentamientos y treinta muestras por escenario, mismos fixtures antes/después: 500, 2.500 y 10.000 reservas, días densos y series de 1, 50 y 500 ocurrencias. Las mediciones se ejecutaron por separado, sin otras mediciones intensivas simultáneas.

**Ganancia = (tiempo anterior − tiempo nuevo) / tiempo anterior × 100**. Una ganancia negativa significa empeoramiento. La mediana usa la muestra ordenada 16/30 y p95 la 29/30. No se calcula un porcentaje global: falta la distribución real de uso.

## Persistencia confirmada en emulador

Se mide desde la llamada hasta comprobar en el servidor la última entrada de disponibilidad; después de cada muestra se verifica el número de reservas, índices y entradas, sin duplicados. El sondeo de 10 ms añade resolución y coste de observación. El retorno del servicio y la confirmación se conservan por separado en los JSON. En la referencia, los lotes devolvían antes de terminar sus índices; comparar solamente el retorno produciría una conclusión engañosa.

| Escenario | Mediana antes → después (ms) | Ganancia mediana | p95 antes → después (ms) | Ganancia p95 |
|---|---:|---:|---:|---:|
| 1 ocurrencia(s) | 48.15 → 45.88 | 4.72 % | 56.53 → 54.93 | 2.82 % |
| 50 ocurrencia(s) | 281.40 → 105.26 | 62.59 % | 303.92 → 132.02 | 56.56 % |
| 500 ocurrencia(s) | 2671.45 → 749.60 | 71.94 % | 2841.86 → 840.36 | 70.43 % |

## Respuesta visual en navegador

Duración de la acción automatizada hasta dos cuadros de animación. Incluye el coste de automatización; la respuesta del campo de búsqueda no equivale a resultados diferidos completamente calculados. Apertura del formulario después de calentamientos, no primera descarga.

| Escenario | Mediana antes → después (ms) | Ganancia mediana | p95 antes → después (ms) | Ganancia p95 |
|---|---:|---:|---:|---:|
| 390 px · 500 reservas · Abrir formulario | 154.80 → 140.60 | 9.17 % | 210.90 → 175.70 | 16.69 % |
| 390 px · 500 reservas · Escribir descripción | 62.50 → 61.10 | 2.24 % | 77.70 → 64.50 | 16.99 % |
| 390 px · 2500 reservas · Abrir formulario | 281.70 → 148.90 | 47.14 % | 347.10 → 255.00 | 26.53 % |
| 390 px · 2500 reservas · Escribir descripción | 96.80 → 47.70 | 50.72 % | 118.30 → 63.70 | 46.15 % |
| 390 px · 10000 reservas · Abrir formulario | 940.80 → 193.30 | 79.45 % | 1444.00 → 290.80 | 79.86 % |
| 390 px · 10000 reservas · Escribir descripción | 577.10 → 61.60 | 89.33 % | 794.00 → 79.70 | 89.96 % |
| 1200 px · 500 reservas · Abrir formulario | 161.80 → 196.30 | -21.32 % | 206.40 → 224.40 | -8.72 % |
| 1200 px · 500 reservas · Escribir descripción | 63.70 → 64.10 | -0.63 % | 88.50 → 77.80 | 12.09 % |
| 1200 px · 500 reservas · Respuesta visual al buscar | 49.10 → 46.60 | 5.09 % | 62.30 → 58.30 | 6.42 % |
| 1200 px · 500 reservas · Cambiar agenda a calendario | 256.90 → 243.20 | 5.33 % | 388.60 → 372.50 | 4.14 % |
| 1200 px · 2500 reservas · Abrir formulario | 216.10 → 253.60 | -17.35 % | 300.60 → 356.90 | -18.73 % |
| 1200 px · 2500 reservas · Escribir descripción | 77.10 → 76.10 | 1.30 % | 92.70 → 88.50 | 4.53 % |
| 1200 px · 2500 reservas · Respuesta visual al buscar | 57.80 → 56.70 | 1.90 % | 91.40 → 69.10 | 24.40 % |
| 1200 px · 2500 reservas · Cambiar agenda a calendario | 868.50 → 208.00 | 76.05 % | 1259.00 → 261.80 | 79.21 % |
| 1200 px · 10000 reservas · Abrir formulario | 604.20 → 481.40 | 20.32 % | 810.40 → 622.40 | 23.20 % |
| 1200 px · 10000 reservas · Escribir descripción | 95.60 → 99.60 | -4.18 % | 113.40 → 127.10 | -12.08 % |
| 1200 px · 10000 reservas · Respuesta visual al buscar | 78.80 → 78.10 | 0.89 % | 106.30 → 135.20 | -27.19 % |
| 1200 px · 10000 reservas · Cambiar agenda a calendario | 7574.60 → 277.30 | 96.34 % | 11962.20 → 400.40 | 96.65 % |

Los observadores registran mutaciones del DOM, **no renders de React**. Las muestras completas incluyen esos conteos, recursos y errores de página. Los contadores no permiten atribuir cada render interno.

## Transferencia inicial

Treinta contextos fríos independientes, después de tres calentamientos, a 1.200 px y 500 reservas. Transferencia observada de navegación y recursos, comprimida localmente y con sobrecarga HTTP: **552.322 → 472.532 bytes**, **14.45 % menos**, 79790 bytes evitados. La carga explícita diferida evita precargar el formulario. No equivale a una medición de CDN o red móvil real.

## Cálculos aislados

Índices con conjuntos por fecha y espacio; campos de búsqueda normalizados reutilizables; consulta por disponibilidad; y resumen de conflictos mediante barrido en lugar de materializar todos los pares. Los PDF conservan su cálculo completo: la mejora pequeña no justifica atribuirles una optimización general.

| Escenario | Mediana antes → después (ms) | Ganancia mediana | p95 antes → después (ms) | Ganancia p95 |
|---|---:|---:|---:|---:|
| 500 reservas · Índice por fecha | 0.71 → 0.63 | 10.33 % | 1.00 → 0.95 | 4.78 % |
| 500 reservas · Índice de días densos | 2.42 → 0.89 | 63.28 % | 8.79 → 5.56 | 36.73 % |
| 500 reservas · Búsqueda aproximada | 10.58 → 9.66 | 8.70 % | 12.04 → 11.31 | 6.04 % |
| 500 reservas · Conflictos de 50 candidatos | 0.36 → 0.32 | 11.56 % | 0.67 → 0.62 | 7.13 % |
| 500 reservas · Validación de todos los registros | 1.65 → 1.91 | -16.03 % | 2.33 → 2.92 | -25.06 % |
| 500 reservas · PDF de todos los registros | 16.78 → 16.86 | -0.48 % | 18.87 → 20.26 | -7.42 % |
| 2500 reservas · Índice por fecha | 5.35 → 3.82 | 28.60 % | 7.97 → 4.45 | 44.15 % |
| 2500 reservas · Índice de días densos | 22.10 → 4.48 | 79.75 % | 24.14 → 4.72 | 80.43 % |
| 2500 reservas · Búsqueda aproximada | 52.11 → 49.48 | 5.03 % | 55.72 → 56.49 | -1.39 % |
| 2500 reservas · Conflictos de 50 candidatos | 1.74 → 1.58 | 9.29 % | 3.14 → 2.83 | 10.12 % |
| 2500 reservas · Validación de todos los registros | 6.49 → 8.16 | -25.79 % | 7.73 → 9.30 | -20.32 % |
| 2500 reservas · PDF de todos los registros | 64.63 → 62.05 | 3.99 % | 78.74 → 66.93 | 14.99 % |
| 10000 reservas · Índice por fecha | 51.03 → 16.00 | 68.64 % | 140.90 → 18.05 | 87.19 % |
| 10000 reservas · Índice de días densos | 421.72 → 17.73 | 95.80 % | 455.54 → 18.39 | 95.96 % |
| 10000 reservas · Búsqueda aproximada | 215.30 → 197.16 | 8.43 % | 220.29 → 202.86 | 7.91 % |
| 10000 reservas · Conflictos de 50 candidatos | 6.41 → 5.73 | 10.50 % | 10.26 → 9.31 | 9.29 % |
| 10000 reservas · Validación de todos los registros | 27.40 → 34.12 | -24.53 % | 29.59 → 37.32 | -26.13 % |
| 10000 reservas · PDF de todos los registros | 241.29 → 237.21 | 1.69 % | 265.43 → 248.21 | 6.49 % |

### Resumen de conflictos

Comparación directa del algoritmo anterior y el nuevo, con el mismo conteo final.

| Escenario | Mediana antes → después (ms) | Ganancia mediana | p95 antes → después (ms) | Ganancia p95 |
|---|---:|---:|---:|---:|
| 500 reservas | 1.44 → 0.50 | 65.04 % | 1.78 → 1.38 | 22.67 % |
| 2500 reservas | 40.77 → 3.99 | 90.21 % | 54.21 → 5.24 | 90.33 % |
| 10000 reservas | 973.85 → 9.15 | 99.06 % | 1377.76 → 10.20 | 99.26 % |

Con 10.000 registros se conserva el conteo de **828.340 pares**, evitando crear esa cantidad de objetos de conflicto cuando solo se necesitan cantidad e IDs. El detalle se calcula al abrirlo y se pagina. La agenda virtualiza días con más de 50 tarjetas. La caché se actualiza por grupos confirmados; los borradores solo se escriben cuando cambian y con debounce.

## Regresiones investigadas y límites

La validación p95 aumenta más del 10 % en los tres tamaños. Se revisó y se sustituyeron construcciones de fechas y comprobaciones repetidas por validación nativa del calendario. El coste restante corresponde a controles adicionales de fechas, IDs y tamaño de campos; a 10.000 registros supone aproximadamente 7,73 ms adicionales en p95, menos de 1 microsegundo por registro. Se conserva por integridad, y se declara como degradación medida.

El guardado individual requiere comprobar la versión de la reserva además de su disponibilidad. Se investigaron lecturas previas y agrupaciones; se retiraron consultas redundantes en creación. Una prelectura global empeoró los lotes y fue descartada. Una corrida intermedia mostró p95 individual de 64,99 ms frente a 56,53 ms de referencia; la medición final con el código definitivo dio 54,93 ms. Se mantienen separados los resultados intermedios y finales. Ninguna ganancia de emulador se extrapola a producción.

En navegador persisten tres aumentos de p95 superiores al 10 %: abrir con 2.500 reservas en escritorio (+18,73 %), escribir con 10.000 (+12,08 %) y respuesta del campo de búsqueda con 10.000 (+27,19 %). Se revisaron la construcción inicial del índice y los efectos de borrador, y se tomó un perfil CPU independiente de los tiempos principales. El perfil muestra trabajo de React y consultas/visibilidad del controlador de automatización; en escritura y búsqueda hay más muestras de consultas del controlador que del módulo del formulario. No se atribuye todo el aumento a una causa única ni se declara eliminada esta regresión de latencia. Queda explícita para seguimiento con interacción real y perfilado más amplio; la aceptación exhaustiva del plan no queda demostrada.

No se instrumentaron facturación de Firestore, todas las lecturas/escrituras internas del SDK, renders React ni el consumo real de red en producción. Las verificaciones cuentan documentos e índices finales y los recursos HTTP observados; los objetos y bytes evitados indicados arriba son reproducibles, no estimaciones de ahorro monetario. No se midió exhaustivamente cada variante de edición ni cada pantalla administrativa con navegador. La búsqueda visual mide respuesta del campo. El servidor construido pasó comprobaciones HTTP de salud, rechazo sin sesión y envío simulado local (ver `verificacion-correo-local.json`). No se verificó entrega real de Gmail/SMTP/Resend, calidad visual de todos los PDF ni todas las combinaciones de importación/restauración. Estos límites impiden afirmar cumplimiento exhaustivo de cada punto del plan o ausencia absoluta de errores.

La integración cubre dos clientes concurrentes, revisiones antiguas, creación con ID existente, reintento con operación estable, fallo intermedio de 500 filas y reanudación tras recarga, preservación de una edición ajena de una fila ya confirmada, rechazo de escritura, cancelación, eliminación, espacios compuestos, medianoche, cambios de fecha, campos opcionales, feriados, restauración con conflictos autorizados, respaldos completos y reconstrucción consistente. Las pruebas unitarias cubren guardado/recuperación de borradores, confirmación de administración y calificaciones, alcances de series y equivalencia de conflictos. No hay una simulación completa de cortes reales de conectividad para cada interfaz.

## Entrega y uso seguro

Cambios disponibles en la copia local vinculada al remoto. Ejecutar `npm test`, `npm run test:integration` con emulador, `npm run lint` y `npm run build`. Los comandos, aislamiento y recuperación están documentados en `docs/validacion-y-recuperacion.md`. Las dependencias están declaradas en `package.json` y `bun.lock`.

**Antes de un despliegue separado**, reconstruir y verificar el índice anterior sobre una copia local, detener escritores durante la migración y planificar su aplicación autorizada en producción. La herramienta entregada solo admite localhost. Este trabajo no cambia el sistema existente de autenticación ni reemplaza las reglas de seguridad del servidor por permisos del cliente.

Datos originales: `before/after-performance.json`, `before/after-browser.json`, `before/after-write-performance.json`, `before/after-initial-browser.json`, `conflict-summary-performance.json`, `baseline-persistence.json`, `after-unit-tests.json` y `after-persistence.json`. Los archivos con sufijos `initial` o `pre-virtualization` adicionales conservan mediciones intermedias y no se usan para la comparación final. `comparacion-metricas.csv` reúne los resultados finales.
