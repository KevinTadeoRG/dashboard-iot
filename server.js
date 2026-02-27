const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const oracledb = require('oracledb');
const fs = require('fs');
const AdmZip = require('adm-zip');

// Librerías de seguridad de Oracle Cloud
const common = require('oci-common');
const secrets = require('oci-secrets');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;


// ==========================================
// FASE 1: EXTRAER SECRETO DE OCI VAULT
// ==========================================
const OCID_SECRETO = "ocid1.vaultsecret.oc1.mx-monterrey-1.amaaaaaawbfvrzqah3escr5xgj6ww6bpciowhkioqsnxggpprg7l4k53sp2q"; 

async function obtenerSecretoOCI() {
    console.log("🔐 Contactando a OCI Vault...");
    // Leemos el archivo de configuración que creaste
const rutaConfig = fs.existsSync('/etc/secrets/oci_config') ? '/etc/secrets/oci_config' : './oci_config';
    
    const provider = new common.ConfigFileAuthenticationDetailsProvider(rutaConfig, "DEFAULT");
    const client = new secrets.SecretsClient({ authenticationDetailsProvider: provider });

    const response = await client.getSecretBundle({ secretId: OCID_SECRETO });
    const contentBase64 = response.secretBundle.secretBundleContent.content;
    
    // Decodificamos el Base64 que nos entrega Oracle
    let contenidoString = Buffer.from(contentBase64, 'base64').toString('utf8');
    
    // NUEVA LÍNEA SALVAVIDAS: Limpiamos saltos de línea (\n), retornos (\r) y tabulaciones (\t)
    // que se hayan colado al copiar y pegar en el navegador.
    contenidoString = contenidoString.replace(/[\n\r\t]/g, "");
    
    return JSON.parse(contenidoString); // Ahora sí, el JSON está perfectamente limpio
}

// ==========================================
// FASE 2: ARRANQUE SEGURO DEL SISTEMA
// ==========================================

async function arrancarSistema() {
    try {
        // 1. Ir a la bóveda por las credenciales
        const credenciales = await obtenerSecretoOCI();

        let rutaWallet = path.join(__dirname, "wallet_iot");

        // 2. Extraer el Wallet si no existe el archivo clave
        if (!fs.existsSync(path.join(rutaWallet, "tnsnames.ora"))) {
            console.log("📦 Descomprimiendo Wallet seguro...");
            
            if (!fs.existsSync(rutaWallet)) {
                fs.mkdirSync(rutaWallet);
            }

            fs.writeFileSync('wallet.zip', Buffer.from(credenciales.wallet_base64, 'base64'));
            const zip = new AdmZip('wallet.zip');
            zip.extractAllTo(rutaWallet, true);
        }

        // 🔧 AUTO-CORRECCIÓN: Síndrome de la "muñeca rusa" (carpeta doble)
        if (!fs.existsSync(path.join(rutaWallet, "tnsnames.ora"))) {
            const archivos = fs.readdirSync(rutaWallet);
            // Si hay una carpeta adentro, apuntamos la ruta hacia esa subcarpeta automáticamente
            if (archivos.length > 0 && fs.lstatSync(path.join(rutaWallet, archivos[0])).isDirectory()) {
                rutaWallet = path.join(rutaWallet, archivos[0]);
            }
        }

        // 3. Forzar la ruta para el driver de Oracle a nivel Sistema Operativo (Infalible)
        process.env.TNS_ADMIN = rutaWallet;

        // 4. Conectar a la Base de Datos
        await oracledb.createPool({
            user: "ADMIN",
            password: credenciales.password,
            connectString: "iotdb_tp", 
            configDir: rutaWallet,
            walletLocation: rutaWallet,
            walletPassword: credenciales.password
        });
        
        console.log("🟢 Conectado exitosamente a Oracle Cloud vía OCI Vault!");

    } catch (err) {
        console.error("🔴 Error Crítico en el arranque:", err);
    }
}

// Ejecutamos la secuencia de arranque
arrancarSistema();

// ==========================================
// RUTAS Y WEBSOCKETS (Se mantienen igual)
// ==========================================
app.get('/api/historico', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(`SELECT * FROM TELEMETRIA ORDER BY ID DESC FETCH FIRST 15 ROWS ONLY`);
        const datosFormateados = result.rows.map(row => ({
            id: row.ID, sensor: row.SENSOR, presion: row.PRESION, unidad: row.UNIDAD, timestamp: row.TIMESTAMP
        }));
        res.json(datosFormateados.reverse());
    } catch (err) {
        res.status(500).json({ error: "Error consultando histórico" });
    } finally {
        if (connection) await connection.close();
    }
});

app.get('/api/exportar', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection();
        const result = await connection.execute(`SELECT * FROM TELEMETRIA ORDER BY ID DESC`);
        let csv = 'ID,Sensor,Presion_PSI,Fecha_Hora\n';
        result.rows.forEach(fila => { csv += `${fila.ID},${fila.SENSOR},${fila.PRESION},${fila.TIMESTAMP}\n`; });
        res.header('Content-Type', 'text/csv');
        res.attachment('Reporte_Cloud_Compresor.csv');
        return res.send(csv);
    } catch (err) {
        res.status(500).send("Error exportando desde OCI");
    } finally {
        if (connection) await connection.close();
    }
});

io.on('connection', (socket) => {
    console.log('Cliente web conectado al dashboard.');
});

setInterval(async () => {
    const presionSimulada = (Math.random() * (120 - 100) + 100).toFixed(2); 
    const timestampActual = new Date().toLocaleTimeString('es-MX', { 
        timeZone: 'America/Monterrey',
        hour12: true 
    });
    const datosTelemetria = { sensor: "Compresor_01", presion: parseFloat(presionSimulada), unidad: "PSI", timestamp: timestampActual };

    let connection;
    try {
        // Asegurarnos de que el pool ya esté creado antes de intentar insertar
        if (oracledb.getPool()) {
            connection = await oracledb.getConnection();
            await connection.execute(
                `INSERT INTO TELEMETRIA (SENSOR, PRESION, UNIDAD, TIMESTAMP) VALUES (:1, :2, :3, :4)`,
                [datosTelemetria.sensor, datosTelemetria.presion, datosTelemetria.unidad, datosTelemetria.timestamp],
                { autoCommit: true }
            );
            io.emit('telemetria_compresor', datosTelemetria); 
        }
    } catch (err) {
        console.error("🔴 Error inyectando datos a Oracle:", err); 
    } finally {
        if (connection) await connection.close();
    }
}, 2000);

const PUERTO = process.env.PORT || 3000;
server.listen(PUERTO, () => {
    console.log(`Motor Node.js arrancado en el puerto ${PUERTO}`);
});