# Validación local y recuperación de guardados

Referencia anterior: `e4bcbeefd6d4f3da4973ec29469de8a029bfb806`.

## Entorno aislado

Ejecutar un emulador Firestore con Java 21 y Firebase CLI, usando `firebase.json` y el proyecto `demo-espacios`:

```powershell
firebase emulators:start --only firestore,auth --project demo-espacios
```

Para abrir la aplicación local, establecer `$env:VITE_LOCAL_TEST_MODE='true'` antes de `npm run dev`. Tanto cliente como servidor usarán aplicaciones Firebase nombradas del proyecto demo. El correo del servidor se simula, sin Gmail, SMTP ni Resend; no se registra OAuth Gmail. No utilizar el servidor habitual para pruebas contra la configuración real.

```powershell
npm test
npm run test:integration
npm run lint
npm run build
```

Las pruebas unitarias sustituyen Firebase. Las pruebas de integración solo aceptan el emulador `127.0.0.1:8087`; borran exclusivamente la base demo antes de cada caso. `test:integration` establece esa dirección por sí mismo. Ejecutar las mediciones sin otras tareas intensivas:

```powershell
node scripts/measure-persistence.cjs before
node scripts/measure-persistence.cjs after
npm run measure:core
npm run measure:browser
```

La primera medición extrae el commit de referencia a `work/baseline-source` y sustituye su configuración Firebase por localhost. Los scripts de navegador bloquean todas las conexiones fuera de su origen estático local. Las métricas tienen 3 calentamientos y 30 muestras. Las mediciones Node, navegador y emulador son independientes; no extrapolar su latencia a producción.

## Guardados parciales

El formulario se conserva si el guardado falla. No modificar ni enviar nuevamente un formulario mientras guarda. La sección «Guardado pendiente» permite reanudar con los mismos IDs y el identificador de operación original después de una recarga. Cada grupo conectado por disponibilidad se confirma atómicamente; una operación grande puede confirmar varios grupos antes de fallar.

Los datos pendientes se guardan en el almacenamiento local del mismo navegador, asociados al usuario. No borrar ese almacenamiento ni cambiar de navegador para reanudar. Si la cuota de almacenamiento impide registrar el payload, no se inicia la escritura. Un grupo indivisible que exceda el presupuesto de 450 escrituras o 8 MB debe reducirse; no se divide silenciosamente. Los adjuntos de una reserva están limitados a un tamaño seguro de documento.

Las ediciones verifican la versión persistida. Ante otro editor, conservar el borrador y recargar la versión actual mediante el aviso del formulario. La reserva confirmada sigue existiendo si falla después la auditoría, el PDF o una notificación.

## Índice de disponibilidad

Antes de desplegar esta implementación sobre datos anteriores, es necesario reconstruir y verificar `schedule_slots`, ya que el formato anterior no protegía todas las salas constituyentes ni ambos días de una reserva nocturna. Este trabajo **no ejecuta esa migración en producción**. La herramienta entregada solo permite localhost:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8087'
npm run slots:check
npm run slots:rebuild
npm run slots:check
```

Detener los escritores durante una reconstrucción. La ejecución es reanudable por comparación: solo reescribe discrepancias y retira entradas obsoletas, en lotes de 400. La última comprobación debe producir `changed: 0` y `obsolete: 0`. Probar primero una copia local de los datos reales. Una adaptación para producción requiere un trabajo de despliegue separado y autorización expresa.

La limpieza periódica conserva todos los índices ocupados, incluso de fechas antiguas. Las eliminaciones de reservas retiran sus entradas mediante el mismo servicio transaccional.

## Límites de aceptación

Las reglas y claves locales conservan su finalidad actual; este trabajo no reemplaza la autenticación existente por Firebase Auth ni rediseña las reglas de autorización del servidor. Los permisos del cliente no sustituyen reglas de seguridad de Firestore. Los escenarios y resultados comprobados están en `outputs/informe-mejoras.md`; no implican ausencia absoluta de errores ni una ganancia global de producción.
