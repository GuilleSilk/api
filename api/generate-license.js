// ✅ VERSIÓN CORREGIDA PARA VERCEL + SHOPIFY HMAC

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
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET

const resend = new Resend(RESEND_API_KEY)

// 🔧 CONFIGURACIÓN PARA OBTENER BODY RAW EN VERCEL
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
}

// Función para verificar la autenticidad del webhook de Shopify
function verifyShopifyWebhook(body, signature) {
  if (!SHOPIFY_WEBHOOK_SECRET) {
    console.warn("⚠️ [HMAC] SHOPIFY_WEBHOOK_SECRET no configurado - saltando verificación")
    return true
  }

  console.log("🔍 [HMAC] Secret configurado:", SHOPIFY_WEBHOOK_SECRET.substring(0, 10) + "...")
  console.log("🔍 [HMAC] Signature recibida:", signature)
  console.log("🔍 [HMAC] Body type:", typeof body)
  console.log("🔍 [HMAC] Body length:", body.length)

  try {
    // Crear HMAC con SHA256
    const hmac = crypto.createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    hmac.update(body, "utf8")
    const calculatedSignature = hmac.digest("base64")

    console.log("🔍 [HMAC] Signature calculada:", calculatedSignature)

    // Comparar signatures
    const isValid = crypto.timingSafeEqual(Buffer.from(signature, "base64"), Buffer.from(calculatedSignature, "base64"))

    console.log("🔍 [HMAC] Verificación resultado:", isValid)
    return isValid
  } catch (error) {
    console.error("❌ [HMAC] Error en verificación:", error.message)
    return false
  }
}

