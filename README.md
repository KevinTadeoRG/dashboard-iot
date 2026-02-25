# 🏭 Real-Time IIoT Telemetry Dashboard

Una aplicación web Fullstack diseñada para monitorear telemetría de equipos de piso (compresores, caudalímetros) en tiempo real, cerrando la brecha entre los sistemas tradicionales de automatización y las arquitecturas web modernas.

## 🎯 El Problema
Los sistemas de monitoreo en planta a menudo dependen de plataformas cerradas o tienen latencia en la visualización de datos. El objetivo de este proyecto es demostrar cómo desacoplar la adquisición de datos de la capa de visualización utilizando tecnologías web de código abierto.

## 💡 La Solución
Desarrollo de un Dashboard reactivo que no requiere recargar la página para mostrar nuevos valores. Emplea un flujo de datos bidireccional que simula el comportamiento de un servidor OPC/MQTT publicando tags en tiempo real hacia clientes web.

## 🛠️ Stack Tecnológico
* **Backend:** Node.js, Express
* **Comunicación en Tiempo Real:** Socket.io (WebSockets)
* **Base de Datos (Historian):** SQLite
* **Frontend:** HTML, CSS, JavaScript, Chart.js

## 🚀 Características Clave
* Generación y transmisión de datos de sensores simulados cada 2 segundos.
* Persistencia de datos históricos localmente.
* Carga automática de la última hora de datos al inicializar la vista (Fetch API).
* Interfaz gráfica dinámica con efecto de scroll temporal.
* Indicador de estado de conexión cliente-servidor (Watchdog).