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


// Escuchamos el evento 'telemetria' que viene del servidor
socket.on('telemetria', (data) => {
    
    // 1. Actualizamos los textos (Esto ya te funciona perfecto)
    document.getElementById('displayPresion').innerText = data.presion + " PSI";
    document.getElementById('displayHora').innerText = "Última lectura: " + data.timestamp;
    
    const statusIA = document.getElementById('statusIA');
    const indicadorAlarma = document.getElementById('indicadorAlarma');

    if (data.estado_ia === 'Normal') {
        statusIA.innerText = "Salud del Equipo: Óptima";
        statusIA.style.color = "#28a745"; 
        indicadorAlarma.style.display = "none"; 
    } else {
        statusIA.innerText = "🚨 Falla Predictiva Detectada";
        statusIA.style.color = "#dc3545"; 
        indicadorAlarma.innerText = "⚠️ ALARMA: CAÍDA DE PRESIÓN (POSIBLE FUGA)";
        indicadorAlarma.style.display = "block"; 
    }

    // 3. AQUI ESTÁ LA MAGIA CORREGIDA: Usamos chartPresion
    chartPresion.data.labels.push(data.timestamp);
    chartPresion.data.datasets[0].data.push(data.presion);

    // Mantenemos la gráfica moviéndose (ventana de 20 lecturas)
    if (chartPresion.data.labels.length > 20) {
        chartPresion.data.labels.shift();
        chartPresion.data.datasets[0].data.shift();
    }

    // Repintamos la gráfica
    chartPresion.update();
});