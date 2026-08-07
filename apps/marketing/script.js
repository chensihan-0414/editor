// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------
// "Continue building" jumps straight into the finished Pascal editor scene
// for the currently selected style (a shared, already-furnished showcase
// house — see STYLES[].showcaseUrl below) rather than through the
// per-request auto-build flow — visitors can freely edit it without
// touching the original. Styles without a showcaseUrl yet hide the button.
function getShowcaseUrl(marketCode) {
  const market = MARKETS.find((m) => m.code === marketCode);
  const style = market && STYLES.find((s) => s.id === market.styleId);
  return style && style.showcaseUrl ? style.showcaseUrl : null;
}

// ---------------------------------------------------------------------
// Module catalog — mirrors apps/editor/lib/prefab/catalog.ts
// ---------------------------------------------------------------------
const MODULE_CATALOG = [
  { id: 'bedroom-std', control: 'stepper', max: 6, i18nKey: 'bedroomStd', sub: '6m x 3m' },
  { id: 'bedroom-master', control: 'stepper', max: 2, i18nKey: 'bedroomMaster', sub: '6m x 3.6m' },
  { id: 'bathroom-std', control: 'stepper', max: 6, i18nKey: 'bathroomStd', sub: '2.5m x 2m' },
  { id: 'kitchen-open', control: 'toggle', i18nKey: 'kitchenOpen', sub: '4m x 3m' },
  { id: 'living-room', control: 'toggle', i18nKey: 'livingRoom', sub: '6m x 4m' },
  { id: 'porch-covered', control: 'toggle', i18nKey: 'porchCovered', sub: '3m x 1.5m' },
  { id: 'storage-loft', control: 'toggle', i18nKey: 'storageLoft', sub: 'Pitched roof only' },
];
const MAX_MODULES = 6;

// ---------------------------------------------------------------------
// Markets — extend this list freely, the grid is fully data-driven
// ---------------------------------------------------------------------
const MARKETS = [
  { code: 'us', flag: '🇺🇸', zh: '美国', en: 'United States', styleId: 'modern-open' },
  { code: 'ca', flag: '🇨🇦', zh: '加拿大', en: 'Canada', styleId: 'modern-open' },
  { code: 'sg', flag: '🇸🇬', zh: '新加坡', en: 'Singapore', styleId: 'tropical' },
  { code: 'my', flag: '🇲🇾', zh: '马来西亚', en: 'Malaysia', styleId: 'tropical' },
  { code: 'th', flag: '🇹🇭', zh: '泰国', en: 'Thailand', styleId: 'tropical' },
  { code: 'br', flag: '🇧🇷', zh: '巴西', en: 'Brazil', styleId: 'tropical' },
  { code: 'mx', flag: '🇲🇽', zh: '墨西哥', en: 'Mexico', styleId: 'tropical' },
  { code: 'au', flag: '🇦🇺', zh: '澳大利亚', en: 'Australia', styleId: 'tropical' },
  { code: 'jp', flag: '🇯🇵', zh: '日本', en: 'Japan', styleId: 'japanese' },
];

