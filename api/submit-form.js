/**
 * NextGen Workflow Automation - Secure Form Submission Cloudflare Worker
 * Runtime: Cloudflare Workers (ES Module format: export default { async fetch(request, env, ctx) })
 *
 * Secret Bindings:
 * - CLOUDFLARE_TURNSTILE_SECRET_KEY: Secret key from Cloudflare Turnstile dashboard
 * - RESEND_API_KEY: API key from Resend dashboard (for hello@nextgenworkflow.co delivery)
 */

export default {
  async fetch(request, env, ctx) {
    // 1. CORS Configuration (Allow https://nextgenworkflow.co and https://www.nextgenworkflow.co)
    const origin = request.headers.get("Origin") || "";
    const allowedOrigins = new Set([
      "https://nextgenworkflow.co",
      "https://www.nextgenworkflow.co"
    ]);

    const isAllowedOrigin = allowedOrigins.has(origin);
    const corsHeaders = {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    if (isAllowedOrigin) {
      corsHeaders["Access-Control-Allow-Origin"] = origin;
    }

    const jsonHeaders = {
      ...corsHeaders,
      "Content-Type": "application/json"
    };

    // 2. Handle HTTP OPTIONS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // 3. Method Gate: Only POST is allowed for form submissions
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Method not allowed"
        }),
        {
          status: 405,
          headers: jsonHeaders
        }
      );
    }

    try {
      // 4. Parse Request Body (JSON)
      let body;
      try {
        body = await request.json();
      } catch (parseErr) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid JSON payload"
          }),
          {
            status: 400,
            headers: jsonHeaders
          }
        );
      }

      const { name, company, email, phone, process, message, turnstileToken, company_website } = body || {};

      // 5. Honeypot Anti-Spam Check (Silently acknowledge bot submissions)
      if (company_website && String(company_website).trim() !== "") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Request received"
          }),
          {
            status: 200,
            headers: jsonHeaders
          }
        );
      }

      // 6. Server-Side Input Validation
      if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid name (must be between 2 and 80 characters)"
          }),
          {
            status: 400,
            headers: jsonHeaders
          }
        );
      }

      if (!company || typeof company !== "string" || company.trim().length < 2 || company.trim().length > 120) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid company name (must be between 2 and 120 characters)"
          }),
          {
            status: 400,
            headers: jsonHeaders
          }
        );
      }

      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!email || typeof email !== "string" || !emailRegex.test(email.trim()) || email.trim().length > 254) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid business email address"
          }),
          {
            status: 400,
            headers: jsonHeaders
          }
        );
      }

      const phoneDigits = phone && typeof phone === "string" ? phone.replace(/\D/g, "") : "";
      if (!phone || typeof phone !== "string" || phoneDigits.length < 7 || phoneDigits.length > 15) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid phone number"
          }),
          {
            status: 400,
            headers: jsonHeaders
          }
        );
      }

      if (!process || typeof process !== "string" || process.trim().length < 10 || process.trim().length > 500) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid process description (must be between 10 and 500 characters)"
          }),
          {
            status: 400,
            headers: jsonHeaders
          }
        );
      }

      if (!message || typeof message !== "string" || message.trim().length < 10 || message.trim().length > 2000) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid requirement description (must be between 10 and 2000 characters)"
          }),
          {
            status: 400,
            headers: jsonHeaders
          }
        );
      }

      // 7. Cloudflare Turnstile Server-Side Token Verification
      const turnstileSecret = env?.CLOUDFLARE_TURNSTILE_SECRET_KEY || env?.TURNSTILE_SECRET || "";
      const expectedAction = "contact";
      const expectedHostnames = new Set([
        "nextgenworkflow.co",
        "www.nextgenworkflow.co"
      ]);

      if (turnstileSecret) {
        if (!turnstileToken || typeof turnstileToken !== "string" || turnstileToken.length > 2048) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Missing or invalid Turnstile verification token"
            }),
            {
              status: 400,
              headers: jsonHeaders
            }
          );
        }

        const clientIp = request.headers.get("CF-Connecting-IP") || "";

        let siteverifyResult;
        try {
          const siteverifyParams = new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken
          });
          if (clientIp) {
            siteverifyParams.append("remoteip", clientIp);
          }

          const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            signal: AbortSignal.timeout(10_000),
            body: siteverifyParams
          });

          if (!turnstileRes.ok) {
            throw new Error(`Siteverify API responded with status ${turnstileRes.status}`);
          }
          siteverifyResult = await turnstileRes.json();
        } catch (verifyErr) {
          console.error("Cloudflare Siteverify request error:", verifyErr);
          return new Response(
            JSON.stringify({
              success: false,
              error: "CAPTCHA verification service temporarily unavailable"
            }),
            {
              status: 502,
              headers: jsonHeaders
            }
          );
        }

        if (
          !siteverifyResult.success ||
          (siteverifyResult.action && siteverifyResult.action !== expectedAction) ||
          (siteverifyResult.hostname && expectedHostnames.size > 0 && !expectedHostnames.has(siteverifyResult.hostname))
        ) {
          console.warn("Turnstile validation rejected:", siteverifyResult["error-codes"] || "Action/hostname mismatch");
          return new Response(
            JSON.stringify({
              success: false,
              error: "CAPTCHA verification failed"
            }),
            {
              status: 403,
              headers: jsonHeaders
            }
          );
        }
      }

      // 8. Sanitization & Lead Payload Assembly
      const sanitize = (str) =>
        String(str).replace(/[&<>"']/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));

      const rawName = name.trim();
      const rawCompany = company.trim();
      const rawEmail = email.trim();
      const rawPhone = phone.trim();
      const rawProcess = process.trim();
      const rawMessage = message.trim();
      const timestampIso = new Date().toISOString();

      const safeName = sanitize(rawName);
      const safeCompany = sanitize(rawCompany);
      const safeEmail = sanitize(rawEmail);
      const safePhone = sanitize(rawPhone);
      const safeProcess = sanitize(rawProcess);
      const safeMessage = sanitize(rawMessage);

      // 9. Resend REST API Email Delivery
      const resendApiKey = env?.RESEND_API_KEY || "";
      if (!resendApiKey) {
        console.error("Missing RESEND_API_KEY binding in Cloudflare Worker environment");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Email service configuration missing"
          }),
          {
            status: 500,
            headers: jsonHeaders
          }
        );
      }

      const emailSubject = `New Workflow Discovery Request — ${rawCompany}`;

      const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1220; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b1220; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 32px; border-bottom: 3px solid #2563eb;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">NextGen Workflow Automation</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase;">New Workflow Discovery Request</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 140px; font-weight: 600; color: #475569; font-size: 14px; vertical-align: top;">Name:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 15px; font-weight: 500;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 140px; font-weight: 600; color: #475569; font-size: 14px; vertical-align: top;">Company:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 15px; font-weight: 600;">${safeCompany}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 140px; font-weight: 600; color: #475569; font-size: 14px; vertical-align: top;">Business Email:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #2563eb; font-size: 15px;">
                    <a href="mailto:${safeEmail}" style="color: #2563eb; text-decoration: none;">${safeEmail}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 140px; font-weight: 600; color: #475569; font-size: 14px; vertical-align: top;">Phone:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 15px;">
                    <a href="tel:${safePhone}" style="color: #0f172a; text-decoration: none;">${safePhone}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 140px; font-weight: 600; color: #475569; font-size: 14px; vertical-align: top;">Process to improve:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; line-height: 1.5;">${safeProcess}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 140px; font-weight: 600; color: #475569; font-size: 14px; vertical-align: top;">Additional details:</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${safeMessage}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; width: 140px; font-weight: 600; color: #64748b; font-size: 13px; vertical-align: top;">Submitted At:</td>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px;">${timestampIso}</td>
                </tr>
              </table>

              <div style="background-color: #f8fafc; border-left: 3px solid #2563eb; padding: 12px 16px; border-radius: 0 4px 4px 0;">
                <p style="margin: 0; font-size: 13px; color: #475569;">
                  <strong>Reply-To Enabled:</strong> Hitting &ldquo;Reply&rdquo; in your email client will respond directly to <a href="mailto:${safeEmail}" style="color: #2563eb; text-decoration: none;">${safeEmail}</a>.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">NextGen Workflow Automation &bull; Secure Lead Ingestion Pipeline</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const emailText = `NextGen Workflow Automation
