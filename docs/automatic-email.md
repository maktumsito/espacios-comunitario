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

Estado: la ruta puede desplegarse, pero queda cerrada hasta configurar su secreto.
Crear y comprobar la tarea externa antes de dar por activada la automatización.