const STYLES = [
  {
    id: 'modern-open',
    zh: '现代开放简约', en: 'Modern Open Minimalist',
    desc: { zh: '开放式厨房+客厅是核心，暖白墙面配浅木色', en: 'Open kitchen-to-living core, warm white walls with light wood tones' },
    photo: 'images/style-modern-open.jpg',
    showcaseUrl: 'https://editor-five-mocha.vercel.app/scene/b9bc64ce220f',
    starter: { modules: [{ id: 'bedroom-master', qty: 1 }, { id: 'bathroom-std', qty: 1 }, { id: 'kitchen-open', qty: 1 }, { id: 'living-room', qty: 1 }],
      note: { zh: '开放式厨房+客厅是当地主流，主卧套间是近两年的热门升级', en: 'Open kitchen-to-living is the norm; a primary suite is a top 2026 upgrade' } },
  },
  {
    id: 'tropical',
    zh: '热带度假风', en: 'Tropical Resort',
    desc: { zh: '室内外连通，门廊是第二客厅，藤编+浅木质感', en: 'Indoor-outdoor connection, porch as a second living space, rattan and light wood' },
    photo: 'images/style-tropical.jpg',
    showcaseUrl: 'https://editor-five-mocha.vercel.app/scene/c765022b5668',
    starter: { modules: [{ id: 'bedroom-std', qty: 1 }, { id: 'bathroom-std', qty: 1 }, { id: 'kitchen-open', qty: 1 }, { id: 'porch-covered', qty: 1 }],
      note: { zh: '热带气候，紧凑户型+带顶门廊是常见配置', en: 'Tropical climate — compact layout plus a covered porch is typical' } },
  },
  {
    id: 'japanese',
    zh: '日式精工极简', en: 'Japanese Precision Minimalist',
    desc: { zh: '高定制、低饱和度木色，收纳优先于外露家具', en: 'Highly customized, muted wood tones, built-in storage over exposed furniture' },
    photo: 'images/style-japanese.png',
    showcaseUrl: 'https://editor-five-mocha.vercel.app/scene/b76791ad58da',
    starter: { modules: [{ id: 'bedroom-std', qty: 1 }, { id: 'bathroom-std', qty: 1 }, { id: 'kitchen-open', qty: 1 }, { id: 'storage-loft', qty: 1 }],
      note: { zh: '当地预制房走精致、高定制路线，紧凑+高效收纳是特色', en: 'Japanese prefab leans premium and highly customized — compact and storage-efficient' } },
  },
];

let expandedStyles = new Set([STYLES[0].id]);