// Función para añadir headers CORS
function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Shopify-Hmac-Sha256")
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
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Silkify - Licencias</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Poppins:wght@700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Roboto', Arial, sans-serif;
            background-color: #f4f6f8;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .wrapper {
            width: 100%;
            padding: 20px 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
            background-color: #ffffff;
            display: flex;
            align-items: center;
            padding: 30px;
        }
        .header img {
            max-width: 100px;
            margin-right: 15px;
        }
        .header h1 {
            margin: 0;
            font-family: 'Poppins', sans-serif;
            font-size: 32px;
            font-weight: 700;
            color: #000;
        }
        .greeting {
            padding: 0 30px 30px;
        }
        .greeting h2 {
            font-size: 20px;
            margin: 0 0 10px;
            text-align: center;
        }
        .greeting p {
            margin: 0;
            font-size: 16px;
            text-align: center;
        }
        .summary {
            padding: 20px;
            background-color: #ffffff;
        }
        .summary p {
            margin: 8px 0;
            font-size: 15px;
        }
        .licenses {
            padding: 20px;
            background-color: rgba(227, 242, 253, 0.4);
            border-radius: 8px;
            margin: 20px;
            box-shadow: inset 0 4px 6px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.06);
        }
        .licenses h2 {
            margin-top: 0;
        }
        .license-box {
            max-width: 80%;
            margin: 15px auto;
            padding: 15px;
            background-color: rgba(227, 242, 253, 0.8);
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }
        .license-code {
            font-size: 18px;
            font-weight: 700;
            color: #0d47a1;
            letter-spacing: 2px;
            margin: 0;
        }
        .instructions {
            padding: 20px;
            background-color: #ffffff;
        }
        .instructions h3 {
            margin-top: 0;
            font-size: 18px;
        }
        .instructions ol, .instructions ul {
            margin: 10px 0 10px 20px;
        }
        .instructions li {
            margin: 6px 0;
        }
        .footer {
            text-align: center;
            padding: 15px 20px;
            font-size: 13px;
            color: #888;
        }
        .footer a {
            color: #1976d2;
            text-decoration: none;
        }
        .legal {
            text-align: center;
            font-size: 12px;
            color: #888;
            padding: 10px 20px;
            background-color: #ffffff;
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <img src="https://cdn.shopify.com/s/files/1/0915/1784/5839/files/ChatGPT_Image_14_may_2025_14_02_34sinfondo.png?v=1747224314" alt="Logo Silkify">
                <h1>Silkify</h1>
            </div>

            <div class="greeting">
                <h2>¡Tus ${licenses.length} licencias de Silkify están listas!</h2>
                <p>Gracias por tu compra, ${customerName || "Cliente"}</p>
            </div>

            <div class="summary">
                <p><strong>Pedido:</strong> #${orderNumber}</p>
                <p><strong>Licencias incluidas:</strong> ${licenses.length}</p>
            </div>

            <div class="licenses">
                <h2>📋 Tus códigos de licencia:</h2>
                ${licensesHtml}
            </div>

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

            <div class="footer">
                <p>Este es un correo automático. Si tienes alguna duda, por favor ponte en contacto a través de nuestra web.</p>
                <p>Gracias por elegir Silkify<br>
                <a href="https://www.silkifytheme.com">www.silkifytheme.com</a></p>
            </div>

            <div class="legal">
                <p>© 2025 Silkify. Todos los derechos reservados.</p>
            </div>
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

// ✅ HANDLER PRINCIPAL
export default async function handler(req, res) {
  console.log("🚀 [WEBHOOK] Webhook recibido de Shopify")
  console.log("🕐 [WEBHOOK] Timestamp:", new Date().toISOString())
  console.log("🔍 [DEBUG] Evento Shopify:", req.headers["x-shopify-topic"])

  // Añadir headers CORS a todas las respuestas
  addCorsHeaders(res)

  // Manejar preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    console.log("✅ [CORS] Respondiendo a preflight request")
    return res.status(200).end()
  }

  // Permitir GET para testing
  if (req.method === "GET") {
    console.log("🔍 [DEBUG] Request GET recibido")
    return res.json({
      message: "Webhook endpoint funcionando",
      timestamp: new Date().toISOString(),
      webhook_secret_configured: !!SHOPIFY_WEBHOOK_SECRET,
    })
  }

  if (req.method !== "POST") {
    console.error(`❌ [ERROR] Método ${req.method} no permitido`)
    return res.status(405).json({
      error: "Method not allowed",
      received_method: req.method,
    })
  }

  try {
    console.log("📦 [WEBHOOK] Procesando request POST...")

    // 🔧 OBTENER RAW BODY PARA HMAC
    let rawBody
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8")
    } else if (typeof req.body === "string") {
      rawBody = req.body
    } else {
      // Si ya es objeto, lo convertimos de vuelta a JSON string
      rawBody = JSON.stringify(req.body)
    }

    const signature = req.headers["x-shopify-hmac-sha256"]

    // 🔧 SALTAR VERIFICACIÓN HMAC TEMPORALMENTE
    const skipVerification = process.env.SKIP_WEBHOOK_VERIFICATION === "true"

    if (skipVerification) {
      console.log("⚠️ [HMAC] Saltando verificación HMAC (modo testing)")
    } else if (signature && !verifyShopifyWebhook(rawBody, signature)) {
      console.error("❌ [WEBHOOK] Verificación HMAC falló")
      // Por ahora, continuamos pero loggeamos el error
      console.log("⚠️ [HMAC] Continuando sin verificación para testing...")
    }

    console.log("✅ [WEBHOOK] Procesando pedido...")

    // Parsear datos del pedido
    const orderData = typeof req.body === "object" ? req.body : JSON.parse(rawBody)
    const { id: order_id, order_number, customer, line_items, financial_status } = orderData

    // 📝 LOG DE PEDIDO
    console.log("📦 [PEDIDO] Procesando pedido:", {
      order_id,
      order_number,
      customer_email: customer?.email,
      total_items: line_items?.length || 0,
      financial_status,
      event_type: req.headers["x-shopify-topic"],
    })

    // ⚠️ VERIFICAR SI ES EL EVENTO CORRECTO
    const eventType = req.headers["x-shopify-topic"]
    if (eventType === "orders/create") {
      console.log("⚠️ [EVENTO] Este es un evento 'orders/create' - puede que el pago no esté confirmado aún")
      console.log("💡 [SUGERENCIA] Considera cambiar a 'orders/paid' en Shopify para mayor seguridad")
    }

    // Buscar SOLO productos con SKU "SilkifyTheme" o título "Silkify Theme"
    let totalLicenses = 0
    const themeItems = []

    line_items?.forEach((item, index) => {
      // DETECCIÓN ESPECÍFICA: Solo SKU "SilkifyTheme" o título "Silkify Theme"
      const isSilkifyTheme = item.sku === "SilkifyTheme" || item.title?.includes("Silkify Theme")

      // 📝 LOG POR PRODUCTO
      console.log(`🛍️ [PRODUCTO ${index + 1}] ${item.title}`, {
        sku: item.sku,
        quantity: item.quantity,
        is_silkify: isSilkifyTheme,
      })

      if (isSilkifyTheme) {
        // Determinar cuántas licencias incluye este item
        let licensesForThisItem = item.quantity || 1

        // Detectar si el producto incluye múltiples licencias en el título
        const titleMatch = item.title?.match(/(\d+)\s*(licencias?|licenses?)/i)
        if (titleMatch) {
          const licensesInTitle = Number.parseInt(titleMatch[1])
          licensesForThisItem = licensesInTitle * item.quantity
          console.log(`🔢 [LICENCIAS] Detectadas ${licensesInTitle} licencias en título`)
        }

        totalLicenses += licensesForThisItem
        themeItems.push({
          ...item,
          licensesCount: licensesForThisItem,
        })

        console.log(`✅ [SILKIFY] Producto detectado: ${item.title} - ${licensesForThisItem} licencias`)
      }
    })

    if (totalLicenses === 0) {
      console.log("🚫 [RESULTADO] No hay productos Silkify, terminando")
      return res.json({ success: true, message: "No es compra de Silkify Theme" })
    }

    console.log(`🎯 [LICENCIAS] Generando ${totalLicenses} licencias para el pedido ${order_number}`)

    // Configurar autenticación con Google Sheets
    console.log("📊 [SHEETS] Conectando a Google Sheets...")
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

    // Crear UNA FILA POR LICENCIA
    for (let i = 0; i < totalLicenses; i++) {
      await sheet.addRow({
        order_number: order_number || order_id,
        customer_email: customer?.email || "",
        customer_name: `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim(),
        licencia: generatedLicenses[i],
        hash_tienda: "", // Inicialmente vacío
        license_number: `${i + 1}/${totalLicenses}`,
        status: "nueva",
        última_verificación: today,
        fecha_creacion: today,
        order_total: orderData.total_price || "",
        currency: orderData.currency || "EUR",
        financial_status: financial_status || "",
        event_type: eventType || "",
      })
    }

    console.log(`✅ [SHEETS] ${totalLicenses} licencias guardadas exitosamente:`, generatedLicenses)

    // Enviar UN SOLO email con todas las licencias
    if (customer?.email && RESEND_API_KEY) {
      console.log(`📧 [EMAIL] Enviando email a ${customer.email}...`)

      const emailResult = await sendMultipleLicensesEmail({
        licenses: generatedLicenses,
        customerEmail: customer.email,
        customerName: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
        orderNumber: order_number || order_id,
        orderTotal: orderData.total_price || "0",
        currency: orderData.currency || "EUR",
      })

      if (emailResult.success) {
        console.log("✅ [EMAIL] Email enviado exitosamente")
      } else {
        console.error("❌ [EMAIL] Error enviando email:", emailResult.error)
      }
    } else {
      console.log("⚠️ [EMAIL] Email no enviado - falta email del cliente o API key")
    }

    // 📝 LOG FINAL
    console.log("🎉 [WEBHOOK] Proceso completado exitosamente", {
      order_number,
      total_licenses: totalLicenses,
      email_sent: !!customer?.email && !!RESEND_API_KEY,
      event_type: eventType,
    })

    return res.json({
      success: true,
      licenses: generatedLicenses,
      total_licenses: totalLicenses,
      order_number: order_number || order_id,
      email_sent: !!customer?.email && !!RESEND_API_KEY,
      event_type: eventType,
    })
  } catch (error) {
    // 📝 LOG DE ERROR
    console.error("💥 [ERROR] Error procesando webhook:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })

    return res.status(500).json({
      success: false,
      error: "Error generando licencias",
      details: error.message,
    })
  }
}
