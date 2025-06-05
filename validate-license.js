// API endpoint para Vercel
import { GoogleSpreadsheet } from "google-spreadsheet"
import { JWT } from "google-auth-library"

// Configuración de Google Sheets
const SHEET_ID = process.env.GOOGLE_SHEET_ID
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

export default async function handler(req, res) {
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

    // Configurar autenticación con Google Sheets
    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
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

    const currentHashTienda = licenseRow.get("hash_tienda")
    const currentStatus = licenseRow.get("status")

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