// ---------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------
const I18N = {
  zh: {
    brandName: '定制预制房',
    eyebrow: 'AI-POWERED PREFAB WORKSPACE',
    heroTitle: '定制预制房 · 启航全球',
    heroSubtitle: '选择目标市场，搭建你的房型，几分钟看到立体效果。',
    positioningLabel: '所在地 · 客户定位',
    positioningHint: 'PRIORITY MARKETS',
    navCustom: '定制设计',
    navMarket: '所在地',
    navQuickStart: '快速开始',
    navRecent: '最近项目',
    customRequestLabel: '🎨 上面没找到你想要的？',
    customRequestHint: 'AI 辅助定制设计',
    customRequestPlaceholder: '例如：想要一个连着餐厅的开放式厨房，再加一个小书房',
    customRequestBtn: '提交定制需求',
    customRequestSubHint: '我们会把定制方案发到你邮箱，通常在 48 小时内',
    customRequestNeedsText: '请先写一下你的需求',
    modalTitle: '还差一步',
    modalHint: '定制方案发到哪个邮箱？',
    modalEmailPlaceholder: 'you@email.com',
    modalAgree: '我同意被联系以跟进这次需求',
    modalSubmit: '提交需求',
    modalEmailError: '请填写一个有效的邮箱地址',
    modalAgreeError: '请先勾选同意',
    modalSuccessTitle: '提交成功',
    modalSuccessBody: '提交成功，我们会在 48 小时内发给你定制方案',
    modalDone: '好的',
    designSavedTitle: '设计已保存',
    designSavedBody: '你的设计图已经下载完成。要联系工厂了解生产吗？',
    contactFactoryBtn: '联系工厂',
    quickStartLabel: '⚡ 快速开始',
    quickStartHint: '勾选你需要的房间，最多 6 个模块，几秒钟出效果',
    recommendTitle: '本地区推荐配置',
    recommendApply: '一键套用',
    recommendViewBtn: '查看详情',
    modulesLabel: '个模块',
    generateBtn: '生成方案',
    resultLabel: '生成结果',
    copyBtn: '复制 JSON',
    continueBtn: '继续搭建 →',
    recentLabel: '最近项目',
    recentHint: '本浏览器保存',
    footerNote: '生成结果仅供方案预览，具体尺寸以工厂确认为准。',
    recommended: '推荐',
    noProjects: '还没有项目 — 上面生成一个试试',
    selectMarketFirst: '请先选择所在地',
    overLimit: '超过 6 个模块，需要人工评估',
    deleteProject: '删除项目',
    confirmDelete: '确定要删除这个项目吗？',
    bedroomStd: '标准卧室',
    bedroomMaster: '主卧',
    bathroomStd: '卫浴',
    kitchenOpen: '开放式厨房',
    livingRoom: '客厅',
    porchCovered: '门廊',
    storageLoft: '阁楼储物',
  },
  en: {
    brandName: 'Custom Prefab House',
    eyebrow: 'AI-POWERED PREFAB WORKSPACE',
    heroTitle: 'Custom Prefab · Go Global',
    heroSubtitle: 'Pick a target market, build your layout, see a 3D result in minutes.',
    positioningLabel: 'Location · positioning',
    positioningHint: 'PRIORITY MARKETS',
    navCustom: 'Custom Design',
    navMarket: 'Location',
    navQuickStart: 'Quick Start',
    navRecent: 'Recent Projects',
    customRequestLabel: "🎨 Didn't find what you need above?",
    customRequestHint: 'CUSTOM AI-ASSISTED DESIGN',
    customRequestPlaceholder: 'e.g. an open kitchen connected to the dining room, plus a small home office',
    customRequestBtn: 'Request custom design',
    customRequestSubHint: "We'll email you a bespoke design — usually within 48 hours",
    customRequestNeedsText: 'Tell us a bit about what you need first',
    modalTitle: 'One more thing',
    modalHint: 'Where should we send your custom design?',
    modalEmailPlaceholder: 'you@email.com',
    modalAgree: 'I agree to be contacted about this request',
    modalSubmit: 'Submit request',
    modalEmailError: 'Please enter a valid email address',
    modalAgreeError: 'Please check the agreement box first',
    modalSuccessTitle: 'Submitted',
    modalSuccessBody: "Submitted — we'll email you a custom design within 48 hours.",
    modalDone: 'Done',
    designSavedTitle: 'Design saved',
    designSavedBody: 'Your design image has been downloaded. Ready to talk to a factory?',
    contactFactoryBtn: 'Contact factory',
    quickStartLabel: '⚡ Quick start',
    quickStartHint: 'Check the rooms you need — up to 6 modules, results in seconds',
    recommendTitle: 'Recommended for this market',
    recommendApply: 'Use this',
    recommendViewBtn: 'View details',
    modulesLabel: 'modules',
    generateBtn: 'Generate',
    resultLabel: 'Result',
    copyBtn: 'Copy JSON',
    continueBtn: 'Continue building →',
    recentLabel: 'Recent projects',
    recentHint: 'saved in this browser',
    footerNote: 'Generated results are a preview only — final dimensions pending factory confirmation.',
    recommended: 'Recommended',
    noProjects: 'No projects yet — generate one above',
    selectMarketFirst: 'Pick a location first',
    overLimit: 'Over the 6-module limit — needs engineer review',
    deleteProject: 'Delete project',
    confirmDelete: 'Delete this project?',
    bedroomStd: 'Standard bedroom',
    bedroomMaster: 'Master bedroom',
    bathroomStd: 'Bathroom',
    kitchenOpen: 'Open kitchen',
    livingRoom: 'Living room',
    porchCovered: 'Covered porch',
    storageLoft: 'Loft storage',
  },
};

let currentLang = 'zh';
let selectedMarket = null;
const moduleState = {}; // moduleId -> quantity (0 or 1 for toggles)
MODULE_CATALOG.forEach((m) => { moduleState[m.id] = 0; });

function t(key) {
  return I18N[currentLang][key] || key;
}

function applyLanguage(lang) {
  currentLang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
  });
  renderMarkets();
  renderModuleForm();
  renderProjects();
  updateSelectedMarketLabel();
  updateRecommendCard();
}

