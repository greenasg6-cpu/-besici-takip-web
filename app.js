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
  sort: 'giris_yeni',
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
  if (currentUserProfile && currentUserProfile.banned) {
    alert('Hesabınız yönetici tarafından engellenmiş, bu işlemi yapamazsınız.');
    return false;
  }
  return true;
}

/* ---------------- Animals list ---------------- */

function sortAnimals(list) {
  const copy = list.slice();
  if (state.sort === 'kupe_no') {
    copy.sort((a, b) => a.ear_tag.localeCompare(b.ear_tag, 'tr'));
  } else if (state.sort === 'kilo_cok') {
    copy.sort((a, b) => {
      const wa = (latestWeightFor(a.id) || {}).weight ?? a.entry_weight ?? 0;
      const wb = (latestWeightFor(b.id) || {}).weight ?? b.entry_weight ?? 0;
      return wb - wa;
    });
  }
  return copy;
}

function renderAnimalsList(root) {
  setTitle('Hayvanlarım');
  let list = listAnimals();
  if (state.filter !== 'hepsi') list = list.filter((a) => a.status === state.filter);
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.ear_tag.toLowerCase().includes(q) ||
        (a.name || '').toLowerCase().includes(q) ||
        (a.pen || '').toLowerCase().includes(q)
    );
  }
  list = sortAnimals(list);

  const filters = [
    ['hepsi', 'Hepsi'],
    ['aktif', 'Aktif'],
    ['satildi', 'Satıldı'],
    ['oldu', 'Öldü'],
    ['kesildi', 'Kesildi'],
  ];
  const sorts = [
    ['giris_yeni', 'En Yeni Giriş'],
    ['kupe_no', 'Küpe No'],
    ['kilo_cok', 'Kilo (Çok-Az)'],
  ];

  const cardsHtml = list.length
    ? list
        .map((a) => {
          const w = latestWeightFor(a.id);
          const weightVal = w ? w.weight : a.entry_weight;
          const avatar = a.photo_uri
            ? `<img src="${a.photo_uri}" alt="" onclick="event.stopPropagation(); openPhotoLightbox('${a.photo_uri}')">`
            : '🐄';
          return `
        <div class="animal-card" onclick="openAnimal(${a.id})">
          <div class="top">
            <div class="avatar">${avatar}</div>
            <div class="info">
              <div class="ear-tag">${escapeHtml(a.ear_tag)}</div>
              ${a.name ? `<div class="name">${escapeHtml(a.name)}</div>` : ''}
            </div>
            <div class="badge badge-${a.status}">${STATUS_LABEL[a.status]}</div>
          </div>
          <div class="bottom">
            <span>${[a.breed, a.pen].filter(Boolean).map(escapeHtml).join(' · ')}${a.breed || a.pen ? ' · ' : ''}Giriş: ${formatDate(a.entry_date)}</span>
            <span class="weight">${formatWeight(weightVal)}</span>
          </div>
        </div>`;
        })
        .join('')
    : `<div class="empty-state"><strong>Henüz hayvan eklenmemiş</strong>Sağ alttaki + butonuyla ilk hayvanınızı ekleyin.</div>`;

  root.innerHTML = `
    <div class="search-row">
      <span>🔍</span>
      <input id="search-input" type="text" placeholder="Küpe no, isim veya ahır ara..." value="${escapeHtml(state.search)}">
    </div>
    <div class="chip-row">
      ${filters.map(([v, l]) => `<div class="chip ${state.filter === v ? 'active' : ''}" onclick="setFilter('${v}')">${l}</div>`).join('')}
    </div>
    <div class="chip-row">
      ${sorts.map(([v, l]) => `<div class="chip ${state.sort === v ? 'active' : ''}" onclick="setSort('${v}')">${l}</div>`).join('')}
    </div>
    ${cardsHtml}
    <button class="fab" onclick="openAnimalForm()">+</button>
  `;

  const input = document.getElementById('search-input');
  input.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderAnimalsList(root);
    document.getElementById('search-input').focus();
    const val = document.getElementById('search-input');
    val.selectionStart = val.selectionEnd = val.value.length;
  });
}

