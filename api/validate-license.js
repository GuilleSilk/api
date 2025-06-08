import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// Configuración de Google Sheets desde variables de entorno
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Función para añadir headers CORS
function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  // Añadir headers CORS a todas las respuestas
  addCorsHeaders(res);

  // Responder preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Solo permitir POST
  if (req.method !== "POST") {
    return res.status(405).json({ valid: false, error: "Method not allowed" });
  }

  try {
    const { licencia, hash_tienda } = req.body || {};

    // Validar parámetros
    if (!licencia || !hash_tienda) {
      return res.status(200).json({ valid: false, error: "Faltan parámetros requeridos" });
    }

    // Autenticación con Google Sheets
    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    // Conectar a Google Sheet
    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Licencias"];
    if (!sheet) {
      throw new Error("Hoja 'Licencias' no encontrada");
    }

    // Leer todas las filas de la hoja
    const rows = await sheet.getRows();

    // Buscar fila de la licencia
    const licenseRow = rows.find(row => row.licencia === licencia);

    // Si no existe
    if (!licenseRow) {
      return res.status(200).json({ valid: false, error: "Licencia no encontrada" });
    }

    // Lectura de campos
    const currentStatus = licenseRow.status;
    const currentHash = licenseRow.hash_tienda;
    const today = new Date().toISOString().split('T')[0];

    // Si ya está marcada como inválida
    if (currentStatus === 'invalida') {
      return res.status(200).json({ valid: false, error: "Licencia inválida" });
    }

    // Si ya hay un hash diferente -> invalidar
    if (currentHash && currentHash !== hash_tienda) {
      licenseRow.status = 'invalida';
      licenseRow.ultima_verificacion = today;
      await licenseRow.save();
      return res.status(200).json({ valid: false, error: "Licencia ya en uso en otra tienda" });
    }

    // Si todo OK, actualizar fila
    licenseRow.hash_tienda = hash_tienda;
    licenseRow.status = 'activa';
    licenseRow.ultima_verificacion = today;
    await licenseRow.save();

    return res.status(200).json({ valid: true, message: "Licencia válida" });
  } catch (error) {
    console.error("Error validating license:", error);
    return res.status(200).json({ valid: false, error: "Error interno del servidor" });
  }
}
