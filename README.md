# 💰 Control de Finanzas Mensuales App

Backend (API en Vercel) para llevar un control detallado de tus finanzas personales mes a mes: activos, deudas, metas de ahorro y estado financiero. **El uso principal es como API de la app móvil en Flutter (Android e iPhone)**. Además incluye una versión web (PWA) que se mantiene como complemento.

## ✨ Características Principales

*   📊 **Gestión Financiera Completa:** Registra activos, ingresos, deudas a tu favor y pasivos (incluyendo tarjetas de crédito con pago total y mínimo).
*   🧮 **Cálculos Automáticos:** Total de activos, total de deudas, saldo parcial y saldo total en tiempo real.
*   🎯 **Metas de Ahorro:** Objetivo de ahorro mensual con barra de progreso.
*   💾 **Doble Sistema de Guardado:**
    *   **Modo Invitado:** Los datos se guardan en el localStorage del navegador.
    *   **Inicio de Sesión con Google:** Los datos se guardan en **MongoDB Atlas** a través de una API segura, accesibles desde cualquier dispositivo.
*   🔄 **Migración Automática:** Al iniciar sesión, los datos locales del invitado se transfieren a la cuenta en la nube.
*   🔔 **Recordatorio diario:** Una notificación push (Firebase Cloud Messaging) se envía cada día para recordar registrar los gastos.
*   🔒 **Seguridad:** Las claves se gestionan con variables de entorno en Vercel, sin exponerlas en el código del cliente.
*   📱 **PWA:** Se puede instalar en móviles y escritorio.

## 🧩 Cómo encaja todo

| Pieza | Para qué sirve |
|---|---|
| **Vercel** | Aloja la web y las funciones serverless de `/api`. Ejecuta el cron diario. |
| **Firebase Auth** | Login de usuarios. El backend verifica el token de cada petición. |
| **Firebase Cloud Messaging** | Envía el recordatorio diario al topic `finanzas-recordatorios`. |
| **MongoDB Atlas** | Guarda los presupuestos (base de datos `finanzas_mensuales`, colección `budgets`). |

Los datos viven en MongoDB, no en Firebase. Firebase solo identifica al usuario y envía notificaciones.

## 📂 Estructura del Proyecto

*   `api/`: el backend, que es la parte principal (lo que consume la app móvil).
*   `index.html`, `style.css`, `app.js`: interfaz y lógica de la versión web (complemento).
*   `sw.js`, `manifest.json`: service worker y manifiesto de la PWA.
*   `api/config.js`: entrega al navegador la configuración pública de Firebase (lee variables de entorno).
*   `api/budgets.js`: guarda, lista y elimina presupuestos por usuario en MongoDB (`GET`, `POST`, `DELETE`). Requiere `Authorization: Bearer <idToken de Firebase>`.
*   `api/internal/notifications/daily-reminder.js`: envía el recordatorio diario por FCM. Protegido con `CRON_SECRET`; acepta `GET` (lo que usa Vercel Cron) y `POST`.
*   `api/_lib/`: utilidades compartidas (`auth.js`, `mongodb.js`, `firebaseMessaging.js`, `http.js`).
*   `vercel.json`: define los crons. Mañana `0 15 * * *` (15:00 UTC = 10:00 a.m. Colombia) y noche `0 1 * * *` con `?slot=night` (01:00 UTC = 8:00 p.m. Colombia). El plan gratuito permite máximo 2 crons, una vez al día cada uno.

## 🔗 Proyecto de Vercel correcto

Este repo está conectado a GitHub y se despliega en el proyecto **`finanzas-mensuales`** (`https://finanzas-jj.vercel.app`). Ese es el proyecto en producción.

Existe otro proyecto llamado `ia` en la misma cuenta de Vercel que **no se usa**. La carpeta `.vercel/` local apunta a `ia`, así que comandos como `vercel env ls` o `vercel deploy` desde esta carpeta actúan sobre `ia`, no sobre `finanzas-mensuales`. Para trabajar con el correcto usa el dashboard o vincula la carpeta con `vercel link`.

## 🚀 Despliegue en Vercel

### 1. Firebase

