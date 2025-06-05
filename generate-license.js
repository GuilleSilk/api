// API para generar licencias automáticamente
import { GoogleSpreadsheet } from "google-spreadsheet"
import { JWT } from "google-auth-library"
import crypto from "crypto"

const SHEET_ID = process.env.GOOGLE_SHEET_ID
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")

// Función para generar licencia aleatoria
function generateLicenseKey() {
  const part1 = crypto.randomBytes(2).toString("hex").toUpperCase()
  const part2 = crypto.randomBytes(2).toString("hex").toUpperCase()
  const part3 = crypto.randomBytes(2).toString("hex").toUpperCase()
  return `LIC-${part1}-${part2}-${part3}`
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Datos del webhook de Shopify
    const { id: order_id, order_number, customer, line_items } = req.body

    // Configurar autenticación
    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth)
    await doc.loadInfo()

    const sheet = doc.sheetsByTitle["Licencias"]

    // Generar nueva licencia
    const newLicense = generateLicenseKey()
    const today = new Date().toISOString().split("T")[0]

    // Añadir fila a Google Sheets con order number
    await sheet.addRow({
      licencia: newLicense,
      última_verificación: today,
      status: "activa",
      hash_tienda: "",
      order_number: order_number || order_id, // Usar order_number si existe, sino order_id
      customer_email: customer?.email || "",
      fecha_creacion: today,
    })

    // TODO: Enviar email al cliente con la licencia
    /*
    await sendLicenseEmail({
      to: customer?.email,
      license: newLicense,
      orderNumber: order_number,
      customerName: customer?.first_name + ' ' + customer?.last_name
    });
    */

    console.log(`Licencia generada: ${newLicense} para pedido: ${order_number || order_id}`)

    return res.json({
      success: true,
      license: newLicense,
      order_number: order_number || order_id,
    })
  } catch (error) {
    console.error("Error generating license:", error)
    return res.status(500).json({
      success: false,
      error: "Error generando licencia",
    })
  }
}
