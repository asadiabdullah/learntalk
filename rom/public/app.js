// --- Authentication & Session Check ---
const sessionToken = localStorage.getItem('rom_session_token');
const adminUser = localStorage.getItem('rom_admin_user');

if (!sessionToken && !window.location.href.includes('login.html')) {
  window.location.href = 'login.html';
}

if (adminUser) {
  const badge = document.getElementById('adminUserBadge');
  if (badge) badge.textContent = `Admin: ${adminUser}`;
}

// --- Global State for Forms & SPA ---
let apiKeysList = [];
let modelsList = [];
let scopesList = [];
let currentScopeModels = []; // Temporarily stores mappings for the active Scope Form

// --- Tab Switching Logic ---
function switchTab(tabName) {
  // Update sidebar links
  const links = document.querySelectorAll('.sidebar-link');
  links.forEach(link => link.classList.remove('active'));
  
  // Find clicked link based on function signature
  const targetLink = Array.from(links).find(link => link.getAttribute('onclick').includes(tabName));
  if (targetLink) targetLink.classList.add('active');

  // Hide all content views
  const views = document.querySelectorAll('.content-view');
  views.forEach(view => view.classList.add('hidden'));

  // Show active view
  const activeView = document.getElementById(`view-${tabName}`);
  if (activeView) activeView.classList.remove('hidden');

  // Load view-specific data
  if (tabName === 'overview') {
    loadOverviewData();
  } else if (tabName === 'providers') {
    loadProvidersData();
  } else if (tabName === 'models') {
    loadModelsData();
  } else if (tabName === 'scopes') {
    loadScopesData();
  } else if (tabName === 'logs') {
    loadLogsData();
  }
}

// --- API Helper Fetchers ---
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    alert(`Error: ${error.message}`);
    throw error;
  }
}

// --- 1. OVERVIEW VIEW DATA ---
async function loadOverviewData() {
  try {
    const [keys, models, scopes] = await Promise.all([
      apiFetch('/api/api-keys'),
      apiFetch('/api/models'),
      apiFetch('/api/scopes')
    ]);
    
    document.getElementById('stat-providers').textContent = keys.length;
    document.getElementById('stat-models').textContent = models.length;
    document.getElementById('stat-scopes').textContent = scopes.length;
  } catch (error) {
    console.error('Failed to load overview statistics:', error);
  }
}

// --- 2. PROVIDERS / API KEYS VIEW DATA ---
async function loadProvidersData() {
  const tbody = document.querySelector('#providerTable tbody');
  if (tbody.children.length === 0 || tbody.textContent.includes('Belum ada provider') || tbody.textContent.includes('Memuat')) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>';
  }

  try {
    apiKeysList = await apiFetch('/api/api-keys');
    tbody.innerHTML = '';

    if (apiKeysList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Belum ada provider API Key. Klik "+ Tambah Provider" untuk menambahkan.</td></tr>';
      return;
    }

    apiKeysList.forEach(key => {
      const dateStr = new Date(key.created_at).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const limitsStr = key.sharing_limits.length > 0 
        ? key.sharing_limits.map(l => l.toUpperCase()).join(', ') 
        : 'Tidak Ada';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600;">${escapeHtml(key.name)}</td>
        <td><span class="badge badge-blue">${escapeHtml(key.provider)}</span></td>
        <td><span style="font-family:monospace; font-size:0.85rem;">${escapeHtml(limitsStr)}</span></td>
        <td>${dateStr}</td>
        <td class="actions-cell">
          <button class="btn-action btn-green" onclick="openEditProviderModal('${key.id}')">📝 Edit</button>
          <button class="btn-action btn-secondary" style="background:#fecaca; color:#b91c1c;" onclick="deleteProvider('${key.id}', '${escapeHtml(key.name)}')">🗑️ Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--error-color);">Gagal memuat data provider.</td></tr>';
  }
}

