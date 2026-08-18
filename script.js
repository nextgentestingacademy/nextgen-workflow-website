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

// Clean Hash at Top Helper (Change 1)
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
    // Clean section hash immediately
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
  // Clean section hash immediately
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

// ==========================================
// FORM VALIDATION & CLOUDFLARE TURNSTILE (Change 2)
// ==========================================

// Configurable Form Endpoint (e.g., Cloudflare Worker, Vercel Serverless Function, or Webhook)
// When left empty, client validates securely and demonstrates complete workflow
const FORM_ENDPOINT = ""; 

const form = document.getElementById("lead-form");
const submitBtn = document.getElementById("submit-btn");
const formAlert = document.getElementById("form-alert");

// Validation helper functions
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

function showAlert(type, message) {
  if (!formAlert) return;
  formAlert.className = `form-alert ${type}`;
  formAlert.textContent = message;
  formAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideAlert() {
  if (!formAlert) return;
  formAlert.className = "form-alert";
  formAlert.textContent = "";
}

// Live real-time error clearance on input & validation on blur
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

// Form Submission Handler
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert();

  // Honeypot check (anti-bot trap)
  const honeypot = document.getElementById("company_website");
  if (honeypot && honeypot.value.trim() !== "") {
    // Bot detected - do not process
    return;
  }

  // 1. Validate all fields
  let firstInvalid = null;
  let hasErrors = false;

  ["name", "company", "email", "phone", "process", "message"].forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    const error = validators[fieldId](input.value);
    if (error) {
      showError(fieldId, error);
      hasErrors = true;
      if (!firstInvalid) firstInvalid = input;
    } else {
      clearError(fieldId);
    }
  });

  // 2. Validate Cloudflare Turnstile token
  const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
  const turnstileToken = turnstileResponse ? turnstileResponse.value : "";
  const turnstileErrorEl = document.getElementById("turnstile-error");

  if (!turnstileToken) {
    if (turnstileErrorEl) {
      turnstileErrorEl.textContent = "Please complete the verification before submitting the form.";
      turnstileErrorEl.classList.add("visible");
    }
    hasErrors = true;
    if (!firstInvalid) {
      firstInvalid = document.querySelector(".cf-turnstile") || submitBtn;
    }
  } else {
    if (turnstileErrorEl) {
      turnstileErrorEl.textContent = "";
      turnstileErrorEl.classList.remove("visible");
    }
  }

  if (hasErrors) {
    firstInvalid?.focus();
    return;
  }

  // 3. Prepare payload
  const formData = {
    name: document.getElementById("name")?.value.trim(),
    company: document.getElementById("company")?.value.trim(),
    email: document.getElementById("email")?.value.trim(),
    phone: document.getElementById("phone")?.value.trim(),
    process: document.getElementById("process")?.value.trim(),
    message: document.getElementById("message")?.value.trim(),
    turnstileToken: turnstileToken
  };

  // 4. Update UI to submitting state
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
        throw new Error(result.error || "Verification failed");
      }
    } else {
      // Static / Demo Mode simulation (validates completely and resets)
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    // Success response
    showAlert("success", "Thank you. We've received your request and will get back to you shortly.");
    form.reset();

    // Reset Cloudflare Turnstile widget if present
    if (window.turnstile) {
      try {
        window.turnstile.reset();
      } catch (e) {
        // ignore reset errors
      }
    }
  } catch (error) {
    console.error("Form submission error:", error);
    showAlert("error", "We couldn't submit your request right now. Please try again or contact us at hello@nextgenworkflow.co.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Request Discovery Session";
    }
  }
});
