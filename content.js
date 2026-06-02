// WhaScale CRM - Content Script v1.0
const APP_ID = "6a1d06b604ca0af56bb0519e";
const BASE_URL = "https://api.base44.com/api/apps/" + APP_ID;
let API_KEY = "";
let currentPhone = "";
let sidebarInjected = false;

chrome.storage.local.get(["whascale_api_key"], (result) => {
    API_KEY = result.whascale_api_key || "";
});

function init() {
    injectSidebar();
  observeConversationChanges();
}

function injectSidebar() {
    if (sidebarInjected) return;
  const sidebar = document.createElement("div");
  sidebar.id = "whascale-sidebar";
  sidebar.innerHTML = getSidebarHTML();
  document.body.appendChild(sidebar);
  sidebarInjected = true;
  attachSidebarEvents();
}

function observeConversationChanges() {
    const observer = new MutationObserver(() => {
    const phone = extractPhoneFromPage();
    if (phone && phone !== currentPhone) {
      currentPhone = phone;
      loadLeadData(phone);
    }
});
  observer.observe(document.body, { childList: true, subtree: true });
}

function extractPhoneFromPage() {
    try {
    const header = document.querySelector('[data-testid="conversation-header"]');
    if (!header) return null;
    const title = header.querySelector("span[title]");
    if (!title) return null;
    const text = title.getAttribute("title") || "";
    const clean = text.replace(/\D/g, "");
          if (clean.length >= 10) return clean;
    const url = window.location.href;
    const match = url.match(/phone=(\d+)/);
    if (match) return match[1];
    } catch (e) {}
  return null;
}

async function loadLeadData(phone) {
  if (!API_KEY) { showSidebarState("no-api-key"); return; }
  showSidebarState("loading");
  try {
    const res = await fetch(BASE_URL + "/functions/crmExtension", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api_key": API_KEY },
      body: JSON.stringify({ phone })
});
    const data = await res.json();
    if (data.found) { renderLead(data); } else { renderNewLead(phone); }
} catch (err) {
    showSidebarState("error");
}
}

function renderLead(data) {
  const { contato, observacoes, tarefas, historico, templates, funil } = data;
  document.getElementById("ws-contact-name").textContent = contato.name || "Sem nome";
  document.getElementById("ws-contact-phone").textContent = contato.phone || "";
  document.getElementById("ws-contact-email").textContent = contato.email || "";
  const tagsEl = document.getElementById("ws-tags");
  tagsEl.innerHTML = (contato.tags || []).map(t => '<span class="ws-tag">' + t + '</span>').join("");
  document.getElementById("ws-funil-status").innerHTML = '<span class="ws-funil-badge ws-funil-' + (contato.funil_status || "novo") + '">' + (contato.funil_status || "novo") + '</span>';
  const funilSelect = document.getElementById("ws-funil-select");
  funilSelect.innerHTML = (funil || []).map(e => '<option value="' + e.nome + '"' + (contato.funil_status === e.nome ? " selected" : "") + ">" + e.nome + "</option>").join("");
  funilSelect.dataset.contatoId = contato.id;
  const obsEl = document.getElementById("ws-observacoes-list");
  obsEl.innerHTML = !(observacoes || []).length ? '<p class="ws-empty">Nenhuma observacao ainda.</p>' : (observacoes || []).map(o => '<div class="ws-obs-item"><p>' + o.texto + '</p><small>' + (o.autor_nome || "") + " - " + formatDate(o.created_date) + "</small></div>").join("");
  const tarefasEl = document.getElementById("ws-tarefas-list");
  tarefasEl.innerHTML = !(tarefas || []).length ? '<p class="ws-empty">Nenhuma tarefa pendente.</p>' : (tarefas || []).map(t => '<div class="ws-tarefa-item"><span class="ws-tarefa-tipo">' + t.tipo + "</span><p>" + t.titulo + "</p><small>" + (t.data_vencimento ? formatDate(t.data_vencimento) : "Sem prazo") + "</small></div>").join("");
  const templatesEl = document.getElementById("ws-templates-list");
  templatesEl.innerHTML = (templates || []).map(tpl => '<div class="ws-template-item"><strong>' + tpl.name + '</strong><p>' + (tpl.content || "").substring(0, 60) + '...</p><button class="ws-btn-copy" onclick="window.wsCopyTemplate(this)" data-content="' + encodeURIComponent(tpl.content || "") + '">Copiar</button></div>').join("");
  const historicoEl = document.getElementById("ws-historico-list");
  historicoEl.innerHTML = !(historico || []).length ? '<p class="ws-empty">Nenhum historico.</p>' : (historico || []).map(h => '<div class="ws-hist-item ws-hist-' + h.tipo + '"><p>' + h.mensagem + "</p><small>" + (h.autor_nome || "") + " - " + formatDate(h.created_date) + "</small></div>").join("");
  showSidebarState("loaded");
  document.getElementById("ws-contact-id").value = contato.id;
}

