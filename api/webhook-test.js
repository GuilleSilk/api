// Endpoint para probar el webhook
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  // Datos de prueba que simula un webhook de Shopify
  const testWebhookData = {
    id: 12345,
    order_number: "TEST-001",
    total_price: "89.97",
    currency: "EUR",
    customer: {
      email: "elliugpaso@gmail.com",
      first_name: "Juan",
      last_name: "Pérez",
    },
    line_items: [
      {
        title: "Silkify Theme - 3 Licencias",
        sku: "SilkifyTheme",
        quantity: 1,
        price: "89.97",
      },
    ],
    billing_address: {
      company: "Mi Tienda Online",
    },
  }

  try {
    // Llamar al endpoint de generación de licencias
    const response = await fetch(`https://${req.headers.host}/api/generate-license`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testWebhookData),
    })

    const result = await response.json()

    return res.json({
      success: true,
      message: "Webhook de prueba ejecutado",
      result,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}
