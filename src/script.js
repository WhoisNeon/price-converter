const API_URL = 'https://chand.clf.dpdns.org/api';
const STORAGE_KEY = 'price-converter-prefs';

let state = {
    data: null,
    fiat: {},
    currency: 'AED',
    percent: 20,
    loading: false,
    lastUpdate: null
};

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ */
/*  Persian digit helpers                                              */
/* ------------------------------------------------------------------ */
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const FA_DIGIT_MAP = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

function toPersianDigits(str) {
    return String(str).replace(/[0-9]/g, d => FA_DIGITS[+d]);
}

function toEnglishDigits(str) {
    return String(str).replace(/[۰-۹٠-٩]/g, d => FA_DIGIT_MAP[d] || d);
}

/* ------------------------------------------------------------------ */
/*  Input handling — Persian display, English value                    */
/* ------------------------------------------------------------------ */
function normalizeNumericInput(raw) {
    let s = toEnglishDigits(raw);
    s = s.replace(/[^\d.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    return s;
}

function readInputValue(el) {
    return toEnglishDigits(el.value).trim();
}

/* Amount input ------------------------------------------------------ */
function onAmountInput(el) {
    const caretAtEnd = el.selectionStart === el.value.length;
    const normalized = normalizeNumericInput(el.value);
    const display = toPersianDigits(normalized);
    if (display !== el.value) {
        el.value = display;
        if (caretAtEnd) {
            try { el.setSelectionRange(display.length, display.length); } catch (e) { }
        }
    }
    savePrefs();
    recalc();
}

function onAmountBlur(el) {
    const raw = readInputValue(el);
    const n = parseFloat(raw);
    if (raw === '' || isNaN(n) || n < 0) {
        el.value = toPersianDigits('1');
        savePrefs();
        recalc();
    }
}

/* Percent input ----------------------------------------------------- */
function onPercentInput(el) {
    const caretAtEnd = el.selectionStart === el.value.length;
    const normalized = normalizeNumericInput(el.value);
    const display = toPersianDigits(normalized);
    if (display !== el.value) {
        el.value = display;
        if (caretAtEnd) {
            try { el.setSelectionRange(display.length, display.length); } catch (e) { }
        }
    }
    const n = parseFloat(normalized);
    if (!isNaN(n) && n >= 0) {
        state.percent = n;
    }
    savePrefs();
    recalc();
}

function onPercentBlur(el) {
    const raw = readInputValue(el);
    const n = parseFloat(raw);
    if (raw === '' || isNaN(n) || n < 0) {
        el.value = toPersianDigits('0');
        state.percent = 0;
        savePrefs();
        recalc();
    }
}

/* ------------------------------------------------------------------ */
/*  Wheel + arrow key controls (restore native number-input feel)      */
/* ------------------------------------------------------------------ */
function attachNumericControls(el, step, max) {
    // Arrow keys
    el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            bumpValue(el, (e.key === 'ArrowUp' ? 1 : -1) * step, max);
        }
    });

    // Mouse wheel (only when the input is focused — same as native)
    el.addEventListener('wheel', (e) => {
        if (document.activeElement !== el) return;
        e.preventDefault();
        bumpValue(el, (e.deltaY < 0 ? 1 : -1) * step, max);
    }, { passive: false });
}

function bumpValue(el, delta, max) {
    const cur = parseFloat(readInputValue(el));
    const base = (isNaN(cur) ? 0 : cur);
    let next = base + delta;
    if (next < 0) next = 0;
    if (max !== undefined && next > max) next = max;
    // Guard against floating point noise
    next = Math.round(next * 1e6) / 1e6;

    el.value = toPersianDigits(String(next));

    // Fire the same handler the user's typing would trigger
    if (el.id === 'inputPrice') onAmountInput(el);
    else if (el.id === 'customPercent') onPercentInput(el);
}

/* ------------------------------------------------------------------ */
/*  Toast notifications (top center)                                   */
/* ------------------------------------------------------------------ */
const TOAST_ICONS = {
    info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="20"/><line x1="128" y1="120" x2="128" y2="176" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="20"/><circle cx="128" cy="84" r="12" fill="currentColor"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><polyline points="216,72 104,184 48,128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="24"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><circle cx="128" cy="128" r="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="20"/><line x1="128" y1="80" x2="128" y2="136" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="20"/><circle cx="128" cy="172" r="12" fill="currentColor"/></svg>'
};