function renderNewLead(phone) {
  document.getElementById("ws-contact-name").textContent = "Novo contato";
  document.getElementById("ws-contact-phone").textContent = phone;
  document.getElementById("ws-new-phone").value = phone;
  showSidebarState("new-lead");
}

function attachSidebarEvents() {
  document.getElementById("ws-toggle").addEventListener("click", () => {
    document.getElementById("whascale-sidebar").classList.toggle("ws-collapsed");
});
  document.querySelectorAll(".ws-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".ws-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".ws-tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
});
});
  document.getElementById("ws-btn-save-obs").addEventListener("click", async () => {
    const texto = document.getElementById("ws-obs-input").value.trim();
    const contatoId = document.getElementById("ws-contact-id").value;
    if (!texto || !contatoId) return;
    await fetch(BASE_URL + "/entities/Observacao", { method: "POST", headers: { "Content-Type": "application/json", "api_key": API_KEY }, body: JSON.stringify({ contato_id: contatoId, texto }) });
    document.getElementById("ws-obs-input").value = "";
    loadLeadData(currentPhone);
});
  document.getElementById("ws-btn-save-tarefa").addEventListener("click", async () => {
    const titulo = document.getElementById("ws-tarefa-titulo").value.trim();
    const tipo = document.getElementById("ws-tarefa-tipo").value;
    const data = document.getElementById("ws-tarefa-data").value;
    const contatoId = document.getElementById("ws-contact-id").value;
    if (!titulo || !contatoId) return;
    await fetch(BASE_URL + "/entities/Tarefa", { method: "POST", headers: { "Content-Type": "application/json", "api_key": API_KEY }, body: JSON.stringify({ contato_id: contatoId, titulo, tipo, status: "pendente", data_vencimento: data || null }) });
    document.getElementById("ws-tarefa-titulo").value = "";
    loadLeadData(currentPhone);
});
  document.getElementById("ws-funil-select").addEventListener("change", async (e) => {
    const contatoId = e.target.dataset.contatoId;
    if (!contatoId) return;
    await fetch(BASE_URL + "/entities/Contact/" + contatoId, { method: "PUT", headers: { "Content-Type": "application/json", "api_key": API_KEY }, body: JSON.stringify({ funil_status: e.target.value, ultima_interacao: new Date().toISOString() }) });
});
  document.getElementById("ws-btn-create-lead").addEventListener("click", async () => {
    const name = document.getElementById("ws-new-name").value.trim();
    const phone = document.getElementById("ws-new-phone").value.trim();
    if (!name || !phone) return;
    await fetch(BASE_URL + "/entities/Contact", { method: "POST", headers: { "Content-Type": "application/json", "api_key": API_KEY }, body: JSON.stringify({ name, phone, origem: "extensao_chrome", funil_status: "novo" }) });
    loadLeadData(phone);
});
  document.getElementById("ws-btn-save-hist").addEventListener("click", async () => {
    const msg = document.getElementById("ws-hist-input").value.trim();
    const tipo = document.getElementById("ws-hist-tipo").value;
    const contatoId = document.getElementById("ws-contact-id").value;
    if (!msg || !contatoId) return;
    await fetch(BASE_URL + "/entities/HistoricoConversa", { method: "POST", headers: { "Content-Type": "application/json", "api_key": API_KEY }, body: JSON.stringify({ contato_id: contatoId, mensagem: msg, tipo, canal: "whatsapp" }) });
    document.getElementById("ws-hist-input").value = "";
    loadLeadData(currentPhone);
});
}

