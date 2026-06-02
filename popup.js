// WhaScale CRM - popup.js
// Carrega a API Key salva
chrome.storage.local.get(["whascale_api_key"], (result) => {
  if (result.whascale_api_key) {
      document.getElementById("api-key-input").value = result.whascale_api_key;
        }
        });

        // Salva a API Key
        document.getElementById("btn-save").addEventListener("click", () => {
          const key = document.getElementById("api-key-input").value.trim();
            if (!key) return;
              chrome.storage.local.set({ whascale_api_key: key }, () => {
                  const status = document.getElementById("status");
                      status.style.display = "block";
                          setTimeout(() => { status.style.display = "none"; }, 2000);
                            });
                            });
