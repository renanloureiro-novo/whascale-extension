// WhaScale CRM - Popup Script v2.0

document.addEventListener("DOMContentLoaded", () => {
  const keyInput = document.getElementById("api-key-input");
  const saveBtn = document.getElementById("btn-save-key");
  const statusEl = document.getElementById("status-msg");
  const openWa = document.getElementById("btn-open-wa");

  // Load saved key
  chrome.storage.local.get(["whascale_api_key"], (result) => {
    if (result.whascale_api_key) {
      keyInput.value = result.whascale_api_key;
      showStatus("API Key carregada.", "success");
    }
  });

  // Save key
  saveBtn.addEventListener("click", () => {
    const key = keyInput.value.trim();
    if (!key) {
      showStatus("Digite sua API Key.", "error");
      return;
    }
    chrome.storage.local.set({ whascale_api_key: key }, () => {
      showStatus("Salvo! Recarregue o WhatsApp Web.", "success");
      // Notify content script
      chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: "API_KEY_UPDATED", key });
        });
      });
    });
  });

  // Open WhatsApp Web
  if (openWa) {
    openWa.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://web.whatsapp.com" });
    });
  }

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = "status " + type;
    statusEl.style.display = "block";
    setTimeout(() => { statusEl.style.display = "none"; }, 3000);
  }
});
