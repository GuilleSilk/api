// File: pages/api/clear-license.js

import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// Configuración de Google Sheets desde variables de entorno
const SHEET_ID                     = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY           = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Función para añadir headers CORS
function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  addCorsHeaders(res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { licencia } = req.body || {};
    if (!licencia) {
      return res.status(200).json({ success: false, error: "Falta parámetro licencia" });
    }

    // Autenticación en Google Sheets
    const auth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    await doc.loadInfo();

    // Acceder a la hoja con título exacto "Licencias"
    const sheet = doc.sheetsByTitle["Licencias"];
    if (!sheet) throw new Error("Hoja 'Licencias' no encontrada");

    const rows = await sheet.getRows();
    const row  = rows.find(r => r.licencia === licencia);

    if (!row) {
      // No existe, nothing to do
      return res.status(200).json({ success: true, cleared: false });
    }

    // Limpiar hash, mantener activa
    row.hash_tienda         = "";
    row.status              = "activa";
    row.ultima_verificacion = new Date().toISOString().split("T")[0];

    // Incrementar contador de tiendas
    const prev = parseInt(row.numero_de_tiendas || "0", 10);
    row.numero_de_tiendas   = (prev + 1).toString();

    // Persistir cambios
    await row.save();

    return res.status(200).json({ success: true, cleared: true });
  } catch (error) {
    console.error("Error clearing license:", error);
    // Siempre 200 para no romper el cliente
    return res.status(200).json({ success: false, error: "Error interno" });
  }
}
