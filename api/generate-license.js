// API para generar licencias automáticamente - CON CORS
import { GoogleSpreadsheet } from "google-spreadsheet"
import { JWT } from "google-auth-library"
import { Resend } from "resend"
import crypto from "crypto"

// Variables de entorno
const SHEET_ID = process.env.GOOGLE_SHEET_ID
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || "licencias@tudominio.com"

const resend = new Resend(RESEND_API_KEY)

// Función para añadir headers CORS
function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader("Access-Control-Max-Age", "86400")
}

// Función para generar licencia aleatoria
function generateLicenseKey() {
  const part1 = crypto.randomBytes(2).toString("hex").toUpperCase()
  const part2 = crypto.randomBytes(2).toString("hex").toUpperCase()
  const part3 = crypto.randomBytes(2).toString("hex").toUpperCase()
  return `LIC-${part1}-${part2}-${part3}`
}

// Función para generar licencias únicas
async function generateUniqueLicenses(count, sheet) {
  const licenses = []
  const existingLicenses = new Set()

  // Obtener todas las licencias existentes
  const rows = await sheet.getRows()
  rows.forEach((row) => {
    const license = row.get("licencia")
    if (license) {
      existingLicenses.add(license)
    }
  })

  // Generar licencias únicas
  for (let i = 0; i < count; i++) {
    let newLicense
    do {
      newLicense = generateLicenseKey()
    } while (existingLicenses.has(newLicense) || licenses.includes(newLicense))

    licenses.push(newLicense)
    existingLicenses.add(newLicense)
  }

  return licenses
}