// --- 3. MODELS VIEW DATA ---
// --- 3. MODELS VIEW DATA ---
async function loadModelsData() {
  const tbody = document.querySelector('#modelTable tbody');
  // Hanya tampilkan loading jika tabel kosong
  if (tbody.children.length === 0 || tbody.textContent.includes('Belum ada model') || tbody.textContent.includes('Memuat')) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Memuat data...</td></tr>';
  }

  try {
    modelsList = await apiFetch('/api/models');
    tbody.innerHTML = '';

    if (modelsList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-muted);">Belum ada model LLM. Klik "+ Tambah Model" untuk menambahkan.</td></tr>';
      return;
    }

    modelsList.forEach(model => {
      // Formatting Rate Usage vs Limits dynamically
      const rateParts = [];
      if (model.rpm > 0 || model.rpm_used > 0) rateParts.push(`RPM: ${model.rpm_used}/${model.rpm || '∞'}`);
      if (model.rph > 0 || model.rph_used > 0) rateParts.push(`RPH: ${model.rph_used}/${model.rph || '∞'}`);
      if (model.rpd > 0 || model.rpd_used > 0) rateParts.push(`RPD: ${model.rpd_used}/${model.rpd || '∞'}`);
      if (model.rpmo > 0 || model.rpmo_used > 0) rateParts.push(`RPMO: ${model.rpmo_used}/${model.rpmo || '∞'}`);
      const rateUsageStr = rateParts.length > 0 ? rateParts.join('<br>') : '<span style="color:var(--text-muted);">Unlimited</span>';

      // Formatting Token Usage vs Limits dynamically
      const tokenParts = [];
      if (model.tkm > 0 || model.tkm_used > 0) tokenParts.push(`TKM: ${model.tkm_used}/${model.tkm || '∞'}`);
      if (model.tkh > 0 || model.tkh_used > 0) tokenParts.push(`TKH: ${model.tkh_used}/${model.tkh || '∞'}`);
      if (model.tkd > 0 || model.tkd_used > 0) tokenParts.push(`TKD: ${model.tkd_used}/${model.tkd || '∞'}`);
      if (model.tkmo > 0 || model.tkmo_used > 0) tokenParts.push(`TKMO: ${model.tkmo_used}/${model.tkmo || '∞'}`);
      const tokenUsageStr = tokenParts.length > 0 ? tokenParts.join('<br>') : '<span style="color:var(--text-muted);">Unlimited</span>';
      
      // Quarantine check
      let qStatus = 'Tidak';
      if (model.quarantine_until) {
        const qTime = new Date(model.quarantine_until);
        if (qTime > new Date()) {
          const diffMs = qTime - new Date();
          const diffMin = Math.ceil(diffMs / 60000);
          qStatus = `Karantina (${diffMin} m)`;
        }
      }

      // Status Badge
      let statusBadge = `<span class="badge badge-active">Active</span>`;
      if (model.status === 'quarantined' || qStatus.startsWith('Karantina')) {
        statusBadge = `<span class="badge badge-quarantined">Quarantined</span>`;
      } else if (model.status === 'inactive') {
        statusBadge = `<span class="badge badge-inactive">Inactive</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600; font-family:monospace;">
          ${escapeHtml(model.model_identifier)}
          <div style="font-size:0.7rem; color:var(--text-muted); font-weight:normal; margin-top:3px;">
            Type: <span class="badge badge-blue" style="font-size:0.65rem; padding:1px 5px; text-transform:uppercase;">${escapeHtml(model.model_type || 'text_out')}</span>
          </div>
        </td>
        <td>${escapeHtml(model.api_key_name)}</td>
        <td style="font-family:monospace; font-size:0.775rem; line-height:1.3;">${rateUsageStr}</td>
        <td style="font-family:monospace; font-size:0.775rem; line-height:1.3;">${tokenUsageStr}</td>
        <td>${qStatus}</td>
        <td><span style="font-family:monospace;">${model.error_count}</span></td>
        <td>${statusBadge}</td>
        <td class="actions-cell">
          <button class="btn-action btn-primary" onclick="openTestModal('${model.id}', '${model.model_identifier}')">⚡ Uji</button>
          <button class="btn-action btn-green" onclick="openEditModelModal('${model.id}')">📝 Edit</button>
          <button class="btn-action btn-secondary" style="background:#fecaca; color:#b91c1c;" onclick="deleteModel('${model.id}', '${escapeHtml(model.model_identifier)}')">🗑️ Hapus</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--error-color);">Gagal memuat data model.</td></tr>';
  }
}

// --- 4. SCOPES VIEW DATA ---
async function loadScopesData() {
  const tbody = document.querySelector('#scopeTable tbody');
  if (tbody.children.length === 0 || tbody.textContent.includes('Belum ada scope') || tbody.textContent.includes('Memuat')) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Memuat data...</td></tr>';
  }

  try {
    scopesList = await apiFetch('/api/scopes');
    tbody.innerHTML = '';

    if (scopesList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">Belum ada scope pemetaan. Klik "+ Tambah Scope" untuk menambahkan.</td></tr>';
      return;
    }

    scopesList.forEach(scope => {
      const fallbackStr = scope.fallback_scope_name 
        ? `<span class="badge badge-blue">${escapeHtml(scope.fallback_scope_name)}</span>` 
        : '<span style="color:var(--text-muted);">Tidak Ada</span>';
        
      const promptSnippet = scope.system_prompt 
        ? `<span style="font-size:0.85rem; color:var(--text-muted);" title="${escapeHtml(scope.system_prompt)}">${escapeHtml(scope.system_prompt.slice(0, 30))}...</span>`
        : '<span style="color:var(--text-muted); font-size:0.85rem;">Default</span>';

      // Build model mapping badges list sorted by priority
      let modelsBadgeList = '';
      if (scope.mapped_models && scope.mapped_models.length > 0) {
        scope.mapped_models.forEach(sm => {
          modelsBadgeList += `
            <div style="margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              <span style="font-size:0.75rem; font-weight:bold; background:#e2e8f0; border-radius:50%; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center;">${sm.priority}</span>
              <span style="font-family:monospace; font-size:0.85rem;">${escapeHtml(sm.model_identifier)}</span>
            </div>
          `;
        });
      } else {
        modelsBadgeList = '<span style="color:var(--text-muted); font-size:0.85rem;">Belum dipetakan</span>';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:600; font-family:monospace;">${escapeHtml(scope.scope_name)}</td>
        <td>${scope.estimated_output_tokens}</td>
        <td>${promptSnippet}</td>
        <td>${fallbackStr}</td>
        <td>${modelsBadgeList}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--error-color);">Gagal memuat data scope.</td></tr>';
  }
}

// --- Form & Modal Handlers ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');

  // Trigger modal-specific data fetches
  if (modalId === 'modelModal') {
    populateApiKeyDropdown();
  } else if (modalId === 'scopeModal') {
    populateScopeModalData();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
  
  // Clear forms
  if (modalId === 'providerModal') document.getElementById('providerForm').reset();
  if (modalId === 'modelModal') document.getElementById('modelForm').reset();
  if (modalId === 'scopeModal') {
    document.getElementById('scopeForm').reset();
    currentScopeModels = [];
    renderScopeModelList();
  }
}

// 1. Populate API Key Dropdown for Model form
async function populateApiKeyDropdown() {
  const dropdown = document.getElementById('m-apiKey');
  dropdown.innerHTML = '<option value="">Memuat Kunci API...</option>';
  try {
    const keys = await apiFetch('/api/api-keys');
    dropdown.innerHTML = '<option value="">-- Pilih API Key --</option>';
    keys.forEach(key => {
      dropdown.innerHTML += `<option value="${key.id}">${escapeHtml(key.name)} (${escapeHtml(key.provider)})</option>`;
    });
  } catch {
    dropdown.innerHTML = '<option value="">Gagal memuat Kunci API</option>';
  }
}

// 2. Populate Scope Forms Dropdowns & Models
async function populateScopeModalData() {
  const fallbackDropdown = document.getElementById('s-fallback');
  const modelDropdown = document.getElementById('s-modelSelector');

  fallbackDropdown.innerHTML = '<option value="">Memuat scope...</option>';
  modelDropdown.innerHTML = '<option value="">Memuat model...</option>';

  try {
    const [scopes, models] = await Promise.all([
      apiFetch('/api/scopes'),
      apiFetch('/api/models')
    ]);

    // Populate Fallback Scopes
    fallbackDropdown.innerHTML = '<option value="">-- Tanpa Fallback Scope --</option>';
    scopes.forEach(sc => {
      fallbackDropdown.innerHTML += `<option value="${sc.id}">${escapeHtml(sc.scope_name)}</option>`;
    });

    // Populate Models Selector
    modelDropdown.innerHTML = '<option value="">-- Pilih Model --</option>';
    models.forEach(mo => {
      modelDropdown.innerHTML += `<option value="${mo.id}">${escapeHtml(mo.model_identifier)} (${escapeHtml(mo.api_key_name)})</option>`;
    });
  } catch {
    fallbackDropdown.innerHTML = '<option value="">Gagal memuat scope</option>';
    modelDropdown.innerHTML = '<option value="">Gagal memuat model</option>';
  }
}

// --- Priority List Builder for Scope Form ---
function addModelToScopeList() {
  const selector = document.getElementById('s-modelSelector');
  const modelId = selector.value;
  const modelName = selector.options[selector.selectedIndex].text;

  if (!modelId) {
    alert('Pilih model terlebih dahulu!');
    return;
  }

  // Prevent duplicate additions
  if (currentScopeModels.some(m => m.model_id === modelId)) {
    alert('Model ini sudah dipetakan ke dalam scope!');
    return;
  }

  // Add to active temporary list
  currentScopeModels.push({
    model_id: modelId,
    model_identifier: modelName,
    priority: currentScopeModels.length + 1
  });

  renderScopeModelList();
}

function removeModelFromScopeList(modelId) {
  currentScopeModels = currentScopeModels.filter(m => m.model_id !== modelId);
  // Re-order remaining priorities
  currentScopeModels.forEach((m, idx) => {
    m.priority = idx + 1;
  });
  renderScopeModelList();
}

function moveModelOrder(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= currentScopeModels.length) return;

  // Swap elements
  const temp = currentScopeModels[index];
  currentScopeModels[index] = currentScopeModels[targetIndex];
  currentScopeModels[targetIndex] = temp;

  // Re-assign priorities based on index
  currentScopeModels.forEach((m, idx) => {
    m.priority = idx + 1;
  });

  renderScopeModelList();
}

function renderScopeModelList() {
  const container = document.getElementById('scopeModelListContainer');
  container.innerHTML = '';

  if (currentScopeModels.length === 0) {
    container.innerHTML = `
      <p class="no-models-msg" style="text-align: center; color: var(--text-muted); padding: 10px; font-size: 0.875rem;">
        Belum ada model yang dipetakan ke scope ini.
      </p>
    `;
    return;
  }

  currentScopeModels.forEach((m, idx) => {
    const row = document.createElement('div');
    row.className = 'priority-row';
    row.innerHTML = `
      <div class="priority-badge">${m.priority}</div>
      <div style="flex-grow:1; font-family:monospace; font-size:0.9rem;">${escapeHtml(m.model_identifier)}</div>
      <div style="display:flex; gap:6px;">
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="moveModelOrder(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="moveModelOrder(${idx}, 1)" ${idx === currentScopeModels.length - 1 ? 'disabled' : ''}>▼</button>
        <button type="button" class="btn-remove" onclick="removeModelFromScopeList('${m.model_id}')">&times;</button>
      </div>
    `;
    container.appendChild(row);
  });
}

// --- Form Submission Events ---

// 1. Submit API Key
document.getElementById('providerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('p-name').value;
  const provider = document.getElementById('p-provider').value;
  const secret_key = document.getElementById('p-key').value;
  
  // Collect sharing limits checkboxes
  const sharing_limits = Array.from(document.querySelectorAll('input[name="p-limits"]:checked')).map(cb => cb.value);

  try {
    await apiFetch('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, provider, secret_key, sharing_limits })
    });
    closeModal('providerModal');
    loadProvidersData();
  } catch (err) {
    console.error(err);
  }
});

// 2. Submit Model
document.getElementById('modelForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const api_key_id = document.getElementById('m-apiKey').value;
  const model_identifier = document.getElementById('m-identifier').value;
  const model_type = document.getElementById('m-type').value;
  const rpm = document.getElementById('m-rpm').value || 0;
  const rph = document.getElementById('m-rph').value || 0;
  const rpd = document.getElementById('m-rpd').value || 0;
  const rpmo = document.getElementById('m-rpmo').value || 0;
  const tkm = document.getElementById('m-tkm').value || 0;
  const tkh = document.getElementById('m-tkh').value || 0;
  const tkd = document.getElementById('m-tkd').value || 0;
  const tkmo = document.getElementById('m-tkmo').value || 0;

  try {
    await apiFetch('/api/models', {
      method: 'POST',
      body: JSON.stringify({
        api_key_id, model_identifier, model_type,
        rpm, rph, rpd, rpmo,
        tkm, tkh, tkd, tkmo
      })
    });
    closeModal('modelModal');
    loadModelsData();
  } catch (err) {
    console.error(err);
  }
});

// 3. Submit Scope
document.getElementById('scopeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const scope_name = document.getElementById('s-name').value;
  const estimated_output_tokens = document.getElementById('s-eto').value || 400;
  const system_prompt = document.getElementById('s-prompt').value || null;
  const fallback_scope_id = document.getElementById('s-fallback').value || null;

  try {
    await apiFetch('/api/scopes', {
      method: 'POST',
      body: JSON.stringify({
        scope_name, estimated_output_tokens, fallback_scope_id, system_prompt,
        model_mappings: currentScopeModels
      })
    });
    closeModal('scopeModal');
    loadScopesData();
  } catch (err) {
    console.error(err);
  }
});

// --- Utility Functions ---
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function logout() {
  localStorage.removeItem('rom_session_token');
  localStorage.removeItem('rom_admin_user');
  window.location.href = 'login.html';
}

// --- Page Start-up initialization ---
loadOverviewData();

// --- 5. MODEL CONNECTION TESTING ---
function openTestModal(modelId, modelName) {
  document.getElementById('test-model-id').value = modelId;
  document.getElementById('test-model-name').textContent = modelName;
  
  // Hide previous report & loader
  document.getElementById('testLoading').classList.add('hidden');
  document.getElementById('testReport').classList.add('hidden');
  
  // Select default 'text' format radio
  document.querySelector('input[name="test-format"][value="text"]').checked = true;
  
  openModal('testModelModal');
}

async function runModelTest() {
  const modelId = document.getElementById('test-model-id').value;
  const format = document.querySelector('input[name="test-format"]:checked').value;
  const btn = document.getElementById('btnRunTest');
  const loader = document.getElementById('testLoading');
  const report = document.getElementById('testReport');

  // Set visual state
  btn.disabled = true;
  loader.classList.remove('hidden');
  report.classList.add('hidden');

  try {
    const res = await fetch('/api/models/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model_id: modelId, format })
    });

    const data = await res.json();

    // Populate Report Fields
    const statusText = document.getElementById('testReportStatus');
    statusText.textContent = data.status || res.status;
    
    if (res.ok && data.success) {
      statusText.style.color = 'var(--primary-green)';
    } else {
      statusText.style.color = 'var(--error-color)';
    }

    // Populate retry badge
    const retryBadge = document.getElementById('testReportRetry');
    if (data.retry_attempted) {
      retryBadge.textContent = 'YA (Format Fallback)';
      retryBadge.className = 'badge badge-quarantined';
    } else {
      retryBadge.textContent = 'TIDAK';
      retryBadge.className = 'badge badge-blue';
    }

    // Populate text response / error message
    const responseTextArea = document.getElementById('testReportText');
    if (data.success) {
      responseTextArea.value = data.response_text || '';
      responseTextArea.style.color = 'var(--text-dark)';
    } else {
      responseTextArea.value = `ERROR: ${data.error_message || data.error || 'Terjadi kesalahan'}`;
      responseTextArea.style.color = 'var(--error-color)';
    }

    // Populate headers list
    const headersPre = document.getElementById('testReportHeaders');
    if (data.standardized_headers && Object.keys(data.standardized_headers).some(k => data.standardized_headers[k] !== undefined)) {
      const sh = data.standardized_headers;
      headersPre.textContent = `Standardized Rate Limits (Provider API Headers):
- Requests Remaining: ${sh.requestsRemaining !== undefined ? sh.requestsRemaining + ' / ' + (sh.requestsLimit || '∞') : 'N/A'}
- Requests Reset: ${sh.requestsReset !== undefined ? sh.requestsReset + 's' : 'N/A'}
- Tokens Remaining: ${sh.tokensRemaining !== undefined ? sh.tokensRemaining + ' / ' + (sh.tokensLimit || '∞') : 'N/A'}
- Tokens Reset: ${sh.tokensReset !== undefined ? sh.tokensReset + 's' : 'N/A'}

Raw Headers:
${JSON.stringify(data.headers, null, 2)}`;
    } else {
      headersPre.textContent = data.headers && Object.keys(data.headers).length > 0 
        ? JSON.stringify(data.headers, null, 2)
        : 'Tidak ada header rate-limit dari provider (e.g. Gemini).';
    }

    // Populate local remaining quota
    const quotaPre = document.getElementById('testReportLocalQuota');
    if (data.local_remaining) {
      const lr = data.local_remaining;
      const lines = [];
      if (lr.rpm !== null) lines.push(`RPM Tersisa (Lokal): ${lr.rpm}`);
      if (lr.rph !== null) lines.push(`RPH Tersisa (Lokal): ${lr.rph}`);
      if (lr.rpd !== null) lines.push(`RPD Tersisa (Lokal): ${lr.rpd}`);
      if (lr.rpmo !== null) lines.push(`RPMO Tersisa (Lokal): ${lr.rpmo}`);
      if (lr.tkm !== null) lines.push(`TKM Tersisa (Lokal): ${lr.tkm}`);
      if (lr.tkh !== null) lines.push(`TKH Tersisa (Lokal): ${lr.tkh}`);
      if (lr.tkd !== null) lines.push(`TKD Tersisa (Lokal): ${lr.tkd}`);
      if (lr.tkmo !== null) lines.push(`TKMO Tersisa (Lokal): ${lr.tkmo}`);

      quotaPre.textContent = lines.length > 0 
        ? lines.join('\n') 
        : 'Model ini tidak memiliki batas quota terdaftar (Quota Unlimited / Tanpa Batas).';
    } else {
      quotaPre.textContent = 'Gagal memuat info sisa limit lokal.';
    }

    // Populate raw details
    document.getElementById('testReportRawRequest').textContent = JSON.stringify(data.payload_sent || {}, null, 2);
    document.getElementById('testReportRawResponse').textContent = JSON.stringify(data.raw_response || {}, null, 2);

    // Show report
    report.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    alert('Pengujian model gagal: Gagal menghubungi server proksi.');
  } finally {
    btn.disabled = false;
    loader.classList.add('hidden');
  }
}

// --- 6. LOGS VIEW DATA ---
async function loadLogsData() {
  const tbody = document.querySelector('#logTable tbody');
  if (tbody.children.length === 0 || tbody.textContent.includes('Belum ada log') || tbody.textContent.includes('Memuat')) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Memuat data log...</td></tr>';
  }

  try {
    const logs = await apiFetch('/api/logs');
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">Belum ada log aktivitas model. Pemicu uji model akan tercatat di sini.</td></tr>';
      return;
    }

    logs.forEach(log => {
      const dateStr = new Date(log.created_at).toLocaleDateString('id-ID', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

      let statusBadge = `<span class="badge badge-active">Success</span>`;
      if (log.status === 'failed') {
        statusBadge = `<span class="badge badge-inactive" style="background:#fef2f2; color:#b91c1c;">Failed</span>`;
      }

      const isTesting = log.scope_name === 'testing';
      const scopeBadge = isTesting 
        ? `<span class="badge badge-quarantined" style="font-size:0.7rem;">TESTING</span>` 
        : `<span class="badge badge-blue" style="font-size:0.7rem;">${escapeHtml(log.scope_name)}</span>`;

      // Display response text snippet or error
      let contentSnippet = '-';
      if (log.status === 'success' && log.response_text) {
        contentSnippet = `<span style="color: var(--text-dark);" title="${escapeHtml(log.response_text)}">${escapeHtml(log.response_text.slice(0, 50))}${log.response_text.length > 50 ? '...' : ''}</span>`;
      } else if (log.status === 'failed' && log.error_message) {
        contentSnippet = `<span style="color: var(--error-color); font-weight:500;" title="${escapeHtml(log.error_message)}">ERR: ${escapeHtml(log.error_message.slice(0, 50))}${log.error_message.length > 50 ? '...' : ''}</span>`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size:0.75rem; color: var(--text-muted);">${dateStr}</td>
        <td style="font-weight:600; font-family:monospace;">${escapeHtml(log.model_identifier)}</td>
        <td>${scopeBadge}</td>
        <td>${statusBadge}</td>
        <td style="font-family:monospace;">${log.prompt_tokens}</td>
        <td style="font-family:monospace;">${log.output_tokens}</td>
        <td>${contentSnippet}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--error-color);">Gagal memuat log riwayat.</td></tr>';
  }
}

// --- 6.5. EDIT & DELETE PROVIDER HELPERS ---
async function deleteProvider(keyId, name) {
  if (!confirm(`Apakah Anda yakin ingin menghapus provider "${name}" secara permanen? \nPERINGATAN: Semua model yang terhubung dengan provider ini juga akan terhapus!`)) {
    return;
  }
  try {
    await apiFetch(`/api/api-keys/${keyId}`, { method: 'DELETE' });
    loadProvidersData();
  } catch (err) {
    console.error(err);
  }
}

function openEditProviderModal(keyId) {
  const key = apiKeysList.find(k => k.id === keyId);
  if (!key) return;

  document.getElementById('edit-p-id').value = key.id;
  document.getElementById('edit-p-name').value = key.name;
  document.getElementById('edit-p-provider').value = key.provider;
  document.getElementById('edit-p-key').value = ''; // Biarkan kosong agar tidak sengaja overwrite

  // Reset checkboxes sharing limits
  const checkboxes = document.querySelectorAll('input[name="edit-p-limits"]');
  checkboxes.forEach(cb => {
    cb.checked = key.sharing_limits.includes(cb.value);
  });

  openModal('editProviderModal');
}

// Submit Edit Provider form
document.getElementById('editProviderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-p-id').value;
  const name = document.getElementById('edit-p-name').value;
  const provider = document.getElementById('edit-p-provider').value;
  const secret_key = document.getElementById('edit-p-key').value;
  
  const sharing_limits = Array.from(document.querySelectorAll('input[name="edit-p-limits"]:checked')).map(cb => cb.value);

  try {
    await apiFetch(`/api/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, provider, secret_key, sharing_limits })
    });
    closeModal('editProviderModal');
    loadProvidersData();
  } catch (err) {
    console.error(err);
  }
});

