// WhaScale CRM - Content Script v2.0
const APP_ID = "6a1d06b604ca0af56bb0519e";
const BASE_URL = "https://api.base44.com/api/apps/" + APP_ID;
let API_KEY = "";
let currentPhone = "";
let currentContactId = "";
let sidebarInjected = false;

// Load API key from storage
chrome.storage.local.get(["whascale_api_key"], (result) => {
  API_KEY = result.whascale_api_key || "";
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "API_KEY_UPDATED") {
    API_KEY = msg.key;
    if (currentPhone) loadLeadData(currentPhone);
  }
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

function getSidebarHTML() {
  return `
  <div id="ws-toggle" class="ws-toggle-btn">WhaScale</div>
  <div class="ws-header">
    <span>WhaScale CRM</span>
  </div>
  <div id="ws-loading" class="ws-state" style="display:none">
    <p>Carregando...</p>
  </div>
  <div id="ws-no-key" class="ws-state" style="display:none">
    <p>Configure sua API Key no icone da extensao.</p>
  </div>
  <div id="ws-error" class="ws-state" style="display:none">
    <p>Erro ao carregar dados.</p>
  </div>
  <div id="ws-new-lead" class="ws-state" style="display:none">
    <p>Novo contato detectado</p>
    <p id="ws-new-phone-label"></p>
    <input id="ws-new-name" type="text" placeholder="Nome do contato" class="ws-input"/>
    <button id="ws-btn-create" class="ws-btn ws-btn-primary">Salvar contato</button>
  </div>
  <div id="ws-loaded" style="display:none">
    <input type="hidden" id="ws-contact-id"/>
    <div class="ws-contact-info">
      <div class="ws-avatar" id="ws-avatar">W</div>
      <div>
        <div id="ws-contact-name" class="ws-name">--</div>
        <div id="ws-contact-phone" class="ws-phone">--</div>
        <div id="ws-contact-email" class="ws-email"></div>
      </div>
    </div>
    <div id="ws-tags" class="ws-tags"></div>
    <div class="ws-funil-bar">
      <label>Funil:</label>
      <select id="ws-funil-select" class="ws-select"></select>
    </div>
    <div class="ws-tabs">
      <button class="ws-tab active" data-tab="ws-tab-obs">Obs.</button>
      <button class="ws-tab" data-tab="ws-tab-tarefas">Tarefas</button>
      <button class="ws-tab" data-tab="ws-tab-templates">Modelos</button>
      <button class="ws-tab" data-tab="ws-tab-historico">Historico</button>
    </div>
    <div id="ws-tab-obs" class="ws-tab-content active">
      <div id="ws-obs-list"></div>
      <textarea id="ws-obs-input" class="ws-textarea" placeholder="Nova observacao..."></textarea>
      <button id="ws-btn-save-obs" class="ws-btn ws-btn-primary">Salvar</button>
    </div>
    <div id="ws-tab-tarefas" class="ws-tab-content">
      <div id="ws-tarefas-list"></div>
      <input id="ws-tarefa-titulo" type="text" class="ws-input" placeholder="Titulo da tarefa"/>
      <input id="ws-tarefa-data" type="date" class="ws-input"/>
      <button id="ws-btn-save-tarefa" class="ws-btn ws-btn-primary">Criar Tarefa</button>
    </div>
    <div id="ws-tab-templates" class="ws-tab-content">
      <div id="ws-templates-list"></div>
    </div>
    <div id="ws-tab-historico" class="ws-tab-content">
      <div id="ws-historico-list"></div>
    </div>
  </div>
  `;
}

function observeConversationChanges() {
  let lastChecked = "";
  setInterval(() => {
    const phone = extractPhoneFromPage();
    if (phone && phone !== lastChecked) {
      lastChecked = phone;
      currentPhone = phone;
      loadLeadData(phone);
    }
  }, 2000);
}

function extractPhoneFromPage() {
  try {
    const url = window.location.href;
    const match = url.match(/[?&]phone=([0-9]+)/);
    if (match) return match[1];
    const spans = document.querySelectorAll('span[title]');
    for (const span of spans) {
      const t = (span.getAttribute('title') || '').replace(/\D/g, '');
      if (t.length >= 10 && t.length <= 15) return t;
    }
    const header = document.querySelector('[data-testid="conversation-header"]');
    if (header) {
      const span = header.querySelector('span[title]');
      if (span) {
        const t = (span.getAttribute('title') || '').replace(/\D/g, '');
        if (t.length >= 10) return t;
      }
    }
  } catch(e) {}
  return null;
}

function showState(state) {
  const states = ['ws-loading','ws-no-key','ws-error','ws-new-lead','ws-loaded'];
  states.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = (s === state) ? 'block' : 'none';
  });
}

async function loadLeadData(phone) {
  if (!API_KEY) { showState('ws-no-key'); return; }
  showState('ws-loading');
  try {
    const res = await fetch(BASE_URL + "/functions/crmExtension", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api_key": API_KEY },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (data && data.encontrado) {
      renderLead(data);
    } else {
      renderNewLead(phone);
    }
  } catch(err) {
    showState('ws-error');
  }
}