// ---------------------------------------------------------------------
// Markets grid
// ---------------------------------------------------------------------
function renderMarkets() {
  const grid = document.getElementById('marketGrid');
  grid.innerHTML = '';
  STYLES.forEach((style) => {
    const marketsInStyle = MARKETS.filter((m) => m.styleId === style.id);
    const isOpen = expandedStyles.has(style.id);

    const group = document.createElement('div');
    group.className = 'style-group' + (isOpen ? ' open' : '');

    const header = document.createElement('div');
    header.className = 'style-header';
    header.innerHTML = `
      <button type="button" class="style-toggle">
        <span class="style-chevron">▸</span>
        <span class="style-text">
          <span class="style-title">${currentLang === 'zh' ? style.zh : style.en}</span>
          <span class="style-desc">${style.desc[currentLang]}</span>
        </span>
      </button>
      <button type="button" class="style-recommend-btn">${t('recommendApply')}</button>
    `;
    header.querySelector('.style-toggle').addEventListener('click', () => {
      if (expandedStyles.has(style.id)) expandedStyles.delete(style.id);
      else expandedStyles.add(style.id);
      renderMarkets();
    });
    header.querySelector('.style-recommend-btn').addEventListener('click', () => {
      selectedMarket = marketsInStyle[0].code;
      expandedStyles.add(style.id);
      renderMarkets();
      updateSelectedMarketLabel();
      // updateRecommendCard() resets the photo slot before applyRecommendation()
      // fills it back in — order matters here. Reversing these two calls silently
      // drops the recommended-style photo (it briefly gets set, then wiped).
      updateRecommendCard();
      applyRecommendation();
      document.getElementById('quickStart').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    group.appendChild(header);

    const body = document.createElement('div');
    body.className = 'style-body';
    marketsInStyle.forEach((market) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'market-card' + (selectedMarket === market.code ? ' selected' : '');
      card.innerHTML = `
        <span class="market-flag">${market.flag}</span>
        <span class="market-name-zh">${currentLang === 'zh' ? market.zh : market.en}</span>
      `;
      card.addEventListener('click', () => {
        selectedMarket = market.code;
        renderMarkets();
        updateSelectedMarketLabel();
        updateRecommendCard();
        document.getElementById('quickStart').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      body.appendChild(card);
    });
    group.appendChild(body);

    grid.appendChild(group);
  });
}

function updateSelectedMarketLabel() {
  const label = document.getElementById('selectedMarketLabel');
  if (!selectedMarket) { label.textContent = ''; return; }
  const market = MARKETS.find((m) => m.code === selectedMarket);
  label.textContent = (currentLang === 'zh' ? market.zh : market.en);
}

function updateRecommendCard() {
  const card = document.getElementById('recommendCard');
  const market = MARKETS.find((m) => m.code === selectedMarket);
  const style = market && STYLES.find((s) => s.id === market.styleId);
  if (!style) { card.hidden = true; return; }
  document.getElementById('recommendNote').textContent = style.starter.note[currentLang];
  card.hidden = false;
  // Photo + view button only appear once "Use this" is actually clicked,
  // not just on market selection.
  document.getElementById('recommendPhotoWrap').hidden = true;
  document.getElementById('recommendPhoto').removeAttribute('src');
}

// Called after "Use this" is clicked (both the accordion header's quick
// button and the recommend-card's own button) — applies the module preset
// and reveals that style's interior photo below the card.
function applyRecommendation() {
  const market = MARKETS.find((m) => m.code === selectedMarket);
  const style = market && STYLES.find((s) => s.id === market.styleId);
  if (!style) return;
  MODULE_CATALOG.forEach((m) => { moduleState[m.id] = 0; });
  style.starter.modules.forEach(({ id, qty }) => { moduleState[id] = qty; });
  renderModuleForm();

  if (style.photo) {
    document.getElementById('recommendPhoto').src = style.photo;
    document.getElementById('recommendPhoto').alt = currentLang === 'zh' ? style.zh : style.en;
    document.getElementById('recommendPhotoWrap').hidden = false;
  }
}

// ---------------------------------------------------------------------
// Module form
// ---------------------------------------------------------------------
function totalModuleCount() {
  return Object.values(moduleState).reduce((sum, v) => sum + v, 0);
}

function updateCounter() {
  const total = totalModuleCount();
  const counterEl = document.getElementById('moduleCount');
  counterEl.textContent = total;
  document.querySelector('.module-counter').classList.toggle('over', total > MAX_MODULES);
}

function renderModuleForm() {
  const form = document.getElementById('moduleForm');
  form.innerHTML = '';
  MODULE_CATALOG.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'module-row';
    const labelHtml = `<div><span class="module-row-label">${t(m.i18nKey)}</span><span class="module-row-sub">${m.sub}</span></div>`;

    if (m.control === 'stepper') {
      row.innerHTML = `
        ${labelHtml}
        <div class="stepper">
          <button type="button" data-action="dec" data-id="${m.id}">-</button>
          <span class="stepper-value" id="value-${m.id}">${moduleState[m.id]}</span>
          <button type="button" data-action="inc" data-id="${m.id}">+</button>
        </div>`;
    } else {
      row.innerHTML = `
        ${labelHtml}
        <button type="button" class="toggle${moduleState[m.id] ? ' on' : ''}" id="toggle-${m.id}" data-id="${m.id}"></button>`;
    }
    form.appendChild(row);
  });

  form.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const spec = MODULE_CATALOG.find((m) => m.id === id);
      const delta = btn.getAttribute('data-action') === 'inc' ? 1 : -1;
      moduleState[id] = Math.max(0, Math.min(spec.max, moduleState[id] + delta));
      document.getElementById(`value-${id}`).textContent = moduleState[id];
      updateCounter();
    });
  });
  form.querySelectorAll('.toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      moduleState[id] = moduleState[id] ? 0 : 1;
      btn.classList.toggle('on', !!moduleState[id]);
      updateCounter();
    });
  });

  updateCounter();
}

