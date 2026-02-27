# ☁️ Industrial IoT Telemetry Dashboard | Cloud Backend

![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs)
![Oracle Cloud](https://img.shields.io/badge/Oracle_Cloud-OCI_Vault-F80000?logo=oracle)
![Render](https://img.shields.io/badge/Render-Deployment-000000?logo=render)
![Security](https://img.shields.io/badge/Security-Zero_Trust-blue)

Este proyecto es el núcleo (backend) de una plataforma IIoT (Internet Industrial de las Cosas) diseñada para la ingesta, almacenamiento y visualización de telemetría proveniente de equipos industriales en piso de planta (ej. compresores, medidores de flujo) hacia la nube.

## 🏗️ Arquitectura del Sistema

El sistema está diseñado para actuar como un puente seguro entre los sistemas de control industrial (SCADA/PLCs) y la infraestructura en la nube (Oracle Cloud Infrastructure).

1. **Ingesta de Datos:** API REST preparada para recibir telemetría industrial en tiempo real (Presión, Temperatura, Flujo).
2. **Procesamiento y WebSockets:** Servidor Node.js/Express que distribuye los datos en tiempo real al frontend del dashboard mediante `Socket.io`.
3. **Almacenamiento Transaccional:** Conexión a Oracle Autonomous Database (ATP) para registro histórico y análisis a largo plazo.

## 🔐 Seguridad y Gobernanza (Zero Trust)

Este proyecto implementa una arquitectura de **"Cero Confianza"** y cumple con los estándares empresariales para el manejo de credenciales:

* **OCI Vault (Gestión de Secretos):** Ninguna contraseña ni certificado mTLS (`ewallet.pem`) está en el código fuente o en el repositorio. Las credenciales se almacenan encriptadas en la bóveda de Oracle Cloud.
* **Aprovisionamiento Dinámico:** Durante el arranque en producción, el servidor Node.js se autentica vía OCI IAM (API Keys), extrae el *payload* en Base64 desde el Vault, lo decodifica y ensambla los certificados de red (`tnsnames.ora`, `sqlnet.ora`, `ewallet.pem`) en memoria efímera.
* **Motor "Thin":** Uso del driver de Oracle en modo ultraligero, optimizando el tamaño del *Wallet* a menos de 10 KB para un despliegue rápido y seguro.

## 🛠️ Stack Tecnológico

* **Backend:** Node.js, Express.js
* **Base de Datos:** Oracle Autonomous Transaction Processing (ATP)
* **Seguridad Cloud:** OCI IAM, OCI Secrets & Vault (`oci-secrets`, `oci-common`)
* **Comunicación Real-Time:** Socket.io
* **Despliegue:** Render (con inyección de Secret Files en `/etc/secrets/`)

## 🚀 Despliegue Local (Desarrollo)

Para ejecutar este proyecto en un entorno local, es necesario contar con credenciales de OCI IAM configuradas:

1. Clonar el repositorio.
2. Instalar dependencias: `npm install`
3. Colocar la llave privada (`oci_api_key.pem`) y el archivo de configuración (`oci_config`) en la raíz del proyecto.
4. Ejecutar el servidor: `npm start`
*Nota: El sistema detectará la ausencia del Wallet local y lo aprovisionará automáticamente conectándose a la nube.*

---
*Desarrollado para demostrar la integración segura entre infraestructuras OT y plataformas IT nativas en la nube.*