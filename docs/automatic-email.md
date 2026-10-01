# Despacho sin la app abierta

Cloud Run con mínimo cero y CPU por solicitud no garantiza temporizadores cuando
no hay visitas. Un programador externo debe llamar por HTTPS a
`POST /api/email/scheduled-check` y esperar la respuesta del servidor.

Configuración propuesta de Cloud Scheduler:

- Nombre: `planillas-actividades`.
- Región: `us-east1`.
- Frecuencia: `*/5 * * * *`; zona `America/Santiago`.
- URL: `https://espacios.ai.studio/api/email/scheduled-check`.
- Método: POST, cuerpo `{}`.
- Encabezado `X-Scheduler-Token`: clave aleatoria exclusiva (al menos 32 caracteres),
  guardada también como `EMAIL_SCHEDULER_SECRET` en los secretos del servidor.
- Tiempo límite: 300 segundos. Reintentos limitados; no usar el endpoint manual
  `trigger-scheduled`, que permite forzar un envío.

Cada comprobación respeta la configuración guardada: habilitación, fechas,
días, hora de Santiago, actividades seleccionadas de la semana en curso y PDF
independiente por día. Puede enviar hasta cinco minutos después de la hora
configurada, además del tiempo de generación y entrega. No requiere navegador
abierto ni computador encendido. Gmail debe conservar una autorización válida.

Una comprobación omitida normalmente responde HTTP 200; un error de entrega
responde 503 para permitir reintentos. La respuesta no incluye destinatarios ni
adjuntos. El temporizador y las solicitudes externas comparten la misma ejecución
en curso dentro de una instancia. Se guarda la fecha local de despacho para
evitar repetir un envío exitoso durante el día. Mantener máximo una instancia;
esta protección no es una garantía de entrega exactamente una vez ante caídas
durante el envío o fallos de escritura posteriores al correo.

Cloud Scheduler ofrece tres tareas gratuitas por **cuenta de facturación**,
incluidas las pausadas. Verificar las tareas de todos los proyectos vinculados
antes de crear una. El cupo gratuito del programador no garantiza que todo el
consumo de Cloud Run, Firestore u otros servicios de la cuenta sea gratuito.
Fuente: https://cloud.google.com/scheduler/pricing

Estado verificado el 1 de octubre de 2026:

- Ruta publicada y secreto configurado en el servidor.
- Tarea `planillas-actividades` habilitada en `gen-lang-client-0391852968`,
  región `us-east1`, zona `America/Santiago`, cada cinco minutos.
- Google Cloud mostró la primera ejecución como **Sin errores**.
- Comprobación sin clave: HTTP 401. Con clave: HTTP 200, omitido porque el jueves
  no figura en los días de envío guardados. No se forzó ningún correo de prueba.
- Programación guardada: viernes 08:30, actividades de sábado y domingo.
- OAuth de Gmail en producción; autorización renovada después de publicar.
- El proyecto no tenía tareas de Scheduler. En los otros tres proyectos de la
  misma cuenta la API de Scheduler estaba deshabilitada. No se habilitó ningún
  servicio en esos proyectos ni se contrataron funciones adicionales.

La ruta queda cerrada si se elimina el secreto. No publicar su valor en Git,
capturas, documentación o registros.