function showToast(message, type = 'info', duration = 2600) {
    const host = $('toastHost');
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast-msg"></span>
  `;
    el.querySelector('.toast-msg').textContent = message;
    host.appendChild(el);

    while (host.children.length > 4) host.removeChild(host.firstChild);

    const remove = () => {
        if (!el.parentNode) return;
        el.classList.add('toast-out');
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    };

    setTimeout(remove, duration);
}

/* ------------------------------------------------------------------ */
/*  Preferences                                                        */
/* ------------------------------------------------------------------ */
function savePrefs() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            currency: state.currency,
            amount: readInputValue($('inputPrice')),
            percent: readInputValue($('customPercent'))
        }));
    } catch (e) { /* storage unavailable — ignore */ }
}

function loadPrefs() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }

    let amountStr = '1';
    let percentStr = '20';

    if (saved && typeof saved === 'object') {
        if (saved.currency && typeof saved.currency === 'string') state.currency = saved.currency;
        if (saved.percent !== undefined && saved.percent !== '' && !isNaN(parseFloat(saved.percent))) {
            state.percent = parseFloat(saved.percent);
            percentStr = String(saved.percent);
        }
        if (saved.amount !== undefined && saved.amount !== '') {
            amountStr = String(saved.amount);
        }
    }

    // If the stored value is empty / invalid, fall back to defaults
    const amtN = parseFloat(amountStr);
    if (amountStr.trim() === '' || isNaN(amtN) || amtN < 0) amountStr = '1';

    const pctN = parseFloat(percentStr);
    if (percentStr.trim() === '' || isNaN(pctN) || pctN < 0) percentStr = '0';

    $('inputPrice').value = toPersianDigits(amountStr);
    $('customPercent').value = toPersianDigits(percentStr);
    state.percent = parseFloat(percentStr) || 0;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatNumber(n) {
    if (!isFinite(n)) return '—';
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Math.round(n));
}

/* Currency fields arrive from a remote API — never interpolate them raw */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ */
/*  Number transition — only digits change, unit is untouched          */
/* ------------------------------------------------------------------ */
const anim = { frame: null, current: 0, duration: 380 };

function renderNumber(v) {
    $('resultNum').textContent = formatNumber(v);
}

function animateNumber(to) {
    const from = anim.current;
    const el = $('resultNum');

    if (anim.frame) { cancelAnimationFrame(anim.frame); anim.frame = null; }

    const diff = to - from;

    if (from === 0 || !isFinite(diff) || Math.abs(diff) < 1) {
        anim.current = to;
        renderNumber(to);
        return;
    }

    el.classList.remove('num-fade');
    void el.offsetWidth;
    el.classList.add('num-fade');

    const t0 = performance.now();
    const dur = anim.duration;

    const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = from + diff * eased;
        anim.current = v;
        renderNumber(v);

        if (p < 1) {
            anim.frame = requestAnimationFrame(step);
        } else {
            anim.current = to;
            renderNumber(to);
            anim.frame = null;
        }
    };

    anim.frame = requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/*  Dropdown                                                           */
/* ------------------------------------------------------------------ */
function toggleDropdown(e) {
    e.stopPropagation();
    const dd = $('dropdown');
    const btn = $('selectorBtn');
    const isOpen = !dd.classList.contains('hidden');

    if (isOpen) {
        closeDropdown();
    } else {
        dd.classList.remove('hidden');
        btn.classList.add('open');
        setTimeout(() => $('searchInput').focus(), 50);
        renderCurrencyList();
    }
}

function closeDropdown() {
    $('dropdown').classList.add('hidden');
    $('selectorBtn').classList.remove('open');
    $('searchInput').value = '';
    document.body.classList.remove('no-scroll');
}

document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.selector-wrap');
    if (wrap && !wrap.contains(e.target)) closeDropdown();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
});

function renderCurrencyList(filter = '') {
    const list = $('currencyList');
    const f = filter.trim().toLowerCase();
    const entries = Object.entries(state.fiat);

    entries.sort((a, b) => {
        if (a[0] === state.currency) return -1;
        if (b[0] === state.currency) return 1;
        return a[0].localeCompare(b[0]);
    });

    const filtered = entries.filter(([code, info]) => {
        if (!f) return true;
        return code.toLowerCase().includes(f) ||
            (info.fa || '').includes(f) ||
            (info.en || '').toLowerCase().includes(f);
    });

    if (!filtered.length) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--txt-3);font-size:0.76rem;">موردی یافت نشد</div>';
        return;
    }

    list.innerHTML = filtered.map(([code, info]) => {
        const active = code === state.currency ? ' active' : '';
        const price = info.sell ? formatNumber(info.sell) : '—';
        return `
      <div class="cur-item${active}" onclick="selectCurrency('${esc(code)}')">
        <img src="${esc(info.icon)}" alt="${esc(code)}" onerror="this.style.visibility='hidden'">
        <div class="ci-info">
          <div class="ci-code">${esc(code)} <span>${esc(info.fa || code)}</span></div>
          <div class="ci-name">${esc(info.en)}</div>
        </div>
        <div class="ci-price">${price}</div>
      </div>
    `;
    }).join('');
}

function filterCurrencies() {
    renderCurrencyList($('searchInput').value);
}

function selectCurrency(code) {
    if (!state.fiat[code]) return;
    if (code === state.currency) {
        closeDropdown();
        return;
    }
    state.currency = code;
    updateSelectorUI();
    closeDropdown();
    savePrefs();
    recalc();

    const info = state.fiat[code];
    showToast('ارز انتخاب شد: ' + (info.fa || info.en || code), 'info', 2000);
}

function updateSelectorUI() {
    const info = state.fiat[state.currency];
    if (!info) return;

    $('selFlag').src = info.icon || '';
    $('selCode').textContent = `${state.currency} — ${info.fa || state.currency}`;
    $('selName').textContent = info.en || '';

    const unitEl = $('inputUnit');
    if (unitEl) unitEl.textContent = state.currency;

    if (!$('dropdown').classList.contains('hidden')) {
        renderCurrencyList($('searchInput').value);
    }
}

/* ------------------------------------------------------------------ */
/*  Fetch — simple, preflight-free request                             */
/* ------------------------------------------------------------------ */
async function fetchPrice() {
    if (state.loading) return;
    state.loading = true;

    const btn = $('refreshBtn');
    const btnText = $('refreshBtnText');
    const statusPill = $('statusPill');
    const statusText = $('statusText');

    btn.disabled = true;
    btnText.textContent = 'در حال دریافت...';
    statusText.textContent = 'در حال دریافت';
    statusPill.className = 'status-pill';
    $('alertBox').classList.add('hidden');

    // dump old payload
    state.data = null;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        let res;
        try {
            res = await fetch(API_URL, {
                method: 'GET',
                cache: 'no-store',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });
        } catch (netErr) {
            clearTimeout(timer);
            throw { type: 'NETWORK', original: netErr };
        }
        clearTimeout(timer);

        if (!res.ok) throw { type: 'HTTP', status: res.status };

        const data = await res.json();

        if (!data.success) throw { type: 'API', message: 'پاسخ ناموفق از سرور' };
        if (!data.fiat || typeof data.fiat !== 'object') throw { type: 'API', message: 'داده ارز یافت نشد' };

        state.data = data;
        state.fiat = data.fiat;
        state.lastUpdate = data.updated_iso || data.updated || null;

        if (!state.fiat[state.currency]) {
            state.currency = Object.keys(state.fiat)[0];
            savePrefs();
        }

        updateSelectorUI();
        $('lastUpdate').textContent = data.updated_iso
            ? 'بروزرسانی: ' + new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.updated_iso))
            : (data.updated ? 'بروزرسانی: ' + data.updated : '');
        statusText.textContent = 'متصل';
        statusPill.className = 'status-pill online';

        $('resultSkeleton').classList.add('hidden');
        $('resultValue').classList.remove('hidden');

        recalc();

        showToast('قیمت‌ها بروزرسانی شد', 'success', 2400);

    } catch (err) {
        console.error(err);

        const isOffline = (typeof navigator !== 'undefined' && navigator.onLine === false);
        const isNetwork =
            err.type === 'NETWORK' ||
            err.name === 'AbortError' ||
            (err.name === 'TypeError' && isOffline);

        const alertBox = $('alertBox');
        let toastMsg = '';

        if (isNetwork) {
            $('alertTitle').textContent = 'اتصال اینترنت قطع است';
            $('alertText').innerHTML = 'اتصال شبکه خود را بررسی کنید و دوباره تلاش کنید.';
            toastMsg = 'اتصال اینترنت قطع است';
        } else if (err.type === 'HTTP') {
            $('alertTitle').textContent = 'خطا در دریافت اطلاعات';
            $('alertText').innerHTML = 'خطای سرور (کد ' + err.status + ')';
            toastMsg = 'خطای سرور (کد ' + err.status + ')';
        } else if (err.type === 'API') {
            $('alertTitle').textContent = 'خطا در دریافت اطلاعات';
            $('alertText').innerHTML = err.message;
            toastMsg = err.message;
        } else if (err.name === 'TypeError') {
            $('alertTitle').textContent = 'درخواست توسط مرورگر مسدود شد';
            $('alertText').innerHTML =
                'سرور API پاسخ معتبری برنگرداند (احتمالاً CORS). ' +
                'کنسول مرورگر (F12) را برای جزئیات بررسی کنید.';
            toastMsg = 'درخواست مسدود شد (CORS)';
        } else {
            $('alertTitle').textContent = 'خطا در دریافت اطلاعات';
            $('alertText').innerHTML = err.message || 'خطای ناشناخته';
            toastMsg = err.message || 'خطای ناشناخته';
        }

        alertBox.classList.remove('hidden');
        statusText.textContent = 'خطا';
        statusPill.className = 'status-pill error';

        $('resultValue').classList.add('hidden');
        $('resultSkeleton').classList.remove('hidden');

        showToast(toastMsg, 'error', 3600);

    } finally {
        state.loading = false;
        btn.disabled = false;
        btnText.textContent = 'بروزرسانی';
    }
}

/* ------------------------------------------------------------------ */
/*  Recalculate                                                        */
/* ------------------------------------------------------------------ */
function recalc() {
    const info = state.fiat[state.currency];
    if (!info) return;

    const sell = Number(info.sell) || 0;

    // Amount fallback → 1
    let amount = parseFloat(readInputValue($('inputPrice')));
    if (isNaN(amount) || amount < 0) amount = 1;

    // Percent fallback → 0
    let pct = parseFloat(readInputValue($('customPercent')));
    if (isNaN(pct) || pct < 0) pct = 0;

    const final = amount * sell * (1 + pct / 100);

    $('resultSkeleton').classList.add('hidden');
    $('resultValue').classList.remove('hidden');

    animateNumber(final);
}

/* ------------------------------------------------------------------ */
/*  Copy                                                               */
/* ------------------------------------------------------------------ */
async function copyResult() {
    const copyBtn = $('copyBtn');
    const copyBtnText = $('copyBtnText');
    const originalText = 'کپی نتیجه';

    const info = state.fiat[state.currency];
    if (!info) {
        showToast('داده‌ای برای کپی موجود نیست', 'error', 2200);
        copyBtnText.textContent = 'داده‌ای موجود نیست';
        setTimeout(() => { copyBtnText.textContent = originalText; }, 1500);
        return;
    }

    const sell = Number(info.sell) || 0;

    let amount = parseFloat(readInputValue($('inputPrice')));
    if (isNaN(amount) || amount < 0) amount = 1;

    let pct = parseFloat(readInputValue($('customPercent')));
    if (isNaN(pct) || pct < 0) pct = 0;

    const final = amount * sell * (1 + pct / 100);
    const textToCopy = formatNumber(final) + ' تومان';

    const markCopied = () => {
        copyBtn.classList.add('copied');
        copyBtnText.textContent = 'کپی شد';
        showToast('در کلیپ‌بورد کپی شد: ' + textToCopy, 'success', 2400);
    };

    try {
        await navigator.clipboard.writeText(textToCopy);
        markCopied();
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = textToCopy;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            markCopied();
        } catch {
            copyBtnText.textContent = 'خطا در کپی';
            showToast('کپی ناموفق بود', 'error', 2200);
        }
    }

    setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtnText.textContent = originalText;
    }, 2000);
}

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */
window.addEventListener('load', () => {
    loadPrefs();

    // Restore wheel + arrow-key control on both numeric inputs
    attachNumericControls($('inputPrice'), 1, undefined);
    attachNumericControls($('customPercent'), 1, 1000);

    fetchPrice();
});