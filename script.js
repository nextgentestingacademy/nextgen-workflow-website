/**
 * NextGen Workflow Automation - Main JavaScript
 */

// Mobile Navigation Toggle
const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector(".nav-menu");

menuToggle?.addEventListener("click", () => {
  const isOpen = navMenu.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
});

navMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Open navigation menu");
  });
});

// Clean Hash at Top of Website (Rule: remove section hash only when returning to the absolute top)
function clearHashAtTop() {
  if (window.scrollY <= 10 && window.location.hash) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

// Home Navigation & Brand Smooth Scroll to Absolute Top
document.querySelectorAll('a[href="#home"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    // Immediately remove hash when user returns to top
    history.replaceState(null, "", window.location.pathname + window.location.search);

    if (navMenu?.classList.contains("open")) {
      navMenu.classList.remove("open");
      menuToggle?.setAttribute("aria-expanded", "false");
      menuToggle?.setAttribute("aria-label", "Open navigation menu");
    }
  });
});

// Floating Back-to-Top Button
const backToTopButton = document.querySelector(".back-to-top");

const handleScroll = () => {
  if (window.scrollY > 200) {
    backToTopButton?.classList.add("visible");
  } else {
    backToTopButton?.classList.remove("visible");
  }
  clearHashAtTop();
};

window.addEventListener("scroll", handleScroll, { passive: true });
handleScroll();

backToTopButton?.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
  // Immediately clean hash when clicking back-to-top
  history.replaceState(null, "", window.location.pathname + window.location.search);
});

// Scroll Reveal Animations
const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

// ================================================================
// CONTACT SECTION FORM SUBMISSION, VALIDATION & CLOUDFLARE TURNSTILE
// ================================================================

// Serverless Form Submission Endpoint (Cloudflare Worker / Vercel / Netlify / Webhook)
// Set your live backend endpoint URL here (or leaves empty to simulate confirmed processing)
const FORM_ENDPOINT = "";

const form = document.getElementById("lead-form");
const submitBtn = document.getElementById("submit-btn");
const contactStatusBanner = document.getElementById("contact-status-banner");

// Smoothly scroll to the TOP of the Contact section accounting for sticky header
function scrollToContactTop() {
  const contactSection = document.getElementById("contact");
  if (!contactSection) return;

  // Set URL hash to #contact as permitted after form submission
  if (window.location.hash !== "#contact") {
    history.replaceState(null, "", "#contact");
  }

  const header = document.querySelector(".site-header");
  const headerHeight = header ? header.offsetHeight : 80;
  const targetY = contactSection.getBoundingClientRect().top + window.scrollY - (headerHeight + 12);

  window.scrollTo({
    top: Math.max(0, targetY),
    behavior: "smooth"
  });
}

// Display result notification at the top of the Contact section
function showContactStatus(type, message) {
  if (!contactStatusBanner) return;

  const iconText = type === "success" ? "✓" : "!";
  contactStatusBanner.className = `contact-status-banner ${type}`;
  contactStatusBanner.innerHTML = `
    <span class="banner-icon" aria-hidden="true">${iconText}</span>
    <span class="banner-text">${message}</span>
  `;

  // Smoothly scroll to top of Contact section so user immediately sees the result
  scrollToContactTop();

  // Shift focus to banner for screen readers / accessibility
  setTimeout(() => {
    contactStatusBanner.focus();
  }, 350);
}

function hideContactStatus() {
  if (!contactStatusBanner) return;
  contactStatusBanner.className = "contact-status-banner";
  contactStatusBanner.innerHTML = "";
}

// Field Validators
const validators = {
  name: (val) => {
    const trimmed = val.trim();
    if (!trimmed) return "Please enter your name.";
    if (trimmed.length < 2 || trimmed.length > 80) return "Name must be between 2 and 80 characters.";
    const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['\-\.\s][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;
    if (!nameRegex.test(trimmed) || /^(.)\1{4,}$/.test(trimmed)) {
      return "Please enter a valid name.";
    }
    return "";
  },
  company: (val) => {
    const trimmed = val.trim();
    if (!trimmed) return "Please enter your company name.";
    if (trimmed.length < 2 || trimmed.length > 120) return "Company name must be between 2 and 120 characters.";
    const companyRegex = /^[A-Za-z0-9À-ÖØ-öø-ÿ\s&.,'\-\/()]+$/;
    if (!companyRegex.test(trimmed)) {
      return "Please enter a valid company name.";
    }
    return "";
  },
  email: (val) => {
    const trimmed = val.trim();
    if (!trimmed) return "Please enter your business email.";
    if (trimmed.length > 254) return "Email address is too long.";
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(trimmed)) {
      return "Please enter a valid business email address.";
    }
    return "";
  },
  phone: (val) => {
    const trimmed = val.trim();
    if (!trimmed) return "Please enter your phone number.";
    const phoneCharsRegex = /^[\+]?[0-9\s\-\(\)\.]{7,25}$/;
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (!phoneCharsRegex.test(trimmed) || digitsOnly.length < 7 || digitsOnly.length > 15 || /^(.)\1+$/.test(digitsOnly)) {
      return "Please enter a valid phone number.";
    }
    return "";
  },
  process: (val) => {
    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 10) {
      return "Please describe the process you would like to improve (minimum 10 characters).";
    }
    if (trimmed.length > 500) {
      return "Process description must not exceed 500 characters.";
    }
    if (/^(.)\1{9,}$/.test(trimmed)) {
      return "Please provide a meaningful process description.";
    }
    return "";
  },
  message: (val) => {
    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 10) {
      return "Please provide a little more information about your requirement (minimum 10 characters).";
    }
    if (trimmed.length > 2000) {
      return "Message must not exceed 2000 characters.";
    }
    if (/^(.)\1{9,}$/.test(trimmed)) {
      return "Please provide a meaningful description.";
    }
    return "";
  }
};

