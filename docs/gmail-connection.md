# Conexión de correo que se conserva al recargar

La aplicación recupera la autorización del servidor al iniciar y al volver a la ventana. Los tokens de Google no se guardan en localStorage ni sessionStorage.

## Renovación automática y envíos programados

1. En Google Cloud, habilitar Gmail API y crear un cliente OAuth de tipo **Aplicación web** para el proyecto.
2. Registrar como URI de redirección `https://DOMINIO-REAL/api/email/gmail/callback`, reemplazando el dominio por el de la aplicación. El dominio debe coincidir con el origen donde se abre la aplicación.
3. Configurar en los secretos del servidor `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET` y `GMAIL_OAUTH_REDIRECT_URI`. No usar variables con prefijo `VITE_` ni guardar secretos en GitHub.
4. Opcionalmente definir `GMAIL_TOKEN_ENCRYPTION_KEY` con una clave aleatoria y estable. Si no se define, se cifra con una clave derivada del secreto OAuth. Cambiar esa clave o el secreto requiere volver a autorizar Gmail.
5. Reiniciar/desplegar el servidor y usar **Conectar con Google** una vez con `cristianshute@gmail.com`, aceptando el permiso de envío.

El servidor solicita autorización offline, guarda el refresh token cifrado con AES-256-GCM en el documento `configuracion_sistema/gmail_oauth_credentials` y renueva el access token antes de enviar. Esto permite recargar, reiniciar el servidor y ejecutar despachos programados con el navegador cerrado. La base de datos debe estar disponible para guardar y recuperar la autorización.

Usar el estado de publicación adecuado en Google Cloud: las autorizaciones de una aplicación externa en modo Testing con acceso a Gmail pueden caducar a los siete días. Cumplir los requisitos de verificación de Google cuando correspondan. Ningún mecanismo evita una revocación de permisos, una deshabilitación de cuenta o una expiración impuesta por Google; en esos casos se debe volver a conectar.

## Compatibilidad sin las credenciales OAuth del servidor

El inicio de sesión Firebase existente sigue disponible. Su token se conserva en una cookie cifrada HttpOnly durante un máximo de 55 minutos, de modo que recargar no corta inmediatamente la conexión. Este token no permite renovación automática: al vencer es necesario reconectar. Una clave de cifrado estable conserva esta sesión temporal frente a reinicios del servidor; sin ella el servidor usa una clave temporal en memoria.

También se reconoce el SMTP de la cuenta oficial cuando está configurado con una contraseña de aplicación en los secretos del servidor. Este mecanismo no depende del token temporal del navegador.

La opción **Desconectar** elimina la autorización persistida desde el navegador que realizó la autorización OAuth. No modifica los permisos concedidos en la cuenta Google; estos también pueden revocarse en la configuración de seguridad de Google.

Referencia: https://developers.google.com/identity/protocols/oauth2/web-server
