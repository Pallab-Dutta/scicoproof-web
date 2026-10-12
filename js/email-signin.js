/* "Sign in with email": a small dialog for passwordless sign-in, opened by any .js-email-signin
   element. Step 1 sends a one-time link + code to the address; step 2 accepts the code (for when the
   email is opened on another device, or a mail filter breaks the link). Google sign-in is untouched. */
(function () {
  const Auth = window.SciCoProofAuth;
  if (!Auth) return;
  const RESEND_SECONDS = 60;
  let dlg = null, email = "", timer = null;

  const css = `
  .esi{position:fixed;inset:0;margin:auto;height:fit-content;max-height:calc(100vh - 32px);overflow:auto;
       border:1px solid var(--border,#e3d4b4);border-radius:16px;padding:0;max-width:min(420px,calc(100vw - 32px));
       width:100%;background:var(--surface,#fffdf8);color:var(--text,#2c2416);box-shadow:0 8px 24px -12px rgba(44,36,22,.25)}
  .esi::backdrop{background:rgba(44,36,22,.35)}
  .esi__body{padding:24px;position:relative}
  .esi h2{font-family:"Cutive Mono",monospace;font-size:1.25rem;margin:0 0 6px}
  .esi p{font-family:"Lora",Georgia,serif;font-size:.95rem;line-height:1.5;margin:0 0 14px;color:var(--muted,#6f6452)}
  .esi label{display:block;font-family:"Cutive Mono",monospace;font-size:.85rem;margin:0 0 6px}
  .esi input{width:100%;box-sizing:border-box;font:inherit;font-size:1rem;padding:10px 12px;border-radius:10px;
       border:1px solid var(--border,#e3d4b4);background:#fff;color:inherit;margin:0 0 12px}
  .esi input:focus{outline:2px solid var(--accent,#5576a6);outline-offset:1px}
  .esi input.esi__code{letter-spacing:.35em;font-family:"Cutive Mono",monospace;text-align:center;font-size:1.3rem}
  .esi__row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .esi__row .btn{flex:1 1 auto;padding:12px 18px;font-size:.95rem;line-height:1.2;min-height:44px}
  .esi__link{background:none;border:0;padding:0;font:inherit;font-size:.85rem;color:var(--accent,#5576a6);
       text-decoration:underline;cursor:pointer}
  .esi__link[disabled]{color:var(--muted,#6f6452);text-decoration:none;cursor:default}
  .esi__msg{min-height:1.2em;font-size:.85rem;margin:8px 0 0;font-family:"Lora",Georgia,serif}
  .esi .esi__msg--err{color:var(--del-text,#b23a3a)} .esi .esi__msg--ok{color:var(--ins-text,#2f7a33)}
  .esi__close{position:absolute;top:10px;right:12px;background:none;border:0;font-size:1.4rem;line-height:1;
       cursor:pointer;color:var(--muted,#6f6452)}
  .esi-alt{display:block;margin-top:12px;font-size:.9rem}
  .hero__actions + .esi-alt{margin:-1.4rem 0 2rem}
  .esi-alt button{background:none;border:0;padding:0;font:inherit;color:var(--muted,#6f6452);text-decoration:underline;cursor:pointer}
  .esi-alt button:hover{color:#317B3C}`;

  function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function build() {
    dlg = el(`
      <dialog class="esi" aria-labelledby="esi-title">
        <button class="esi__close" type="button" aria-label="Close">×</button>
        <div class="esi__body">
          <form class="esi__step esi__step--email">
            <h2 id="esi-title">Sign in with email</h2>
            <p>No password: we email you a sign-in link and a code. Use the address of your Google account
               if you already have one, to keep the same plan and history.</p>
            <label for="esi-email">Email address</label>
            <input id="esi-email" type="email" autocomplete="email" required placeholder="you@university.edu">
            <div class="esi__row"><button class="btn btn--primary" type="submit">Send sign-in link</button></div>
            <p class="esi__msg" role="status"></p>
          </form>
          <form class="esi__step esi__step--code" hidden>
            <h2>Check your inbox</h2>
            <p>We sent a sign-in link to <strong class="esi__to"></strong>. Click it on this device, or enter
               the code from the email here. Not there? Check spam or promotions.</p>
            <label for="esi-code">Code</label>
            <input id="esi-code" class="esi__code" inputmode="numeric" autocomplete="one-time-code"
                   pattern="[0-9]{6,10}" maxlength="10" required placeholder="123456">
            <div class="esi__row"><button class="btn btn--primary" type="submit">Sign in</button></div>
            <div class="esi__row" style="margin-top:10px;justify-content:space-between">
              <button class="esi__link esi__resend" type="button" disabled>Resend</button>
              <button class="esi__link esi__other" type="button">Use a different email</button>
            </div>
            <p class="esi__msg" role="status"></p>
          </form>
        </div>
      </dialog>`);
    document.body.appendChild(dlg);
    const fEmail = dlg.querySelector(".esi__step--email"), fCode = dlg.querySelector(".esi__step--code");
    dlg.querySelector(".esi__close").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    fEmail.addEventListener("submit", async e => { e.preventDefault(); await send(fEmail, fCode); });
    fCode.addEventListener("submit", async e => { e.preventDefault(); await verify(fCode); });
    dlg.querySelector(".esi__resend").addEventListener("click", () => send(fEmail, fCode, true));
    dlg.querySelector(".esi__other").addEventListener("click", () => showStep(fEmail, fCode, "email"));
  }

  function msg(form, text, kind) {
    const m = form.querySelector(".esi__msg");
    m.textContent = text || "";
    m.className = "esi__msg" + (kind ? " esi__msg--" + kind : "");
  }

  function busy(form, on) { form.querySelectorAll("button,input").forEach(x => { if (!x.classList.contains("esi__resend")) x.disabled = on; }); }

  function showStep(fEmail, fCode, step) {
    fEmail.hidden = step !== "email";
    fCode.hidden = step !== "code";
    msg(fEmail, ""); msg(fCode, "");
    (step === "email" ? fEmail.querySelector("input") : fCode.querySelector("input")).focus();
  }

  function startResendTimer() {
    const b = dlg.querySelector(".esi__resend");
    let left = RESEND_SECONDS;
    clearInterval(timer);
    b.disabled = true;
    b.textContent = `Resend in ${left}s`;
    timer = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(timer); b.disabled = false; b.textContent = "Resend"; return; }
      b.textContent = `Resend in ${left}s`;
    }, 1000);
  }

  function friendly(err) {
    const t = (err && (err.message || err.msg || "")) + "";
    if (/rate|too many|security purposes/i.test(t)) return "Too many requests: please wait a minute and try again.";
    if (/invalid.*email|email.*invalid/i.test(t)) return "Please enter a valid email address.";
    if (/expired|invalid|token/i.test(t)) return "That code is wrong or has expired: request a new one.";
    return "Something went wrong. Please try again, or write to contact@scicoagent.com.";
  }

  async function send(fEmail, fCode, resend) {
    const input = fEmail.querySelector("input");
    if (!resend) email = input.value.trim().toLowerCase();
    if (!email || !input.checkValidity()) { msg(fEmail, "Please enter a valid email address.", "err"); return; }
    const form = resend ? fCode : fEmail;
    busy(form, true);
    msg(form, resend ? "Sending a new link…" : "Sending…");
    try {
      await Auth.signInWithEmail(email);
      dlg.querySelector(".esi__to").textContent = email;
      if (!resend) showStep(fEmail, fCode, "code");
      msg(fCode, resend ? "A new link and code are on the way." : "", "ok");
      startResendTimer();
    } catch (err) {
      msg(form, friendly(err), "err");
    } finally {
      busy(form, false);
    }
  }

  async function verify(fCode) {
    const code = fCode.querySelector("input").value.replace(/\D/g, "");
    if (code.length < 6) { msg(fCode, "Enter the code from the email.", "err"); return; }
    busy(fCode, true);
    msg(fCode, "Signing in…");
    try {
      await Auth.verifyEmailCode(email, code);
      msg(fCode, "Signed in. Opening Benjamin…", "ok");
      location.href = "app.html";
    } catch (err) {
      msg(fCode, friendly(err), "err");
      busy(fCode, false);
    }
  }

  async function open() {
    try {
      const user = await Auth.getUser();
      if (user) { location.href = "app.html"; return; }
    } catch (_) {}
    if (!dlg) build();
    const fEmail = dlg.querySelector(".esi__step--email"), fCode = dlg.querySelector(".esi__step--code");
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    showStep(fEmail, fCode, "email");
  }

  window.SciCoEmailSignIn = { open: open };
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest(".js-email-signin");
    if (t) { e.preventDefault(); open(); }
  });
})();
