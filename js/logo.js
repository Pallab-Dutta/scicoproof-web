/* Renders the SciCoproof wordmark via KaTeX.
   Sidebar logo: SciCo_proof  (compact subscript variant)
   Page title:   SciCoÅngström_proofreading  (full formula variant)

   Any element with class "scicoproof-logo" gets the sidebar variant;
   class "scicoproof-title" gets the full title formula.
   Both scale by their element's CSS font-size. */
(function () {
  // Sidebar logo — compact: SciCo with blue "proof" subscript
  const TEX_LOGO = "\\mathbf{SciCo}_{\\color{#5576A6}{\\text{proof}}}";

  // Page title — mirrors the Streamlit title:
  //   SciCo with strikethrough-A → Å and strikethrough-o → ö corrections
  //   displayed in the superscript (red = deleted, green = added, grey = unchanged)
  //   with "proofreading" in the subscript.
  // KaTeX has no \sout; we use \cancel (diagonal) to indicate the deleted letter.
  const TEX_TITLE = [
    "\\text{SciCo}",
    "^{",
      "\\color{#D13D3D}{\\cancel{\\text{A}}}",
      "\\color{#6CA65D}{\\text{Å}}",
      "\\color{#525252}{\\text{ngstr}}",
      "\\color{#D13D3D}{\\cancel{\\text{o}}}",
      "\\color{#6CA65D}{\\text{ö}}",
      "\\color{#525252}{\\text{m}}",
    "}",
    "_{\\color{#5576A6}{\\text{proofreading}}}",
  ].join("");

  if (!document.getElementById("scicoproof-logo-style")) {
    const st = document.createElement("style");
    st.id = "scicoproof-logo-style";
    st.textContent = ".scicoproof-title .katex{font-size:1em}";
    (document.head || document.documentElement).appendChild(st);
  }

  function whenKatex(cb) {
    if (window.katex) return cb();
    let n = 0;
    const t = setInterval(() => {
      if (window.katex || n++ > 100) { clearInterval(t); if (window.katex) cb(); }
    }, 40);
  }

  function renderEl(el, tex) {
    if (!el) return;
    whenKatex(() => {
      try {
        window.katex.render(tex, el, {
          throwOnError: false,
          displayMode: false,
          trust: true,
          strict: false,
          macros: { "\\cancel": "\\enclose{updiagonalstrike}{#1}" },
        });
      } catch (_) {}
    });
  }

  function renderAll(root) {
    (root || document).querySelectorAll(".scicoproof-logo").forEach(el => renderEl(el, TEX_LOGO));
    (root || document).querySelectorAll(".scicoproof-title").forEach(el => renderEl(el, TEX_TITLE));
  }

  window.SciCoProofLogo = { TEX_LOGO, TEX_TITLE, renderAll };

  if (document.readyState !== "loading") renderAll();
  else document.addEventListener("DOMContentLoaded", () => renderAll());
})();
