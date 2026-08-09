'use strict';

/* ---------------- Utilities ---------------- */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatWeight(v) {
  if (v === null || v === undefined || v === '') return '-';
  return `${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} kg`;
}

function formatMoney(v) {
  if (v === null || v === undefined || v === '') return '-';
  return `${Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`;
}

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function daysUntil(iso) {
  return daysBetween(todayIso(), iso);
}

function toNumberOrNull(text) {
  if (text === null || text === undefined) return null;
  const t = String(text).trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

function cowIconSvg(size) {
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}"><ellipse cx="38" cy="52" rx="15" ry="10" fill="#7a8a5e"></ellipse><ellipse cx="82" cy="52" rx="15" ry="10" fill="#7a8a5e"></ellipse><circle cx="60" cy="58" r="26" fill="#7a8a5e"></circle><ellipse cx="60" cy="72" rx="15" ry="11" fill="#e1eecc"></ellipse><circle cx="54" cy="71" r="2.6" fill="#7a8a5e"></circle><circle cx="66" cy="71" r="2.6" fill="#7a8a5e"></circle></svg>`;
}

let toastTimer = null;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function confirmDialog(message) {
  return window.confirm(message);
}

/* ---------------- Storage ---------------- */

const STORAGE_KEY = 'besicitakip_data_v1';

function emptyData() {
  return { animals: [], weightRecords: [], vaccinations: [], healthRecords: [], expenses: [], seq: 1 };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    return Object.assign(emptyData(), parsed);
  } catch (e) {
    return emptyData();
  }
}

let DB = loadData();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

function nextId() {
  const id = DB.seq;
  DB.seq += 1;
  return id;
}

const nowIso = () => new Date().toISOString();

/* ---------------- CRUD ---------------- */

function listAnimals() {
  return DB.animals.slice().sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
}

function getAnimal(id) {
  return DB.animals.find((a) => a.id === id) || null;
}

function latestWeightFor(animalId) {
  const rows = DB.weightRecords
    .filter((w) => w.animal_id === animalId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return rows[0] || null;
}

function dailyGainFor(animal) {
  const latest = latestWeightFor(animal.id);
  if (!latest || animal.entry_weight === null || animal.entry_weight === undefined) return null;
  const days = daysBetween(animal.entry_date, latest.date);
  if (days <= 0) return null;
  return (latest.weight - animal.entry_weight) / days;
}

function animalIdsNeedingAttention(withinDays) {
  const ids = new Set();
  for (const v of DB.vaccinations) {
    if (!v.next_date) continue;
    if (daysUntil(v.next_date) <= withinDays) ids.add(v.animal_id);
  }
  return ids;
}

function distinctPens() {
  const pens = new Set();
  for (const a of DB.animals) {
    if (a.pen && a.pen.trim()) pens.add(a.pen.trim());
  }
  return Array.from(pens).sort((a, b) => a.localeCompare(b, 'tr'));
}

function saveAnimal(data, existingId) {
  const ts = nowIso();
  if (existingId) {
    const idx = DB.animals.findIndex((a) => a.id === existingId);
    if (idx === -1) return null;
    DB.animals[idx] = Object.assign({}, DB.animals[idx], data, { updated_at: ts });
    persist();
    return DB.animals[idx];
  }
  const record = Object.assign({ id: nextId(), created_at: ts, updated_at: ts }, data);
  DB.animals.push(record);
  persist();
  return record;
}

function isEarTagTaken(earTag, excludeId) {
  return DB.animals.some(
    (a) => a.ear_tag.toLowerCase() === earTag.toLowerCase() && a.id !== excludeId
  );
}

function deleteAnimal(id) {
  DB.animals = DB.animals.filter((a) => a.id !== id);
  DB.weightRecords = DB.weightRecords.filter((r) => r.animal_id !== id);
  DB.vaccinations = DB.vaccinations.filter((r) => r.animal_id !== id);
  DB.healthRecords = DB.healthRecords.filter((r) => r.animal_id !== id);
  DB.expenses = DB.expenses.filter((r) => r.animal_id !== id);
  persist();
}

function listWeights(animalId) {
  return DB.weightRecords
    .filter((w) => w.animal_id === animalId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}
function addWeight(data) {
  const record = Object.assign({ id: nextId(), created_at: nowIso() }, data);
  DB.weightRecords.push(record);
  persist();
  return record;
}
function deleteWeight(id) {
  DB.weightRecords = DB.weightRecords.filter((r) => r.id !== id);
  persist();
}

function listVaccinations(animalId) {
  return DB.vaccinations
    .filter((v) => v.animal_id === animalId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}
function addVaccination(data) {
  const record = Object.assign({ id: nextId(), created_at: nowIso() }, data);
  DB.vaccinations.push(record);
  persist();
  return record;
}
function deleteVaccination(id) {
  DB.vaccinations = DB.vaccinations.filter((r) => r.id !== id);
  persist();
}
function upcomingVaccinations(withinDays) {
  const list = [];
  for (const v of DB.vaccinations) {
    if (!v.next_date) continue;
    const animal = getAnimal(v.animal_id);
    if (!animal || animal.status !== 'aktif') continue;
    if (withinDays !== null && daysUntil(v.next_date) > withinDays) continue;
    list.push(Object.assign({}, v, { ear_tag: animal.ear_tag, animal_name: animal.name }));
  }
  return list.sort((a, b) => new Date(a.next_date) - new Date(b.next_date));
}

function listHealth(animalId) {
  return DB.healthRecords
    .filter((h) => h.animal_id === animalId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}
function addHealth(data) {
  const record = Object.assign({ id: nextId(), created_at: nowIso() }, data);
  DB.healthRecords.push(record);
  persist();
  return record;
}
function deleteHealth(id) {
  DB.healthRecords = DB.healthRecords.filter((r) => r.id !== id);
  persist();
}

function listExpenses(animalId) {
  return DB.expenses
    .filter((e) => e.animal_id === animalId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}
function addExpense(data) {
  const record = Object.assign({ id: nextId(), created_at: nowIso() }, data);
  DB.expenses.push(record);
  persist();
  return record;
}
function deleteExpense(id) {
  DB.expenses = DB.expenses.filter((r) => r.id !== id);
  persist();
}

function farmSummary() {
  const totalAnimals = DB.animals.length;
  const activeAnimals = DB.animals.filter((a) => a.status === 'aktif').length;
  const soldAnimals = DB.animals.filter((a) => a.status === 'satildi').length;
  const deadAnimals = DB.animals.filter((a) => a.status === 'oldu').length;
  const totalPurchases = DB.animals.reduce((sum, a) => sum + (Number(a.purchase_price) || 0), 0);
  const totalSales = DB.animals
    .filter((a) => a.status === 'satildi')
    .reduce((sum, a) => sum + (Number(a.sale_price) || 0), 0);
  const totalExpenses = DB.expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const upcoming = upcomingVaccinations(7).length;
  return { totalAnimals, activeAnimals, soldAnimals, deadAnimals, totalPurchases, totalSales, totalExpenses, upcoming };
}

/* ---------------- State & routing ---------------- */

const state = {
  tab: 'animals',
  detailId: null,
  search: '',
  filter: 'hepsi',
  detailTab: 'kilo',
  adminTab: 'kullanici',
  moderationMode: false,
  moreScreen: null,
  listingId: null,
  postId: null,
  marketSearch: '',
  marketMineOnly: false,
  communityMineOnly: false,
};

let currentUser = null;
let currentUserProfile = null;

const STATUS_LABEL = { aktif: 'Aktif', satildi: 'Satıldı', oldu: 'Öldü', kesildi: 'Kesildi' };
const HEALTH_TYPE_LABEL = { hastalik: 'Hastalık', muayene: 'Muayene', tedavi: 'Tedavi' };
const EXPENSE_LABEL = { yem: 'Yem', ilac: 'İlaç', veteriner: 'Veteriner', nakliye: 'Nakliye', diger: 'Diğer' };

function setTitle(text) {
  document.getElementById('page-title').textContent = text;
}

function goTab(tab) {
  state.tab = tab;
  state.detailId = null;
  state.listingId = null;
  state.postId = null;
  state.moreScreen = null;
  state.marketMineOnly = false;
  state.communityMineOnly = false;
  render();
}

function openAnimal(id) {
  state.detailId = id;
  state.detailTab = 'kilo';
  render();
}

function closeDetail() {
  state.detailId = null;
  render();
}

function render() {
  document.querySelectorAll('nav.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === state.tab && state.detailId === null);
  });
  const root = document.getElementById('view-root');
  root.innerHTML = '';
  if (state.detailId !== null) {
    renderDetail(root, state.detailId);
    return;
  }
  if (state.tab === 'animals') renderAnimalsList(root);
  else if (state.tab === 'market') {
    if (state.listingId !== null) renderListingDetail(root, state.listingId);
    else renderMarket(root);
  } else if (state.tab === 'community') {
    if (state.postId !== null) renderPostDetail(root, state.postId);
    else renderCommunity(root);
  } else if (state.tab === 'account') renderAccount(root);
  else if (state.tab === 'more') {
    if (state.moreScreen === 'reminders') renderReminders(root);
    else if (state.moreScreen === 'summary') renderSummary(root);
    else if (state.moreScreen === 'settings') renderSettings(root);
    else if (state.moreScreen === 'admin') renderAdmin(root);
    else renderMoreMenu(root);
  }
}

function goMore(screen) {
  state.moreScreen = screen;
  render();
}

function requireOnline(actionLabel) {
  if (!window.firebaseReady) {
    alert(`${actionLabel} için internet bağlantısı gerekiyor.`);
    return false;
  }
  return true;
}

function requireLogin(actionLabel) {
  if (!requireOnline(actionLabel)) return false;
  if (!currentUser) {
    alert(`${actionLabel} için giriş yapmalısın.`);
    state.tab = 'account';
    state.detailId = null;
    render();
    return false;
  }
  if (currentUser.emailVerified === false) {
    alert(`${actionLabel} için önce e-postanı doğrulamalısın.`);
    state.tab = 'account';
    state.detailId = null;
    render();
    return false;
  }
  if (currentUserProfile && currentUserProfile.banned) {
    alert('Hesabınız yönetici tarafından engellenmiş, bu işlemi yapamazsınız.');
    return false;
  }
  return true;
}

async function checkEmailVerified() {
  if (!currentUser) return;
  try {
    await currentUser.reload();
  } catch (e) {}
  toast(currentUser.emailVerified ? 'E-posta doğrulandı, hoş geldin!' : 'Henüz doğrulanmamış görünüyor, e-postanı kontrol et.');
  render();
}

async function resendVerificationEmail() {
  if (!currentUser) return;
  try {
    await currentUser.sendEmailVerification();
    toast('Doğrulama bağlantısı tekrar gönderildi.');
  } catch (e) {
    toast(loginErrorMessage(e));
  }
}

/* ---------------- Animals list ---------------- */

function filteredAnimalsForList() {
  const allAnimals = listAnimals();
  const activeAnimals = allAnimals.filter((a) => a.status === 'aktif');

  let list;
  if (state.filter === 'satildi_hepsi') {
    list = allAnimals.filter((a) => a.status !== 'aktif');
  } else if (state.filter === 'hepsi') {
    list = activeAnimals;
  } else {
    list = activeAnimals.filter((a) => a.pen === state.filter);
  }

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.ear_tag.toLowerCase().includes(q) ||
        (a.name || '').toLowerCase().includes(q) ||
        (a.pen || '').toLowerCase().includes(q)
    );
  }

  return { list, activeAnimals };
}

function animalCardHtml(a, attention) {
  const w = latestWeightFor(a.id);
  const weightVal = w ? w.weight : a.entry_weight;
  const gain = dailyGainFor(a);
  const avatar = a.photo_uri
    ? `<img src="${a.photo_uri}" alt="" onclick="event.stopPropagation(); openPhotoLightbox('${a.photo_uri}')">`
    : cowIconSvg(42);
  const genderBadge = a.gender
    ? `<span class="badge badge-${a.gender === 'erkek' ? 'erkek' : 'disi'}">${a.gender === 'erkek' ? 'Erkek' : 'Dişi'}</span>`
    : '';
  return `
        <div class="animal-card" onclick="openAnimal(${a.id})">
          <div class="top">
            <div class="avatar">${avatar}</div>
            <div class="info">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="ear-tag">${escapeHtml(a.ear_tag)}</span>
                ${genderBadge}
              </div>
              <div class="name">${[a.breed, a.pen].filter(Boolean).map(escapeHtml).join(' · ') || escapeHtml(a.species)}</div>
            </div>
            ${a.status !== 'aktif' ? `<div class="badge badge-${a.status}">${STATUS_LABEL[a.status]}</div>` : ''}
          </div>
          <div class="bottom">
            <span class="weight">${formatWeight(weightVal)}</span>
            ${gain !== null ? `<span class="gain">+${gain.toFixed(2)}/gün</span>` : ''}
            ${attention.has(a.id) ? '<span class="alert-dot"></span>' : ''}
          </div>
        </div>`;
}

function animalsResultsHtml(list, emptyHtml) {
  const attention = animalIdsNeedingAttention(14);
  const cardsHtml = list.length ? list.map((a) => animalCardHtml(a, attention)).join('') : emptyHtml;
  return `
    ${cardsHtml}
    <div class="info-banner" style="margin-top:8px;">
      <div class="icon">⬇</div>
      <div>Bu liste telefonunda duruyor, internetsiz de açılır. <a href="#" onclick="goMore('settings'); return false;" style="font-weight:800;color:inherit;">Yedeğini al</a></div>
    </div>
  `;
}

function renderAnimalsList(root) {
  setTitle('Hayvanlarım');

  const { list, activeAnimals } = filteredAnimalsForList();
  const pens = distinctPens();
  const filters = [['hepsi', 'Hepsi']]
    .concat(pens.map((p) => [p, p]))
    .concat([['satildi_hepsi', 'Satılanlar']]);

  const gains = activeAnimals.map(dailyGainFor).filter((g) => g !== null);
  const avgGain = gains.length ? gains.reduce((s, g) => s + g, 0) / gains.length : null;

  const emptyHtml = `<div class="empty-state">
        <svg viewBox="0 0 160 160" width="140" height="140"><circle cx="80" cy="80" r="76" fill="#e1eecc"></circle><g fill="none" stroke="#7a8a5e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M26 74 L80 34 L134 74"></path><rect x="36" y="74" width="88" height="56" rx="16"></rect><rect x="66" y="98" width="28" height="32" rx="12"></rect></g><circle cx="52" cy="94" r="7" fill="#7a8a5e"></circle><circle cx="108" cy="94" r="7" fill="#7a8a5e"></circle></svg>
        <strong>Henüz hayvan eklenmemiş</strong>Sağ alttaki + butonuyla ilk hayvanınızı ekleyin.
      </div>`;

  root.innerHTML = `
    <div class="chip-row">
      ${filters.map(([v, l]) => `<div class="chip ${state.filter === v ? 'active' : ''}" onclick="setFilter('${escapeHtml(v)}')">${escapeHtml(l)}</div>`).join('')}
    </div>
    <div class="stat-row">
      <div class="stat-block fill">
        <div class="stat-label">Ahırda</div>
        <div class="stat-value">${activeAnimals.length}</div>
      </div>
      <div class="stat-block outline">
        <div class="stat-label">Günlük ortalama</div>
        <div class="stat-value">${avgGain !== null ? avgGain.toFixed(2) + ' kg' : '-'}</div>
      </div>
    </div>
    <div class="search-row">
      <span>🔍</span>
      <input id="search-input" type="text" placeholder="Küpe no, isim veya ahır ara..." value="${escapeHtml(state.search)}">
    </div>
    <div id="animals-results">${animalsResultsHtml(list, emptyHtml)}</div>
    <button class="fab" onclick="openAnimalForm()">+</button>
  `;

  const input = document.getElementById('search-input');
  input.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderAnimalsResultsOnly();
  });
}

