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
        Shell.loadPlan();   // fill the top-right plan + budget HUD once we know the user
      });
    },

    /** Fetch /me and render the top-right plan badge + monthly word-budget bar. */
    async loadPlan() {
      const hud = document.getElementById("planHud");
      if (!hud || !window.SciCoProofAPI) return;
      let me;
      try { me = await window.SciCoProofAPI.me(); } catch (_) { return; }

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
