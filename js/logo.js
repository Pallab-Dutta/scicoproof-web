/* Renders the Benjamin wordmark into .scicoproof-logo and .scicoproof-title placeholders. */
(function () {
  function renderAll(root) {
    (root || document).querySelectorAll(".scicoproof-logo").forEach(el => {
      el.innerHTML = '<img src="Benjamin_name.svg" alt="Benjamin" class="benjamin-logo benjamin-logo--mini">';
    });
    (root || document).querySelectorAll(".scicoproof-title").forEach(el => {
      el.innerHTML = '<img src="Benjamin_name.svg" alt="Benjamin" class="benjamin-logo benjamin-logo--title">';
    });
  }

  window.SciCoProofLogo = { renderAll };

  if (document.readyState !== "loading") renderAll();
  else document.addEventListener("DOMContentLoaded", () => renderAll());
})();
