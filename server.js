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

// OPTIENE DIRECTAMENTE DE LA TABLA TELEMETRIA 
// app.get('/api/exportar', async (req, res) => {
//     let connection;
//     try {
//         connection = await oracledb.getConnection();
//         const result = await connection.execute(`SELECT * FROM TELEMETRIA ORDER BY ID DESC`);
//         let csv = 'ID,Sensor,Presion_PSI,Fecha_Hora\n';
//         result.rows.forEach(fila => { csv += `${fila.ID},${fila.SENSOR},${fila.PRESION},${fila.TIMESTAMP}\n`; });
//         res.header('Content-Type', 'text/csv');
//         res.attachment('Reporte_Cloud_Compresor.csv');
//         return res.send(csv);
//     } catch (err) {
//         res.status(500).send("Error exportando desde OCI");
//     } finally {
//         if (connection) await connection.close();
//     }
// });

io.on('connection', (socket) => {
    console.log('Cliente web conectado al dashboard.');
});


// ==========================================
// 📊 ENDPOINT: GENERADOR DE REPORTES CSV
// ==========================================
app.get('/api/exportar', async (req, res) => {
    let connection;

    try {
        console.log("📥 Generando reporte de mantenimiento...");
        
        // 1. Pedimos una conexión a Oracle
        connection = await oracledb.getConnection();

        // 2. Consulta directa (sin alias)
        const sqlQuery = `
            SELECT TIMESTAMP, PRESION_PSI 
            FROM COMPRESOR_HISTORICO 
            ORDER BY TIMESTAMP DESC 
            FETCH FIRST 100 ROWS ONLY
        `;
        
        // 🚨 CAMBIO CLAVE: Cambiamos OUT_FORMAT_OBJECT por OUT_FORMAT_ARRAY
        const result = await connection.execute(
            sqlQuery, 
            [], 
            { outFormat: oracledb.OUT_FORMAT_ARRAY } 
        );

        // 3. Transformar los datos
        let csvContent = "Fecha_Hora,Presion_PSI\n"; 
        
        result.rows.forEach(row => {
            // Como es un Array, row[0] es la primera columna (Fecha) y row[1] la segunda (Presión)
            const fechaLimpia = row[0] ? row[0] : 'Sin Fecha';
            const presionLimpia = row[1] ? row[1] : 0;
            
            csvContent += `${fechaLimpia},${presionLimpia}\n`;
        });

        // 4. Magia HTTP: Le decimos al navegador que esto es un archivo descargable
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Reporte_Compresor_01.csv"');

        // 5. Enviamos el archivo terminado al cliente
        res.status(200).send(csvContent);
        
        console.log("✅ Reporte descargado exitosamente");

    } catch (err) {
        console.error("❌ Error al generar el Excel:", err);
        res.status(500).send("Error interno al generar el reporte");
    } finally {
        // Siempre liberamos la conexión
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
});

// --- CONFIGURACIÓN DEL GEMELO DIGITAL ---
let iteracion = 0;
const presionBase = 110.0;
const amplitudCiclo = 2.5;

setInterval(async () => {
    let connection; // Declaramos la variable localmente

    try {
        // 0. Pedimos prestada una conexión al Pool de Oracle
        connection = await oracledb.getConnection();

        iteracion++;
        
        // 1. Generamos el dato normal
        let presionActual = presionBase + (Math.sin(iteracion / 10) * amplitudCiclo) + ((Math.random() - 0.5) * 0.5);

        // 2. Simulamos la FALLA cada 15 lecturas
        if (iteracion % 15 === 0) {
            presionActual = 95.0; 
            console.log("⚠️ Simulando fuga de presión en el compresor...");
        }

        // 3. CONSULTA DE INTELIGENCIA ARTIFICIAL (Inferencia)

        const sqlPredict = `SELECT PREDICTION(MODELO_PREDICTIVO_COMPRESOR USING :presion AS PRESION_PSI) AS ESTATUS FROM DUAL`;
        
        const resultPredict = await connection.execute(
            sqlPredict, 
            { presion: presionActual },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        const estatusIA = resultPredict.rows[0].ESTATUS; 
        const diagnostico = (estatusIA === 1) ? 'Normal' : '🚨 Anomalía Detectada';

        // Usamos toLocaleString para obtener Fecha Y Hora (ej. 4/3/2026, 10:28:00 p.m.)
        const timestampActual = new Date().toLocaleString('es-MX', { timeZone: 'America/Monterrey', hour12: true });
        
        // ==========================================
        // 4. ¡NUEVO! GUARDAR EL DATO EN LA BASE DE DATOS
        // ==========================================
        const sqlInsert = `INSERT INTO COMPRESOR_HISTORICO (TIMESTAMP, PRESION_PSI) VALUES (:fecha, :presion)`;
        await connection.execute(sqlInsert, {
            fecha: timestampActual,
            presion: Math.round(presionActual * 100) / 100 // Redondeamos a 2 decimales para que el Excel quede limpio
        }, { autoCommit: true }); // autoCommit guarda el cambio permanentemente
        // ==========================================

        
        io.emit('telemetria', {
            presion: presionActual.toFixed(2),
            timestamp: timestampActual,
            estado_ia: diagnostico
        });

    } catch (err) {
        console.error("Error en el ciclo de lectura:", err);
    } finally {
        // 6. ¡MUY IMPORTANTE! Siempre cerramos/devolvemos la conexión en el bloque finally
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Error al cerrar la conexión:", err);
            }
        }
    }
}, 5000); // Se ejecuta cada 5 segundos

const PUERTO = process.env.PORT || 3000;
server.listen(PUERTO, () => {
    console.log(`Motor Node.js arrancado en el puerto ${PUERTO}`);
});