// ---------------------------------------------------------------------
// Assembly check — mirrors lib/prefab/assembly.ts's limit + adjacency
// ---------------------------------------------------------------------
function buildModuleRequest() {
  const requests = [];
  MODULE_CATALOG.forEach((m) => {
    if (moduleState[m.id] > 0) requests.push({ moduleId: m.id, quantity: moduleState[m.id] });
  });
  const total = requests.reduce((sum, r) => sum + r.quantity, 0);

  // Auto-add rules, same as the Stage 1 -> Stage 2 conversion guide.
  const hasBath = moduleState['bathroom-std'] > 0;
  const hasKitchen = moduleState['kitchen-open'] > 0;
  if (hasBath && hasKitchen) {
    requests.push({ moduleId: 'hallway-connector', quantity: 1 });
  }
  requests.push({ moduleId: 'utility-mechanical', quantity: 1 });

  const finalTotal = requests.reduce((sum, r) => sum + r.quantity, 0);
  return { requests, valid: finalTotal <= MAX_MODULES, rawTotal: total, finalTotal };
}

// ---------------------------------------------------------------------
// Recent projects (localStorage — this is a static site with no backend)
// ---------------------------------------------------------------------
const STORAGE_KEY = 'prefab_recent_projects';

function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveProject(project) {
  const list = loadProjects();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  list.unshift({ id, ...project });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
}
function deleteProject(id) {
  const list = loadProjects().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  renderProjects();
}
function renderProjects() {
  const grid = document.getElementById('projectGrid');
  const list = loadProjects();
  grid.innerHTML = '';
  if (list.length === 0) {
    grid.innerHTML = `<div class="project-empty">${t('noProjects')}</div>`;
    return;
  }
  list.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'project-card';
    const market = MARKETS.find((m) => m.code === p.market);
    const marketName = market ? (currentLang === 'zh' ? market.zh : market.en) : p.market;
    card.innerHTML = `
      <div class="project-card-top">
        <div class="project-card-title">${market ? market.flag + ' ' : ''}${marketName}</div>
        <button class="project-delete-btn" data-id="${p.id}" type="button" aria-label="${t('deleteProject')}">&times;</button>
      </div>
      <div class="project-card-meta">${p.moduleCount} ${t('modulesLabel')} · ${new Date(p.date).toLocaleDateString()}</div>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.project-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm(t('confirmDelete'))) deleteProject(btn.getAttribute('data-id'));
    });
  });
}

// ---------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------
function handleSubmit() {
  if (!selectedMarket) {
    alert(t('selectMarketFirst'));
    return;
  }
  const { requests, valid, finalTotal } = buildModuleRequest();

  const resultPanel = document.getElementById('resultPanel');
  const resultJson = document.getElementById('resultJson');
  const continueRow = document.getElementById('continueRow');

  resultPanel.hidden = false;
  resultJson.textContent = JSON.stringify(requests, null, 2);

  if (!valid) {
    resultJson.textContent += `\n\n// ${t('overLimit')} (${finalTotal} / ${MAX_MODULES})`;
    continueRow.hidden = true;
    return;
  }

  saveProject({ market: selectedMarket, moduleCount: finalTotal, date: Date.now(), requests });
  renderProjects();

  const showcaseUrl = getShowcaseUrl(selectedMarket);
  if (showcaseUrl) {
    document.getElementById('continueLink').href = showcaseUrl;
    continueRow.hidden = false;
  } else {
    continueRow.hidden = true;
  }

  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------------------------------------------------------------------
