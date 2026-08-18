/**
 * NextGen Workflow Automation - Secure Form Submission Cloudflare Worker
 * Runtime: Cloudflare Workers (ES Module format: export default { async fetch(request, env, ctx) })
 *
 * Secret Binding:
 * - CLOUDFLARE_TURNSTILE_SECRET_KEY: Secret key from Cloudflare Turnstile dashboard
 *   (Set in Cloudflare Dashboard > Workers & Pages > Settings > Variables and Secrets,
 *    or via `npx wrangler secret put CLOUDFLARE_TURNSTILE_SECRET_KEY`)
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
      // In Cloudflare Workers, secrets are bound on the `env` parameter
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

      const leadData = {
        name: sanitize(name.trim()),
        company: sanitize(company.trim()),
        email: sanitize(email.trim()),
        phone: sanitize(phone.trim()),
        process: sanitize(process.trim()),
        message: sanitize(message.trim()),
        timestamp: new Date().toISOString()
      };

      // 9. Confirmed Receipt (Email dispatch will be attached in a subsequent step)
      console.log("Verified Lead Received:", leadData);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Thank you. We've received your request and will get back to you shortly."
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
