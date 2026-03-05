const fs = require('fs');

// Nombre del archivo que vamos a generar
const nombreArchivo = 'entrenamiento_compresor.csv';

// 1. PREPARAMOS EL ARCHIVO CSV (Cabeceras)
// Oracle Anomaly Detection necesita al menos una columna de fecha (timestamp) y una de valor.
fs.writeFileSync(nombreArchivo, 'timestamp,presion_psi\n');

console.log("🏭 Iniciando Gemelo Digital del Compresor...");

// 2. CONFIGURACIÓN FÍSICA DEL COMPRESOR
const presionBase = 110.0;     // El compresor debe mantenerse cerca de 110 PSI
const amplitudCiclo = 2.5;     // La presión sube y baja 2.5 PSI por el ciclo del motor
const nivelRuido = 0.5;        // Vibración normal del sensor (max 0.5 PSI)

const totalRegistros = 2000;   // Generaremos 2000 lecturas (nuestro libro de texto para la IA)

// Simularemos que las lecturas empezaron hoy a la medianoche
let tiempoSimulado = new Date();
tiempoSimulado.setHours(0, 0, 0, 0);

// 3. GENERACIÓN DE LOS DATOS (El bucle del tiempo)
for (let i = 0; i < totalRegistros; i++) {
    
    // A) Calculamos la oscilación del motor usando trigonometría (Seno)
    // Dividimos 'i' entre 10 para que la onda sea suave y no un pico brusco
    const oscilacion = Math.sin(i / 10) * amplitudCiclo;
    
    // B) Agregamos el ruido blanco (Vibración del sensor)
    // Math.random() da de 0 a 1. Le restamos 0.5 para que dé entre -0.5 y +0.5
    const ruido = (Math.random() - 0.5) * nivelRuido;
    
    // C) Calculamos la presión final en este milisegundo
    const presionFinal = presionBase + oscilacion + ruido;

    // D) Formateamos la fecha al estándar ISO 8601 que Oracle exige (ej. 2026-03-04T10:00:00Z)
    const timestampISO = tiempoSimulado.toISOString();

    // E) Escribimos la línea en nuestro archivo CSV (Fecha, Presión)
    // .toFixed(2) asegura que solo tengamos 2 decimales
    fs.appendFileSync(nombreArchivo, `${timestampISO},${presionFinal.toFixed(2)}\n`);

    // F) Avanzamos el reloj 1 minuto para la siguiente lectura
    tiempoSimulado.setMinutes(tiempoSimulado.getMinutes() + 1);
}

console.log(`✅ ¡Dataset generado con éxito! Se guardaron ${totalRegistros} lecturas en ${nombreArchivo}`);