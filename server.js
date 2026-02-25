const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path'); // NUEVO: Herramienta para manejar rutas de archivos

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// NUEVO: Cuando alguien entre a http://localhost:3000, el servidor le entregará el archivo index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Crear y conectar a la base de datos
const db = new sqlite3.Database('./historico.db', (err) => {
    if (err) console.error("Error al abrir base de datos", err);
    else console.log("Conectado a la base de datos SQLite.");
});

db.run(`CREATE TABLE IF NOT EXISTS telemetria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor TEXT,
    presion REAL,
    unidad TEXT,
    timestamp TEXT
)`);

// Ruta API para el histórico
app.get('/api/historico', (req, res) => {
    db.all(`SELECT * FROM telemetria ORDER BY id DESC LIMIT 15`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows.reverse()); 
    });
});

io.on('connection', (socket) => {
    console.log('Un nuevo cliente web se ha conectado:', socket.id);
});

// El simulador de datos
setInterval(() => {
    const presionSimulada = (Math.random() * (120 - 100) + 100).toFixed(2); 
    const timestampActual = new Date().toLocaleTimeString();

    const datosTelemetria = {
        sensor: "Compresor_01",
        presion: parseFloat(presionSimulada),
        unidad: "PSI",
        timestamp: timestampActual
    };

    // Guardar en base de datos y emitir
    db.run(`INSERT INTO telemetria (sensor, presion, unidad, timestamp) VALUES (?, ?, ?, ?)`, 
        [datosTelemetria.sensor, datosTelemetria.presion, datosTelemetria.unidad, datosTelemetria.timestamp],
        function(err) {
            if (err) return console.log(err.message);
            io.emit('telemetria_compresor', datosTelemetria); 
        }
    );

}, 2000);

const PUERTO = 3000;
server.listen(PUERTO, () => {
    console.log(`Servidor de telemetría corriendo en http://localhost:${PUERTO}`);
});