function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (field) {
    field.classList.add("invalid");
    field.setAttribute("aria-invalid", "true");
  }
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add("visible");
  }
}

function clearError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (field) {
    field.classList.remove("invalid");
    field.removeAttribute("aria-invalid");
  }
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.remove("visible");
  }
}

// Real-time error clearance on input & blur validation
["name", "company", "email", "phone", "process", "message"].forEach((fieldId) => {
  const input = document.getElementById(fieldId);
  if (!input) return;

  input.addEventListener("input", () => {
    if (input.classList.contains("invalid")) {
      const error = validators[fieldId](input.value);
      if (!error) {
        clearError(fieldId);
      }
    }
  });

  input.addEventListener("blur", () => {
    if (input.value.trim().length > 0) {
      const error = validators[fieldId](input.value);
      if (error) {
        showError(fieldId, error);
      } else {
        clearError(fieldId);
      }
    }
  });
});

// Cloudflare Turnstile Callbacks (Global)
window.onTurnstileSuccess = function () {
  clearError("turnstile");
};

window.onTurnstileExpired = function () {
  showError("turnstile", "Verification expired. Please complete the verification again.");
};

window.onTurnstileError = function (errorCode) {
  console.warn("Cloudflare Turnstile notice:", errorCode);
};

// Form Submission Handler
let isSubmitting = false;

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Prevent duplicate submissions if already in-flight
  if (isSubmitting) return;

  // Clear previous status banner
  hideContactStatus();

  // Honeypot anti-spam check (reject silently)
  const honeypot = document.getElementById("company_website");
  if (honeypot && honeypot.value.trim() !== "") {
    return;
  }

  // 1. Validate form fields
  let firstInvalid = null;
  let hasValidationErrors = false;

  ["name", "company", "email", "phone", "process", "message"].forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    const error = validators[fieldId](input.value);
    if (error) {
      showError(fieldId, error);
      hasValidationErrors = true;
      if (!firstInvalid) firstInvalid = input;
    } else {
      clearError(fieldId);
    }
  });

  // 2. Validate Turnstile CAPTCHA Token
  const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
  const turnstileToken = turnstileResponse ? turnstileResponse.value : "";
  const turnstileErrorEl = document.getElementById("turnstile-error");

  let hasCaptchaError = false;
  if (!turnstileToken) {
    if (turnstileErrorEl) {
      turnstileErrorEl.textContent = "Please complete the verification before submitting the form.";
      turnstileErrorEl.classList.add("visible");
    }
    hasCaptchaError = true;
    if (!firstInvalid) {
      firstInvalid = document.querySelector(".cf-turnstile") || submitBtn;
    }
  } else {
    if (turnstileErrorEl) {
      turnstileErrorEl.textContent = "";
      turnstileErrorEl.classList.remove("visible");
    }
  }

  // If there are validation or CAPTCHA errors:
  // Do NOT submit, do NOT show generic server failure, PRESERVE entered data, and focus first invalid field.
  if (hasValidationErrors || hasCaptchaError) {
    firstInvalid?.focus();
    return;
  }

  // 3. Prepare Form Payload
  const formData = {
    name: document.getElementById("name")?.value.trim(),
    company: document.getElementById("company")?.value.trim(),
    email: document.getElementById("email")?.value.trim(),
    phone: document.getElementById("phone")?.value.trim(),
    process: document.getElementById("process")?.value.trim(),
    message: document.getElementById("message")?.value.trim(),
    turnstileToken: turnstileToken
  };

  // 4. Update UI to Submitting State
  isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
  }

  try {
    if (FORM_ENDPOINT) {
      // Production Serverless Submission Flow
      const response = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Server rejected submission");
      }
    } else {
      // Static / Simulated Submission Delay
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // ==========================================
    // SUCCESSFUL SUBMISSION
    // ==========================================
    // 1. Display success message at top of Contact section
    showContactStatus("success", "Thank you. We've received your request and will get back to you shortly.");

    // 2. Clear form fields ONLY after confirmed success
    form.reset();

    // 3. Reset Turnstile widget
    if (window.turnstile) {
      try {
        window.turnstile.reset();
      } catch (e) {
        // ignore reset errors
      }
    }
  } catch (error) {
    // ==========================================
    // FAILED SUBMISSION (Server / Network Error)
    // ==========================================
    console.error("Form submission failed:", error);

    // 1. Display failure message at top of Contact section
    showContactStatus("error", "We couldn't submit your request right now. Please try again or contact us at hello@nextgenworkflow.co.");

    // 2. IMPORTANT: DO NOT clear the form. PRESERVE all user-entered data so they can retry.
    // 3. Reset Turnstile widget to allow re-verification if token was consumed
    if (window.turnstile) {
      try {
        window.turnstile.reset();
      } catch (e) {
        // ignore reset errors
      }
    }
  } finally {
    // Restore Submit Button
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Request Discovery Session";
    }
  }
});