// Función para enviar email con múltiples licencias
async function sendMultipleLicensesEmail(licenseData) {
  try {
    const { licenses, customerEmail, customerName, orderNumber, orderTotal, currency } = licenseData

    // Generar HTML para múltiples licencias
    const licensesHtml = licenses
      .map(
        (license, index) => `
      <div class="license-box">
        <h3>Licencia ${index + 1}:</h3>
        <div class="license-code">${license}</div>
      </div>
    `,
      )
      .join("")

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
            .license-box { background: #e3f2fd; padding: 20px; margin: 15px 0; border-radius: 8px; text-align: center; }
            .license-code { font-size: 20px; font-weight: bold; color: #1976d2; letter-spacing: 2px; margin: 10px 0; }
            .instructions { background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>¡Tus ${licenses.length} licencias de Silkify están listas! 🎉</h1>
                <p>Gracias por tu compra, ${customerName || "Cliente"}</p>
            </div>
            
            <div class="summary">
                <p><strong>Pedido:</strong> #${orderNumber}</p>
                <p><strong>Licencias incluidas:</strong> ${licenses.length}</p>
                <p><strong>Total:</strong> ${orderTotal} ${currency}</p>
            </div>
            
            <h2>📋 Tus códigos de licencia:</h2>
            ${licensesHtml}
            
            <div class="instructions">
                <h3>📋 Instrucciones de activación:</h3>
                <ol>
                    <li>Ve al <strong>Editor de temas</strong> de tu tienda Shopify</li>
                    <li>Busca la sección <strong>"Licencia"</strong> en la configuración del tema</li>
                    <li>Pega <strong>UNA</strong> de las licencias de arriba</li>
                    <li>Guarda los cambios</li>
                    <li>¡Tu tema ya está activado! ✅</li>
                </ol>
                
                <p><strong>💡 Importante:</strong></p>
                <ul>
                    <li>Cada licencia es para <strong>una tienda diferente</strong></li>
                    <li>Solo usa <strong>una licencia por tienda</strong></li>
                    <li>Guarda las licencias restantes para futuras tiendas</li>
                    <li>Cada licencia solo puede estar activa en una tienda a la vez</li>
                </ul>
            </div>
            
            <p>Si tienes algún problema con la activación, no dudes en contactarnos respondiendo a este email.</p>
            
            <div class="footer">
                <p>Gracias por elegir Silkify<br>
                <a href="https://www.silkifystore.com">www.silkifystore.com</a></p>
            </div>
        </div>
    </body>
    </html>
    `

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [customerEmail],
      subject: `Tus ${licenses.length} licencias de Silkify - Pedido #${orderNumber}`,
      html: emailHtml,
    })

    if (error) {
      console.error("Error enviando email:", error)
      return { success: false, error }
    }

    console.log("Email con múltiples licencias enviado exitosamente:", data)
    return { success: true, data }
  } catch (error) {
    console.error("Error en sendMultipleLicensesEmail:", error)
    return { success: false, error: error.message }
  }
}

export default async function handler(req, res) {
  // Añadir headers CORS a todas las respuestas
  addCorsHeaders(res)

  // Manejar preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Datos del webhook de Shopify
    const { id: order_id, order_number, customer, line_items, billing_address, shipping_address } = req.body

    console.log(`Procesando pedido: ${order_number} para ${customer?.email}`)

    // Buscar SOLO productos con SKU "SilkifyTheme" o título "Silkify Theme"
    let totalLicenses = 0
    const themeItems = []

    line_items?.forEach((item) => {
      // DETECCIÓN ESPECÍFICA: Solo SKU "SilkifyTheme" o título "Silkify Theme"
      const isSilkifyTheme = item.sku === "SilkifyTheme" || item.title?.includes("Silkify Theme")

      if (isSilkifyTheme) {
        // Determinar cuántas licencias incluye este item
        let licensesForThisItem = item.quantity || 1

        // Detectar si el producto incluye múltiples licencias en el título
        const titleMatch = item.title?.match(/(\d+)\s*(licencias?|licenses?)/i)
        if (titleMatch) {
          const licensesInTitle = Number.parseInt(titleMatch[1])
          licensesForThisItem = licensesInTitle * item.quantity
        }

        totalLicenses += licensesForThisItem
        themeItems.push({
          ...item,
          licensesCount: licensesForThisItem,
        })

        console.log(`Producto Silkify detectado: ${item.title} - ${licensesForThisItem} licencias`)
      }
    })

    if (totalLicenses === 0) {
      console.log("Pedido no incluye productos Silkify Theme, ignorando")
      return res.json({ success: true, message: "No es compra de Silkify Theme" })
    }

    console.log(`Generando ${totalLicenses} licencias para el pedido ${order_number}`)

    // Configurar autenticación con Google Sheets
    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth)
    await doc.loadInfo()

    const sheet = doc.sheetsByTitle["Licencias"]
    if (!sheet) {
      throw new Error("Hoja de licencias no encontrada")
    }

    // Generar licencias únicas
    const generatedLicenses = await generateUniqueLicenses(totalLicenses, sheet)
    const today = new Date().toISOString().split("T")[0]

    // Crear UNA FILA POR LICENCIA (como quieres)
    for (let i = 0; i < totalLicenses; i++) {
      await sheet.addRow({
        order_number: order_number || order_id,
        customer_email: customer?.email || "",
        customer_name: `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim(),
        licencia: generatedLicenses[i],
        hash_tienda: "", // Inicialmente vacío
        license_number: `${i + 1}/${totalLicenses}`,
        status: "activa",
        última_verificación: today,
        fecha_creacion: today,
        order_total: req.body.total_price || "",
        currency: req.body.currency || "EUR",
      })
    }

    console.log(`${totalLicenses} licencias guardadas en Google Sheets:`, generatedLicenses)

    // Enviar UN SOLO email con todas las licencias
    if (customer?.email && RESEND_API_KEY) {
      const emailResult = await sendMultipleLicensesEmail({
        licenses: generatedLicenses,
        customerEmail: customer.email,
        customerName: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
        orderNumber: order_number || order_id,
        orderTotal: req.body.total_price || "0",
        currency: req.body.currency || "EUR",
      })

      if (emailResult.success) {
        console.log(`Email con ${totalLicenses} licencias enviado a ${customer.email}`)
      } else {
        console.error(`Error enviando email a ${customer.email}:`, emailResult.error)
      }
    }

    return res.json({
      success: true,
      licenses: generatedLicenses,
      total_licenses: totalLicenses,
      order_number: order_number || order_id,
      email_sent: !!customer?.email && !!RESEND_API_KEY,
    })
  } catch (error) {
    console.error("Error generating licenses:", error)
    return res.status(500).json({
      success: false,
      error: "Error generando licencias",
      details: error.message,
    })
  }
}
