/* SciCoproof sidebar shell.
   Renders the persistent collapsible sidebar (profile, logout, rating, new-run button).
   Auth guard: redirects unauthenticated visitors to index.html.
   Mirrors the pattern of scico-search-web/js/shell.js. */
(function () {
  const esc = s => String(s == null ? "" : s)
    .replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function sidebarHTML() {
    return `
      <div class="sb-top">
        <span class="sb-logo scicoproof-logo" style="font-size:1.05rem"></span>
        <button class="sb-toggle" id="sbToggle" title="Hide sidebar">
          <span class="mi">chevron_left</span>
        </button>
      </div>

      <div class="sb-profile">
        <span class="sb-avatar" id="sbAvatar">?</span>
        <div class="sb-id">
          <div class="sb-name" id="sbName">…</div>
          <div class="sb-email" id="sbEmail"></div>
        </div>
      </div>

      <button class="sb-logout" id="sbLogout">
        <span class="mi">logout</span> Log Out
      </button>

      <a class="sb-logout sb-plans" href="pricing.html">
        <span class="mi">workspace_premium</span> Pricing &amp; Plans
      </a>

      <hr style="border:0;border-top:1px solid var(--line);margin:0"/>

      <div class="sb-rate">
        <p class="side-h"><span class="mi">star</span> Rate SciCoproof</p>
        <div class="stars" id="sbStars">
          ${[1,2,3,4,5].map(i =>
            `<span class="mi" data-star="${i}" title="${i} star${i>1?'s':''}">star</span>`
          ).join("")}
        </div>
        <div class="sb-feedback" id="sbFeedback" style="display:none">
          <textarea id="sbComment" placeholder="Optional: what do you love? What's missing?" rows="3"></textarea>
          <button id="sbSubmitReview">Submit Review</button>
        </div>
        <div id="sbReviewThanks" style="display:none;font-size:.85rem;color:var(--blue)">
          Thank you for the review! ✓
        </div>
      </div>

      <button class="sb-newbtn" id="sbNewRun">
        <span class="mi">add</span> New Proofreading Run
      </button>`;
  }

  const Shell = {
    _selectedStars: 0,

    async init() {
      const host = document.getElementById("sidebar");
      if (!host) return;
      host.innerHTML = sidebarHTML();

      // Render the SciCoproof KaTeX logo in the sidebar
      if (window.SciCoProofLogo) window.SciCoProofLogo.renderAll(host);

      // Collapse state (persisted like the Streamlit sidebar)
      if (localStorage.getItem("scicoproof_sb_collapsed") === "1") {
        document.body.classList.add("sb-collapsed");
      }
      const toggle = () => {
        const collapsed = document.body.classList.toggle("sb-collapsed");
        localStorage.setItem("scicoproof_sb_collapsed", collapsed ? "1" : "0");
      };
      document.getElementById("sbToggle").addEventListener("click", toggle);
      const exp = document.getElementById("sbExpand");
      if (exp) exp.addEventListener("click", toggle);

      // Logout
      document.getElementById("sbLogout").addEventListener("click", async () => {
        try { await window.SciCoProofAuth.signOut(); } catch (_) {}
        location.href = "index.html";
      });

      // New run
      document.getElementById("sbNewRun").addEventListener("click", () => {
        if (window.App && window.App.resetToUpload) {
          window.App.resetToUpload();
        } else {
          location.reload();
        }
      });

      // Star rating
      const starsEl = document.getElementById("sbStars");
      const feedbackEl = document.getElementById("sbFeedback");
      const thanksEl = document.getElementById("sbReviewThanks");

      starsEl.querySelectorAll(".mi").forEach(starEl => {
        starEl.addEventListener("click", () => {
          Shell._selectedStars = +starEl.dataset.star;
          starsEl.querySelectorAll(".mi").forEach((s, i) => {
            s.classList.toggle("lit", i < Shell._selectedStars);
            s.classList.toggle("fill", i < Shell._selectedStars);
            s.style.color = i < Shell._selectedStars ? "#E3A52E" : "#ccc";
          });
          feedbackEl.style.display = "flex";
        });
        starEl.addEventListener("mouseenter", () => {
          const n = +starEl.dataset.star;
          starsEl.querySelectorAll(".mi").forEach((s, i) => {
            s.style.color = i < n ? "#E3A52E" : "#ccc";
          });
        });
        starEl.addEventListener("mouseleave", () => {
          starsEl.querySelectorAll(".mi").forEach((s, i) => {
            s.style.color = i < Shell._selectedStars ? "#E3A52E" : "#ccc";
          });
        });
      });

      document.getElementById("sbSubmitReview").addEventListener("click", async () => {
        if (!Shell._selectedStars) return;
        const comment = document.getElementById("sbComment").value.trim();
        try {
          await window.SciCoProofAPI.feedback(Shell._selectedStars, comment);
        } catch (_) {}
        feedbackEl.style.display = "none";
        thanksEl.style.display = "block";
      });

      // Auth guard + profile fill
      window.SciCoProofAuth.onChange(user => {
        if (!user) { location.href = "index.html"; return; }
        const md = user.user_metadata || {};
        const name = md.full_name || md.name || user.name || (user.email || "").split("@")[0];
        document.getElementById("sbName").textContent = name;
        document.getElementById("sbEmail").textContent = user.email || "";
        const av = document.getElementById("sbAvatar");
        const picture = md.avatar_url || md.picture || user.picture;
        if (picture) {
          const img = document.createElement("img");
          img.className = "sb-avatar";
          img.id = "sbAvatar";
          img.src = esc(picture);
          img.alt = "";
          av.replaceWith(img);
        } else {
          av.textContent = (name || "?").trim().charAt(0).toUpperCase();
        }
        Shell.loadPlan(user);   // plan HUD: instant from cache, then confirmed by /me
        Shell.requireTerms(user);
      });
    },

    /** First sign-in (or after the Terms change): show Terms + Privacy and require agreement before
     *  the app can be used. Acceptance is stored on the user's account (Supabase user_metadata:
     *  terms_version + terms_accepted_at), so it follows the user across browsers and devices. */
    TERMS_VERSION: "2026-10-02",
    requireTerms(user) {
      const md = (user && user.user_metadata) || {};
      if (md.terms_version === Shell.TERMS_VERSION || document.getElementById("termsGate")) return;
      const css = document.createElement("style");
      css.textContent = `
        #termsGate{position:fixed;inset:0;z-index:9999;background:rgba(44,36,22,.55);display:flex;
          align-items:center;justify-content:center;padding:16px}
        #termsGate .tg-card{background:#fffdf8;border:1px solid #e3d4b4;border-radius:16px;max-width:520px;
          width:100%;padding:26px 26px 22px;box-shadow:0 18px 50px -20px rgba(44,36,22,.5);color:#2c2416;
          font-family:Lora,Georgia,serif}
        #termsGate h2{font-family:"Cutive Mono",monospace;font-size:1.35rem;margin:0 0 .6rem}
        #termsGate p{margin:.4rem 0 .9rem;line-height:1.55;color:#6f6452}
        #termsGate .tg-links{display:flex;gap:.6rem;flex-wrap:wrap;margin:.2rem 0 1rem}
        #termsGate .tg-links a{border:1px solid #e3d4b4;border-radius:999px;padding:.35rem .9rem;color:#5576a6;
          text-decoration:none;font-weight:600}
        #termsGate label{display:flex;gap:.6rem;align-items:flex-start;line-height:1.45;cursor:pointer}
        #termsGate input{margin-top:.25rem;width:1.05rem;height:1.05rem}
        #termsGate .tg-row{display:flex;gap:.6rem;justify-content:flex-end;margin-top:1.2rem;flex-wrap:wrap}
        #termsGate button{border-radius:999px;padding:.6rem 1.3rem;font-weight:700;cursor:pointer;
          font-family:"Cutive Mono",monospace;border:1px solid #e3d4b4;background:transparent;color:#2c2416}
        #termsGate button.tg-ok{background:#F9C7C7;color:#B33A3B;border-color:transparent}
        #termsGate button.tg-ok:disabled{opacity:.45;cursor:not-allowed}
        #termsGate .tg-err{color:#b23a3a;font-size:.9rem;margin-top:.6rem;display:none}`;
      document.head.appendChild(css);
      const gate = document.createElement("div");
      gate.id = "termsGate";
      gate.setAttribute("role", "dialog");
      gate.setAttribute("aria-modal", "true");
      gate.innerHTML = `
        <div class="tg-card">
          <h2>Before you start</h2>
          <p>Please read Benjamin's Terms of Service and Privacy Policy. They explain how your documents
             are processed (by Google's Gemini API), what you can expect from the AI suggestions, and how
             plans, cancellation and refunds work.</p>
          <div class="tg-links">
            <a href="terms.html" target="_blank" rel="noopener">Terms of Service ↗</a>
            <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy ↗</a>
          </div>
          <label><input type="checkbox" id="tgAgree">
            <span>I have read and agree to the Terms of Service and the Privacy Policy.</span></label>
          <div class="tg-err" id="tgErr">Could not save your agreement — please try again.</div>
          <div class="tg-row">
            <button type="button" id="tgDecline">Sign out</button>
            <button type="button" class="tg-ok" id="tgAccept" disabled>Agree and continue</button>
          </div>
        </div>`;
      document.body.appendChild(gate);
      const box = document.getElementById("tgAgree"), ok = document.getElementById("tgAccept");
      box.addEventListener("change", () => { ok.disabled = !box.checked; });
      document.getElementById("tgDecline").addEventListener("click", async () => {
        try { await window.SciCoProofAuth.signOut(); } catch (_) {}
        location.href = "index.html";
      });
      ok.addEventListener("click", async () => {
        ok.disabled = true;
        try {
          const c = window.SciCoProofAuth.client();
          const { error } = await c.auth.updateUser({ data: {
            terms_version: Shell.TERMS_VERSION, terms_accepted_at: new Date().toISOString() } });
          if (error) throw error;
          gate.remove();
        } catch (_) {
          document.getElementById("tgErr").style.display = "block";
          ok.disabled = false;
        }
      });
    },

    /** Fetch /me and render the top-right plan badge + monthly word-budget bar. */
    /** Fetch /me and render the plan HUD. Renders INSTANTLY first from the last plan seen for this
     *  user (localStorage), or Free on a first visit, because /me can take seconds while the API
     *  Space wakes up; the real answer then replaces it and is remembered for next time. */
    async loadPlan(user) {
      const hud = document.getElementById("planHud");
      if (!hud || !window.SciCoProofAPI) return;
      const key = "benjamin.plan." + ((user && user.id) || "anon");
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) {}
      Shell.renderPlan(cached || { tier: "free" });
      let me;
      try { me = await window.SciCoProofAPI.me(); } catch (_) { return; }
      try {
        localStorage.setItem(key, JSON.stringify({ tier: me.tier, word_limit: me.word_limit,
          words_used: me.words_used, words_remaining: me.words_remaining }));
      } catch (_) {}
      Shell.renderPlan(me);
    },

    renderPlan(me) {
      const hud = document.getElementById("planHud");
      if (!hud) return;
      const tier = (me.tier || "free").toLowerCase();
      const badge = document.getElementById("planBadge");
      badge.textContent = { free: "Free", pro: "Pro", max: "Max" }[tier] || "Free";
      badge.className = "plan-badge plan-" + tier;

      const upgrade = document.getElementById("planUpgrade");
      if (tier === "free")      { upgrade.textContent = "Upgrade to Pro"; upgrade.hidden = false; }
      else if (tier === "pro")  { upgrade.textContent = "Upgrade to Max"; upgrade.hidden = false; }
      else                      { upgrade.hidden = true; }

      // Free tier currently has no word budget — show only the badge + upgrade CTA.
      const budget = hud.querySelector(".plan-budget");
      if (tier === "free") {
        budget.hidden = true;
      } else {
        budget.hidden = false;
        const limit = Number(me.word_limit || 0);
        const used = Number(me.words_used || 0);
        const remaining = me.words_remaining != null ? Number(me.words_remaining)
                                                     : Math.max(0, limit - used);
        const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        const fill = document.getElementById("planBudgetFill");
        fill.style.width = pct + "%";
        fill.classList.toggle("pb-danger", pct >= 90);
        document.getElementById("planBudgetLabel").textContent =
          `${used.toLocaleString()} / ${limit.toLocaleString()} words · ${remaining.toLocaleString()} left`;
      }

      hud.hidden = false;
    },
  };

  window.Shell = Shell;
})();