New Workflow Discovery Request

Name: ${rawName}
Company: ${rawCompany}
Business Email: ${rawEmail}
Phone: ${rawPhone}

Process they want to improve:
${rawProcess}

Additional details:
${rawMessage}

Submitted: ${timestampIso}
Reply-To: ${rawEmail}
`;

      const resendPayload = {
        from: "NextGen Workflow Automation <hello@nextgenworkflow.co>",
        to: ["hello@nextgenworkflow.co"],
        reply_to: rawEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText
      };

      let resendRes;
      try {
        resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify(resendPayload)
        });
      } catch (networkErr) {
        console.error("Resend API network dispatch failed:", networkErr?.message || networkErr);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Unable to send your request right now. Please try again later."
          }),
          {
            status: 502,
            headers: jsonHeaders
          }
        );
      }

      if (!resendRes.ok) {
        const resendStatus = resendRes.status;
        let resendErrDetails = "";
        try {
          const errJson = await resendRes.json();
          resendErrDetails = errJson?.message || JSON.stringify(errJson);
        } catch {
          resendErrDetails = await resendRes.text();
        }
        console.error(`Resend API rejected delivery (HTTP ${resendStatus}):`, resendErrDetails);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Unable to send your request right now. Please try again later."
          }),
          {
            status: 502,
            headers: jsonHeaders
          }
        );
      }

      const resendResult = await resendRes.json();
      console.log("Resend delivery accepted successfully. Email ID:", resendResult?.id);

      // 10. Success Response (Exact specification)
      return new Response(
        JSON.stringify({
          success: true,
          message: "Your request has been received."
        }),
        {
          status: 200,
          headers: jsonHeaders
        }
      );
    } catch (err) {
      console.error("Worker unhandled error:", err);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Internal server error"
        }),
        {
          status: 500,
          headers: jsonHeaders
        }
      );
    }
  }
};