function setFilter(v) {
  state.filter = v;
  render();
}
function setSort(v) {
  state.sort = v;
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
      const remaining = daysUntil(v.next_date);
      const overdue = remaining < 0;
      const dueText = overdue
        ? `${Math.abs(remaining)} gün gecikti (${formatDate(v.next_date)})`
        : remaining === 0
          ? `Bugün (${formatDate(v.next_date)})`
          : `${remaining} gün sonra (${formatDate(v.next_date)})`;
      return `
      <div class="card" style="cursor:pointer; ${overdue ? 'border-color: var(--red); background: var(--red-light);' : ''}" onclick="openAnimal(${v.animal_id})">
        <div style="font-weight:700;">${escapeHtml(v.name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${escapeHtml(v.ear_tag)}${v.animal_name ? ' · ' + escapeHtml(v.animal_name) : ''}</div>
        <div style="font-size:13px;font-weight:600;color:${overdue ? 'var(--red)' : 'var(--amber)'};margin-top:6px;">${dueText}</div>
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
    <div class="card">
      <div style="font-weight:700; margin-bottom:8px;">Mali Durum</div>
      <div class="finance-row"><span class="label">Toplam Alış Maliyeti</span><span class="value">${formatMoney(s.totalPurchases)}</span></div>
      <div class="finance-row"><span class="label">Toplam Gider (yem, ilaç, vb.)</span><span class="value">${formatMoney(s.totalExpenses)}</span></div>
      <div class="finance-row"><span class="label">Toplam Satış Geliri</span><span class="value">${formatMoney(s.totalSales)}</span></div>
      <div class="finance-row finance-total"><span class="label">Net Kâr / Zarar</span><span class="value" style="color:${profit >= 0 ? 'var(--primary-dark)' : 'var(--red)'}">${formatMoney(profit)}</span></div>
    </div>
    <div class="card">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:20px;">💉</span>
        <span style="font-size:13px;">Önümüzdeki 7 gün içinde <strong>${s.upcoming}</strong> aşı hatırlatıcısı var</span>
      </div>
    </div>
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

async function refreshCurrentUserProfile() {
  if (!currentUser) {
    currentUserProfile = null;
    isAdminUser = false;
    return;
  }
  try {
    const [userSnap, adminSnap] = await Promise.all([
      db.collection('users').doc(currentUser.uid).get(),
      db.collection('admins').doc(currentUser.uid).get(),
    ]);
    currentUserProfile = userSnap.exists ? userSnap.data() : null;
    isAdminUser = adminSnap.exists;
  } catch (e) {
    currentUserProfile = null;
    isAdminUser = false;
  }
}

function renderAccount(root) {
  if (!window.firebaseReady) {
    root.innerHTML = `<div class="empty-state"><strong>İnternet bağlantısı yok</strong>Hesap özellikleri için internete bağlanman gerekiyor.</div>`;
    return;
  }
  if (currentUser) {
    const p = currentUserProfile || {};
    root.innerHTML = `
      <div class="card">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="avatar" style="width:56px;height:56px;border-radius:28px;font-size:24px;">👤</div>
          <div style="flex:1;">
            <div style="font-size:18px;font-weight:800;">${escapeHtml(p.displayName || currentUser.email)}</div>
            <div style="font-size:12px;color:var(--muted);">${escapeHtml(currentUser.email)}</div>
          </div>
          ${isAdminUser ? '<div class="badge badge-aktif">Yönetici</div>' : ''}
        </div>
        <div style="height:1px;background:var(--border);margin:12px 0;"></div>
        <div class="row"><span class="label">Telefon</span><span class="value">${escapeHtml(p.phone) || '-'}</span></div>
        <div class="row"><span class="label">Şehir</span><span class="value">${escapeHtml(p.city) || '-'}</span></div>
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn btn-secondary" onclick="openEditProfileForm()">Profili Düzenle</button>
          <button class="btn btn-danger" onclick="logout()">Çıkış Yap</button>
        </div>
      </div>
      <div class="card">
        <div class="btn-row">
          <button class="btn btn-ghost" onclick="state.tab='market'; state.marketMineOnly=true; render();">İlanlarım</button>
          <button class="btn btn-ghost" onclick="state.tab='community'; state.communityMineOnly=true; render();">Gönderilerim</button>
        </div>
      </div>
      ${isAdminUser ? `<div class="card"><button class="btn btn-primary" onclick="state.tab='more'; goMore('admin');">🛡️ Yönetici Paneli</button></div>` : ''}
    `;
    return;
  }

  root.innerHTML = `
    <div class="chip-row">
      <div class="chip ${accountFormMode === 'login' ? 'active' : ''}" onclick="accountFormMode='login'; render();">Giriş Yap</div>
      <div class="chip ${accountFormMode === 'register' ? 'active' : ''}" onclick="accountFormMode='register'; render();">Kayıt Ol</div>
    </div>
    <div class="card">
      ${accountFormMode === 'login' ? loginFormHtml() : registerFormHtml()}
    </div>
  `;
}

function loginFormHtml() {
  return `
    <label class="field"><span class="field-label">E-posta</span><input type="text" id="lf-email" placeholder="ornek@eposta.com"></label>
    <label class="field"><span class="field-label">Şifre</span><input type="password" id="lf-password" placeholder="Şifreniz"></label>
    <button class="btn btn-primary" onclick="submitLogin()">Giriş Yap</button>
  `;
}

function registerFormHtml() {
  return `
    <label class="field"><span class="field-label">Ad Soyad / Kullanıcı Adı <span class="required">*</span></span><input type="text" id="rf-name" placeholder="Ör. Mehmet Yılmaz"></label>
    <label class="field"><span class="field-label">Telefon</span><input type="text" id="rf-phone" placeholder="05xx xxx xx xx"></label>
    <label class="field"><span class="field-label">Şehir</span><input type="text" id="rf-city" placeholder="Ör. Şanlıurfa"></label>
    <label class="field"><span class="field-label">E-posta <span class="required">*</span></span><input type="text" id="rf-email" placeholder="ornek@eposta.com"></label>
    <label class="field"><span class="field-label">Şifre <span class="required">*</span></span><input type="password" id="rf-password" placeholder="En az 6 karakter"></label>
    <button class="btn btn-primary" onclick="submitRegister()">Kayıt Ol</button>
  `;
}

async function submitLogin() {
  const email = document.getElementById('lf-email').value.trim();
  const password = document.getElementById('lf-password').value;
  if (!email || !password) return alert('E-posta ve şifre zorunludur.');
  try {
    await auth.signInWithEmailAndPassword(email, password);
    toast('Giriş yapıldı');
  } catch (e) {
    alert(loginErrorMessage(e));
  }
}

function loginErrorMessage(e) {
  const map = {
    'auth/invalid-email': 'Geçersiz e-posta adresi.',
    'auth/user-not-found': 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.',
    'auth/wrong-password': 'Şifre hatalı.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  };
  return map[e.code] || 'Bir hata oluştu: ' + e.message;
}

async function submitRegister() {
  const name = document.getElementById('rf-name').value.trim();
  const phone = document.getElementById('rf-phone').value.trim();
  const city = document.getElementById('rf-city').value.trim();
  const email = document.getElementById('rf-email').value.trim();
  const password = document.getElementById('rf-password').value;
  if (!name || !email || !password) return alert('Ad, e-posta ve şifre zorunludur.');
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
      displayName: name,
      email,
      phone: phone || null,
      city: city || null,
      banned: false,
      muted: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    toast('Kayıt tamamlandı, hoş geldin!');
  } catch (e) {
    alert(loginErrorMessage(e));
  }
}

function logout() {
  auth.signOut();
  state.tab = 'animals';
  render();
}

function openEditProfileForm() {
  const p = currentUserProfile || {};
  const body = `
    <label class="field"><span class="field-label">Ad Soyad / Kullanıcı Adı</span><input type="text" id="ep-name" value="${escapeHtml(p.displayName || '')}"></label>
    <label class="field"><span class="field-label">Telefon</span><input type="text" id="ep-phone" value="${escapeHtml(p.phone || '')}"></label>
    <label class="field"><span class="field-label">Şehir</span><input type="text" id="ep-city" value="${escapeHtml(p.city || '')}"></label>
    <button class="btn btn-primary" onclick="submitEditProfile()">Kaydet</button>
  `;
  openModal('Profili Düzenle', body);
}

async function submitEditProfile() {
  const name = document.getElementById('ep-name').value.trim();
  const phone = document.getElementById('ep-phone').value.trim();
  const city = document.getElementById('ep-city').value.trim();
  if (!name) return alert('Ad zorunludur.');
  try {
    await db.collection('users').doc(currentUser.uid).set(
      { displayName: name, phone: phone || null, city: city || null },
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

async function renderMarket(root) {
  setTitle('Pazar Yeri');
  if (!window.firebaseReady) {
    root.innerHTML = `<div class="empty-state"><strong>İnternet bağlantısı yok</strong>Pazar Yeri için internete bağlanman gerekiyor.</div>`;
    return;
  }
  root.innerHTML = `<div class="empty-state">Yükleniyor...</div>`;
  try {
    let query = db.collection('listings').orderBy('createdAt', 'desc').limit(100);
    const snap = await query.get();
    let listings = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
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

    const cardsHtml = listings.length
      ? listings
          .map(
            (l) => `
        <div class="animal-card" onclick="openListing('${l.id}')">
          <div class="top">
            <div class="avatar">${l.photoUrl ? `<img src="${l.photoUrl}" alt="">` : '🐄'}</div>
            <div class="info">
              <div class="ear-tag">${escapeHtml(l.title)}</div>
              <div class="name">${escapeHtml(l.city || '')}${l.breed ? ' · ' + escapeHtml(l.breed) : ''}</div>
            </div>
            ${l.status === 'sold' ? '<div class="badge badge-satildi">Satıldı</div>' : ''}
          </div>
          <div class="bottom">
            <span>${escapeHtml(l.sellerName || '')}</span>
            <span class="weight">${formatMoney(l.price)}</span>
          </div>
        </div>`
          )
          .join('')
      : `<div class="empty-state"><strong>${state.marketMineOnly ? 'Henüz ilanın yok' : 'Henüz ilan yok'}</strong>${state.marketMineOnly ? '' : 'İlk ilanı sen ver!'}</div>`;

    root.innerHTML = `
      <div class="search-row">
        <span>🔍</span>
        <input id="market-search-input" type="text" placeholder="Hayvan, şehir veya ırk ara..." value="${escapeHtml(state.marketSearch)}">
      </div>
      ${
        state.marketMineOnly
          ? `<div class="chip-row"><div class="chip active" onclick="state.marketMineOnly=false; render();">Tüm ilanlar</div></div>`
          : ''
      }
      ${cardsHtml}
      <button class="fab" onclick="openListingForm()">+</button>
    `;
    const input = document.getElementById('market-search-input');
    input.addEventListener('input', (e) => {
      state.marketSearch = e.target.value;
      renderMarket(root);
    });
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><strong>Yüklenemedi</strong>${escapeHtml(e.message)}</div>`;
  }
}