1.  Crea un proyecto en la [consola de Firebase](https://console.firebase.google.com/).
2.  En Authentication > Sign-in method, habilita **Google** y **Anónimo**.
3.  En Configuración del proyecto > Cuentas de servicio, genera una clave privada JSON. Ese JSON completo (o en base64) va en `FIREBASE_SERVICE_ACCOUNT_KEY`.
4.  En Authentication > Settings > Dominios autorizados, agrega tu dominio de Vercel (por ejemplo `finanzas-jj.vercel.app`).

### 2. MongoDB Atlas

Crea un cluster, un usuario de base de datos y copia la cadena de conexión (Connect > Drivers). En Network Access permite `0.0.0.0/0`, porque Vercel usa IPs cambiantes.

### 3. Variables de entorno en Vercel

Settings > Environment Variables del proyecto `finanzas-mensuales`, con Production marcado (y Preview si usas previews):

| Variable | Valor / dónde obtenerla |
|---|---|
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | Firebase Console > Configuración del proyecto > tu app web |
| `FIREBASE_PROJECT_ID` | `control-de-finanzas-mensuales`. Es una variable propia: no basta con tenerla dentro del JSON del service account, porque `/api/config` la lee directamente |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON completo de la cuenta de servicio |
| `MONGODB_URI` | Cadena de conexión de Atlas con la contraseña real |
| `MONGODB_DB_NAME` | `finanzas_mensuales` (con guion bajo) |
| `CRON_SECRET` | Texto largo y aleatorio que tú inventas. Vercel Cron lo envía solo en `Authorization: Bearer ...` |

Alternativa al JSON del service account: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.

**Después de cambiar cualquier variable hay que hacer Redeploy**: los deployments ya hechos no leen los valores nuevos.

## 🔔 Notificaciones

*   El servidor envía al topic `finanzas-recordatorios`. Cada dispositivo debe suscribirse una vez (tras iniciar sesión):
    ```dart
    await FirebaseMessaging.instance.requestPermission();
    await FirebaseMessaging.instance.subscribeToTopic('finanzas-recordatorios');
    ```
*   Probar el envío sin esperar al cron:
    ```powershell
    curl.exe -X POST https://finanzas-jj.vercel.app/api/internal/notifications/daily-reminder -H "x-cron-secret: TU_CRON_SECRET"
    ```
    Respuesta esperada: `{"success":true,"messageId":...}`. Solo permite un envío exitoso por hora por instancia (responde 429 si se repite).
*   Para ver si el cron corrió: Vercel > Logs > busca `[daily-reminder] Message sent successfully`.

## 🛠️ Si volví al proyecto después de mucho tiempo

Revisa esto en orden:

1.  **MongoDB pausado.** El plan gratuito de Atlas pausa el cluster tras varios días sin conexiones. Síntoma: `/api/budgets` responde 500 y la app no carga ni guarda datos. Solución: entra a Atlas, abre el cluster y pulsa **Resume** (tarda unos minutos). Los datos no se pierden. Atlas suele avisar por correo antes de pausarlo.
2.  **Deployment Protection de Vercel.** Si las llamadas a `/api/*` devuelven un redirect 302 a `vercel.com/sso-api`, la protección SSO está activada y bloquea la API. Desactívala en Settings > Deployment Protection (Vercel Authentication).
3.  **Variables de entorno.** Verifica que existan todas en el proyecto correcto (`finanzas-mensuales`). Si falta `FIREBASE_API_KEY`, `/api/config` da 500; si falta `CRON_SECRET`, el recordatorio da 500.
4.  **Contraseña de MongoDB o IP.** Si cambiaste la contraseña del usuario de base de datos, actualiza `MONGODB_URI`. En Network Access debe estar permitido `0.0.0.0/0`.
5.  **Clave de Firebase.** Si generaste una clave nueva del service account, actualiza `FIREBASE_SERVICE_ACCOUNT_KEY` y redepliega.

### Diagnóstico rápido con curl

```powershell
curl.exe -i https://finanzas-jj.vercel.app/api/config
curl.exe -i https://finanzas-jj.vercel.app/api/budgets
```

| Resultado | Significado |
|---|---|
| `/api/config` → 200 con `projectId` | Variables de Firebase correctas |
| `/api/config` → 500 | Faltan variables de Firebase en Vercel |
| `/api/config` → 302 | Deployment Protection activada |
| `/api/budgets` → 401 `missing-token` | Normal sin sesión iniciada |
| `/api/budgets` → 500 `server-misconfiguration` | Falta `MONGODB_URI` o credenciales de Firebase Admin |
| `/api/budgets` → 500 `unexpected-error` | Suele ser MongoDB pausado o inaccesible |

## ⚠️ Seguridad

*   **Nunca subas a GitHub** el JSON del service account de Firebase ni `.env.local`. Si una clave se filtra, genera una nueva en Firebase Console y borra la anterior.
*   No pongas `CRON_SECRET` en el código de la app Flutter ni en el frontend: solo vive en Vercel y en tu PC para pruebas.

## ✅ Verificación rápida

1.  Inicia sesión con Google.
2.  Guarda un mes de presupuesto.
3.  Abre la app en otro dispositivo con la misma cuenta y confirma que el presupuesto aparece.