// --- 7. EDIT & DELETE MODEL HELPERS ---
async function deleteModel(modelId, modelName) {
  if (!confirm(`Apakah Anda yakin ingin menghapus model "${modelName}" secara permanen?`)) {
    return;
  }
  try {
    await apiFetch(`/api/models/${modelId}`, { method: 'DELETE' });
    loadModelsData();
  } catch (err) {
    console.error(err);
  }
}

function openEditModelModal(modelId) {
  const model = modelsList.find(m => m.id === modelId);
  if (!model) return;

  document.getElementById('edit-m-id').value = model.id;
  document.getElementById('edit-m-identifier').value = model.model_identifier;
  document.getElementById('edit-m-type').value = model.model_type || 'text_out';
  document.getElementById('edit-m-status').value = model.status;
  document.getElementById('edit-m-errorCount').value = model.error_count || 0;
  
  // Format datetime-local
  const quarantineInput = document.getElementById('edit-m-quarantine');
  if (model.quarantine_until) {
    const date = new Date(model.quarantine_until);
    const offset = date.getTimezoneOffset() * 60000;
    quarantineInput.value = new Date(date.getTime() - offset).toISOString().slice(0, 16);
  } else {
    quarantineInput.value = '';
  }

  // Populate limits
  document.getElementById('edit-m-rpm').value = model.rpm || 0;
  document.getElementById('edit-m-rph').value = model.rph || 0;
  document.getElementById('edit-m-rpd').value = model.rpd || 0;
  document.getElementById('edit-m-rpmo').value = model.rpmo || 0;
  document.getElementById('edit-m-tkm').value = model.tkm || 0;
  document.getElementById('edit-m-tkh').value = model.tkh || 0;
  document.getElementById('edit-m-tkd').value = model.tkd || 0;
  document.getElementById('edit-m-tkmo').value = model.tkmo || 0;

  openModal('editModelModal');
}

