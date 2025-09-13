# 💰 Control de Finanzas Mensuales App

Esta es una aplicación web progresiva (PWA) diseñada para ayudar a los usuarios a llevar un control detallado de sus finanzas personales mes a mes. Permite registrar activos, deudas, establecer metas de ahorro y visualizar el estado financiero de forma clara y sencilla.

## ✨ Características Principales

*   📊 **Gestión Financiera Completa:** Registra activos, ingresos, deudas a tu favor y pasivos (incluyendo un manejo especial para tarjetas de crédito con pago total y mínimo).

*   🧮 **Cálculos Automáticos:** La aplicación calcula en tiempo real el total de activos, el total de deudas, el saldo parcial y el saldo total.

*   🎯 **Metas de Ahorro:** Establece un objetivo de ahorro mensual y visualiza tu progreso con una barra motivacional.

*   💾 **Doble Sistema de Guardado:**

    *   **Modo Invitado:** Los datos se guardan de forma segura en el localStorage del navegador.

    *   **Inicio de Sesión con Google:** Los datos se almacenan en la nube con Firebase Firestore, permitiendo el acceso desde cualquier dispositivo.

*   🔄 **Migración Automática:** Si un usuario empieza como invitado y luego inicia sesión, sus datos locales se transfieren automáticamente a su cuenta en la nube.

*   🔒 **Seguridad:** Las claves de Firebase se gestionan de forma segura a través de variables de entorno en Vercel, sin exponerlas en el código del cliente.

*   📱 **PWA (Progressive Web App):** La aplicación se puede "instalar" en dispositivos móviles y de escritorio para un acceso rápido.

## 📂 Estructura del Proyecto

El proyecto está organizado en archivos separados para mantener el código limpio y mantenible:

*   index.html: Contiene la estructura principal de la interfaz de usuario (HTML).

*   style.css: Contiene todos los estilos personalizados de la aplicación.

*   app.js: El corazón de la aplicación. Contiene toda la lógica de la interfaz, el manejo de eventos y la interacción con el servicio de datos.

*   /api/config.js: Una función sin servidor (Serverless Function) de Vercel que lee las claves de Firebase desde las variables de entorno y las entrega de forma segura a la aplicación.

## 🚀 Guía de Despliegue en Vercel

Sigue estos pasos para publicar tu propia versión de la aplicación:

### 1. Configuración de Firebase

1.  **Crea un Proyecto:** Ve a la [consola de Firebase](https://console.firebase.google.com/) y crea un nuevo proyecto.

2.  **Activa la Autenticación:** En Compilación > Authentication > Sign-in method, habilita los proveedores **Google** y **Anónimo**.

3.  **Crea la Base de Datos:** Ve a Compilación > Firestore Database y crea una nueva base de datos en **modo de producción**.

4.  **Establece las Reglas de Seguridad:** En la pestaña Reglas de Firestore, reemplaza el contenido con lo siguiente y publica los cambios:

    ```

    rules_version = '2';

    service cloud.firestore {

      match /databases/{database}/documents {

        match /budgets/{userId}/{document=**} {

          allow read, write: if request.auth != null && request.auth.uid == userId;

        }

      }

    }

    ```

### 2. Preparación del Repositorio

1.  **Sube los Archivos:** Sube los archivos index.html, style.css, app.js y la carpeta api con su contenido a un repositorio de GitHub.

### 3. Despliegue en Vercel

1.  **Importa el Proyecto:** En tu panel de [Vercel](https://vercel.com/), importa el repositorio de GitHub. Vercel detectará la estructura y lo desplegará.

2.  **Añade las Variables de Entorno:**

    *   En la configuración de tu proyecto en Vercel, ve a Settings > Environment Variables.

    *   Añade las siguientes variables con las claves de tu proyecto de Firebase:

        *   FIREBASE_API_KEY

        *   FIREBASE_AUTH_DOMAIN

        *   FIREBASE_PROJECT_ID

        *   FIREBASE_STORAGE_BUCKET

        *   FIREBASE_MESSAGING_SENDER_ID

        *   FIREBASE_APP_ID

3.  **Autoriza el Dominio:**

    *   Vercel te asignará una URL (ej: mi-app.vercel.app).

    *   Vuelve a la consola de Firebase, a Authentication > Settings > Dominios autorizados.

    *   Haz clic en "Añadir dominio" y pega la URL que te dio Vercel.

¡Y listo! Tu aplicación estará funcionando en línea de forma segura y profesional.
