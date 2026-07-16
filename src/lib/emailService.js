import emailjs from "@emailjs/browser";

// EmailJS lets the app send real emails straight from the browser/Electron
// renderer, with no backend needed. The public key below is safe to ship
// client-side (that's how EmailJS is designed to be used) — it only allows
// sending through the specific service/template configured on your EmailJS
// account, not reading anything.
const SERVICE_ID = "service_ed748wk";
const TEMPLATE_ID = "template_levkmmi";
const PUBLIC_KEY = "ZudBZfrVLtFAc7mx_";

/**
 * Sends the one-time passcode to `email`.
 * The EmailJS template must expect these variables: email, passcode, time.
 */
export async function sendOtpEmail(email, passcode, validityLabel = "10 minutes") {
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      { email, passcode, time: validityLabel },
      { publicKey: PUBLIC_KEY }
    );
  } catch (err) {
    console.error("EmailJS send failed:", err);
    throw new Error("Impossible d'envoyer l'email. Vérifie ta connexion internet et réessaie.");
  }
}