function showSidebarState(state) {
  ["loading","loaded","new-lead","error","no-api-key"].forEach(s => {
    const el = document.getElementById("ws-state-" + s);
    if (el) el.style.display = s === state ? "block" : "none";
});
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

window.wsCopyTemplate = function(btn) {
  const content = decodeURIComponent(btn.dataset.content);
  navigator.clipboard.writeText(content);
  btn.textContent = "Copiado!";
  setTimeout(() => { btn.textContent = "Copiar"; }, 2000);
};

function getSidebarHTML() {
  return '<div id="ws-toggle" class="ws-toggle-btn">CRM</div>' +
  '<div class="ws-header"><strong>WhaScale CRM</strong></div>' +
  '<input type="hidden" id="ws-contact-id" value=""/>' +
  '<div id="ws-state-loading" style="display:none;padding:20px;text-align:center;"><div class="ws-spinner"></div><p>Buscando lead...</p></div>' +
  '<div id="ws-state-no-api-key" style="display:none;padding:20px;"><p>Configure sua API Key clicando no icone da extensao.</p></div>' +
  '<div id="ws-state-error" style="display:none;padding:20px;"><p>Erro ao carregar dados.</p></div>' +
  '<div id="ws-state-new-lead" style="display:none;padding:16px;"><p>Contato nao encontrado no CRM.</p><label>Nome:</label><input id="ws-new-name" type="text" class="ws-input" placeholder="Nome"/><label>Telefone:</label><input id="ws-new-phone" type="text" class="ws-input"/><button id="ws-btn-create-lead" class="ws-btn ws-btn-primary">Cadastrar no CRM</button></div>' +
  '<div id="ws-state-loaded" style="display:none;">' +
  '<div class="ws-contact-header"><div class="ws-avatar">U</div><div><h3 id="ws-contact-name"></h3><p id="ws-contact-phone" class="ws-muted"></p><p id="ws-contact-email" class="ws-muted"></p></div></div>' +
  '<div id="ws-tags" class="ws-tags-container"></div>' +
  '<div class="ws-funil-row"><div id="ws-funil-status"></div><select id="ws-funil-select" class="ws-select"></select></div>' +
  '<div class="ws-tabs"><button class="ws-tab active" data-tab="ws-tab-obs">Obs</button><button class="ws-tab" data-tab="ws-tab-tarefas">Tarefas</button><button class="ws-tab" data-tab="ws-tab-templates">Msgs</button><button class="ws-tab" data-tab="ws-tab-historico">Hist</button></div>' +
  '<div id="ws-tab-obs" class="ws-tab-content active"><div id="ws-observacoes-list" class="ws-list"></div><textarea id="ws-obs-input" class="ws-textarea" placeholder="Nova observacao..."></textarea><button id="ws-btn-save-obs" class="ws-btn ws-btn-primary">Salvar Obs</button></div>' +
  '<div id="ws-tab-tarefas" class="ws-tab-content"><div id="ws-tarefas-list" class="ws-list"></div><input id="ws-tarefa-titulo" type="text" class="ws-input" placeholder="Titulo da tarefa..."/><select id="ws-tarefa-tipo" class="ws-select"><option value="follow_up">Follow-up</option><option value="ligacao">Ligacao</option><option value="whatsapp">WhatsApp</option><option value="reuniao">Reuniao</option></select><input id="ws-tarefa-data" type="datetime-local" class="ws-input"/><button id="ws-btn-save-tarefa" class="ws-btn ws-btn-primary">Criar Tarefa</button></div>' +
  '<div id="ws-tab-templates" class="ws-tab-content"><div id="ws-templates-list" class="ws-list"></div></div>' +
  '<div id="ws-tab-historico" class="ws-tab-content"><div id="ws-historico-list" class="ws-list"></div><textarea id="ws-hist-input" class="ws-textarea" placeholder="Registrar mensagem..."></textarea><select id="ws-hist-tipo" class="ws-select"><option value="enviada">Enviada</option><option value="recebida">Recebida</option><option value="nota_interna">Nota interna</option></select><button id="ws-btn-save-hist" class="ws-btn ws-btn-primary">Registrar</button></div>' +
  '</div>';
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
