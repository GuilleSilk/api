// API endpoint para Vercel - CON CORS CONFIGURADO
import { GoogleSpreadsheet } from "google-spreadsheet"
import { JWT } from "google-auth-library"

// Configuración de Google Sheets
type Row = { [key: string]: any };
const SHEET_ID = process.env.GOOGLE_SHEET_ID
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

// Función para añadir headers CORS
function addCorsHeaders(res: { setHeader: (h: string, v: string) => void }) {
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
    return res.status(405).json({ valid: false, error: "Method not allowed" })
  }

  try {
    const { licencia, hash_tienda } = req.body as { licencia?: string; hash_tienda?: string }

    if (!licencia) {
      return res.status(400).json({ valid: false, error: "Falta parámetro licencia" })
    }

    // Conectar a Google Sheets
    const auth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL!,
      key: GOOGLE_PRIVATE_KEY!,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
    const doc = new GoogleSpreadsheet(SHEET_ID!, auth)
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle["Licencias"]
    if (!sheet) {
      return res.status(500).json({ valid: false, error: "Hoja de licencias no encontrada" })
    }

    // Obtener todas las filas y buscar la licencia
    const rows: Row[] = await sheet.getRows()
    const licenseRow = rows.find(row => row.licencia === licencia)
    if (!licenseRow) {
      return res.status(404).json({ valid: false, error: "Licencia no encontrada" })
    }

    const now = new Date().toISOString().split("T")[0]

    // Si no viene hash_tienda en el body, lo borramos (clear)
    if (hash_tienda === "") {
      licenseRow.hash_tienda = ""
      licenseRow.status = "activa"
      licenseRow.ultima_verificacion = now
      const prev = parseInt(licenseRow.numero_de_tiendas || "0", 10)
      licenseRow.numero_de_tiendas = (prev + 1).toString()
      await licenseRow.save()
      return res.status(200).json({ valid: true, message: "Licencia liberada" })
    }

    // Validación normal requiere hash_tienda
    if (!hash_tienda) {
      return res.status(400).json({ valid: false, error: "Falta parámetro hash_tienda" })
    }

    const currentStatus = licenseRow.status
    const currentHashTienda = licenseRow.hash_tienda

    // Si la licencia ya está inválida
    if (currentStatus === "invalida") {
      return res.status(200).json({ valid: false, error: "Licencia inválida" })
    }

    // Si ya hay un hash y es diferente al actual
    if (currentHashTienda && currentHashTienda !== hash_tienda) {
      // Invalidar la licencia
      licenseRow.status = "invalida"
      licenseRow.ultima_verificacion = now
      await licenseRow.save()
      return res.status(200).json({ valid: false, error: "Licencia ya está en uso en otra tienda" })
    }

    // Actualizar la licencia con el hash actual
    licenseRow.hash_tienda = hash_tienda
    licenseRow.ultima_verificacion = now
    licenseRow.status = "activa"
    await licenseRow.save()

    return res.status(200).json({ valid: true, message: "Licencia válida" })
  } catch (error) {
    console.error("Error validating license:", error)
    return res.status(500).json({ valid: false, error: "Error interno del servidor" })
  }
}
