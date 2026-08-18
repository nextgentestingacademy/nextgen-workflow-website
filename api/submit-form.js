/**
 * NextGen Workflow Automation - Secure Form Submission Serverless Handler
 * Compatible with: Cloudflare Workers, Vercel Serverless Functions, Netlify Functions, or Node.js
 *
 * Required Environment Variables (Set in your hosting provider's dashboard):
 * - CLOUDFLARE_TURNSTILE_SECRET_KEY: Secret key from Cloudflare Turnstile dashboard (e.g. 0x4AAAAAA...)
 * - NOTIFICATION_EMAIL: Destination email for lead alerts (e.g. hello@nextgenworkflow.co)
 * - RESEND_API_KEY / SENDGRID_API_KEY / WEBHOOK_URL: Email or CRM dispatch credentials
 */

export default async function handler(req, res) {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "https://nextgenworkflow.co",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { name, company, email, phone, process, message, turnstileToken, company_website } = body;

    // 1. Honeypot check (reject bot submissions silently)
    if (company_website && company_website.trim() !== "") {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // 2. Server-Side Input Validation
    if (!name || name.trim().length < 2 || name.trim().length > 80) {
      return new Response(JSON.stringify({ success: false, error: "Invalid name" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    if (!company || company.trim().length < 2 || company.trim().length > 120) {
      return new Response(JSON.stringify({ success: false, error: "Invalid company" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!email || !emailRegex.test(email.trim()) || email.trim().length > 254) {
      return new Response(JSON.stringify({ success: false, error: "Invalid email" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
    if (!phone || phoneDigits.length < 7 || phoneDigits.length > 15) {
      return new Response(JSON.stringify({ success: false, error: "Invalid phone" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    if (!process || process.trim().length < 10 || process.trim().length > 500) {
      return new Response(JSON.stringify({ success: false, error: "Invalid process description" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    if (!message || message.trim().length < 10 || message.trim().length > 2000) {
      return new Response(JSON.stringify({ success: false, error: "Invalid message" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" }
      });
    }

    // 3. Cloudflare Turnstile Server-Side Token Verification
    const turnstileSecret = process.env?.CLOUDFLARE_TURNSTILE_SECRET_KEY || "";
    
    if (turnstileSecret) {
      if (!turnstileToken) {
        return new Response(JSON.stringify({ success: false, error: "Missing Turnstile verification token" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }

      const clientIp = req.headers?.get?.("CF-Connecting-IP") || req.headers?.get?.("x-forwarded-for") || "";

      const verifyFormData = new FormData();
      verifyFormData.append("secret", turnstileSecret);
      verifyFormData.append("response", turnstileToken);
      if (clientIp) verifyFormData.append("remoteip", clientIp);

      const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: verifyFormData
      });

      const turnstileOutcome = await turnstileRes.json();
      if (!turnstileOutcome.success) {
        return new Response(JSON.stringify({ success: false, error: "CAPTCHA verification failed" }), {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" }
        });
      }
    }

    // 4. HTML/Text Sanitization Helper
    const sanitize = (str) => String(str).replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));

    const leadData = {
      name: sanitize(name.trim()),
      company: sanitize(company.trim()),
      email: sanitize(email.trim()),
      phone: sanitize(phone.trim()),
      process: sanitize(process.trim()),
      message: sanitize(message.trim()),
      timestamp: new Date().toISOString()
    };

    // 5. Dispatch Lead (Example: Resend / SendGrid / Webhook / Make / n8n)
    // TODO: Connect email or CRM provider using environment variables
    console.log("New Lead Received:", leadData);

    return new Response(JSON.stringify({ success: true, message: "Discovery session request received" }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Serverless handler error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" }
    });
  }
}