function renderAnimalsResultsOnly() {
  const resultsEl = document.getElementById('animals-results');
  if (!resultsEl) return;
  const { list } = filteredAnimalsForList();
  const emptyHtml = `<div class="empty-state"><strong>Sonuç bulunamadı</strong>Farklı bir arama dene.</div>`;
  resultsEl.innerHTML = animalsResultsHtml(list, emptyHtml);
}

function setFilter(v) {
  state.filter = v;
  render();
}

/* ---------------- Reminders ---------------- */

function renderReminders(root) {
  setTitle('Aşı Hatırlatıcıları');
  const items = upcomingVaccinations(60);
  if (!items.length) {
    root.innerHTML = `${moreBackButton()}<div class="empty-state"><strong>Yaklaşan aşı hatırlatıcısı yok</strong>Aşı kayıtlarına "sonraki doz tarihi" girdiğinizde burada görünecek.</div>`;
    return;
  }
  root.innerHTML = moreBackButton() + items
    .map((v) => {
      const info = vaccineStatusInfo(v);
      return `
      <div class="card" style="cursor:pointer;display:flex;gap:13px;align-items:center;border-color:${info.border};" onclick="openAnimal(${v.animal_id})">
        <div style="width:12px;height:46px;border-radius:999px;background:${info.color};flex:none;"></div>
        <div style="flex:1;">
          <div style="font-size:17px;font-weight:800;">${escapeHtml(v.name)}</div>
          <div style="font-size:13.5px;font-weight:600;color:var(--muted);margin-top:3px;">${escapeHtml(v.ear_tag)}${v.animal_name ? ' · ' + escapeHtml(v.animal_name) : ''}</div>
        </div>
        <div style="font-size:13.5px;font-weight:800;color:${info.color};text-align:right;flex:none;max-width:86px;line-height:1.3;">${info.label}</div>
      </div>`;
    })
    .join('');
}

/* ---------------- Summary ---------------- */

function renderSummary(root) {
  setTitle('Çiftlik Özeti');
  const s = farmSummary();
  const profit = s.totalSales - s.totalPurchases - s.totalExpenses;
  root.innerHTML = `
    ${moreBackButton()}
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon">🐄</div><div class="stat-value">${s.totalAnimals}</div><div class="stat-label">Toplam Hayvan</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${s.activeAnimals}</div><div class="stat-label">Aktif</div></div>
      <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-value">${s.soldAnimals}</div><div class="stat-label">Satıldı</div></div>
      <div class="stat-card"><div class="stat-icon">⚠️</div><div class="stat-value">${s.deadAnimals}</div><div class="stat-label">Öldü</div></div>
    </div>
    <div class="card" style="background:var(--text);color:var(--bg);border:none;margin-top:12px;">
      <div style="font-size:13.5px;font-weight:700;opacity:0.7;">NET KÂR</div>
      <div style="font-family:var(--font-heading);font-size:38px;line-height:1.05;margin-top:6px;color:${profit >= 0 ? 'var(--sage-light)' : '#ffb2a0'};">${profit >= 0 ? '+' : ''}${formatMoney(profit)}</div>
      <div style="display:flex;gap:5px;margin-top:18px;height:14px;border-radius:999px;overflow:hidden;">
        <div style="flex:${Math.max(s.totalSales, 1)};background:var(--sage-light);"></div>
        <div style="flex:${Math.max(s.totalPurchases, 1)};background:#f6a06b;"></div>
        <div style="flex:${Math.max(s.totalExpenses, 1)};background:rgba(245,234,216,0.3);"></div>
      </div>
      <div style="display:flex;gap:16px;margin-top:11px;font-size:13px;font-weight:600;opacity:0.85;flex-wrap:wrap;">
        <span>Satış ${formatMoney(s.totalSales)}</span><span>Alış ${formatMoney(s.totalPurchases)}</span><span>Gider ${formatMoney(s.totalExpenses)}</span>
      </div>
    </div>
    <div class="card">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">💉</span>
        <span style="font-size:13.5px;font-weight:600;">Önümüzdeki 7 gün içinde <strong>${s.upcoming}</strong> aşı hatırlatıcısı var</span>
      </div>
    </div>
    <button class="btn btn-ghost" onclick="exportBackup()">Tüm veriyi JSON olarak yedekle</button>
  `;
}

/* ---------------- Settings ---------------- */

function renderSettings(root) {
  setTitle('Ayarlar');
  root.innerHTML = `
    ${moreBackButton()}
    <div class="card">
      <div style="font-weight:700; margin-bottom:8px;">☁️ Yedekleme</div>
      <div style="font-size:13px; color:var(--muted); line-height:1.5; margin-bottom:12px;">
        Tüm hayvan, kilo, aşı, sağlık ve gider kayıtlarınızı tek bir dosyaya aktarıp saklayabilir veya başka bir cihaza aktarabilirsiniz.
      </div>
      <div class="btn-row" style="margin-bottom:10px;">
        <button class="btn btn-primary" onclick="exportBackup()">Yedek Dosyası İndir</button>
      </div>
      <input type="file" id="import-file-input" accept="application/json" class="hidden">
      <button class="btn btn-secondary" onclick="document.getElementById('import-file-input').click()">Yedekten Geri Yükle</button>
    </div>
    <div class="card">
      <div style="font-weight:700; margin-bottom:8px;">ℹ️ Hakkında</div>
      <div style="font-size:13px; color:var(--muted); line-height:1.5;">
        Besici Takip Web · Tüm verileriniz yalnızca bu cihazın tarayıcısında saklanır, internete ihtiyaç duymaz.<br><br>
        En iyi deneyim için bu sayfayı Safari'de "Paylaş" menüsünden <strong>"Ana Ekrana Ekle"</strong> ile telefonunuza ekleyin.
      </div>
    </div>
  `;
  document.getElementById('import-file-input').addEventListener('change', handleImportFile);
}

