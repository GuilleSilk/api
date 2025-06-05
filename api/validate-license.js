// API endpoint para Vercel - USANDO JSON COMPLETO
import { GoogleSpreadsheet } from "google-spreadsheet"
import { JWT } from "google-auth-library"

// Configuración de Google Sheets usando JSON completo
const SHEET_ID = process.env.GOOGLE_SHEET_ID
const GOOGLE_CREDENTIALS = process.env.GOOGLE_CREDENTIALS

// Función para añadir headers CORS
function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader("Access-Control-Max-Age", "86400")
}

export default async function handler(req, res) {
  // Añadir headers CORS a todas las respuestas
  addCorsHeaders(res)

  // Manejar preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  // Solo permitir POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { licencia, hash_tienda } = req.body

    if (!licencia || !hash_tienda) {
      return res.status(400).json({
        valid: false,
        error: "Faltan parámetros requeridos",
      })
    }

    // Configurar autenticación con Google Sheets usando JSON completo
    const credentials = JSON.parse(GOOGLE_CREDENTIALS)
    const serviceAccountAuth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    // Conectar a Google Sheets
    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth)
    await doc.loadInfo()

    const sheet = doc.sheetsByTitle["Licencias"]
    if (!sheet) {
      return res.status(500).json({
        valid: false,
        error: "Hoja de licencias no encontrada",
      })
    }

    // Obtener todas las filas
    const rows = await sheet.getRows()

    // Buscar la licencia
    const licenseRow = rows.find((row) => row.get("licencia") === licencia)

    if (!licenseRow) {
      return res.status(404).json({
        valid: false,
        error: "Licencia no encontrada",
      })
    }

    const currentStatus = licenseRow.get("status")
    const currentHashTienda = licenseRow.get("hash_tienda")

    // Si la licencia ya está inválida
    if (currentStatus === "inválida") {
      return res.json({
        valid: false,
        error: "Licencia inválida",
      })
    }

    // Si ya hay un hash y es diferente al actual
    if (currentHashTienda && currentHashTienda !== hash_tienda) {
      // Invalidar la licencia
      licenseRow.set("status", "inválida")
      licenseRow.set("última_verificación", new Date().toISOString().split("T")[0])
      await licenseRow.save()

      return res.json({
        valid: false,
        error: "Licencia ya está en uso en otra tienda",
      })
    }

    // Actualizar la licencia con el hash actual
    licenseRow.set("hash_tienda", hash_tienda)
    licenseRow.set("última_verificación", new Date().toISOString().split("T")[0])
    licenseRow.set("status", "activa")
    await licenseRow.save()

    return res.json({
      valid: true,
      message: "Licencia válida",
    })
  } catch (error) {
    console.error("Error validating license:", error)
    return res.status(500).json({
      valid: false,
      error: "Error interno del servidor",
    })
  }
}
