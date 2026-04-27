// ─────────────────────────────────────────────
//  EMAILJS CONFIGURATION
// ─────────────────────────────────────────────
const EMAILJS_PUBLIC_KEY = "errOxfyRufK5khrqp";
const EMAILJS_SERVICE_ID = "service_s1c3h0b";
const EMAILJS_TEMPLATE_ID = "template_wrkxt6f";

// ─────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");

function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  menuBtn.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("active");
  document.body.style.overflow = "";
  menuBtn.setAttribute("aria-expanded", "false");
}

function toggleSidebar() {
  sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSidebar();
});

// ─────────────────────────────────────────────
//  CONTACT FORM
// ─────────────────────────────────────────────
const contactForm = document.getElementById("contactForm");

if (contactForm) {
  if (typeof emailjs !== "undefined") {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  contactForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Spam trap
    const honeypot = document.getElementById("honeypot");
    if (honeypot && honeypot.value) return;

    const submitBtn = document.getElementById("submitBtn");
    const successMsg = document.getElementById("successMsg");

    const name    = document.getElementById("name").value.trim();
    const email   = document.getElementById("email").value.trim();
    const phone   = document.getElementById("phone").value.trim();
    const message = document.getElementById("message").value.trim();

    if (!name || !email || !phone || !message) {
      alert("Please fill in all fields before sending.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        from_name:  name,
        from_email: email,
        phone:      phone,
        message:    message,
        reply_to:   email,
      });

      contactForm.style.display = "none";
      if (successMsg) successMsg.style.display = "block";
    } catch (err) {
      console.error("EmailJS error:", err);
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
      alert(
        "Sorry, there was a problem sending your message.\n" +
          "Please try WhatsApp or email us directly."
      );
    }
  });
}