function exportBackup() {
  const data = {
    formatVersion: 1,
    exportedAt: nowIso(),
    animals: DB.animals,
    weight_records: DB.weightRecords,
    vaccinations: DB.vaccinations,
    health_records: DB.healthRecords,
    expenses: DB.expenses,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `besicitakip-yedek-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Yedek dosyası indirildi');
}

function handleImportFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!confirmDialog('Bu işlem cihazdaki mevcut tüm verilerin üzerine yazacak. Devam etmek istiyor musunuz?')) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.animals)) throw new Error('invalid');
      DB = {
        animals: data.animals || [],
        weightRecords: data.weight_records || data.weightRecords || [],
        vaccinations: data.vaccinations || [],
        healthRecords: data.health_records || data.healthRecords || [],
        expenses: data.expenses || [],
        seq: 1,
      };
      const allIds = []
        .concat(DB.animals, DB.weightRecords, DB.vaccinations, DB.healthRecords, DB.expenses)
        .map((r) => r.id || 0);
      DB.seq = (allIds.length ? Math.max(...allIds) : 0) + 1;
      persist();
      toast('Yedek geri yüklendi');
      render();
    } catch (err) {
      alert('Dosya okunamadı veya bozuk.');
    }
  };
  reader.readAsText(file);
}

/* ---------------- Shared helpers for online sections ---------------- */

function moreBackButton() {
  return `<button class="btn btn-ghost" style="margin-bottom:12px;" onclick="goMore(null)">← Geri</button>`;
}

function timeAgoOrDate(ts) {
  if (!ts) return '';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return formatDate(date.toISOString().slice(0, 10));
}

function resizeImageToBlob(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode-failed'));
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h >= w && h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode-failed'))), 'image/jpeg', quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadPhoto(path, blob) {
  const ref = storage.ref(path);
  await ref.put(blob);
  return ref.getDownloadURL();
}

/* ---------------- Gemini photo moderation ---------------- */

const GEMINI_MODEL = 'gemini-2.0-flash';

async function moderateAnimalPhoto(blob) {
  if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY) {
    return { ok: true, skipped: true };
  }
  try {
    const base64 = await blobToBase64(blob);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Bu fotoğrafta net şekilde bir çiftlik hayvanı (sığır, koyun, keçi, manda, tavuk vb.) görünüyor mu? Sadece tek kelimeyle cevap ver: EVET veya HAYIR.',
              },
              { inline_data: { mime_type: 'image/jpeg', data: base64 } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return { ok: true, skipped: true, error: `http_${res.status}` };
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toUpperCase();
    if (text.includes('HAYIR')) return { ok: false };
    return { ok: true };
  } catch (e) {
    return { ok: true, skipped: true, error: e.message };
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

/* ---------------- Auth / Account ---------------- */

let isAdminUser = false;
let accountFormMode = 'login';
let authError = null;
let authBusy = false;
let profileRequestSeq = 0;

async function refreshCurrentUserProfile() {
  const myRequestId = ++profileRequestSeq;

  if (!currentUser) {
    if (myRequestId === profileRequestSeq) {
      currentUserProfile = null;
      isAdminUser = false;
    }
    return;
  }

  const uid = currentUser.uid;
  let profile = null;
  let admin = false;
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    profile = userSnap.exists ? userSnap.data() : null;
  } catch (e) {
    profile = null;
  }
  try {
    const adminSnap = await db.collection('admins').doc(uid).get();
    admin = adminSnap.exists;
  } catch (e) {
    admin = false;
  }

  // Discard this result if a newer refresh has since been requested (avoids races
  // where an older, slower request resolves after a newer one and overwrites it).
  if (myRequestId === profileRequestSeq) {
    currentUserProfile = profile;
    isAdminUser = admin;
  }
}

function renderAccount(root) {
  setTitle('Hesabım');
  if (!window.firebaseReady) {
    root.innerHTML = `<div class="empty-state"><strong>İnternet bağlantısı yok</strong>Hesap özellikleri için internete bağlanman gerekiyor.</div>`;
    return;
  }
  if (currentUser && currentUser.emailVerified === false) {
    root.innerHTML = `
      <div style="padding-top:10px;text-align:center;">
        <div style="width:64px;height:64px;margin:0 auto;">${authIconSvg(64)}</div>
        <div style="font-family:var(--font-heading);font-size:26px;line-height:1.15;margin-top:18px;">E-postanı doğrula</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-soft);line-height:1.5;margin-top:10px;">
          <strong>${escapeHtml(currentUser.email || '')}</strong> adresine bir doğrulama bağlantısı gönderdik. Pazar Yeri ve Topluluk'u kullanabilmek için önce e-postanı doğrulaman gerekiyor.
        </div>
        <button class="btn btn-primary" style="margin-top:24px;height:58px;width:100%;" onclick="checkEmailVerified()">Doğruladım, devam et</button>
        <button class="btn btn-secondary" style="margin-top:12px;height:58px;width:100%;" onclick="resendVerificationEmail()">Doğrulama bağlantısını tekrar gönder</button>
        <div style="margin-top:20px;font-size:15px;font-weight:700;color:var(--primary-active);cursor:pointer;text-decoration:underline;" onclick="logout()">Çıkış yap</div>
      </div>`;
    return;
  }
  if (currentUser) {
    const p = currentUserProfile || {};
    const initials = (p.displayName || currentUser.email || '?').trim().slice(0, 2).toUpperCase();
    const maskedPhone = p.phone ? p.phone.replace(/(\d{4})\d+(\d{2})$/, '$1 *** ** $2') : '';
    const rows = [
      { label: 'Profil bilgileri', sub: 'Ad, telefon, şehir', on: 'openEditProfileForm()' },
      { label: 'İlanlarım', sub: 'Pazar Yeri ilanların', on: "state.tab='market'; state.marketMineOnly=true; render();" },
      { label: 'Gönderilerim', sub: 'Topluluk gönderilerin', on: "state.tab='community'; state.communityMineOnly=true; render();" },
    ];
    if (isAdminUser) rows.push({ label: '🛡️ Yönetici Paneli', sub: 'Kullanıcılar, ilanlar, gönderiler', on: "state.tab='more'; goMore('admin');" });
    rows.push({ label: 'Çıkış yap', sub: 'Hayvan kayıtların telefonda kalır', on: 'logout()', danger: true });

    root.innerHTML = `
      <div class="card" style="display:flex;gap:15px;align-items:center;">
        <div class="avatar-initials" style="width:66px;height:66px;background:var(--primary);color:var(--bg);font-size:24px;">${escapeHtml(initials)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-heading);font-size:22px;line-height:1.1;">${escapeHtml(p.displayName || currentUser.email)}</div>
          ${p.username ? `<div style="font-size:13.5px;font-weight:700;color:var(--primary-active);margin-top:2px;">@${escapeHtml(p.username)}</div>` : ''}
          <div style="font-size:14px;font-weight:600;color:var(--muted);margin-top:4px;">${escapeHtml(p.city || '')}${p.city && maskedPhone ? ' · ' : ''}${escapeHtml(maskedPhone)}</div>
        </div>
        ${isAdminUser ? '<div class="badge badge-aktif">Yönetici</div>' : ''}
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        ${rows
          .map(
            (r, i) => `
        <div class="list-row" style="padding:17px 18px;${i === 0 ? 'border-top:none;' : ''}cursor:pointer;" onclick="${r.on}">
          <div class="body"><div class="title" style="${r.danger ? 'color:var(--red);' : ''}">${r.label}</div><div class="subtitle">${r.sub}</div></div>
          <span style="color:var(--faint);">›</span>
        </div>`
          )
          .join('')}
      </div>
      ${
        isAdminUser
          ? `<div class="card" style="background:var(--text);display:flex;align-items:center;gap:14px;cursor:pointer;margin-top:14px;" onclick="toggleModerationMode()">
              <div style="flex:1;"><div style="font-size:16.5px;font-weight:800;color:var(--bg);">Denetim modu</div><div style="font-size:13px;font-weight:600;color:rgba(245,234,216,0.7);margin-top:3px;">${state.moderationMode ? 'Açık — ilan ve gönderilerde "Kaldır" butonu görünüyor' : 'Kapalı — normal kullanıcı görünümü'}</div></div>
              <div style="width:56px;height:32px;border-radius:999px;background:${state.moderationMode ? 'var(--primary)' : 'rgba(245,234,216,0.25)'};padding:4px;display:flex;justify-content:${state.moderationMode ? 'flex-end' : 'flex-start'};flex:none;">
                <div style="width:24px;height:24px;border-radius:999px;background:var(--bg);"></div>
              </div>
            </div>`
          : ''
      }
      <div class="info-banner neutral" style="margin-top:14px;">
        <div>Hayvanlar ve giderler yalnızca bu telefonda. Pazar Yeri, Topluluk ve hesabın internetten senkron — başka telefondan girince de görürsün.</div>
      </div>
    `;
    return;
  }

  const isLogin = accountFormMode === 'login';
  root.innerHTML = `
    <div style="padding-top:6px;">
      <div style="width:64px;height:64px;">${authIconSvg(64)}</div>
      <div style="font-family:var(--font-heading);font-size:32px;line-height:1.08;letter-spacing:-.02em;margin-top:16px;">${isLogin ? 'Tekrar hoş geldin' : 'Aramıza katıl'}</div>
      <div style="font-size:15px;font-weight:600;color:var(--text-soft);line-height:1.5;margin-top:8px;">Pazar Yeri ve Topluluk için ${isLogin ? 'giriş yap' : 'kayıt ol'}. Hayvan kayıtların telefonunda zaten duruyor.</div>

      <div class="seg-row" style="margin-top:20px;">
        <div class="seg-opt ${isLogin ? 'active' : ''}" onclick="accountFormMode='login'; authError=null; render();">Giriş yap</div>
        <div class="seg-opt ${!isLogin ? 'active' : ''}" onclick="accountFormMode='register'; authError=null; render();">Kayıt ol</div>
      </div>

      ${isLogin ? loginFormHtml() : registerFormHtml()}

      ${
        authError
          ? `<div style="margin-top:14px;padding:14px 16px;border-radius:24px;background:var(--primary-light);border:1.5px solid var(--red);display:flex;gap:10px;align-items:center;">
              <div style="width:26px;height:26px;border-radius:999px;background:var(--red);color:var(--primary-light);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;flex:none;">!</div>
              <div style="font-size:14.5px;font-weight:700;color:var(--red-deep);line-height:1.4;">${escapeHtml(authError)}</div>
            </div>`
          : ''
      }

      <button class="btn btn-primary" style="margin-top:20px;height:64px;font-size:20px;display:flex;align-items:center;justify-content:center;gap:10px;" onclick="${isLogin ? 'submitLogin()' : 'submitRegister()'}" ${authBusy ? 'disabled' : ''}>
        ${authBusy ? '<span class="spinner"></span>' : ''}<span>${isLogin ? 'Giriş yap' : 'Kayıt ol'}</span>
      </button>

      ${isLogin ? `<div style="margin-top:16px;text-align:center;font-size:15px;font-weight:700;color:var(--primary-active);cursor:pointer;text-decoration:underline;" onclick="resetPassword()">Şifremi unuttum</div>` : ''}

      <div class="info-banner" style="margin-top:26px;">
        <div style="flex:1;">
          <div>Hayvan kayıtların için hesap gerekmiyor — Pazar Yeri ve Topluluk için gerekiyor.</div>
          <button class="btn btn-secondary" style="margin-top:14px;" onclick="goTab('animals')">Şimdilik geç, hayvanlarımı takip et</button>
        </div>
      </div>
    </div>
  `;
}

function authIconSvg(size) {
  return `<svg viewBox="0 0 512 512" width="${size}" height="${size}"><rect width="512" height="512" rx="118" fill="#c67139"></rect><g transform="rotate(-8 256 262)"><circle cx="256" cy="132" r="30" fill="#f5ead8"></circle><rect x="140" y="140" width="232" height="262" rx="76" fill="#f5ead8"></rect><circle cx="256" cy="200" r="27" fill="#c67139"></circle><ellipse cx="190" cy="292" rx="34" ry="21" fill="#7a8a5e"></ellipse><ellipse cx="322" cy="292" rx="34" ry="21" fill="#7a8a5e"></ellipse><circle cx="256" cy="300" r="56" fill="#7a8a5e"></circle><ellipse cx="256" cy="330" rx="32" ry="23" fill="#f5ead8"></ellipse><circle cx="244" cy="329" r="5.5" fill="#7a8a5e"></circle><circle cx="268" cy="329" r="5.5" fill="#7a8a5e"></circle></g></svg>`;
}

function authFieldIconHtml(path) {
  return `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#82796a" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const TURKISH_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
  'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur',
  'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan',
  'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
  'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir',
  'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş',
  'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
  'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat',
  'Zonguldak',
];

const COUNTRY_CODES = [
  { code: '+90', label: 'Türkiye (+90)' },
  { code: '+49', label: 'Almanya (+49)' },
  { code: '+31', label: 'Hollanda (+31)' },
  { code: '+32', label: 'Belçika (+32)' },
  { code: '+33', label: 'Fransa (+33)' },
  { code: '+43', label: 'Avusturya (+43)' },
  { code: '+41', label: 'İsviçre (+41)' },
  { code: '+44', label: 'İngiltere (+44)' },
  { code: '+1', label: 'ABD / Kanada (+1)' },
  { code: '+7', label: 'Rusya (+7)' },
  { code: '+994', label: 'Azerbaycan (+994)' },
  { code: '+971', label: 'BAE (+971)' },
  { code: '+966', label: 'Suudi Arabistan (+966)' },
];

const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com', 'hotmail.com', 'hotmail.com.tr', 'outlook.com', 'outlook.com.tr',
  'yahoo.com', 'yahoo.com.tr', 'icloud.com', 'live.com', 'yandex.com', 'yandex.com.tr',
  'mynet.com', 'protonmail.com',
];

const AUTH_ICONS = {
  mail: '<path d="M4 6h16v12H4z"></path><path d="M4 6l8 7 8-7"></path>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
  person: '<circle cx="12" cy="8" r="4"></circle><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"></path>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z"></path>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"></path><circle cx="12" cy="9" r="2.5"></circle>',
  at: '<circle cx="12" cy="12" r="4"></circle><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4 7.5"></path>',
};

function authInputHtml(id, label, type, placeholder, icon, value, extraAttrs) {
  const isPassword = type === 'password';
  return `
    <div style="margin-top:14px;">
      <div style="font-size:14px;font-weight:800;margin-bottom:8px;">${label}</div>
      <div style="height:58px;border-radius:999px;border:1.5px solid var(--border);background:var(--card);display:flex;align-items:center;gap:11px;padding:0 20px;">
        ${authFieldIconHtml(AUTH_ICONS[icon])}
        <input type="${type}" id="${id}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value || '')}" ${extraAttrs || ''} style="border:none;background:transparent;flex:1;height:100%;padding:0;font-size:16.5px;font-weight:600;min-width:0;">
        ${
          isPassword
            ? `<button type="button" onclick="togglePasswordVisibility('${id}', this)" style="background:none;border:none;padding:4px;margin:0;flex:none;cursor:pointer;display:flex;align-items:center;" aria-label="Şifreyi göster">${authFieldIconHtml('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle>')}</button>`
            : ''
        }
      </div>
    </div>`;
}

