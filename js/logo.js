/* Renders the SciCoproof wordmark used on the landing page.
   .scicoproof-logo  -> compact sidebar variant
   .scicoproof-title -> centered app-page title variant */
(function () {
  function logoHTML(extraClass) {
    return `
      <span class="brand-mark ${extraClass}" aria-label="SciCoproof">
        <span class="brand-base">SciCo</span>
        <span class="brand-scripts">
          <span class="brand-sup">
            <span class="diff-letter">
              <span class="del-wrap"><span class="del-text">A</span><span class="strike-line"></span></span>
              <span class="ins-wrap">Å</span>
            </span>ngstr<span class="diff-letter">
              <span class="del-wrap"><span class="del-text">o</span><span class="strike-line"></span></span>
              <span class="ins-wrap">ö</span>
            </span>m
          </span>
          <span class="brand-sub">proofreading</span>
        </span>
      </span>`;
  }

  function renderLogo(el, extraClass) {
    if (!el) return;
    el.innerHTML = logoHTML(extraClass);
  }

  function renderAll(root) {
    (root || document).querySelectorAll(".scicoproof-logo").forEach(el => {
      renderLogo(el, "brand-mark--mini");
    });
    (root || document).querySelectorAll(".scicoproof-title").forEach(el => {
      renderLogo(el, "brand-mark--app");
    });
  }

  window.SciCoProofLogo = { renderAll };

  if (document.readyState !== "loading") renderAll();
  else document.addEventListener("DOMContentLoaded", () => renderAll());
})();
