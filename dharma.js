// dharma.js — Three Dharma Teachers chat (Gemini API)
import { buildGeminiUrl } from './scripts/gemini-api.js';

// ── Constants ──
const AV = { tib: '🙏', zen: '⛰️', hum: '🪷' };
const AVC = { tib: 'ai-tib', zen: 'ai-zen', hum: 'ai-hum' };
const TRAD = { tib: 'dalai', zen: 'ddm', hum: 'fgs' };
const CMP_COL = { dalai: 'tib', ddm: 'zen', fgs: 'hum' };
const SUGG = [
  '我最近很煩惱，不知道未來怎樣',
  '我和家人吵架了，心裡很難過',
  '我覺得自己做什麼都沒有意義',
  '睡不著，腦子一直轉不下來',
  '我覺得很失落',
  '工作壓力很大，不知道撐不撐得住'
];

// ── System prompts ──
const SYSTEM_PROMPTS = {
  dalai: `你是一位藏傳佛教格魯派的慈悲導師，以達賴喇嘛風格對話。
理論基礎：入菩薩行論、菩提道次第廣論、般若心經。
核心：菩提心、慈悲、空性智慧。
回應方式：先承接苦難讓人感到被理解；引導看見苦的本質（無常、執著）；
提醒這是人類共同經驗，你並不孤單；給予慈悲修行建議。
你習慣說：「我想先讓你知道，這種感受非常正常……」
「全世界有幾十億人，此刻很可能有許多人也有類似的感受……」
逆境觀：困難的時刻正在給你力量，苦痛無常，是生命的常數。
語氣：溫暖包容，像充滿慈悲的長者。長度150-250字。繁體中文。`,

  ddm: `你是一位融合法鼓山聖嚴法師風格的禪宗導師。
理論基礎：金剛經、六祖壇經、維摩詰經。
核心：無我、覺照、心靈環保。名言：「面對它、接受它、處理它、放下它。」
回應方式：不過度同情，直接切入核心；用反問引導覺察；
引導回到當下——「這一刻你在做什麼？把這一刻做好。」
強調：過去不悔恨，未來不憂慮，只有當下是真實的。
你習慣說：「飢來吃飯，睏來眠。」「心隨境轉是凡夫，境隨心轉是聖賢。」
「需要的不多，想要的太多。」「忙沒關係，不煩就好。」
語氣：簡潔直接，有時帶鋒利反問。長度80-150字。繁體中文。`,

  fgs: `你是一位人間佛教導師，融合佛光山星雲大師風格對話。
理論基礎：阿含經（四聖諦）、法華經（人人可成佛）、華嚴經（緣起）。
核心：佛法生活化、給人信心給人歡喜、三好運動（做好事說好話存好心）。
回應方式：溫暖親切貼近台灣日常；從緣起看困境（一切因緣聚合，可以改變）；
強調行動——去做一件小善事，心境就不一樣了。
你習慣說：「有苦有樂的人生是充實的，有成有敗的人生是合理的。」
「聰明的人凡事往好處想，以歡喜的心想歡喜的事。」
「給人歡喜，就是給自己歡喜。」
語氣：溫暖積極，像慈祥實際的長輩。長度150-220字。繁體中文。`
};

const MAX_ROUNDS = 10;

// ── State ──
let geminiApiKey = null;
let geminiModel = 'gemini-3.1-flash-lite-preview';
let hist = { tib: [], zen: [], hum: [] };
let compareHistories = { dalai: [], ddm: [], fgs: [] };
let busy = { tib: false, zen: false, hum: false, cmp: false };

// ── Load settings from chrome.storage.sync ──
async function loadSettings() {
  const items = await chrome.storage.sync.get({
    geminiApiKey: '',
    translationModel: 'gemini-3.1-flash-lite-preview'
  });
  geminiApiKey = items.geminiApiKey;
  geminiModel = items.translationModel;

  const banner = document.getElementById('noKeyBanner');
  if (!geminiApiKey) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

// Open options page link
document.getElementById('openOptionsLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'options.html' });
});

// ── Gemini API call ──
async function callGemini(tradition, messages) {
  if (!geminiApiKey) throw new Error('請先至設定頁面輸入 Gemini API Key');

  const apiUrl = buildGeminiUrl(geminiModel, geminiApiKey);

  // Convert messages to Gemini format (role: user/model)
  const contents = messages.slice(-MAX_ROUNDS * 2).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const payload = {
    contents,
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPTS[tradition] }]
    }
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || 'HTTP ' + response.status);
  }

  // Extract text (handle thinking models with multiple parts)
  const parts = result.candidates?.[0]?.content?.parts;
  if (parts) {
    const textPart = parts.find(p => p.text !== undefined && !p.thought);
    if (textPart) return textPart.text;
  }

  if (result.promptFeedback?.blockReason) {
    throw new Error('API 拒絕回應：' + result.promptFeedback.blockReason);
  }

  throw new Error('無法取得回應');
}

// ── UI: Intro toggle ──
document.getElementById('infoBtn').addEventListener('click', () => {
  const panel = document.getElementById('introPanel');
  const btn = document.getElementById('infoBtn');
  const open = panel.classList.toggle('open');
  btn.textContent = open ? '收起' : '關於';
  btn.classList.toggle('open', open);
});

// ── UI: Tab switching ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const v = tab.dataset.v;
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + v).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => {
      t.className = 'tab';
      if (t.dataset.v === v) t.classList.add('act-' + (v === 'compare' ? 'cmp' : v));
    });
  });
});

