// These preview-only controls save the embedded document without any server API.
// Saved copies omit this toolbar, rendered React state and local research data.
function installDownloadControls() {
  const controls = document.getElementById("standalone-export-controls");
  const status = document.getElementById("standalone-export-status");
  const dialog = document.getElementById("standalone-export-dialog");
  const textarea = document.getElementById("standalone-export-code");
  const updateVisibility = () => {
    const active = Boolean(
      document.querySelector('[data-testid="logo-intro"]'),
    );
    controls.hidden = active;
    controls.style.display = active ? "none" : "flex";
  };
  new MutationObserver(updateVisibility).observe(
    document.getElementById("root"),
    { childList: true, subtree: true },
  );
  updateVisibility();
  function portableHtml() {
    const copy = document.documentElement.cloneNode(true);
    copy
      .querySelectorAll("#standalone-export-controls,#standalone-export-script")
      .forEach((node) => node.remove());
    copy.querySelector("#root").replaceChildren();
    copy.querySelector("body").style.overflow = "";
    return "<!doctype html>\n" + copy.outerHTML;
  }
  document
    .getElementById("standalone-save-html")
    .addEventListener("click", () => {
      const blob = new Blob([portableHtml()], {
        type: "text/html;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Laanndet.html";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status.textContent =
        "Rozpoczęto zapis. Jeśli przeglądarka go blokuje, wybierz ⋯ → Kopiuj kod HTML.";
    });
  document
    .getElementById("standalone-copy-html")
    .addEventListener("click", async () => {
      const html = portableHtml();
      try {
        if (!navigator.clipboard?.writeText)
          throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(html);
        status.textContent =
          "Kod skopiowany. Wklej go do Notatnika i zapisz jako Laanndet.html (typ: Wszystkie pliki, kodowanie UTF-8).";
      } catch {
        textarea.value = html;
        dialog.showModal();
        textarea.focus();
        textarea.select();
      }
    });
  document
    .getElementById("standalone-close-copy")
    .addEventListener("click", () => {
      dialog.close();
      textarea.value = "";
    });
}
export function downloadControlsMarkup() {
  return `<div id="standalone-export-controls" lang="pl" style="position:fixed;left:14px;bottom:14px;z-index:1100;display:flex;align-items:center;gap:5px;font:600 12px/1.5 Manrope,Arial,sans-serif"><button id="standalone-save-html" type="button" style="min-height:44px;padding:10px 16px;border:1px solid #174d3c;border-radius:24px;background:#174d3c;color:white;box-shadow:0 3px 15px #0002">↓ Zapisz HTML</button><details style="position:relative"><summary aria-label="Więcej opcji zapisu" style="display:flex;align-items:center;justify-content:center;list-style:none;cursor:pointer;width:40px;height:44px;border:1px solid #d9dfd2;border-radius:22px;background:#fffdf7;color:#174d3c">⋯</summary><button id="standalone-copy-html" type="button" style="position:absolute;bottom:52px;left:0;white-space:nowrap;padding:12px 16px;border:1px solid #d9dfd2;border-radius:8px;background:#fffdf7;color:#174d3c;box-shadow:0 3px 15px #0002">Kopiuj kod HTML</button></details><span id="standalone-export-status" role="status" style="position:absolute;left:0;bottom:54px;max-width:min(360px,85vw);width:max-content;background:#fffdf7;color:#174d3c;font-size:11px;border-radius:6px;padding:0 8px"></span><dialog id="standalone-export-dialog" class="modal" aria-labelledby="standalone-copy-title" style="padding:25px;max-width:650px"><h2 id="standalone-copy-title" style="font-size:23px">Skopiuj stronę do pliku</h2><p>W polu poniżej jest cały projekt. Naciśnij Ctrl+C, wklej kod do Notatnika i zapisz jako <strong>Laanndet.html</strong>. Wybierz typ „Wszystkie pliki” i kodowanie UTF-8.</p><textarea id="standalone-export-code" aria-label="Kod HTML do skopiowania" readonly style="width:100%;height:230px;margin:20px 0;font:11px monospace;border:1px solid #d9dfd2;border-radius:6px"></textarea><button id="standalone-close-copy" type="button" class="button primary">Zamknij</button></dialog></div><script id="standalone-export-script">(${installDownloadControls.toString()})();</script>`;
}
