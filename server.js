require('dotenv').config(); // Cargar la contraseña secreta
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const oracledb = require('oracledb'); // El nuevo driver industrial

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Le decimos a Oracle que nos entregue los datos en formato JSON, no en arreglos puros
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. INICIALIZAR LA CONEXIÓN A OCI
async function iniciarOracle() {
    try {
        await oracledb.createPool({
            user: "ADMIN",
            password: process.env.DB_PASSWORD, // Lo lee de tu archivo .env
            connectString: "(description= (retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=1522)(host=adb.mx-monterrey-1.oraclecloud.com))(connect_data=(service_name=g1504cc4cf398d5_iotdb_tp.adb.oraclecloud.com))(security=(ssl_server_dn_match=yes)))", // <--- CAMBIA ESTO por el nombre que viste en tu tnsnames.ora
            walletLocation: path.join(__dirname, "wallet_iot"),
            walletPassword: process.env.DB_PASSWORD // Usualmente es la misma contraseña
        });
        console.log("🟢 Conectado exitosamente a Oracle Cloud (Autonomous Database)");
    } catch (err) {
        console.error("🔴 Error conectando a Oracle:", err);
    }
}
iniciarOracle(); // Ejecutamos la conexión al arrancar

// 2. RUTA HISTÓRICO (Endpoint)
app.get('/api/historico', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        // En Oracle, LIMIT se escribe como FETCH FIRST n ROWS ONLY
        const result = await connection.execute(
            `SELECT * FROM TELEMETRIA ORDER BY ID DESC FETCH FIRST 15 ROWS ONLY`
        );
        
        // Oracle devuelve las columnas en MAYÚSCULAS. Las pasamos a minúsculas para no romper tu frontend.
        const datosFormateados = result.rows.map(row => ({
            id: row.ID,
            sensor: row.SENSOR,
            presion: row.PRESION,
            unidad: row.UNIDAD,
            timestamp: row.TIMESTAMP
        }));
        
        res.json(datosFormateados.reverse());
    } catch (err) {
        res.status(500).json({ error: "Error consultando histórico en OCI" });
    } finally {
        if (connection) await connection.close(); // Siempre cerramos la conexión para no saturar el pool
    }
});

// 3. RUTA EXPORTAR A EXCEL (CSV)
app.get('/api/exportar', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(`SELECT * FROM TELEMETRIA ORDER BY ID DESC`);
        
        let csv = 'ID,Sensor,Presion_PSI,Fecha_Hora\n';
        result.rows.forEach(fila => {
            csv += `${fila.ID},${fila.SENSOR},${fila.PRESION},${fila.TIMESTAMP}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment('Reporte_Cloud_Compresor.csv');
        return res.send(csv);
    } catch (err) {
        res.status(500).send("Error exportando desde OCI");
    } finally {
        if (connection) await connection.close();
    }
});

// 4. LÓGICA DE WEBSOCKETS Y SIMULADOR
io.on('connection', (socket) => {
    console.log('Cliente web conectado al sistema.');
});

setInterval(async () => {
    const presionSimulada = (Math.random() * (120 - 100) + 100).toFixed(2); 
    const timestampActual = new Date().toLocaleTimeString();

    const datosTelemetria = {
        sensor: "Compresor_01",
        presion: parseFloat(presionSimulada),
        unidad: "PSI",
        timestamp: timestampActual
    };

    let connection;
    try {
        connection = await oracledb.getConnection();
        // En Oracle, por seguridad, se usan "Bind Variables" (:1, :2) en lugar de signos de interrogación (?, ?)
        await connection.execute(
            `INSERT INTO TELEMETRIA (SENSOR, PRESION, UNIDAD, TIMESTAMP) VALUES (:1, :2, :3, :4)`,
            [datosTelemetria.sensor, datosTelemetria.presion, datosTelemetria.unidad, datosTelemetria.timestamp],
            { autoCommit: true } // VITAL: Si no pones esto, Oracle no guarda el dato permanentemente
        );
        
        // Solo emitimos al Frontend si el dato se guardó exitosamente en la nube
        io.emit('telemetria_compresor', datosTelemetria); 
    } catch (err) {
        console.error("Error insertando en OCI:", err);
    } finally {
        if (connection) await connection.close();
    }

}, 2000);

// 5. ENCENDER SERVIDOR
const PUERTO = process.env.PORT || 3000;
server.listen(PUERTO, () => {
    console.log(`Motor Node.js arrancado en el puerto ${PUERTO}`);
});