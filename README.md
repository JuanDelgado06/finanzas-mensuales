# 💰 Control de Finanzas Mensuales App

Esta es una aplicación web progresiva (PWA) diseñada para ayudar a los usuarios a llevar un control detallado de sus finanzas personales mes a mes. Permite registrar activos, deudas, establecer metas de ahorro y visualizar el estado financiero de forma clara y sencilla.

## ✨ Características Principales

*   📊 **Gestión Financiera Completa:** Registra activos, ingresos, deudas a tu favor y pasivos (incluyendo un manejo especial para tarjetas de crédito con pago total y mínimo).

*   🧮 **Cálculos Automáticos:** La aplicación calcula en tiempo real el total de activos, el total de deudas, el saldo parcial y el saldo total.

*   🎯 **Metas de Ahorro:** Establece un objetivo de ahorro mensual y visualiza tu progreso con una barra motivacional.

*   💾 **Doble Sistema de Guardado:**

    *   **Modo Invitado:** Los datos se guardan de forma segura en el localStorage del navegador.

    *   **Inicio de Sesión con Google:** Los datos se almacenan en la nube con **MongoDB Atlas** a través de una API segura, permitiendo el acceso desde cualquier dispositivo.

*   🔄 **Migración Automática:** Si un usuario empieza como invitado y luego inicia sesión, sus datos locales se transfieren automáticamente a su cuenta en la nube (MongoDB Atlas).

*   🔒 **Seguridad:** Las claves de Firebase se gestionan de forma segura a través de variables de entorno en Vercel, sin exponerlas en el código del cliente.

*   📱 **PWA (Progressive Web App):** La aplicación se puede "instalar" en dispositivos móviles y de escritorio para un acceso rápido.

## 📂 Estructura del Proyecto

El proyecto está organizado en archivos separados para mantener el código limpio y mantenible:

*   index.html: Contiene la estructura principal de la interfaz de usuario (HTML).

*   style.css: Contiene todos los estilos personalizados de la aplicación.

*   app.js: El corazón de la aplicación. Contiene toda la lógica de la interfaz, el manejo de eventos y la interacción con el servicio de datos.

*   /api/config.js: Una función sin servidor (Serverless Function) de Vercel que lee las claves de Firebase desde variables de entorno.

*   /api/budgets.js: API serverless que guarda, lista y elimina presupuestos por usuario autenticado en MongoDB Atlas.

## 🚀 Guía de Despliegue en Vercel

Sigue estos pasos para publicar tu propia versión de la aplicación:

### 1. Configuración de Firebase

1.  **Crea un Proyecto:** Ve a la [consola de Firebase](https://console.firebase.google.com/) y crea un nuevo proyecto.

2.  **Activa la Autenticación:** En Compilación > Authentication > Sign-in method, habilita los proveedores **Google** y **Anónimo**.

3.  **Crea tu proyecto en MongoDB Atlas:** Genera un cluster, crea un usuario de base de datos y copia la cadena de conexión.

4.  **Crea una cuenta de servicio para Firebase Admin (backend):**

  *   Ve a Firebase Console > Configuración del proyecto > Cuentas de servicio.

  *   Genera una nueva clave privada JSON.

  *   Guarda ese JSON como variable de entorno en Vercel usando `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON completo o en base64).

5.  **(Opcional) Variables separadas de Firebase Admin:** Si no usas el JSON completo, configura estas variables:

  *   `FIREBASE_PROJECT_ID`

  *   `FIREBASE_CLIENT_EMAIL`

  *   `FIREBASE_PRIVATE_KEY`

### 2. Preparación del Repositorio

1.  **Sube los Archivos:** Sube los archivos `index.html`, `style.css`, `app.js`, `package.json` y la carpeta `api` con su contenido a tu repositorio de GitHub.

### 3. Despliegue en Vercel

1.  **Importa el Proyecto:** En tu panel de [Vercel](https://vercel.com/), importa el repositorio de GitHub.

2.  **Añade las Variables de Entorno (obligatorias):**

  *   Firebase cliente (para login en frontend):

    *   `FIREBASE_API_KEY`

    *   `FIREBASE_AUTH_DOMAIN`

    *   `FIREBASE_PROJECT_ID`

    *   `FIREBASE_STORAGE_BUCKET`

    *   `FIREBASE_MESSAGING_SENDER_ID`

    *   `FIREBASE_APP_ID`

  *   MongoDB Atlas (para datos en la nube):

    *   `MONGODB_URI`

    *   `MONGODB_DB_NAME` (ejemplo: `finanzas_mensuales`)

  *   Firebase Admin (verificación de token en backend):

    *   `FIREBASE_SERVICE_ACCOUNT_KEY`

3.  **Autoriza el Dominio en Firebase Authentication:**

  *   Ve a Authentication > Settings > Dominios autorizados.

  *   Añade tu dominio de Vercel (por ejemplo `finanzas-jj.vercel.app`).

### 4. Verificación Rápida

1.  Inicia sesión con Google.

2.  Guarda un mes de presupuesto.

3.  Abre la app en otro dispositivo con la misma cuenta y confirma que el presupuesto aparece.
¡Y listo! Tu aplicación quedará autenticada con Firebase y con almacenamiento de datos en MongoDB Atlas.