// ── UI: Chips ──
function renderChips() {
  const cmpEl = document.getElementById('cmp-chips');
  cmpEl.innerHTML = '';
  SUGG.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip cc';
    chip.dataset.mode = 'compare';
    chip.dataset.text = s;
    chip.textContent = s;
    cmpEl.appendChild(chip);
  });
  ['tib', 'zen', 'hum'].forEach(t => {
    const el = document.getElementById(t + '-chips');
    if (!el) return;
    el.innerHTML = '';
    SUGG.forEach(s => {
      const chip = document.createElement('div');
      chip.className = `chip ${t[0]}c`;
      chip.dataset.mode = t;
      chip.dataset.text = s;
      chip.textContent = s;
      el.appendChild(chip);
    });
  });
}

document.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip[data-mode]');
  if (!chip) return;
  const mode = chip.dataset.mode;
  const text = chip.dataset.text;
  if (mode === 'compare') {
    document.getElementById('cmp-input').value = text;
    sendCmp();
  } else {
    document.getElementById(mode + '-input').value = text;
    sendS(mode);
  }
});

// ── UI: Message rendering ──
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function addMsg(cid, role, text, t) {
  const el = document.getElementById(cid);
  const w = el.querySelector('.welcome');
  if (w) w.remove();
  const d = document.createElement('div');
  d.className = `msg ${role}`;
  d.innerHTML = `<div class="av ${role === 'ai' ? AVC[t] : 'uav'}">${role === 'ai' ? AV[t] : '你'}</div><div class="bbl">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

function addThink(cid, t) {
  const el = document.getElementById(cid);
  const d = document.createElement('div');
  d.className = 'msg ai';
  d.id = 'th-' + cid;
  d.innerHTML = `<div class="av ${AVC[t]}">${AV[t]}</div><div class="bbl"><div class="thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

function rmThink(cid) {
  const e = document.getElementById('th-' + cid);
  if (e) e.remove();
}

// ── Send: single tradition ──
async function sendS(t) {
  const inp = document.getElementById(t + '-input');
  const text = inp.value.trim();
  if (!text || busy[t]) return;
  busy[t] = true;
  inp.value = '';
  document.getElementById(t + '-send').disabled = true;
  addMsg('single-' + t, 'user', text, t);
  hist[t].push({ role: 'user', content: text });
  addThink('single-' + t, t);
  try {
    const r = await callGemini(TRAD[t], hist[t]);
    rmThink('single-' + t);
    hist[t].push({ role: 'assistant', content: r });
    addMsg('single-' + t, 'ai', r, t);
  } catch (e) {
    rmThink('single-' + t);
    hist[t].pop();
    addMsg('single-' + t, 'ai', '（錯誤：' + e.message + '）', t);
  }
  busy[t] = false;
  document.getElementById(t + '-send').disabled = false;
  inp.focus();
}

// ── Send: compare (all three in parallel) ──
async function sendCmp() {
  const inp = document.getElementById('cmp-input');
  const text = inp.value.trim();
  if (!text || busy.cmp) return;
  busy.cmp = true;
  inp.value = '';
  document.getElementById('cmp-send').disabled = true;

  const traditions = ['dalai', 'ddm', 'fgs'];
  traditions.forEach(tradition => compareHistories[tradition].push({ role: 'user', content: text }));
  ['tib', 'zen', 'hum'].forEach(t => { addMsg('cmp-' + t, 'user', text, t); addThink('cmp-' + t, t); });

  const results = await Promise.allSettled(
    traditions.map(tradition => callGemini(tradition, compareHistories[tradition]))
  );

  traditions.forEach((tradition, i) => {
    const col = CMP_COL[tradition];
    rmThink('cmp-' + col);
    if (results[i].status === 'fulfilled') {
      const reply = results[i].value;
      compareHistories[tradition].push({ role: 'assistant', content: reply });
      addMsg('cmp-' + col, 'ai', reply, col);
    } else {
      compareHistories[tradition].pop();
      addMsg('cmp-' + col, 'ai', '（錯誤：' + results[i].reason.message + '）', col);
    }
  });

  busy.cmp = false;
  document.getElementById('cmp-send').disabled = false;
  inp.focus();
}

// ── Keyboard / IME handling ──
function isImeComposing(e) {
  return e.isComposing || e.keyCode === 229 || e.which === 229 || e.target?.dataset.composing === 'true';
}

document.getElementById('cmp-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !isImeComposing(e)) { e.preventDefault(); sendCmp(); }
});
['tib', 'zen', 'hum'].forEach(t => {
  document.getElementById(t + '-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isImeComposing(e)) { e.preventDefault(); sendS(t); }
  });
});

// ── Send button click handlers ──
document.getElementById('cmp-send').addEventListener('click', sendCmp);
['tib', 'zen', 'hum'].forEach(t => {
  document.getElementById(t + '-send').addEventListener('click', () => sendS(t));
});

// ── Textarea auto-resize + IME tracking ──
document.querySelectorAll('textarea').forEach(ta => {
  ta.dataset.composing = 'false';
  ta.addEventListener('compositionstart', function () { this.dataset.composing = 'true'; });
  ta.addEventListener('compositionend', function () { this.dataset.composing = 'false'; });
  ta.addEventListener('blur', function () { this.dataset.composing = 'false'; });
  ta.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 88) + 'px';
  });
});

// ── Boot ──
loadSettings();
renderChips();