// Custom design requests — static site, so this just saves to
// localStorage (same pattern as recent projects) instead of hitting a
// backend. In production, swap saveCustomRequest() for a real API call
// or a form-submission service.
// ---------------------------------------------------------------------
const CUSTOM_REQUEST_KEY = 'prefab_custom_requests';

function saveCustomRequest(entry) {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_REQUEST_KEY) || '[]');
    list.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...entry });
    localStorage.setItem(CUSTOM_REQUEST_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    // localStorage unavailable (private browsing etc.) — request still
    // showed the success screen, it just won't persist. Not worth
    // blocking the user's flow over.
  }
}

function openCustomModal() {
  document.getElementById('customModalForm').hidden = false;
  document.getElementById('customModalSuccess').hidden = true;
  document.getElementById('modalError').hidden = true;
  document.getElementById('customModalEmail').value = '';
  document.getElementById('customModalAgree').checked = false;
  document.getElementById('customModalOverlay').hidden = false;
}

function closeCustomModal() {
  document.getElementById('customModalOverlay').hidden = true;
}

// Shown when a buyer arrives back from the Pascal editor's "Save image"
// button (see STYLES[].showcaseUrl / apps/editor's scene-loader.tsx), which
// redirects here with ?saved=1 after downloading their design PNG.
function maybeShowDesignSaved() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('saved') !== '1') return;
  document.getElementById('designSavedOverlay').hidden = false;
  // Drop the query param so a refresh/share of the URL doesn't re-trigger it.
  window.history.replaceState({}, '', window.location.pathname);
}

function closeDesignSaved() {
  document.getElementById('designSavedOverlay').hidden = true;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function handleCustomRequestSubmit() {
  const text = document.getElementById('customRequestText').value.trim();
  if (!text) {
    alert(t('customRequestNeedsText'));
    return;
  }
  openCustomModal();
}

function handleModalSubmit() {
  const email = document.getElementById('customModalEmail').value.trim();
  const agreed = document.getElementById('customModalAgree').checked;
  const errorEl = document.getElementById('modalError');

  if (!isValidEmail(email)) {
    errorEl.textContent = t('modalEmailError');
    errorEl.hidden = false;
    return;
  }
  if (!agreed) {
    errorEl.textContent = t('modalAgreeError');
    errorEl.hidden = false;
    return;
  }
  errorEl.hidden = true;

  saveCustomRequest({
    email,
    requirement: document.getElementById('customRequestText').value.trim(),
    market: selectedMarket,
    date: Date.now(),
  });

  document.getElementById('customModalForm').hidden = true;
  document.getElementById('customModalSuccess').hidden = false;
}

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------
document.getElementById('submitBtn').addEventListener('click', handleSubmit);
document.getElementById('recommendBtn').addEventListener('click', applyRecommendation);
document.getElementById('customRequestBtn').addEventListener('click', handleCustomRequestSubmit);
document.getElementById('customModalSubmit').addEventListener('click', handleModalSubmit);
document.getElementById('customModalClose').addEventListener('click', closeCustomModal);
document.getElementById('customModalDone').addEventListener('click', closeCustomModal);
document.getElementById('customModalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'customModalOverlay') closeCustomModal();
});
document.getElementById('designSavedClose').addEventListener('click', closeDesignSaved);
document.getElementById('designSavedOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'designSavedOverlay') closeDesignSaved();
});
// Factory hand-off isn't built yet — reuse the existing "leave your email"
// modal as a stand-in so the button does something real in the meantime.
document.getElementById('designSavedContactBtn').addEventListener('click', () => {
  closeDesignSaved();
  openCustomModal();
});
document.getElementById('copyBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('resultJson').textContent);
});
document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => applyLanguage(btn.getAttribute('data-lang')));
});

const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
menuToggle.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});
mobileMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

applyLanguage('en');
maybeShowDesignSaved();
