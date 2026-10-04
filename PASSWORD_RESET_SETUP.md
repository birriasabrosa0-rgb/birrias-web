# Configurar el restablecimiento de contraseña

El flujo usa un código de seis cifras que vence a los 10 minutos. El servidor lo envía por correo, limita los intentos y actualiza la contraseña en Firebase Authentication después de validarlo.

## Requisitos del servidor

1. Instala las dependencias de `requirements.txt` en el entorno de la aplicación.
2. En Firebase Console, crea una clave de cuenta de servicio con permisos para administrar usuarios de Firebase Authentication. Guarda el archivo JSON fuera de este proyecto y no lo subas al repositorio.
3. Configura estas variables en el entorno donde se ejecuta Flask:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\ruta-segura\firebase-service-account.json'
$env:FIREBASE_PROJECT_ID = 'birrias'
$env:PASSWORD_RESET_SECRET = 'una-clave-aleatoria-larga-y-privada'
```

Genera un secreto aleatorio y privado (por ejemplo, con `python -c "import secrets; print(secrets.token_urlsafe(48))"`) y úsalo como valor de `PASSWORD_RESET_SECRET`. Debe mantenerse estable entre reinicios y ser el mismo en todas las instancias del servidor. No lo incluyas en el repositorio.

El envío usa la configuración SMTP de Flask-Mail que ya tiene la aplicación. El correo saliente debe estar habilitado y sus credenciales deben seguir siendo válidas.

Sin las credenciales de Firebase Admin y `PASSWORD_RESET_SECRET`, el servidor rechazará de forma segura las solicitudes; esas credenciales no se pueden sustituir por código ejecutado en el navegador.