function authSelectHtml(id, label, icon, options, value, placeholder) {
  return `
    <div style="margin-top:14px;">
      <div style="font-size:14px;font-weight:800;margin-bottom:8px;">${label}</div>
      <div style="height:58px;border-radius:999px;border:1.5px solid var(--border);background:var(--card);display:flex;align-items:center;gap:11px;padding:0 20px;">
        ${authFieldIconHtml(AUTH_ICONS[icon])}
        <select id="${id}" style="border:none;background:transparent;flex:1;height:100%;padding:0;font-size:16.5px;font-weight:600;min-width:0;">
          <option value="">${escapeHtml(placeholder || 'Seç')}</option>
          ${options.map((o) => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

function authPhoneRowHtml(codeId, numId, label, value, codeValue) {
  return `
    <div style="margin-top:14px;">
      <div style="font-size:14px;font-weight:800;margin-bottom:8px;">${label}</div>
      <div style="height:58px;border-radius:999px;border:1.5px solid var(--border);background:var(--card);display:flex;align-items:center;gap:8px;padding:0 14px 0 20px;">
        ${authFieldIconHtml(AUTH_ICONS.phone)}
        <select id="${codeId}" style="border:none;background:transparent;flex:none;height:100%;padding:0 4px 0 0;font-size:16.5px;font-weight:700;">
          ${COUNTRY_CODES.map((c) => `<option value="${c.code}" ${c.code === (codeValue || '+90') ? 'selected' : ''}>${c.code}</option>`).join('')}
        </select>
        <div style="width:1px;height:26px;background:var(--border);flex:none;"></div>
        <input type="tel" id="${numId}" placeholder="5xx xxx xx xx" value="${escapeHtml(value || '')}" oninput="this.value=this.value.replace(/[^0-9 ]/g,'')" style="border:none;background:transparent;flex:1;height:100%;padding:0 0 0 8px;font-size:16.5px;font-weight:600;min-width:0;">
      </div>
    </div>`;
}

function splitPhone(phone) {
  if (!phone) return { code: '+90', number: '' };
  const codes = COUNTRY_CODES.map((c) => c.code).sort((a, b) => b.length - a.length);
  const match = codes.find((code) => phone.startsWith(code));
  if (match) return { code: match, number: phone.slice(match.length).trim() };
  return { code: '+90', number: phone };
}

function togglePasswordVisibility(id, btn) {
  const input = document.getElementById(id);
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.innerHTML = authFieldIconHtml(
    showing
      ? '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"></path><circle cx="12" cy="12" r="3"></circle>'
      : '<path d="M3 3l18 18"></path><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a16.9 16.9 0 0 1-3.4 4.3M6.5 6.6C4 8.3 2 12 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.9"></path><path d="M9.5 9.8a3 3 0 0 0 4.2 4.2"></path>'
  );
}

function loginFormHtml() {
  return `
    ${authInputHtml('lf-email', 'E-posta', 'text', 'ornek@eposta.com', 'mail')}
    ${authInputHtml('lf-password', 'Şifre', 'password', 'Şifreniz', 'lock')}
  `;
}

function registerFormHtml() {
  return `
    ${authInputHtml('rf-name', 'Ad Soyad *', 'text', 'Ör. Mehmet Yılmaz', 'person')}
    ${authInputHtml('rf-username', 'Kullanıcı Adı', 'text', 'Ör. mehmety34', 'at', '', `oninput="this.value=this.value.replace(/[^a-zA-Z0-9_]/g,'').toLowerCase()"`)}
    <div style="font-size:12.5px;font-weight:600;color:var(--text-soft);margin-top:6px;padding:0 6px;">Sadece İngilizce harf, rakam ve alt çizgi (_) kullanılabilir.</div>
    ${authPhoneRowHtml('rf-phone-code', 'rf-phone', 'Telefon', '', '+90')}
    ${authSelectHtml('rf-city', 'Şehir', 'pin', TURKISH_CITIES, '', 'Şehir seç')}
    ${authInputHtml('rf-email', 'E-posta *', 'text', 'ornek@gmail.com', 'mail')}
    ${authInputHtml('rf-password', 'Şifre *', 'password', 'En az 6 karakter', 'lock')}
    <div style="font-size:12.5px;font-weight:600;color:var(--text-soft);margin-top:6px;padding:0 6px;">Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermeli.</div>
  `;
}

async function submitLogin() {
  const email = document.getElementById('lf-email').value.trim();
  const password = document.getElementById('lf-password').value;
  if (!email || !password) {
    authError = 'E-posta ve şifre zorunludur.';
    render();
    return;
  }
  authBusy = true;
  authError = null;
  render();
  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    currentUser = cred.user;
    await refreshCurrentUserProfile();
    authBusy = false;
    toast('Giriş yapıldı');
    render();
  } catch (e) {
    authBusy = false;
    authError = loginErrorMessage(e);
    render();
  }
}

function loginErrorMessage(e) {
  const map = {
    'auth/invalid-email': 'Geçersiz e-posta adresi.',
    'auth/user-not-found': 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.',
    'auth/wrong-password': 'Şifre hatalı görünüyor. Tekrar dene ya da sıfırla.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/missing-password': 'Şifre girmelisin.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı, birazdan tekrar dene.',
  };
  return map[e.code] || 'Bir hata oluştu: ' + e.message;
}

async function resetPassword() {
  const email = (document.getElementById('lf-email') && document.getElementById('lf-email').value.trim()) || '';
  if (!email) {
    authError = 'Şifre sıfırlamak için önce e-posta adresini yaz.';
    render();
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    authError = null;
    toast('Şifre sıfırlama bağlantısı e-postana gönderildi');
  } catch (e) {
    authError = loginErrorMessage(e);
    render();
  }
}

async function submitRegister() {
  const name = document.getElementById('rf-name').value.trim();
  const username = document.getElementById('rf-username').value.trim().replace(/^@/, '').toLowerCase();
  const phoneCode = document.getElementById('rf-phone-code').value;
  const phoneNum = document.getElementById('rf-phone').value.trim();
  const phone = phoneNum ? `${phoneCode} ${phoneNum}` : '';
  const city = document.getElementById('rf-city').value;
  const email = document.getElementById('rf-email').value.trim();
  const password = document.getElementById('rf-password').value;

  if (!name || !email || !password) {
    authError = 'Ad soyad, e-posta ve şifre zorunludur.';
    render();
    return;
  }
  if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    authError = 'Kullanıcı adı sadece İngilizce harf, rakam ve alt çizgi içerebilir (en az 3 karakter).';
    render();
    return;
  }
  const emailDomain = (email.split('@')[1] || '').toLowerCase();
  if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
    authError = 'Lütfen bilinen bir e-posta sağlayıcısı kullan (Gmail, Hotmail, Outlook, Yahoo, iCloud vb.).';
    render();
    return;
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password)) {
    authError = 'Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermeli.';
    render();
    return;
  }

  authBusy = true;
  authError = null;
  render();
  try {
    if (username) {
      const existing = await db.collection('users').where('username', '==', username).limit(1).get();
      if (!existing.empty) {
        authBusy = false;
        authError = 'Bu kullanıcı adı alınmış, başka bir tane dene.';
        render();
        return;
      }
    }
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    currentUser = cred.user;
    await db.collection('users').doc(cred.user.uid).set({
      displayName: name,
      username: username || null,
      email,
      phone: phone || null,
      city: city || null,
      banned: false,
      muted: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await cred.user.sendEmailVerification();
    await refreshCurrentUserProfile();
    authBusy = false;
    toast('Kayıt tamamlandı! Doğrulama bağlantısı e-postana gönderildi.');
    render();
  } catch (e) {
    authBusy = false;
    authError = loginErrorMessage(e);
    render();
  }
}

function logout() {
  auth.signOut();
  state.tab = 'animals';
  state.moderationMode = false;
  render();
}

function toggleModerationMode() {
  state.moderationMode = !state.moderationMode;
  render();
}

function moderationBannerHtml() {
  if (!(isAdminUser && state.moderationMode)) return '';
  return `<div style="margin-bottom:14px;background:var(--text);border-radius:24px;padding:13px 16px;display:flex;align-items:center;gap:11px;">
    <span style="font-size:16px;">🛡️</span>
    <div style="flex:1;font-size:13.5px;font-weight:700;color:var(--bg);line-height:1.4;">Denetim modu açık — ilan ve gönderileri kaldırabilirsin.</div>
  </div>`;
}

function openEditProfileForm() {
  const p = currentUserProfile || {};
  const phoneParts = splitPhone(p.phone);
  const body = `
    <label class="field"><span class="field-label">Ad Soyad</span><input type="text" id="ep-name" value="${escapeHtml(p.displayName || '')}"></label>
    <label class="field"><span class="field-label">Kullanıcı Adı</span><input type="text" id="ep-username" value="${escapeHtml(p.username || '')}" placeholder="Ör. mehmety34" oninput="this.value=this.value.replace(/[^a-zA-Z0-9_]/g,'').toLowerCase()"></label>
    <label class="field"><span class="field-label">Telefon</span>
      <div style="display:flex;gap:8px;">
        <select id="ep-phone-code" style="flex:none;width:92px;">
          ${COUNTRY_CODES.map((c) => `<option value="${c.code}" ${c.code === phoneParts.code ? 'selected' : ''}>${c.code}</option>`).join('')}
        </select>
        <input type="tel" id="ep-phone" value="${escapeHtml(phoneParts.number)}" style="flex:1;" oninput="this.value=this.value.replace(/[^0-9 ]/g,'')">
      </div>
    </label>
    <label class="field"><span class="field-label">Şehir</span>
      <select id="ep-city">
        <option value="">Şehir seç</option>
        ${TURKISH_CITIES.map((c) => `<option value="${escapeHtml(c)}" ${c === p.city ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
    </label>
    <button class="btn btn-primary" onclick="submitEditProfile()">Kaydet</button>
  `;
  openModal('Profili Düzenle', body);
}

async function submitEditProfile() {
  const name = document.getElementById('ep-name').value.trim();
  const username = document.getElementById('ep-username').value.trim().replace(/^@/, '').toLowerCase();
  const phoneCode = document.getElementById('ep-phone-code').value;
  const phoneNum = document.getElementById('ep-phone').value.trim();
  const phone = phoneNum ? `${phoneCode} ${phoneNum}` : '';
  const city = document.getElementById('ep-city').value;
  if (!name) return alert('Ad soyad zorunludur.');
  if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return alert('Kullanıcı adı sadece İngilizce harf, rakam ve alt çizgi içerebilir (en az 3 karakter).');
  }
  try {
    if (username && username !== (currentUserProfile && currentUserProfile.username)) {
      const existing = await db.collection('users').where('username', '==', username).limit(1).get();
      if (!existing.empty) return alert('Bu kullanıcı adı alınmış, başka bir tane dene.');
    }
    await db.collection('users').doc(currentUser.uid).set(
      { displayName: name, username: username || null, phone: phone || null, city: city || null },
      { merge: true }
    );
    await refreshCurrentUserProfile();
    closeModal();
    toast('Profil güncellendi');
    render();
  } catch (e) {
    alert('Hata: ' + e.message);
  }
}

/* ---------------- Pazar Yeri (Marketplace) ---------------- */

let cachedListings = [];

function marketCardHtml(l) {
  const mine = currentUser && l.sellerId === currentUser.uid;
  const meta = [l.city, l.weight ? formatWeight(l.weight) : null, l.age].filter(Boolean).map(escapeHtml).join(' · ');
  return `
        <div class="card" style="padding:0;overflow:hidden;cursor:pointer;" onclick="openListing('${l.id}')">
          <div class="photo-header" style="border-radius:0;height:150px;position:relative;">
            ${l.photoUrl ? `<img src="${l.photoUrl}">` : cowIconSvg(52)}
            ${mine ? '<div class="badge" style="position:absolute;top:12px;left:12px;background:var(--text);color:var(--bg);">Benim ilanım</div>' : ''}
            ${l.status === 'sold' ? '<div class="badge badge-satildi" style="position:absolute;top:12px;right:12px;">Satıldı</div>' : ''}
          </div>
          <div style="padding:14px 16px 16px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">
              <div style="font-size:17px;font-weight:800;line-height:1.3;flex:1;">${escapeHtml(l.title)}</div>
              <div style="font-family:var(--font-heading);font-size:20px;color:var(--primary-active);white-space:nowrap;">${formatMoney(l.price)}</div>
            </div>
            ${meta ? `<div style="font-size:14px;font-weight:600;color:var(--muted);margin-top:8px;">${meta}</div>` : ''}
            ${
              isAdminUser && state.moderationMode
                ? `<div style="margin-top:13px;padding-top:13px;border-top:1px dashed var(--border);display:flex;justify-content:flex-end;">
                    <button class="chip" style="height:40px;background:var(--red-light);color:var(--red-deep);border-color:var(--red);" onclick="event.stopPropagation(); adminDeleteListing('${l.id}')">🗑 Kaldır</button>
                  </div>`
                : ''
            }
          </div>
        </div>`;
}

function filteredListings() {
  let listings = cachedListings.slice();
  if (state.marketMineOnly && currentUser) {
    listings = listings.filter((l) => l.sellerId === currentUser.uid);
  }
  if (state.marketSearch.trim()) {
    const q = state.marketSearch.trim().toLowerCase();
    listings = listings.filter(
      (l) =>
        (l.title || '').toLowerCase().includes(q) ||
        (l.city || '').toLowerCase().includes(q) ||
        (l.breed || '').toLowerCase().includes(q)
    );
  }
  return listings;
}

function marketResultsHtml(listings) {
  if (!listings.length) {
    return `<div class="empty-state">
          <svg viewBox="0 0 160 160" width="140" height="140"><circle cx="80" cy="80" r="76" fill="#e1eecc"></circle><g fill="none" stroke="#7a8a5e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><rect x="30" y="52" width="100" height="60" rx="18"></rect><path d="M52 112 L44 132"></path><path d="M108 112 L116 132"></path><path d="M30 74 H130"></path></g><circle cx="60" cy="63" r="5" fill="#7a8a5e"></circle><circle cx="100" cy="94" r="12" fill="none" stroke="#c67139" stroke-width="6"></circle></svg>
          <strong>${state.marketMineOnly ? 'Henüz ilanın yok' : 'Henüz ilan yok'}</strong>${state.marketMineOnly ? '' : 'İlk ilanı sen ver!'}
        </div>`;
  }
  return listings.map(marketCardHtml).join('');
}

function renderMarketResultsOnly() {
  const resultsEl = document.getElementById('market-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = marketResultsHtml(filteredListings());
}

function setMarketMineOnly(value, chipEl) {
  state.marketMineOnly = value;
  const row = document.getElementById('market-filter-chips');
  if (row) row.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  renderMarketResultsOnly();
}

async function renderMarket(root) {
  setTitle('Pazar Yeri');
  if (!window.firebaseReady) {
    root.innerHTML = `<div class="empty-state"><strong>İnternet bağlantısı yok</strong>Pazar Yeri için internete bağlanman gerekiyor.</div>`;
    return;
  }
  root.innerHTML = `<div class="empty-state">Yükleniyor...</div>`;
  try {
    const snap = await db.collection('listings').orderBy('createdAt', 'desc').limit(100).get();
    cachedListings = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

    root.innerHTML = `
      ${moderationBannerHtml()}
      <div class="search-row">
        <span>🔍</span>
        <input id="market-search-input" type="text" placeholder="Hayvan, şehir veya ırk ara..." value="${escapeHtml(state.marketSearch)}">
      </div>
      <div class="chip-row" id="market-filter-chips">
        <div class="chip ${!state.marketMineOnly ? 'active' : ''}" onclick="setMarketMineOnly(false, this)">Tümü</div>
        <div class="chip ${state.marketMineOnly ? 'active' : ''}" onclick="setMarketMineOnly(true, this)">Benim ilanlarım</div>
      </div>
      <div id="market-results">${marketResultsHtml(filteredListings())}</div>
      <button class="fab" onclick="openListingForm()">+</button>
    `;
    const input = document.getElementById('market-search-input');
    input.addEventListener('input', (e) => {
      state.marketSearch = e.target.value;
      renderMarketResultsOnly();
    });
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><strong>Yüklenemedi</strong>${escapeHtml(e.message)}</div>`;
  }
}

function openListing(id) {
  state.tab = 'market';
  state.listingId = id;
  render();
}

async function renderListingDetail(root, id) {
  setTitle('İlan');
  root.innerHTML = `<div class="empty-state">Yükleniyor...</div>`;
  try {
    const doc = await db.collection('listings').doc(id).get();
    if (!doc.exists) {
      root.innerHTML = `<div class="empty-state"><strong>İlan bulunamadı</strong>Silinmiş olabilir.</div><button class="btn btn-ghost" onclick="state.listingId=null; render();">← Geri</button>`;
      return;
    }
    const l = doc.data();
    const isOwner = currentUser && l.sellerId === currentUser.uid;
    const phoneDigits = (l.sellerPhone || '').replace(/\D/g, '');
    const specs = [
      l.species ? { k: 'Tür', v: l.species } : null,
      l.breed ? { k: 'Irk', v: l.breed } : null,
      l.weight ? { k: 'Ağırlık', v: formatWeight(l.weight) } : null,
      l.age ? { k: 'Yaş', v: l.age } : null,
    ].filter(Boolean);
    const initials = (l.sellerName || '?').trim().slice(0, 2).toUpperCase();

    root.innerHTML = `
      <button class="btn btn-ghost" style="margin-bottom:12px;" onclick="state.listingId=null; render();">← Geri</button>

      ${
        l.photoUrl
          ? `<div class="photo-header" style="height:220px;" onclick="openPhotoLightbox('${l.photoUrl}')"><img src="${l.photoUrl}"></div>`
          : `<div class="photo-header" style="height:220px;">${cowIconSvg(64)}</div>`
      }

      <div style="padding-top:18px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-family:var(--font-heading);font-size:34px;line-height:1.05;color:var(--primary-active);">${formatMoney(l.price)}</div>
          ${l.status === 'sold' ? '<div class="badge badge-satildi">Satıldı</div>' : ''}
        </div>
        <div style="font-size:20px;font-weight:800;margin-top:8px;line-height:1.3;">${escapeHtml(l.title)}</div>
        <div style="font-size:14.5px;font-weight:600;color:var(--muted);margin-top:6px;">${escapeHtml(l.city || '')} · ${timeAgoOrDate(l.createdAt)}</div>

        ${
          specs.length
            ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0;">
                ${specs.map((s) => `<div class="card" style="padding:13px 15px;margin-bottom:0;"><div style="font-size:13px;font-weight:700;color:var(--muted);">${s.k}</div><div style="font-size:17px;font-weight:800;margin-top:3px;">${escapeHtml(s.v)}</div></div>`).join('')}
              </div>`
            : ''
        }

        ${l.description ? `<div style="font-size:15.5px;font-weight:500;line-height:1.6;color:var(--text-soft);">${escapeHtml(l.description)}</div>` : ''}

        <div class="card" style="margin-top:18px;display:flex;align-items:center;gap:14px;">
          <div class="avatar-initials" style="width:54px;height:54px;background:var(--sage);color:var(--card);font-size:19px;">${escapeHtml(initials)}</div>
          <div style="flex:1;"><div style="font-size:17px;font-weight:800;">${escapeHtml(l.sellerName || '')}</div><div style="font-size:13.5px;font-weight:600;color:var(--muted);margin-top:2px;">${escapeHtml(l.city || '')}</div></div>
        </div>

        ${
          phoneDigits
            ? `<div class="btn-row" style="margin-top:14px;">
                <a class="btn btn-primary" style="text-decoration:none;background:var(--text);color:var(--bg);" href="tel:${phoneDigits}">📞 Ara</a>
                <a class="btn btn-primary" style="text-decoration:none;" href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener">💬 WhatsApp</a>
              </div>`
            : ''
        }
        <div style="margin-top:14px;font-size:13px;font-weight:600;color:var(--muted);text-align:center;line-height:1.5;">Alışveriş satıcıyla aranızda — uygulamada ödeme yok.</div>

        ${
          isOwner || isAdminUser
            ? `<div class="btn-row" style="margin-top:16px;">
                ${l.status !== 'sold' ? `<button class="btn btn-ghost" onclick="markListingSold('${id}')">Satıldı Olarak İşaretle</button>` : ''}
                <button class="btn btn-danger" onclick="confirmDeleteListing('${id}')">Sil</button>
              </div>`
            : ''
        }
      </div>
    `;
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><strong>Yüklenemedi</strong>${escapeHtml(e.message)}</div>`;
  }
}

async function markListingSold(id) {
  try {
    await db.collection('listings').doc(id).update({ status: 'sold' });
    renderListingDetail(document.getElementById('view-root'), id);
    toast('İlan satıldı olarak işaretlendi');
  } catch (e) {
    alert('Hata: ' + e.message);
  }
}

function confirmDeleteListing(id) {
  if (!confirmDialog('Bu ilanı silmek istiyor musunuz?')) return;
  db.collection('listings')
    .doc(id)
    .delete()
    .then(() => {
      state.listingId = null;
      toast('İlan silindi');
      render();
    })
    .catch((e) => alert('Hata: ' + e.message));
}

function openListingForm(preselectAnimalId) {
  if (!requireLogin('İlan vermek')) return;
  const p = currentUserProfile || {};
  const trackedAnimals = listAnimals().filter((a) => a.status === 'aktif');
  const body = `
    ${
      trackedAnimals.length
        ? `<label class="field"><span class="field-label">Kayıtlı hayvanlarından doldur (opsiyonel)</span>
      <select id="lf-from-animal" onchange="fillListingFromAnimal(this.value)">
        <option value="">— Manuel gir —</option>
        ${trackedAnimals.map((a) => `<option value="${a.id}" ${preselectAnimalId && Number(preselectAnimalId) === a.id ? 'selected' : ''}>${escapeHtml(a.ear_tag)}${a.name ? ' · ' + escapeHtml(a.name) : ''}</option>`).join('')}
      </select></label>`
        : ''
    }
    <div class="photo-picker">
      <button type="button" class="avatar-lg" id="lf-photo-btn" onclick="document.getElementById('lf-photo-input').click()">
        <span id="lf-photo-preview-text">📷<br>Fotoğraf Ekle</span>
      </button>
      <input type="file" id="lf-photo-input" accept="image/*" capture="environment" class="hidden">
    </div>
    <label class="field"><span class="field-label">Başlık <span class="required">*</span></span><input type="text" id="lf-title" placeholder="Ör. Simmental Dişi Dana"></label>
    <label class="field"><span class="field-label">Tür</span>
      <select id="lf-species">${SPECIES_OPTIONS.map((s) => `<option value="${s}">${s}</option>`).join('')}</select>
    </label>
    <label class="field"><span class="field-label">Irk</span><input type="text" id="lf-breed" placeholder="Ör. Simmental"></label>
    <label class="field"><span class="field-label">Ağırlık (kg)</span><input type="number" step="0.1" id="lf-weight" placeholder="Ör. 350"></label>
    <label class="field"><span class="field-label">Yaş</span><input type="text" id="lf-age" placeholder="Ör. 8 aylık"></label>
    <label class="field"><span class="field-label">Fiyat (₺) <span class="required">*</span></span><input type="number" step="0.01" id="lf-price" placeholder="Ör. 65000"></label>
    <label class="field"><span class="field-label">Şehir</span><input type="text" id="lf-city" value="${escapeHtml(p.city || '')}" placeholder="Ör. Şanlıurfa"></label>
    <label class="field"><span class="field-label">Açıklama</span><textarea id="lf-description" placeholder="Detaylar, sağlık durumu vb."></textarea></label>
    <button class="btn btn-primary" id="lf-submit-btn" onclick="submitListingForm()">İlanı Yayınla</button>
  `;
  openModal('Yeni İlan', body, () => {
    document.getElementById('lf-photo-input').addEventListener('change', handleListingPhotoInput);
    if (preselectAnimalId) fillListingFromAnimal(preselectAnimalId);
  });
}

let pendingListingPhotoBlob = null;

function fillListingFromAnimal(animalId) {
  if (!animalId) return;
  const a = getAnimal(Number(animalId));
  if (!a) return;
  document.getElementById('lf-title').value = `${a.breed || a.species} ${a.name ? '· ' + a.name : ''}`.trim();
  document.getElementById('lf-species').value = a.species;
  document.getElementById('lf-breed').value = a.breed || '';
  const w = latestWeightFor(a.id);
  document.getElementById('lf-weight').value = w ? w.weight : a.entry_weight || '';
  if (a.photo_uri) {
    document.getElementById('lf-photo-btn').innerHTML = `<img src="${a.photo_uri}">`;
    fetch(a.photo_uri)
      .then((r) => r.blob())
      .then((b) => (pendingListingPhotoBlob = b));
  }
}

async function handleListingPhotoInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const blob = await resizeImageToBlob(file, 800, 0.75);
    pendingListingPhotoBlob = blob;
    const url = URL.createObjectURL(blob);
    document.getElementById('lf-photo-btn').innerHTML = `<img src="${url}">`;
  } catch (err) {
    alert('Fotoğraf işlenemedi.');
  }
}

async function submitListingForm() {
  const title = document.getElementById('lf-title').value.trim();
  const price = toNumberOrNull(document.getElementById('lf-price').value);
  if (!title) return alert('Başlık zorunludur.');
  if (price === null) return alert('Geçerli bir fiyat girin.');

  const btn = document.getElementById('lf-submit-btn');
  btn.textContent = 'Yayınlanıyor...';
  btn.disabled = true;

  try {
    if (pendingListingPhotoBlob) {
      const check = await moderateAnimalPhoto(pendingListingPhotoBlob);
      if (!check.ok) {
        alert('Yüklediğin fotoğrafta bir hayvan tespit edilemedi. Lütfen hayvanın net görüldüğü bir fotoğraf seç.');
        btn.textContent = 'İlanı Yayınla';
        btn.disabled = false;
        return;
      }
    }

    const docRef = await db.collection('listings').add({
      sellerId: currentUser.uid,
      sellerName: (currentUserProfile && currentUserProfile.displayName) || currentUser.email,
      sellerPhone: (currentUserProfile && currentUserProfile.phone) || null,
      title,
      species: document.getElementById('lf-species').value,
      breed: document.getElementById('lf-breed').value.trim() || null,
      weight: toNumberOrNull(document.getElementById('lf-weight').value),
      age: document.getElementById('lf-age').value.trim() || null,
      price,
      city: document.getElementById('lf-city').value.trim() || null,
      description: document.getElementById('lf-description').value.trim() || null,
      photoUrl: null,
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (pendingListingPhotoBlob) {
      const url = await uploadPhoto(`listings/${docRef.id}/photo.jpg`, pendingListingPhotoBlob);
      await docRef.update({ photoUrl: url });
    }

    pendingListingPhotoBlob = null;
    closeModal();
    toast('İlan yayınlandı');
    openListing(docRef.id);
  } catch (e) {
    alert('Hata: ' + e.message);
    btn.textContent = 'İlanı Yayınla';
    btn.disabled = false;
  }
}

/* ---------------- Topluluk (Community) ---------------- */

async function renderCommunity(root) {
  setTitle('Topluluk');
  if (!window.firebaseReady) {
    root.innerHTML = `<div class="empty-state"><strong>İnternet bağlantısı yok</strong>Topluluk için internete bağlanman gerekiyor.</div>`;
    return;
  }
  root.innerHTML = `<div class="empty-state">Yükleniyor...</div>`;
  try {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(100).get();
    let posts = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    if (state.communityMineOnly && currentUser) {
      posts = posts.filter((p) => p.authorId === currentUser.uid);
    }

    const html = posts.length
      ? posts
          .map((p) => {
            const initials = (p.authorName || '?').trim().slice(0, 2).toUpperCase();
            return `
        <div class="card" style="cursor:pointer;" onclick="openPost('${p.id}')">
          <div style="display:flex;gap:12px;align-items:center;">
            <div class="avatar-initials" style="width:44px;height:44px;background:var(--sage-light);color:var(--sage-dark);font-size:16px;">${escapeHtml(initials)}</div>
            <div style="flex:1;"><div style="font-size:16px;font-weight:800;">${escapeHtml(p.authorName || '')}</div><div style="font-size:13px;font-weight:600;color:var(--muted);margin-top:2px;">${escapeHtml(p.authorCity || '')}${p.authorCity ? ' · ' : ''}${timeAgoOrDate(p.createdAt)}</div></div>
          </div>
          <div style="font-size:15px;font-weight:700;margin-top:12px;">${escapeHtml(p.title)}</div>
          <div style="font-size:14.5px;font-weight:500;line-height:1.5;margin-top:6px;color:var(--text-soft);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.body || '')}</div>
          ${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;height:140px;object-fit:cover;border-radius:24px;margin-top:12px;">` : ''}
          <div style="margin-top:14px;display:flex;align-items:center;gap:10px;">
            <span style="height:40px;padding:0 16px;border-radius:999px;display:inline-flex;align-items:center;font-size:13.5px;font-weight:700;color:var(--muted);border:1px solid var(--border);">💬 ${p.commentCount || 0} cevap</span>
            ${
              isAdminUser && state.moderationMode
                ? `<button class="chip" style="height:40px;background:var(--red-light);color:var(--red-deep);border-color:var(--red);" onclick="event.stopPropagation(); adminDeletePost('${p.id}')">🗑 Kaldır</button>`
                : ''
            }
          </div>
        </div>`;
          })
          .join('')
      : `<div class="empty-state"><strong>${state.communityMineOnly ? 'Henüz gönderin yok' : 'Henüz gönderi yok'}</strong>${state.communityMineOnly ? '' : 'Hayvanınla ilgili bir soru veya durum paylaşabilirsin.'}</div>`;

    root.innerHTML = `
      ${moderationBannerHtml()}
      <div class="chip-row">
        <div class="chip ${!state.communityMineOnly ? 'active' : ''}" onclick="state.communityMineOnly=false; render();">Tümü</div>
        <div class="chip ${state.communityMineOnly ? 'active' : ''}" onclick="state.communityMineOnly=true; render();">Benim gönderilerim</div>
      </div>
      ${html}
      <button class="fab" onclick="openPostForm()">+</button>
    `;
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><strong>Yüklenemedi</strong>${escapeHtml(e.message)}</div>`;
  }
}

function openPost(id) {
  state.tab = 'community';
  state.postId = id;
  render();
}

async function renderPostDetail(root, id) {
  setTitle('Gönderi');
  root.innerHTML = `<div class="empty-state">Yükleniyor...</div>`;
  try {
    const [postDoc, commentsSnap] = await Promise.all([
      db.collection('posts').doc(id).get(),
      db.collection('posts').doc(id).collection('comments').orderBy('createdAt', 'asc').get(),
    ]);
    if (!postDoc.exists) {
      root.innerHTML = `<div class="empty-state"><strong>Gönderi bulunamadı</strong></div><button class="btn btn-ghost" onclick="state.postId=null; render();">← Geri</button>`;
      return;
    }
    const p = postDoc.data();
    const isOwner = currentUser && p.authorId === currentUser.uid;
    const comments = commentsSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

    const initials = (p.authorName || '?').trim().slice(0, 2).toUpperCase();
    root.innerHTML = `
      <button class="btn btn-ghost" style="margin-bottom:12px;" onclick="state.postId=null; render();">← Geri</button>
      <div class="card">
        <div style="display:flex;gap:12px;align-items:center;">
          <div class="avatar-initials" style="width:44px;height:44px;background:var(--sage-light);color:var(--sage-dark);font-size:16px;">${escapeHtml(initials)}</div>
          <div style="flex:1;"><div style="font-size:16px;font-weight:800;">${escapeHtml(p.authorName || '')}</div><div style="font-size:13px;font-weight:600;color:var(--muted);margin-top:2px;">${escapeHtml(p.authorCity || '')}${p.authorCity ? ' · ' : ''}${timeAgoOrDate(p.createdAt)}</div></div>
        </div>
        <div style="font-size:18px;font-weight:800;margin-top:14px;">${escapeHtml(p.title)}</div>
        <div style="font-size:15px;font-weight:500;margin-top:8px;white-space:pre-wrap;line-height:1.55;color:var(--text-soft);">${escapeHtml(p.body || '')}</div>
        ${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;border-radius:24px;margin-top:12px;cursor:zoom-in;" onclick="openPhotoLightbox('${p.photoUrl}')">` : ''}
        ${
          isOwner || isAdminUser
            ? `<div class="btn-row" style="margin-top:14px;"><button class="btn btn-danger" onclick="confirmDeletePost('${id}')">Gönderiyi Sil</button></div>`
            : ''
        }
      </div>
      <div class="card">
        <div class="section-title-row"><h3>Yorumlar (${comments.length})</h3></div>
        ${
          comments.length
            ? comments
                .map(
                  (c) => `
          <div class="list-row">
            <div class="body">
              <div class="title">${escapeHtml(c.authorName || '')}</div>
              <div class="subtitle">${timeAgoOrDate(c.createdAt)}</div>
              <div class="note" style="font-style:normal;margin-top:4px;">${escapeHtml(c.body)}</div>
            </div>
            ${
              (currentUser && c.authorId === currentUser.uid) || isAdminUser
                ? `<button class="delete-btn" onclick="confirmDeleteComment('${id}','${c.id}')">🗑</button>`
                : ''
            }
          </div>`
                )
                .join('')
            : '<div class="empty-state">Henüz yorum yok</div>'
        }
        ${
          currentUser
            ? `<div style="margin-top:12px;">
                <textarea id="comment-input" placeholder="Yorum yaz..." style="min-height:60px;"></textarea>
                <button class="btn btn-primary" style="margin-top:8px;" onclick="submitComment('${id}')">Gönder</button>
              </div>`
            : `<div style="margin-top:12px;font-size:13px;color:var(--muted);">Yorum yapmak için <a href="#" onclick="state.tab='account'; state.postId=null; render(); return false;">giriş yap</a>.</div>`
        }
      </div>
    `;
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><strong>Yüklenemedi</strong>${escapeHtml(e.message)}</div>`;
  }
}

function confirmDeletePost(id) {
  if (!confirmDialog('Bu gönderiyi silmek istiyor musunuz?')) return;
  db.collection('posts')
    .doc(id)
    .delete()
    .then(() => {
      state.postId = null;
      toast('Gönderi silindi');
      render();
    })
    .catch((e) => alert('Hata: ' + e.message));
}

function confirmDeleteComment(postId, commentId) {
  if (!confirmDialog('Bu yorumu silmek istiyor musunuz?')) return;
  db.collection('posts')
    .doc(postId)
    .collection('comments')
    .doc(commentId)
    .delete()
    .then(() => {
      db.collection('posts')
        .doc(postId)
        .update({ commentCount: firebase.firestore.FieldValue.increment(-1) })
        .catch(() => {});
      renderPostDetail(document.getElementById('view-root'), postId);
    })
    .catch((e) => alert('Hata: ' + e.message));
}

async function submitComment(postId) {
  const body = document.getElementById('comment-input').value.trim();
  if (!body) return;
  try {
    await db.collection('posts').doc(postId).collection('comments').add({
      authorId: currentUser.uid,
      authorName: (currentUserProfile && currentUserProfile.displayName) || currentUser.email,
      body,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db
      .collection('posts')
      .doc(postId)
      .update({ commentCount: firebase.firestore.FieldValue.increment(1) });
    renderPostDetail(document.getElementById('view-root'), postId);
  } catch (e) {
    alert('Hata: ' + e.message);
  }
}

let pendingPostPhotoBlob = null;

function openPostForm() {
  if (!requireLogin('Gönderi paylaşmak')) return;
  pendingPostPhotoBlob = null;
  const body = `
    <div class="photo-picker">
      <button type="button" class="avatar-lg" id="pf-photo-btn" onclick="document.getElementById('pf-photo-input').click()">
        <span>📷<br>Fotoğraf Ekle (opsiyonel)</span>
      </button>
      <input type="file" id="pf-photo-input" accept="image/*" capture="environment" class="hidden">
    </div>
    <label class="field"><span class="field-label">Başlık <span class="required">*</span></span><input type="text" id="pf-title" placeholder="Ör. Buzağımda topallık var"></label>
    <label class="field"><span class="field-label">Açıklama <span class="required">*</span></span><textarea id="pf-body" placeholder="Durumu detaylandır..."></textarea></label>
    <button class="btn btn-primary" id="pf-submit-btn" onclick="submitPostForm()">Paylaş</button>
  `;
  openModal('Yeni Gönderi', body, () => {
    document.getElementById('pf-photo-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        pendingPostPhotoBlob = await resizeImageToBlob(file, 800, 0.75);
        const url = URL.createObjectURL(pendingPostPhotoBlob);
        document.getElementById('pf-photo-btn').innerHTML = `<img src="${url}">`;
      } catch {
        alert('Fotoğraf işlenemedi.');
      }
    });
  });
}

async function submitPostForm() {
  const title = document.getElementById('pf-title').value.trim();
  const body = document.getElementById('pf-body').value.trim();
  if (!title || !body) return alert('Başlık ve açıklama zorunludur.');

  const btn = document.getElementById('pf-submit-btn');
  btn.textContent = 'Paylaşılıyor...';
  btn.disabled = true;

  try {
    if (pendingPostPhotoBlob) {
      const check = await moderateAnimalPhoto(pendingPostPhotoBlob);
      if (!check.ok) {
        alert('Yüklediğin fotoğrafta bir hayvan tespit edilemedi. Lütfen hayvanın net görüldüğü bir fotoğraf seç.');
        btn.textContent = 'Paylaş';
        btn.disabled = false;
        return;
      }
    }

    const docRef = await db.collection('posts').add({
      authorId: currentUser.uid,
      authorName: (currentUserProfile && currentUserProfile.displayName) || currentUser.email,
      authorCity: (currentUserProfile && currentUserProfile.city) || null,
      title,
      body,
      photoUrl: null,
      commentCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    if (pendingPostPhotoBlob) {
      const url = await uploadPhoto(`posts/${docRef.id}/photo.jpg`, pendingPostPhotoBlob);
      await docRef.update({ photoUrl: url });
    }

    pendingPostPhotoBlob = null;
    closeModal();
    toast('Gönderi paylaşıldı');
    openPost(docRef.id);
  } catch (e) {
    alert('Hata: ' + e.message);
    btn.textContent = 'Paylaş';
    btn.disabled = false;
  }
}

/* ---------------- More menu ---------------- */

function renderMoreMenu(root) {
  setTitle('Diğer');
  const reminderCount = upcomingVaccinations(7).length;
  const rows = [
    { label: 'Hatırlatıcılar', sub: 'Yaklaşan ve geciken aşılar', icon: '💉', bg: 'var(--primary-light)', badge: reminderCount || null, on: 'reminders' },
    { label: 'Özet', sub: 'Alış, satış, gider ve net kâr', icon: '📊', bg: 'var(--sage-light)', badge: null, on: 'summary' },
    { label: 'Yedekleme', sub: 'JSON indir / cihazdan yükle', icon: '⬇️', bg: 'var(--card-alt)', badge: null, on: 'settings' },
  ];
  if (isAdminUser) rows.push({ label: 'Yönetici Paneli', sub: 'Kullanıcılar, ilanlar, gönderiler', icon: '🛡️', bg: 'var(--primary-light)', badge: null, on: 'admin' });

  root.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${rows
        .map(
          (r) => `
      <div class="card" style="display:flex;align-items:center;gap:14px;cursor:pointer;padding:17px 18px;" onclick="goMore('${r.on}')">
        <div style="width:46px;height:46px;border-radius:999px;background:${r.bg};display:flex;align-items:center;justify-content:center;flex:none;font-size:20px;">${r.icon}</div>
        <div style="flex:1;"><div style="font-size:17.5px;font-weight:800;">${r.label}</div><div style="font-size:13.5px;font-weight:600;color:var(--muted);margin-top:2px;">${r.sub}</div></div>
        ${r.badge ? `<div style="height:32px;min-width:32px;padding:0 11px;border-radius:999px;background:var(--primary);color:var(--bg);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex:none;">${r.badge}</div>` : ''}
      </div>`
        )
        .join('')}
    </div>
  `;
}

/* ---------------- Admin panel ---------------- */

async function renderAdmin(root) {
  setTitle('Yönetici Paneli');
  if (!isAdminUser) {
    root.innerHTML = `${moreBackButton()}<div class="empty-state"><strong>Yetkisiz</strong>Bu sayfayı görüntüleme yetkin yok.</div>`;
    return;
  }
  root.innerHTML = `${moreBackButton()}<div class="empty-state">Yükleniyor...</div>`;
  try {
    const [usersSnap, listingsSnap, postsSnap] = await Promise.all([
      db.collection('users').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('listings').orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('posts').orderBy('createdAt', 'desc').limit(200).get(),
    ]);
    const users = usersSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    const listings = listingsSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    const posts = postsSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));

    const userRows = users
      .map((u) => {
        const initials = (u.displayName || u.email || '?').trim().slice(0, 2).toUpperCase();
        return `
      <div class="card" style="display:flex;gap:12px;align-items:center;">
        <div class="avatar-initials" style="width:44px;height:44px;background:var(--card-alt);color:var(--muted);font-size:15px;">${escapeHtml(initials)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.displayName || u.email)}</div>
          <div style="font-size:13px;font-weight:600;color:var(--muted);margin-top:2px;">${escapeHtml(u.city || '')}${u.banned ? ' · Engelli' : ''}${u.muted ? ' · Susturulmuş' : ''}</div>
        </div>
        <button class="chip" style="height:44px;${u.banned ? 'background:var(--red-light);color:var(--red-deep);border-color:var(--red);' : ''}" onclick="toggleUserFlag('${u.id}','banned',${!u.banned})">${u.banned ? 'Engeli Kaldır' : 'Engelle'}</button>
      </div>`;
      })
      .join('');

    const listingRows = listings
      .map(
        (l) => `
      <div class="card" style="display:flex;gap:12px;align-items:center;">
        <div style="flex:1;min-width:0;"><div style="font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(l.title)}</div><div style="font-size:13px;font-weight:600;color:var(--muted);margin-top:2px;">${escapeHtml(l.sellerName || '')} · ${formatMoney(l.price)}</div></div>
        <button class="chip" style="height:44px;background:var(--red-light);color:var(--red-deep);border-color:var(--red);" onclick="adminDeleteListing('${l.id}')">Sil</button>
      </div>`
      )
      .join('');

    const postRows = posts
      .map(
        (p) => `
      <div class="card" style="display:flex;gap:12px;align-items:center;">
        <div style="flex:1;min-width:0;"><div style="font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.title)}</div><div style="font-size:13px;font-weight:600;color:var(--muted);margin-top:2px;">${escapeHtml(p.authorName || '')}</div></div>
        <button class="chip" style="height:44px;background:var(--red-light);color:var(--red-deep);border-color:var(--red);" onclick="adminDeletePost('${p.id}')">Sil</button>
      </div>`
      )
      .join('');

    const tabs = [
      ['kullanici', `Kullanıcılar (${users.length})`],
      ['ilan', `İlanlar (${listings.length})`],
      ['gonderi', `Gönderiler (${posts.length})`],
    ];
    const bodies = { kullanici: userRows || '<div class="empty-state">Kullanıcı yok</div>', ilan: listingRows || '<div class="empty-state">İlan yok</div>', gonderi: postRows || '<div class="empty-state">Gönderi yok</div>' };

    root.innerHTML = `
      ${moreBackButton()}
      <div class="seg-row">
        ${tabs.map(([k, l]) => `<div class="seg-opt ${state.adminTab === k ? 'active' : ''}" onclick="setAdminTab('${k}')">${l}</div>`).join('')}
      </div>
      ${bodies[state.adminTab]}
    `;
  } catch (e) {
    root.innerHTML = `${moreBackButton()}<div class="empty-state"><strong>Yüklenemedi</strong>${escapeHtml(e.message)}</div>`;
  }
}

function setAdminTab(tab) {
  state.adminTab = tab;
  render();
}

async function toggleUserFlag(uid, field, value) {
  try {
    await db.collection('users').doc(uid).update({ [field]: value });
    renderAdmin(document.getElementById('view-root'));
  } catch (e) {
    alert('Hata: ' + e.message);
  }
}

function adminDeleteListing(id) {
  if (!confirmDialog('Bu ilanı silmek istiyor musunuz?')) return;
  db.collection('listings')
    .doc(id)
    .delete()
    .then(() => {
      toast('İlan kaldırıldı');
      render();
    })
    .catch((e) => alert('Hata: ' + e.message));
}

function adminDeletePost(id) {
  if (!confirmDialog('Bu gönderiyi silmek istiyor musunuz?')) return;
  db.collection('posts')
    .doc(id)
    .delete()
    .then(() => {
      toast('Gönderi kaldırıldı');
      render();
    })
    .catch((e) => alert('Hata: ' + e.message));
}

/* ---------------- Animal detail ---------------- */

function vaccineStatusInfo(v) {
  if (!v.next_date) return { label: 'Sonraki doz girilmedi', color: 'var(--muted)', border: 'var(--border)' };
  const remaining = daysUntil(v.next_date);
  if (remaining < 0) return { label: `${Math.abs(remaining)} gün geçti`, color: 'var(--red)', border: 'var(--red)' };
  if (remaining <= 14) return { label: `${remaining} gün kaldı`, color: 'var(--primary-active)', border: '#f6a06b' };
  return { label: 'Zamanında', color: 'var(--sage-dark)', border: 'var(--border)' };
}

function renderDetail(root, id) {
  const animal = getAnimal(id);
  if (!animal) {
    closeDetail();
    return;
  }
  setTitle(animal.ear_tag);
  const weights = listWeights(id);
  const vaccinations = listVaccinations(id);
  const health = listHealth(id);
  const expenses = listExpenses(id);
  const latest = weights[0];
  const gain = dailyGainFor(animal);
  const daysInPen = Math.max(0, daysBetween(animal.entry_date, todayIso()));
  const expenseTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const statCards = [
    { k: 'Güncel kilo', v: formatWeight(latest ? latest.weight : animal.entry_weight) },
    { k: 'Günlük kazanç', v: gain !== null ? gain.toFixed(2) : '-' },
    { k: 'Ahırda', v: `${daysInPen} gün` },
  ];

  const tabs = [
    ['kilo', 'Kilo'],
    ['asi', 'Aşı'],
    ['saglik', 'Sağlık'],
    ['gider', 'Gider'],
  ];

  const sparkline = renderSparklineHtml(weights.slice().reverse());
  const firstW = weights[weights.length - 1];
  const weightDeltaText =
    weights.length >= 2
      ? `${latest.weight - firstW.weight >= 0 ? '+' : ''}${(latest.weight - firstW.weight).toFixed(1)} kg / ${daysBetween(firstW.date, latest.date)} gün`
      : '';

  let tabBody = '';
  if (state.detailTab === 'kilo') {
    tabBody = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">
          <div style="font-family:var(--font-heading);font-size:19px;">Kilo geçmişi</div>
          ${weightDeltaText ? `<div style="font-size:14px;font-weight:800;color:var(--primary-active);">${weightDeltaText}</div>` : ''}
        </div>
        ${sparkline || '<div class="empty-state">Henüz kilo kaydı yok</div>'}
        ${weights
          .map(
            (w) => `
        <div class="list-row">
          <div class="body"><div class="title">${formatWeight(w.weight)}</div><div class="subtitle">${formatDate(w.date)}</div>${w.note ? `<div class="note">${escapeHtml(w.note)}</div>` : ''}</div>
          <button class="delete-btn" onclick="confirmDeleteRecord('weight', ${w.id}, ${id})">🗑</button>
        </div>`
          )
          .join('')}
        <button class="btn btn-secondary" style="margin-top:16px;" onclick="openWeightForm(${id})">Yeni tartım gir</button>
      </div>`;
  } else if (state.detailTab === 'asi') {
    tabBody = vaccinations.length
      ? vaccinations
          .map((v) => {
            const info = vaccineStatusInfo(v);
            return `
        <div class="card" style="display:flex;gap:13px;align-items:center;border-color:${info.border};">
          <div style="width:12px;height:44px;border-radius:999px;background:${info.color};flex:none;"></div>
          <div style="flex:1;">
            <div style="font-size:17px;font-weight:800;">${escapeHtml(v.name)}</div>
            <div style="font-size:13.5px;font-weight:600;color:var(--muted);margin-top:3px;">Yapıldı ${formatDate(v.date)}${v.next_date ? ' · Sonraki ' + formatDate(v.next_date) : ''}</div>
          </div>
          <div style="font-size:13px;font-weight:800;color:${info.color};text-align:right;line-height:1.3;flex:none;max-width:82px;">${info.label}</div>
          <button class="delete-btn" onclick="confirmDeleteRecord('vaccination', ${v.id}, ${id})">🗑</button>
        </div>`;
          })
          .join('') + `<button class="btn btn-secondary" onclick="openVaccinationForm(${id})">Aşı Ekle</button>`
      : `<div class="empty-state"><strong>Henüz aşı kaydı yok</strong></div><button class="btn btn-secondary" onclick="openVaccinationForm(${id})">Aşı Ekle</button>`;
  } else if (state.detailTab === 'saglik') {
    tabBody = health.length
      ? health
          .map(
            (h) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">
            <div style="font-size:17px;font-weight:800;">${escapeHtml(h.diagnosis || HEALTH_TYPE_LABEL[h.type])}</div>
            <div style="font-size:13px;font-weight:700;color:var(--muted);">${formatDate(h.date)}</div>
          </div>
          <div style="font-size:13px;font-weight:700;color:${h.resolved ? 'var(--sage-dark)' : 'var(--primary-active)'};margin-top:4px;">${h.resolved ? 'İyileşti' : 'Devam ediyor'}</div>
          ${h.treatment ? `<div style="font-size:14.5px;font-weight:500;color:var(--text-soft);line-height:1.5;margin-top:6px;">${escapeHtml(h.treatment)}</div>` : ''}
          <button class="delete-btn" style="margin-top:6px;" onclick="confirmDeleteRecord('health', ${h.id}, ${id})">🗑 Sil</button>
        </div>`
          )
          .join('') + `<button class="btn btn-secondary" onclick="openHealthForm(${id})">Sağlık Kaydı Ekle</button>`
      : `<div class="empty-state"><strong>Henüz sağlık kaydı yok</strong></div><button class="btn btn-secondary" onclick="openHealthForm(${id})">Sağlık Kaydı Ekle</button>`;
  } else if (state.detailTab === 'gider') {
    tabBody = `
      <div class="card" style="padding:0;overflow:hidden;">
        ${
          expenses.length
            ? expenses
                .map(
                  (e) => `
        <div class="list-row" style="padding-left:16px;padding-right:16px;">
          <div class="body"><div class="title">${EXPENSE_LABEL[e.category]}</div><div class="subtitle">${formatDate(e.date)}${e.notes ? ' · ' + escapeHtml(e.notes) : ''}</div></div>
          <div style="font-size:17px;font-weight:900;">${formatMoney(e.amount)}</div>
          <button class="delete-btn" onclick="confirmDeleteRecord('expense', ${e.id}, ${id})">🗑</button>
        </div>`
                )
                .join('')
            : '<div class="empty-state" style="padding:16px;">Henüz gider kaydı yok</div>'
        }
        ${
          expenses.length
            ? `<div style="display:flex;align-items:center;justify-content:space-between;padding:16px;background:var(--card-alt);">
                <div style="font-family:var(--font-heading);font-size:17px;">Toplam</div>
                <div style="font-family:var(--font-heading);font-size:21px;color:var(--primary-active);">${formatMoney(expenseTotal)}</div>
              </div>`
            : ''
        }
      </div>
      <button class="btn btn-secondary" onclick="openExpenseForm(${id})">Gider Ekle</button>`;
  }

  root.innerHTML = `
    <button class="btn btn-ghost" style="margin-bottom:12px;" onclick="closeDetail()">← Geri</button>

    ${
      animal.photo_uri
        ? `<div class="photo-header" onclick="openPhotoLightbox('${animal.photo_uri}')"><img src="${animal.photo_uri}"></div>`
        : `<div class="photo-header" style="cursor:pointer;" onclick="openAnimalForm(${id})">${cowIconSvg(56)}</div>`
    }

    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0 4px;">
      <div>
        <div style="font-size:24px;font-weight:900;">${escapeHtml(animal.ear_tag)}</div>
        <div style="font-size:14px;font-weight:600;color:var(--muted);margin-top:2px;">${escapeHtml(animal.breed || animal.species)}${animal.gender ? ' · ' + (animal.gender === 'erkek' ? 'Erkek' : 'Dişi') : ''}${animal.pen ? ' · ' + escapeHtml(animal.pen) : ''}</div>
      </div>
      <div class="badge badge-${animal.status}">${STATUS_LABEL[animal.status]}</div>
    </div>

    <div class="stat-row" style="margin-top:12px;">
      ${statCards.map((s) => `<div class="stat-block outline"><div class="stat-label">${s.k}</div><div class="stat-value">${s.v}</div></div>`).join('')}
    </div>

    <div class="seg-row">
      ${tabs.map(([k, l]) => `<div class="seg-opt ${state.detailTab === k ? 'active' : ''}" onclick="setDetailTab('${k}')">${l}</div>`).join('')}
    </div>

    ${tabBody}

    <div class="card" style="margin-top:16px;">
      <div class="row"><span class="label">Doğum Tarihi</span><span class="value">${formatDate(animal.birth_date)}</span></div>
      <div class="row"><span class="label">Giriş Tarihi / Kilosu</span><span class="value">${formatDate(animal.entry_date)} · ${formatWeight(animal.entry_weight)}</span></div>
      <div class="row"><span class="label">Alış Fiyatı</span><span class="value">${formatMoney(animal.purchase_price)}</span></div>
      ${animal.source ? `<div class="row"><span class="label">Kaynak</span><span class="value">${escapeHtml(animal.source)}</span></div>` : ''}
      ${
        animal.status === 'satildi'
          ? `<div class="row"><span class="label">Satış Tarihi</span><span class="value">${formatDate(animal.exit_date)}</span></div>
             <div class="row"><span class="label">Satış Kilosu</span><span class="value">${formatWeight(animal.sale_weight)}</span></div>
             <div class="row"><span class="label">Satış Fiyatı</span><span class="value">${formatMoney(animal.sale_price)}</span></div>`
          : ''
      }
      ${animal.notes ? `<div class="row"><span class="label">Not</span><span class="value">${escapeHtml(animal.notes)}</span></div>` : ''}
    </div>

    <div class="btn-row" style="margin-top:6px;">
      ${animal.status === 'aktif' ? `<button class="btn btn-primary" onclick="openListingForm(${id})">Pazar Yeri'nde sat</button>` : ''}
      <button class="btn btn-ghost" onclick="openAnimalForm(${id})">Düzenle</button>
    </div>
    <button class="btn btn-danger" style="margin-top:10px;" onclick="confirmDeleteAnimal(${id})">Hayvanı Sil</button>
  `;
}

function setDetailTab(tab) {
  state.detailTab = tab;
  render();
}

function renderSparklineHtml(records) {
  if (records.length < 2) return '';
  const weights = records.map((r) => r.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const bars = records
    .map((r, i) => {
      const ratio = (r.weight - min) / range;
      const height = 6 + ratio * 58;
      const isLast = i === records.length - 1;
      return `<div class="bar-col"><div class="bar ${isLast ? 'last' : ''}" style="height:${height}px;"></div></div>`;
    })
    .join('');
  return `
    <div class="sparkline">${bars}</div>
    <div class="sparkline-labels">
      <span>${formatDate(records[0].date)} · ${formatWeight(records[0].weight)}</span>
      <span class="strong">${formatDate(records[records.length - 1].date)} · ${formatWeight(records[records.length - 1].weight)}</span>
    </div>`;
}

function confirmDeleteAnimal(id) {
  const animal = getAnimal(id);
  if (!animal) return;
  if (!confirmDialog(`${animal.ear_tag} küpe numaralı hayvanı ve tüm kayıtlarını silmek istediğinize emin misiniz?`)) return;
  deleteAnimal(id);
  closeDetail();
  toast('Hayvan silindi');
}

function confirmDeleteRecord(type, id, animalId) {
  if (!confirmDialog('Bu kaydı silmek istiyor musunuz?')) return;
  if (type === 'weight') deleteWeight(id);
  else if (type === 'vaccination') deleteVaccination(id);
  else if (type === 'health') deleteHealth(id);
  else if (type === 'expense') deleteExpense(id);
  render();
}

/* ---------------- Modal system ---------------- */

function openModal(title, bodyHtml, onMount) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-sheet">
        <div class="modal-header">
          <h2>${escapeHtml(title)}</h2>
          <button class="close-btn" onclick="closeModal()">✕</button>
        </div>
        ${bodyHtml}
      </div>
    </div>
  `;
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  if (onMount) onMount();
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

function openPhotoLightbox(uri) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="lightbox-overlay" id="lightbox-overlay" onclick="closeModal()">
      <img src="${uri}" class="lightbox-img">
    </div>
  `;
}

/* ---------------- Animal form ---------------- */

const SPECIES_OPTIONS = ['Sığır', 'Koyun', 'Keçi', 'Manda', 'Diğer'];

function chipSelectHtml(name, options, selected) {
  return options
    .map((o) => {
      const value = typeof o === 'string' ? o : o.value;
      const label = typeof o === 'string' ? o : o.label;
      const safeValue = escapeHtml(value).replace(/'/g, "\\'");
      return `<div class="chip ${selected === value ? 'active' : ''}" onclick="selectFormChip('${name}', '${safeValue}', this)">${escapeHtml(label)}</div>`;
    })
    .join('');
}

function selectFormChip(hiddenInputId, value, el) {
  const input = document.getElementById(hiddenInputId);
  if (input) input.value = value;
  el.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  el.classList.add('active');
}

function openAnimalForm(existingId) {
  const animal = existingId ? getAnimal(existingId) : null;
  const a = animal || {
    ear_tag: '', name: '', species: 'Sığır', breed: '', gender: null, birth_date: '',
    entry_date: todayIso(), entry_weight: '', purchase_price: '', source: '', pen: '',
    status: 'aktif', exit_date: '', sale_price: '', sale_weight: '', notes: '', photo_uri: null,
  };
  const pens = distinctPens();

  const body = `
    <div style="font-size:15px;font-weight:600;color:var(--text-soft);line-height:1.5;margin-bottom:16px;">Küpe no ve türü yaz, gerisi sonra. Acelesi yok.</div>

    <label class="field"><span class="field-label">Küpe Numarası <span class="required">*</span></span>
      <input type="text" id="af-ear-tag" value="${escapeHtml(a.ear_tag)}" placeholder="TR-1234-5678" autofocus></label>

    <div class="field">
      <span class="field-label">Tür <span class="required">*</span></span>
      <div class="chip-row" style="margin-bottom:0;">${chipSelectHtml('af-species', SPECIES_OPTIONS, a.species)}</div>
      <input type="hidden" id="af-species" value="${escapeHtml(a.species)}">
    </div>

    <button type="button" class="btn btn-ghost" id="af-toggle-detail" style="margin:6px 0 4px;" onclick="toggleAnimalFormDetail()">
      ${existingId ? 'Detayları gizle' : 'Detay ekle (kilo, fiyat, ahır, foto)'}
    </button>

    <div id="af-detail-fields" class="${existingId ? '' : 'hidden'}" style="margin-top:12px;">
      <div class="photo-picker">
        <button type="button" class="avatar-lg" id="af-photo-btn" onclick="document.getElementById('af-photo-input').click()">
          ${a.photo_uri ? `<img id="af-photo-preview" src="${a.photo_uri}">` : '<span id="af-photo-preview-text">📷<br>Fotoğraf Ekle</span>'}
        </button>
        <input type="file" id="af-photo-input" accept="image/*" capture="environment" class="hidden">
      </div>
      <input type="hidden" id="af-photo-data" value="${a.photo_uri ? escapeHtml(a.photo_uri) : ''}">

      <label class="field"><span class="field-label">İsim / Lakap</span>
        <input type="text" id="af-name" value="${escapeHtml(a.name || '')}" placeholder="Opsiyonel"></label>
      <label class="field"><span class="field-label">Cins / Irk</span>
        <input type="text" id="af-breed" value="${escapeHtml(a.breed || '')}" placeholder="Ör. Simmental"></label>

      <div class="field">
        <span class="field-label">Cinsiyet</span>
        <div class="chip-row" style="margin-bottom:0;">${chipSelectHtml('af-gender', [{ value: 'erkek', label: 'Erkek' }, { value: 'disi', label: 'Dişi' }], a.gender || '')}</div>
        <input type="hidden" id="af-gender" value="${a.gender || ''}">
      </div>

      <label class="field"><span class="field-label">Doğum Tarihi</span>
        <input type="date" id="af-birth-date" value="${a.birth_date || ''}"></label>
      <label class="field"><span class="field-label">Çiftliğe Giriş Tarihi <span class="required">*</span></span>
        <input type="date" id="af-entry-date" value="${a.entry_date}"></label>

      <div style="display:flex;gap:10px;">
        <label class="field" style="flex:1;"><span class="field-label">Giriş Kilosu (kg)</span>
          <input type="number" step="0.1" id="af-entry-weight" value="${a.entry_weight ?? ''}" placeholder="Ör. 320"></label>
        <label class="field" style="flex:1;"><span class="field-label">Alış Fiyatı (₺)</span>
          <input type="number" step="0.01" id="af-purchase-price" value="${a.purchase_price ?? ''}" placeholder="Ör. 45000"></label>
      </div>

      <label class="field"><span class="field-label">Nereden Alındı</span>
        <input type="text" id="af-source" value="${escapeHtml(a.source || '')}" placeholder="Pazar, yetiştirici vb."></label>

      <div class="field">
        <span class="field-label">Ahır / Bölme</span>
        ${pens.length ? `<div class="chip-row" style="margin-bottom:8px;">${chipSelectHtml('af-pen', pens, a.pen || '')}</div>` : ''}
        <input type="text" id="af-pen" value="${escapeHtml(a.pen || '')}" placeholder="Ör. A Bloğu (yeni yazabilirsin)">
      </div>

      <label class="field"><span class="field-label">Durum</span>
        <select id="af-status" onchange="toggleAnimalFormStatusFields()">
          <option value="aktif" ${a.status === 'aktif' ? 'selected' : ''}>Aktif</option>
          <option value="satildi" ${a.status === 'satildi' ? 'selected' : ''}>Satıldı</option>
          <option value="oldu" ${a.status === 'oldu' ? 'selected' : ''}>Öldü</option>
          <option value="kesildi" ${a.status === 'kesildi' ? 'selected' : ''}>Kesildi</option>
        </select>
      </label>

      <div id="af-exit-fields" class="${a.status === 'aktif' ? 'hidden' : ''}">
        <label class="field"><span class="field-label">Çıkış / Satış Tarihi</span>
          <input type="date" id="af-exit-date" value="${a.exit_date || ''}"></label>
      </div>
      <div id="af-sale-fields" class="${a.status === 'satildi' ? '' : 'hidden'}">
        <label class="field"><span class="field-label">Satış Kilosu (kg)</span>
          <input type="number" step="0.1" id="af-sale-weight" value="${a.sale_weight ?? ''}" placeholder="Ör. 480"></label>
        <label class="field"><span class="field-label">Satış Fiyatı (₺)</span>
          <input type="number" step="0.01" id="af-sale-price" value="${a.sale_price ?? ''}" placeholder="Ör. 78000"></label>
      </div>

      <label class="field"><span class="field-label">Notlar</span>
        <textarea id="af-notes" placeholder="Serbest not">${escapeHtml(a.notes || '')}</textarea></label>
    </div>

    <button class="btn btn-primary" style="margin-top:8px;" onclick="submitAnimalForm(${existingId || 'null'})">${existingId ? 'Değişiklikleri Kaydet' : 'Kaydet'}</button>
    ${existingId ? '' : '<div style="margin-top:12px;text-align:center;font-size:13.5px;font-weight:600;color:var(--muted);">Kaydettikten sonra detayları hayvanın sayfasından ekleyebilirsin.</div>'}
  `;

  openModal(existingId ? 'Hayvanı Düzenle' : 'Yeni Hayvan', body, () => {
    document.getElementById('af-photo-input').addEventListener('change', (e) => handlePhotoInput(e, 'af'));
  });
}

function toggleAnimalFormDetail() {
  const el = document.getElementById('af-detail-fields');
  const btn = document.getElementById('af-toggle-detail');
  const nowHidden = el.classList.toggle('hidden');
  btn.textContent = nowHidden ? 'Detay ekle (kilo, fiyat, ahır, foto)' : 'Detayları gizle';
}

function toggleAnimalFormStatusFields() {
  const status = document.getElementById('af-status').value;
  document.getElementById('af-exit-fields').classList.toggle('hidden', status === 'aktif');
  document.getElementById('af-sale-fields').classList.toggle('hidden', status !== 'satildi');
}

function handlePhotoInput(e, prefix) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 480;
      let w = img.width;
      let h = img.height;
      if (w > h && w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else if (h >= w && h > maxDim) {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById(`${prefix}-photo-data`).value = dataUrl;
      const btn = document.getElementById(`${prefix}-photo-btn`);
      btn.innerHTML = `<img src="${dataUrl}">`;
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function submitAnimalForm(existingId) {
  const earTag = document.getElementById('af-ear-tag').value.trim();
  const entryDate = document.getElementById('af-entry-date').value;
  if (!earTag) return alert('Küpe numarası zorunludur.');
  if (!entryDate) return alert('Giriş tarihi zorunludur.');
  if (isEarTagTaken(earTag, existingId || null)) return alert('Bu küpe numarası zaten kayıtlı.');

  const status = document.getElementById('af-status').value;
  const data = {
    ear_tag: earTag,
    name: document.getElementById('af-name').value.trim() || null,
    species: document.getElementById('af-species').value,
    breed: document.getElementById('af-breed').value.trim() || null,
    gender: document.getElementById('af-gender').value || null,
    birth_date: document.getElementById('af-birth-date').value || null,
    entry_date: entryDate,
    entry_weight: toNumberOrNull(document.getElementById('af-entry-weight').value),
    purchase_price: toNumberOrNull(document.getElementById('af-purchase-price').value),
    source: document.getElementById('af-source').value.trim() || null,
    pen: document.getElementById('af-pen').value.trim() || null,
    status,
    exit_date: status === 'aktif' ? null : document.getElementById('af-exit-date').value || null,
    sale_price: status === 'satildi' ? toNumberOrNull(document.getElementById('af-sale-price').value) : null,
    sale_weight: status === 'satildi' ? toNumberOrNull(document.getElementById('af-sale-weight').value) : null,
    notes: document.getElementById('af-notes').value.trim() || null,
    photo_uri: document.getElementById('af-photo-data').value || null,
  };

  const saved = saveAnimal(data, existingId || null);
  closeModal();
  toast(existingId ? 'Değişiklikler kaydedildi' : 'Hayvan eklendi');
  if (existingId) {
    state.detailId = existingId;
    render();
  } else {
    openAnimal(saved.id);
  }
}

/* ---------------- Weight form ---------------- */

function openWeightForm(animalId) {
  const body = `
    <label class="field"><span class="field-label">Tarih <span class="required">*</span></span>
      <input type="date" id="wf-date" value="${todayIso()}"></label>
    <label class="field"><span class="field-label">Kilo (kg) <span class="required">*</span></span>
      <input type="number" step="0.1" id="wf-weight" placeholder="Ör. 350"></label>
    <label class="field"><span class="field-label">Not</span>
      <input type="text" id="wf-note" placeholder="Opsiyonel"></label>
    <button class="btn btn-primary" onclick="submitWeightForm(${animalId})">Kaydet</button>
  `;
  openModal('Kilo Ekle', body);
}

function submitWeightForm(animalId) {
  const date = document.getElementById('wf-date').value;
  const weight = toNumberOrNull(document.getElementById('wf-weight').value);
  if (!date || weight === null) return alert('Tarih ve kilo zorunludur.');
  addWeight({ animal_id: animalId, date, weight, note: document.getElementById('wf-note').value.trim() || null });
  closeModal();
  toast('Kilo kaydedildi');
  render();
}

/* ---------------- Vaccination form ---------------- */

function openVaccinationForm(animalId) {
  const body = `
    <label class="field"><span class="field-label">Aşı Adı <span class="required">*</span></span>
      <input type="text" id="vf-name" placeholder="Ör. Şap Aşısı"></label>
    <label class="field"><span class="field-label">Uygulama Tarihi <span class="required">*</span></span>
      <input type="date" id="vf-date" value="${todayIso()}"></label>
    <label class="field"><span class="field-label">Sonraki Doz / Hatırlatma Tarihi</span>
      <input type="date" id="vf-next-date"></label>
    <label class="field"><span class="field-label">Doz</span>
      <input type="text" id="vf-dose" placeholder="Ör. 2 ml"></label>
    <label class="field"><span class="field-label">Veteriner</span>
      <input type="text" id="vf-vet" placeholder="Opsiyonel"></label>
    <label class="field"><span class="field-label">Not</span>
      <input type="text" id="vf-notes" placeholder="Opsiyonel"></label>
    <button class="btn btn-primary" onclick="submitVaccinationForm(${animalId})">Kaydet</button>
  `;
  openModal('Aşı Ekle', body);
}

function submitVaccinationForm(animalId) {
  const name = document.getElementById('vf-name').value.trim();
  const date = document.getElementById('vf-date').value;
  if (!name || !date) return alert('Aşı adı ve tarih zorunludur.');
  addVaccination({
    animal_id: animalId,
    name,
    date,
    next_date: document.getElementById('vf-next-date').value || null,
    dose: document.getElementById('vf-dose').value.trim() || null,
    vet_name: document.getElementById('vf-vet').value.trim() || null,
    notes: document.getElementById('vf-notes').value.trim() || null,
  });
  closeModal();
  toast('Aşı kaydedildi');
  render();
}

/* ---------------- Health form ---------------- */

function openHealthForm(animalId) {
  const body = `
    <label class="field"><span class="field-label">Kayıt Türü</span>
      <select id="hf-type">
        <option value="hastalik">Hastalık</option>
        <option value="muayene">Muayene</option>
        <option value="tedavi">Tedavi</option>
      </select>
    </label>
    <label class="field"><span class="field-label">Tarih <span class="required">*</span></span>
      <input type="date" id="hf-date" value="${todayIso()}"></label>
    <label class="field"><span class="field-label">Hastalık / Bulgu <span class="required">*</span></span>
      <input type="text" id="hf-diagnosis" placeholder="Ör. Topallık"></label>
    <label class="field"><span class="field-label">Tedavi / İlaç</span>
      <input type="text" id="hf-treatment" placeholder="Uygulanan tedavi"></label>
    <label class="field"><span class="field-label">Veteriner</span>
      <input type="text" id="hf-vet" placeholder="Opsiyonel"></label>
    <label class="field"><span class="field-label">Maliyet (₺)</span>
      <input type="number" step="0.01" id="hf-cost" placeholder="Opsiyonel"></label>
    <label class="field"><span class="field-label">Durum</span>
      <select id="hf-resolved">
        <option value="0">Devam ediyor</option>
        <option value="1">İyileşti</option>
      </select>
    </label>
    <label class="field"><span class="field-label">Not</span>
      <input type="text" id="hf-notes" placeholder="Opsiyonel"></label>
    <button class="btn btn-primary" onclick="submitHealthForm(${animalId})">Kaydet</button>
  `;
  openModal('Sağlık Kaydı Ekle', body);
}

function submitHealthForm(animalId) {
  const diagnosis = document.getElementById('hf-diagnosis').value.trim();
  const date = document.getElementById('hf-date').value;
  if (!diagnosis || !date) return alert('Tarih ve hastalık/bulgu zorunludur.');
  addHealth({
    animal_id: animalId,
    date,
    type: document.getElementById('hf-type').value,
    diagnosis,
    treatment: document.getElementById('hf-treatment').value.trim() || null,
    vet_name: document.getElementById('hf-vet').value.trim() || null,
    cost: toNumberOrNull(document.getElementById('hf-cost').value),
    resolved: Number(document.getElementById('hf-resolved').value),
    notes: document.getElementById('hf-notes').value.trim() || null,
  });
  closeModal();
  toast('Sağlık kaydı eklendi');
  render();
}

/* ---------------- Expense form ---------------- */

function openExpenseForm(animalId) {
  const body = `
    <label class="field"><span class="field-label">Kategori</span>
      <select id="ef-category">
        <option value="yem">Yem</option>
        <option value="ilac">İlaç</option>
        <option value="veteriner">Veteriner</option>
        <option value="nakliye">Nakliye</option>
        <option value="diger">Diğer</option>
      </select>
    </label>
    <label class="field"><span class="field-label">Tarih <span class="required">*</span></span>
      <input type="date" id="ef-date" value="${todayIso()}"></label>
    <label class="field"><span class="field-label">Tutar (₺) <span class="required">*</span></span>
      <input type="number" step="0.01" id="ef-amount" placeholder="Ör. 1500"></label>
    <label class="field"><span class="field-label">Not</span>
      <input type="text" id="ef-notes" placeholder="Opsiyonel"></label>
    <button class="btn btn-primary" onclick="submitExpenseForm(${animalId})">Kaydet</button>
  `;
  openModal('Gider Ekle', body);
}

function submitExpenseForm(animalId) {
  const date = document.getElementById('ef-date').value;
  const amount = toNumberOrNull(document.getElementById('ef-amount').value);
  if (!date || amount === null || amount <= 0) return alert('Tarih ve geçerli bir tutar zorunludur.');
  addExpense({
    animal_id: animalId,
    date,
    category: document.getElementById('ef-category').value,
    amount,
    notes: document.getElementById('ef-notes').value.trim() || null,
  });
  closeModal();
  toast('Gider kaydedildi');
  render();
}

/* ---------------- Init ---------------- */

document.querySelectorAll('nav.tabbar button').forEach((btn) => {
  btn.addEventListener('click', () => goTab(btn.dataset.tab));
});

render();

if (window.firebaseReady && typeof auth !== 'undefined' && auth) {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    await refreshCurrentUserProfile();
    if (['account', 'market', 'community'].includes(state.tab) || state.moreScreen === 'admin') {
      render();
    }
  });
}
