const socket = io();

// Cambiar a rojo si se pierde la conexión
socket.on('disconnect', () => {
    const statusDiv = document.getElementById('indicadorStatus');
    statusDiv.style.backgroundColor = '#dc3545';
    statusDiv.innerHTML = '🔴 Conexión Perdida';
});

// Volver a verde si se reconecta
socket.on('connect', () => {
    const statusDiv = document.getElementById('indicadorStatus');
    statusDiv.style.backgroundColor = '#28a745';
    statusDiv.innerHTML = '🟢 Conectado al Servidor';
});

// B. CONFIGURAR LA GRÁFICA (Chart.js)
const ctx = document.getElementById('graficaPresion').getContext('2d');
const chartPresion = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [], 
        datasets: [{
            label: 'Presión (PSI)',
            data: [], 
            borderColor: 'rgba(0, 123, 255, 1)',
            backgroundColor: 'rgba(0, 123, 255, 0.2)',
            borderWidth: 2,
            tension: 0.4 
        }]
    },
    options: {
        responsive: true,
        animation: false, 
        scales: { y: { min: 90, max: 130 } }
    }
});

// NUEVO C. CARGAR DATOS HISTÓRICOS AL INICIAR
// Hacemos una petición (Fetch) a la ruta que creamos en el servidor
fetch('/api/historico')
    .then(respuesta => respuesta.json()) // Convertimos la respuesta a formato JSON
    .then(datosHistoricos => {
        // Por cada dato guardado, lo metemos a la gráfica
        datosHistoricos.forEach(dato => {
            chartPresion.data.labels.push(dato.timestamp);
            chartPresion.data.datasets[0].data.push(dato.presion);
        });
        chartPresion.update(); // Dibujamos el historial
    })
    .catch(error => console.error("Error cargando historial:", error));

// D. ESCUCHAR LOS DATOS NUEVOS EN TIEMPO REAL
socket.on('telemetria_compresor', (datos) => {
    
    document.getElementById('displayPresion').innerText = datos.presion + " " + datos.unidad;
    document.getElementById('displayHora').innerText = "Última lectura: " + datos.timestamp;

    chartPresion.data.labels.push(datos.timestamp);
    chartPresion.data.datasets[0].data.push(datos.presion);

    if (chartPresion.data.labels.length > 15) {
        chartPresion.data.labels.shift();
        chartPresion.data.datasets[0].data.shift();
    }
    // LÓGICA DE ALARMAS (Set-Point: 115 PSI)
    const tarjeta = document.getElementById('tarjetaPresion');
    const indicadorAlarma = document.getElementById('indicadorAlarma');
    const valorPresion = document.getElementById('displayPresion');

    if (datos.presion >= 115) {
        // ACTIVAR ALARMA: Tarjeta roja y gráfica roja
        tarjeta.style.backgroundColor = "#ffe6e6";
        tarjeta.style.border = "2px solid #dc3545";
        valorPresion.style.color = "#dc3545";
        indicadorAlarma.style.display = "inline-block"; // Mostrar letrero
        
        // Cambiar color de la línea de Chart.js a rojo
        chartPresion.data.datasets[0].borderColor = 'rgba(220, 53, 69, 1)';
        chartPresion.data.datasets[0].backgroundColor = 'rgba(220, 53, 69, 0.2)';
    } else {
        // ESTADO NORMAL: Tarjeta blanca y gráfica azul
        tarjeta.style.backgroundColor = "white";
        tarjeta.style.border = "none";
        valorPresion.style.color = "#007bff";
        indicadorAlarma.style.display = "none"; // Ocultar letrero

        // Cambiar color de la línea de Chart.js a azul
        chartPresion.data.datasets[0].borderColor = 'rgba(0, 123, 255, 1)';
        chartPresion.data.datasets[0].backgroundColor = 'rgba(0, 123, 255, 0.2)';
    }
    chartPresion.update();

    // ==========================================
    // LÓGICA DE IA PREDICTIVA (Simulación OCI)
    // ==========================================
    // 1. Guardar un historial corto en la memoria del navegador
    if (!window.memoriaIA) window.memoriaIA = [];
    window.memoriaIA.push(datos.presion);
    
    // Mantener solo las últimas 5 lecturas para el análisis
    if (window.memoriaIA.length > 5) window.memoriaIA.shift();

    // 2. Calcular el promedio de esas 5 lecturas
    let suma = window.memoriaIA.reduce((a, b) => a + b, 0);
    let promedioTendencia = suma / window.memoriaIA.length;

    // 3. Evaluar la tendencia (Detección de anomalías)
    const statusIA = document.getElementById('statusIA');
    
    if (promedioTendencia > 113) {
        statusIA.innerText = "⚠️ Tendencia Anómala: Revisar Válvulas";
        statusIA.style.color = "#ffc107"; // Amarillo de advertencia predictiva
    } else if (promedioTendencia < 102) {
        statusIA.innerText = "⚠️ Riesgo de Despresurización";
        statusIA.style.color = "#ffc107"; 
    } else {
        statusIA.innerText = "Salud del Equipo: Óptima";
        statusIA.style.color = "#28a745"; // Verde
    }
});