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

// Home Navigation & Brand Smooth Scroll to Absolute Top
document.querySelectorAll('a[href="#home"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
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
};

window.addEventListener("scroll", handleScroll, { passive: true });
handleScroll();

backToTopButton?.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

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

// Contact Form Handler
// TODO: Connect to live backend endpoint/webhook (e.g., Formspree, Make, n8n, Zapier, or custom API)
document.querySelector(".contact-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  if (!button) return;
  const originalText = button.textContent;
  button.textContent = "Request Ready to Send";
  setTimeout(() => {
    button.textContent = originalText;
  }, 2400);
});