function openListing(id) {
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
    root.innerHTML = `
      <button class="btn btn-ghost" style="margin-bottom:12px;" onclick="state.listingId=null; render();">← Geri</button>
      <div class="card">
        ${l.photoUrl ? `<img src="${l.photoUrl}" style="width:100%;border-radius:12px;margin-bottom:12px;cursor:zoom-in;" onclick="openPhotoLightbox('${l.photoUrl}')">` : ''}
        <div style="font-size:20px;font-weight:800;">${escapeHtml(l.title)}</div>
        <div style="font-size:22px;font-weight:800;color:var(--primary-dark);margin-top:4px;">${formatMoney(l.price)}</div>
        ${l.status === 'sold' ? '<div class="badge badge-satildi" style="margin-top:8px;">Satıldı</div>' : ''}
        <div style="height:1px;background:var(--border);margin:12px 0;"></div>
        <div class="row"><span class="label">Tür / Irk</span><span class="value">${escapeHtml(l.species || '')}${l.breed ? ' · ' + escapeHtml(l.breed) : ''}</span></div>
        <div class="row"><span class="label">Ağırlık</span><span class="value">${l.weight ? formatWeight(l.weight) : '-'}</span></div>
        <div class="row"><span class="label">Yaş</span><span class="value">${escapeHtml(l.age) || '-'}</span></div>
        <div class="row"><span class="label">Şehir</span><span class="value">${escapeHtml(l.city) || '-'}</span></div>
        ${l.description ? `<div class="row"><span class="label">Açıklama</span><span class="value">${escapeHtml(l.description)}</span></div>` : ''}
        <div class="row"><span class="label">Satıcı</span><span class="value">${escapeHtml(l.sellerName || '')}</span></div>
        <div class="row"><span class="label">Tarih</span><span class="value">${timeAgoOrDate(l.createdAt)}</span></div>
      </div>
      ${
        phoneDigits
          ? `<div class="btn-row">
              <a class="btn btn-primary" style="text-decoration:none;" href="tel:${phoneDigits}">📞 Ara</a>
              <a class="btn btn-secondary" style="text-decoration:none;" href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener">💬 WhatsApp</a>
            </div>`
          : ''
      }
      ${
        isOwner || isAdminUser
          ? `<div class="btn-row" style="margin-top:10px;">
              ${l.status !== 'sold' ? `<button class="btn btn-secondary" onclick="markListingSold('${id}')">Satıldı Olarak İşaretle</button>` : ''}
              <button class="btn btn-danger" onclick="confirmDeleteListing('${id}')">Sil</button>
            </div>`
          : ''
      }
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

function openListingForm() {
  if (!requireLogin('İlan vermek')) return;
  const p = currentUserProfile || {};
  const trackedAnimals = listAnimals().filter((a) => a.status === 'aktif');
  const body = `
    ${
      trackedAnimals.length
        ? `<label class="field"><span class="field-label">Kayıtlı hayvanlarından doldur (opsiyonel)</span>
      <select id="lf-from-animal" onchange="fillListingFromAnimal(this.value)">
        <option value="">— Manuel gir —</option>
        ${trackedAnimals.map((a) => `<option value="${a.id}">${escapeHtml(a.ear_tag)}${a.name ? ' · ' + escapeHtml(a.name) : ''}</option>`).join('')}
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
          .map(
            (p) => `
        <div class="card" style="cursor:pointer;" onclick="openPost('${p.id}')">
          <div style="display:flex; gap:10px;">
            ${p.photoUrl ? `<img src="${p.photoUrl}" style="width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0;">` : ''}
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:15px;">${escapeHtml(p.title)}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">${escapeHtml(p.authorName || '')} · ${timeAgoOrDate(p.createdAt)}</div>
              <div style="font-size:13px;color:var(--muted);margin-top:6px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHtml(p.body || '')}</div>
              <div style="font-size:12px;color:var(--primary-dark);margin-top:6px;font-weight:600;">💬 ${p.commentCount || 0} yorum</div>
            </div>
          </div>
        </div>`
          )
          .join('')
      : `<div class="empty-state"><strong>${state.communityMineOnly ? 'Henüz gönderin yok' : 'Henüz gönderi yok'}</strong>${state.communityMineOnly ? '' : 'Hayvanınla ilgili bir soru veya durum paylaşabilirsin.'}</div>`;

    root.innerHTML = `
      ${
        state.communityMineOnly
          ? `<div class="chip-row"><div class="chip active" onclick="state.communityMineOnly=false; render();">Tüm gönderiler</div></div>`
          : ''
      }
      ${html}
      <button class="fab" onclick="openPostForm()">+</button>
    `;
  } catch (e) {
    root.innerHTML = `<div class="empty-state"><strong>Yüklenemedi</strong>${escapeHtml(e.message)}</div>`;
  }
}

function openPost(id) {
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

    root.innerHTML = `
      <button class="btn btn-ghost" style="margin-bottom:12px;" onclick="state.postId=null; render();">← Geri</button>
      <div class="card">
        ${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;border-radius:12px;margin-bottom:12px;cursor:zoom-in;" onclick="openPhotoLightbox('${p.photoUrl}')">` : ''}
        <div style="font-size:18px;font-weight:800;">${escapeHtml(p.title)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">${escapeHtml(p.authorName || '')} · ${timeAgoOrDate(p.createdAt)}</div>
        <div style="font-size:14px;margin-top:10px;white-space:pre-wrap;">${escapeHtml(p.body || '')}</div>
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
  root.innerHTML = `
    <div class="card" style="padding:0; overflow:hidden;">
      <div class="list-row" style="border-top:none; padding:14px 16px; cursor:pointer;" onclick="goMore('reminders')">
        <div class="body"><div class="title">💉 Aşı Hatırlatıcıları</div></div>
      </div>
      <div class="list-row" style="padding:14px 16px; cursor:pointer;" onclick="goMore('summary')">
        <div class="body"><div class="title">📊 Çiftlik Özeti</div></div>
      </div>
      <div class="list-row" style="padding:14px 16px; cursor:pointer;" onclick="goMore('settings')">
        <div class="body"><div class="title">⚙️ Ayarlar / Yedekleme</div></div>
      </div>
      ${
        isAdminUser
          ? `<div class="list-row" style="padding:14px 16px; cursor:pointer;" onclick="goMore('admin')">
              <div class="body"><div class="title">🛡️ Yönetici Paneli</div></div>
            </div>`
          : ''
      }
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

    root.innerHTML = `
      ${moreBackButton()}
      <div class="card">
        <div class="section-title-row"><h3>Kullanıcılar (${users.length})</h3></div>
        ${users
          .map(
            (u) => `
          <div class="list-row">
            <div class="body">
              <div class="title">${escapeHtml(u.displayName || u.email)} ${u.banned ? '<span class="badge badge-oldu">Engelli</span>' : ''} ${u.muted ? '<span class="badge badge-kesildi">Susturulmuş</span>' : ''}</div>
              <div class="subtitle">${escapeHtml(u.email || '')} · ${escapeHtml(u.city || '')}</div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="delete-btn" style="font-size:12px;" onclick="toggleUserFlag('${u.id}','banned',${!u.banned})">${u.banned ? 'Engeli Kaldır' : 'Engelle'}</button>
              <button class="delete-btn" style="font-size:12px;" onclick="toggleUserFlag('${u.id}','muted',${!u.muted})">${u.muted ? 'Sesi Aç' : 'Sustur'}</button>
            </div>
          </div>`
          )
          .join('')}
      </div>
      <div class="card">
        <div class="section-title-row"><h3>İlanlar (${listings.length})</h3></div>
        ${listings
          .map(
            (l) => `
          <div class="list-row">
            <div class="body"><div class="title">${escapeHtml(l.title)}</div><div class="subtitle">${escapeHtml(l.sellerName || '')} · ${formatMoney(l.price)}</div></div>
            <button class="delete-btn" onclick="adminDeleteListing('${l.id}')">🗑</button>
          </div>`
          )
          .join('')}
      </div>
      <div class="card">
        <div class="section-title-row"><h3>Gönderiler (${posts.length})</h3></div>
        ${posts
          .map(
            (p) => `
          <div class="list-row">
            <div class="body"><div class="title">${escapeHtml(p.title)}</div><div class="subtitle">${escapeHtml(p.authorName || '')}</div></div>
            <button class="delete-btn" onclick="adminDeletePost('${p.id}')">🗑</button>
          </div>`
          )
          .join('')}
      </div>
    `;
  } catch (e) {
    root.innerHTML = `${moreBackButton()}<div class="empty-state"><strong>Yüklenemedi</strong>${escapeHtml(e.message)}</div>`;
  }
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
    .then(() => renderAdmin(document.getElementById('view-root')))
    .catch((e) => alert('Hata: ' + e.message));
}

function adminDeletePost(id) {
  if (!confirmDialog('Bu gönderiyi silmek istiyor musunuz?')) return;
  db.collection('posts')
    .doc(id)
    .delete()
    .then(() => renderAdmin(document.getElementById('view-root')))
    .catch((e) => alert('Hata: ' + e.message));
}

/* ---------------- Animal detail ---------------- */

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

  let gainText = '';
  if (latest) {
    const days = daysBetween(animal.entry_date, latest.date);
    if (days > 0 && animal.entry_weight !== null && animal.entry_weight !== undefined) {
      const gain = (latest.weight - animal.entry_weight) / days;
      gainText = `<div class="row"><span class="label">Günlük Ort. Kazanç</span><span class="value">${gain.toFixed(2)} kg/gün</span></div>`;
    }
  }

  const sparkline = renderSparklineHtml(weights.slice().reverse());

  root.innerHTML = `
    <button class="btn btn-ghost" style="margin-bottom:12px;" onclick="closeDetail()">← Geri</button>

    <div class="card">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="avatar" style="width:56px;height:56px;border-radius:28px;font-size:26px;">${animal.photo_uri ? `<img src="${animal.photo_uri}" onclick="event.stopPropagation(); openPhotoLightbox('${animal.photo_uri}')">` : '🐄'}</div>
        <div style="flex:1;">
          <div style="font-size:22px;font-weight:800;">${escapeHtml(animal.ear_tag)}</div>
          ${animal.name ? `<div style="font-size:14px;color:var(--muted);">${escapeHtml(animal.name)}</div>` : ''}
        </div>
        <div class="badge badge-${animal.status}">${STATUS_LABEL[animal.status]}</div>
      </div>
      <div style="height:1px;background:var(--border);margin:12px 0;"></div>
      <div class="row"><span class="label">Tür / Cins</span><span class="value">${escapeHtml(animal.species)}${animal.breed ? ' · ' + escapeHtml(animal.breed) : ''}</span></div>
      <div class="row"><span class="label">Cinsiyet</span><span class="value">${animal.gender === 'erkek' ? 'Erkek' : animal.gender === 'disi' ? 'Dişi' : '-'}</span></div>
      <div class="row"><span class="label">Doğum Tarihi</span><span class="value">${formatDate(animal.birth_date)}</span></div>
      <div class="row"><span class="label">Giriş Tarihi</span><span class="value">${formatDate(animal.entry_date)}</span></div>
      <div class="row"><span class="label">Giriş Kilosu</span><span class="value">${formatWeight(animal.entry_weight)}</span></div>
      <div class="row"><span class="label">Güncel Kilo</span><span class="value">${formatWeight(latest ? latest.weight : animal.entry_weight)}</span></div>
      ${gainText}
      <div class="row"><span class="label">Ahır / Grup</span><span class="value">${escapeHtml(animal.pen) || '-'}</span></div>
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
      <div class="btn-row" style="margin-top:14px;">
        <button class="btn btn-secondary" onclick="openAnimalForm(${id})">Düzenle</button>
        <button class="btn btn-danger" onclick="confirmDeleteAnimal(${id})">Sil</button>
      </div>
    </div>

    <div class="card">
      <div class="section-title-row"><h3>Kilo Geçmişi</h3><button class="add-btn" onclick="openWeightForm(${id})">+</button></div>
      ${sparkline}
      ${
        weights.length
          ? weights
              .map(
                (w) => `
        <div class="list-row">
          <div class="body"><div class="title">${formatWeight(w.weight)}</div><div class="subtitle">${formatDate(w.date)}</div>${w.note ? `<div class="note">${escapeHtml(w.note)}</div>` : ''}</div>
          <button class="delete-btn" onclick="confirmDeleteRecord('weight', ${w.id}, ${id})">🗑</button>
        </div>`
              )
              .join('')
          : '<div class="empty-state">Henüz kilo kaydı yok</div>'
      }
    </div>

    <div class="card">
      <div class="section-title-row"><h3>Aşılar</h3><button class="add-btn" onclick="openVaccinationForm(${id})">+</button></div>
      ${
        vaccinations.length
          ? vaccinations
              .map(
                (v) => `
        <div class="list-row">
          <div class="body"><div class="title">${escapeHtml(v.name)}</div><div class="subtitle">${formatDate(v.date)}${v.next_date ? ' · Sonraki: ' + formatDate(v.next_date) : ''}</div>${v.notes ? `<div class="note">${escapeHtml(v.notes)}</div>` : ''}</div>
          <button class="delete-btn" onclick="confirmDeleteRecord('vaccination', ${v.id}, ${id})">🗑</button>
        </div>`
              )
              .join('')
          : '<div class="empty-state">Henüz aşı kaydı yok</div>'
      }
    </div>

    <div class="card">
      <div class="section-title-row"><h3>Sağlık Kayıtları</h3><button class="add-btn" onclick="openHealthForm(${id})">+</button></div>
      ${
        health.length
          ? health
              .map(
                (h) => `
        <div class="list-row">
          <div class="body"><div class="title">${escapeHtml(h.diagnosis || HEALTH_TYPE_LABEL[h.type])}</div><div class="subtitle">${formatDate(h.date)} · ${h.resolved ? 'İyileşti' : 'Devam ediyor'}</div>${h.treatment ? `<div class="note">${escapeHtml(h.treatment)}</div>` : ''}</div>
          <button class="delete-btn" onclick="confirmDeleteRecord('health', ${h.id}, ${id})">🗑</button>
        </div>`
              )
              .join('')
          : '<div class="empty-state">Henüz sağlık kaydı yok</div>'
      }
    </div>

    <div class="card">
      <div class="section-title-row"><h3>Giderler</h3><button class="add-btn" onclick="openExpenseForm(${id})">+</button></div>
      ${
        expenses.length
          ? expenses
              .map(
                (e) => `
        <div class="list-row">
          <div class="body"><div class="title">${EXPENSE_LABEL[e.category]} · ${formatMoney(e.amount)}</div><div class="subtitle">${formatDate(e.date)}</div>${e.notes ? `<div class="note">${escapeHtml(e.notes)}</div>` : ''}</div>
          <button class="delete-btn" onclick="confirmDeleteRecord('expense', ${e.id}, ${id})">🗑</button>
        </div>`
              )
              .join('')
          : '<div class="empty-state">Henüz gider kaydı yok</div>'
      }
    </div>
  `;
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

function openAnimalForm(existingId) {
  const animal = existingId ? getAnimal(existingId) : null;
  const a = animal || {
    ear_tag: '', name: '', species: 'Sığır', breed: '', gender: null, birth_date: '',
    entry_date: todayIso(), entry_weight: '', purchase_price: '', source: '', pen: '',
    status: 'aktif', exit_date: '', sale_price: '', sale_weight: '', notes: '', photo_uri: null,
  };

  const body = `
    <div class="photo-picker">
      <button type="button" class="avatar-lg" id="af-photo-btn" onclick="document.getElementById('af-photo-input').click()">
        ${a.photo_uri ? `<img id="af-photo-preview" src="${a.photo_uri}">` : '<span id="af-photo-preview-text">📷<br>Fotoğraf Ekle</span>'}
      </button>
      <input type="file" id="af-photo-input" accept="image/*" capture="environment" class="hidden">
    </div>
    <input type="hidden" id="af-photo-data" value="${a.photo_uri ? escapeHtml(a.photo_uri) : ''}">

    <label class="field"><span class="field-label">Küpe Numarası <span class="required">*</span></span>
      <input type="text" id="af-ear-tag" value="${escapeHtml(a.ear_tag)}" placeholder="TR-1234-5678"></label>
    <label class="field"><span class="field-label">İsim / Lakap</span>
      <input type="text" id="af-name" value="${escapeHtml(a.name || '')}" placeholder="Opsiyonel"></label>

    <label class="field"><span class="field-label">Tür</span>
      <select id="af-species">${SPECIES_OPTIONS.map((s) => `<option value="${s}" ${a.species === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    </label>
    <label class="field"><span class="field-label">Cins / Irk</span>
      <input type="text" id="af-breed" value="${escapeHtml(a.breed || '')}" placeholder="Ör. Simmental"></label>
    <label class="field"><span class="field-label">Cinsiyet</span>
      <select id="af-gender">
        <option value="">Belirtilmedi</option>
        <option value="erkek" ${a.gender === 'erkek' ? 'selected' : ''}>Erkek</option>
        <option value="disi" ${a.gender === 'disi' ? 'selected' : ''}>Dişi</option>
      </select>
    </label>
    <label class="field"><span class="field-label">Doğum Tarihi</span>
      <input type="date" id="af-birth-date" value="${a.birth_date || ''}"></label>
    <label class="field"><span class="field-label">Çiftliğe Giriş Tarihi <span class="required">*</span></span>
      <input type="date" id="af-entry-date" value="${a.entry_date}"></label>
    <label class="field"><span class="field-label">Giriş Kilosu (kg)</span>
      <input type="number" step="0.1" id="af-entry-weight" value="${a.entry_weight ?? ''}" placeholder="Ör. 320"></label>
    <label class="field"><span class="field-label">Alış Fiyatı (₺)</span>
      <input type="number" step="0.01" id="af-purchase-price" value="${a.purchase_price ?? ''}" placeholder="Ör. 45000"></label>
    <label class="field"><span class="field-label">Nereden Alındı</span>
      <input type="text" id="af-source" value="${escapeHtml(a.source || '')}" placeholder="Pazar, yetiştirici vb."></label>
    <label class="field"><span class="field-label">Ahır / Padok / Grup</span>
      <input type="text" id="af-pen" value="${escapeHtml(a.pen || '')}" placeholder="Ör. A Bloğu"></label>

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

    <button class="btn btn-primary" onclick="submitAnimalForm(${existingId || 'null'})">${existingId ? 'Değişiklikleri Kaydet' : 'Hayvanı Kaydet'}</button>
  `;

  openModal(existingId ? 'Hayvanı Düzenle' : 'Yeni Hayvan', body, () => {
    document.getElementById('af-photo-input').addEventListener('change', (e) => handlePhotoInput(e, 'af'));
  });
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