function renderLead(data) {
  const { contato, observacoes, tarefas, historico, templates, funil } = data;
  currentContactId = contato.id || "";
  document.getElementById("ws-contact-id").value = currentContactId;
  document.getElementById("ws-contact-name").textContent = contato.nome || "Sem nome";
  document.getElementById("ws-contact-phone").textContent = contato.telefone || "";
  document.getElementById("ws-contact-email").textContent = contato.email || "";
  const av = document.getElementById("ws-avatar");
  av.textContent = (contato.nome || "?").charAt(0).toUpperCase();
  const tagsEl = document.getElementById("ws-tags");
  tagsEl.innerHTML = (contato.tags || []).map(t => '<span class="ws-tag">' + t + '</span>').join("");
  const funilSel = document.getElementById("ws-funil-select");
  funilSel.innerHTML = '<option value="">-- Etapa --</option>' + (funil || []).map(e =>
    '<option value="' + e.nome + '"' + (contato.funil_status === e.nome ? ' selected' : '') + '>' + e.nome + '</option>'
  ).join("");
  const obsEl = document.getElementById("ws-obs-list");
  obsEl.innerHTML = !(observacoes || []).length
    ? '<p class="ws-empty">Sem observacoes.</p>'
    : (observacoes || []).map(o => '<div class="ws-obs-item"><p>' + (o.texto || '') + '</p><small>' + (o.autor_nome || '') + ' - ' + fmtDate(o.created_date) + '</small></div>').join("");
  const tskEl = document.getElementById("ws-tarefas-list");
  tskEl.innerHTML = !(tarefas || []).length
    ? '<p class="ws-empty">Sem tarefas.</p>'
    : (tarefas || []).map(t => '<div class="ws-tarefa-item"><p>' + (t.titulo || '') + '</p><small>' + (t.data_vencimento ? fmtDate(t.data_vencimento) : 'Sem prazo') + '</small></div>').join("");
  const tplEl = document.getElementById("ws-templates-list");
  tplEl.innerHTML = !(templates || []).length
    ? '<p class="ws-empty">Sem modelos.</p>'
    : (templates || []).map(tpl => '<div class="ws-template-item"><strong>' + (tpl.name || '') + '</strong><p>' + ((tpl.content || '').substring(0,80)) + '</p><button class="ws-btn ws-btn-copy" data-content="' + encodeURIComponent(tpl.content || '') + '">Copiar</button></div>').join("");
  document.querySelectorAll('.ws-btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const txt = decodeURIComponent(btn.getAttribute('data-content'));
      navigator.clipboard.writeText(txt).catch(() => {});
      btn.textContent = 'Copiado!';
      setTimeout(() => btn.textContent = 'Copiar', 2000);
    });
  });
  const histEl = document.getElementById("ws-historico-list");
  histEl.innerHTML = !(historico || []).length
    ? '<p class="ws-empty">Sem historico.</p>'
    : (historico || []).map(h => '<div class="ws-hist-item"><p>' + (h.mensagem || '') + '</p><small>' + (h.autor_nome || '') + ' - ' + fmtDate(h.created_date) + '</small></div>').join("");
  showState('ws-loaded');
}

function renderNewLead(phone) {
  const lbl = document.getElementById("ws-new-phone-label");
  if (lbl) lbl.textContent = "Telefone: " + phone;
  const inp = document.getElementById("ws-new-name");
  if (inp) inp.value = "";
  showState('ws-new-lead');
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch(e) { return d; }
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
    if (!texto || !currentContactId) return;
    await fetch(BASE_URL + "/entities/Observacao", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api_key": API_KEY },
      body: JSON.stringify({ contato_id: currentContactId, texto })
    });
    document.getElementById("ws-obs-input").value = "";
    loadLeadData(currentPhone);
  });
  document.getElementById("ws-btn-save-tarefa").addEventListener("click", async () => {
    const titulo = document.getElementById("ws-tarefa-titulo").value.trim();
    const data = document.getElementById("ws-tarefa-data").value;
    if (!titulo || !currentContactId) return;
    await fetch(BASE_URL + "/entities/Tarefa", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api_key": API_KEY },
      body: JSON.stringify({ contato_id: currentContactId, titulo, data_vencimento: data, status: "pendente" })
    });
    document.getElementById("ws-tarefa-titulo").value = "";
    document.getElementById("ws-tarefa-data").value = "";
    loadLeadData(currentPhone);
  });
  document.getElementById("ws-funil-select").addEventListener("change", async (e) => {
    if (!currentContactId) return;
    await fetch(BASE_URL + "/entities/Contact/" + currentContactId, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "api_key": API_KEY },
      body: JSON.stringify({ funil_status: e.target.value })
    });
  });
  document.getElementById("ws-btn-create").addEventListener("click", async () => {
    const nome = document.getElementById("ws-new-name").value.trim();
    if (!nome) return;
    await fetch(BASE_URL + "/entities/Contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api_key": API_KEY },
      body: JSON.stringify({ nome, telefone: currentPhone })
    });
    loadLeadData(currentPhone);
  });
}

// Start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  setTimeout(init, 1500);
}