// Submit Edit Model form
document.getElementById('editModelForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-m-id').value;
  const model_identifier = document.getElementById('edit-m-identifier').value;
  const model_type = document.getElementById('edit-m-type').value;
  const status = document.getElementById('edit-m-status').value;
  const error_count = document.getElementById('edit-m-errorCount').value;
  const quarantine_until = document.getElementById('edit-m-quarantine').value || null;

  const rpm = document.getElementById('edit-m-rpm').value || 0;
  const rph = document.getElementById('edit-m-rph').value || 0;
  const rpd = document.getElementById('edit-m-rpd').value || 0;
  const rpmo = document.getElementById('edit-m-rpmo').value || 0;
  const tkm = document.getElementById('edit-m-tkm').value || 0;
  const tkh = document.getElementById('edit-m-tkh').value || 0;
  const tkd = document.getElementById('edit-m-tkd').value || 0;
  const tkmo = document.getElementById('edit-m-tkmo').value || 0;

  try {
    await apiFetch(`/api/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        model_identifier, model_type, status, error_count, quarantine_until,
        rpm, rph, rpd, rpmo,
        tkm, tkh, tkd, tkmo
      })
    });
    closeModal('editModelModal');
    loadModelsData();
  } catch (err) {
    console.error(err);
  }
});

// --- 8. AUTO-REFRESH INTERVAL (POLLING BACKGROUND) ---
// Melakukan reload data secara asinkronus setiap 5 detik sesuai tab menu yang aktif.
// Ini memicu lazy reset di database secara berkala dan membuat UI selalu segar secara bebas kedipan (flicker-free).
setInterval(() => {
  const activeLink = document.querySelector('.sidebar-link.active');
  if (!activeLink) return;
  const clickAttr = activeLink.getAttribute('onclick') || '';
  if (clickAttr.includes('overview')) {
    loadOverviewData();
  } else if (clickAttr.includes('providers')) {
    loadProvidersData();
  } else if (clickAttr.includes('models')) {
    loadModelsData();
  } else if (clickAttr.includes('scopes')) {
    loadScopesData();
  } else if (clickAttr.includes('logs')) {
    loadLogsData();
  }
}, 5000);
