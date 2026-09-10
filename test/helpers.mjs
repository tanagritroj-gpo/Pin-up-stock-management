import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..');
export const INDEX_HTML = join(ROOT, 'index.html');
export const FIXTURES = join(HERE, 'fixtures');

/**
 * โหลด index.html จริงลงใน JSDOM แล้วรัน IIFE ของแอป
 * @param {object} [opts]
 * @param {string} [opts.savedState] JSON string ที่จะใส่ลง localStorage ก่อนสคริปต์รัน (ทดสอบ restore)
 * @returns {Promise<{dom: JSDOM, window: Window, document: Document}>}
 */
export async function loadApp(opts = {}) {
  const dom = await JSDOM.fromFile(INDEX_HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    beforeParse(win) {
      if (opts.savedState !== undefined) {
        win.localStorage.setItem('pinup-stock-v1', opts.savedState);
      }
      // jsdom ไม่ได้ expose สิ่งเหล่านี้บน window — เติมจาก Node global
      win.TextDecoder = globalThis.TextDecoder;
      win.TextEncoder = globalThis.TextEncoder;
      // jsdom ยังไม่ implement scrollIntoView — กันสคริปต์ throw
      win.HTMLElement.prototype.scrollIntoView = () => {};
      win.scrollTo = () => {};
    }
  });
  const { window } = dom;
  await new Promise((resolve) => window.addEventListener('load', resolve));
  return { dom, window, document: window.document };
}

/** อ่านไฟล์ fixture เป็นข้อความ */
export function fixture(name) {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

/** จำลองการเลือกไฟล์ในช่อง input[data-target=...] แล้ว dispatch change */
export async function uploadFixture(window, target, fixtureName) {
  const csv = fixture(fixtureName);
  const file = new window.File([csv], fixtureName, { type: 'text/csv' });
  const input = window.document.querySelector(`input[type=file][data-target="${target}"]`);
  if (!input) throw new Error(`ไม่พบช่องอัปโหลด target="${target}"`);
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  await tick();
}

/** อัปโหลดชุดมาตรฐาน stock/bo/sales (+ ตัวเลือกเพิ่ม) */
export async function uploadStandard(window, extra = {}) {
  await uploadFixture(window, 'stock', extra.stock || 'stock.csv');
  await uploadFixture(window, 'bo', extra.bo || 'bo.csv');
  await uploadFixture(window, 'sales', extra.sales || 'sales.csv');
  if (extra.lt) await uploadFixture(window, 'lt', extra.lt);
  if (extra.master) await uploadFixture(window, 'master', extra.master);
  if (extra.incoming) await uploadFixture(window, 'incoming', extra.incoming);
}

/** กดปุ่มคำนวณในหน้าหลัก (ค่าเริ่มต้นกรอง "แสดงเฉพาะที่ต้องเบิก") */
export async function calc(window, { showAll = true } = {}) {
  window.document.getElementById('calcBtn').click();
  await tick();
  if (showAll) showAllRows(window);
}

/** ตั้งตัวกรองสถานะเป็น "แสดงทั้งหมด" เพื่อให้ tableRows เห็นรายการ 'ok' ด้วย */
export function showAllRows(window) {
  const sel = window.document.getElementById('statusFilter');
  sel.value = 'all';
  sel.dispatchEvent(new window.Event('change', { bubbles: true }));
}

/** ตั้งค่าช่องในขั้นตอนที่ 2 */
export function setSetting(window, id, value) {
  const el = window.document.getElementById(id);
  el.value = String(value);
  el.dispatchEvent(new window.Event('change', { bubbles: true }));
}

/** เลือกโหมด Safety Stock: 'fixed' | 'months' */
export function setSafetyMode(window, mode) {
  const radio = window.document.querySelector(`input[name=safetyMode][value="${mode}"]`);
  radio.checked = true;
  radio.dispatchEvent(new window.Event('change', { bubbles: true }));
}

/** map แถวตารางผลลัพธ์ตาม data-code → { header: cellText|inputValue } */
export function tableRows(window) {
  const doc = window.document;
  const headers = [...doc.querySelectorAll('#tableWrap thead th')].map((th) =>
    th.textContent.replace(/[▲▼]/g, '').trim()
  );
  const out = {};
  for (const tr of doc.querySelectorAll('#tableWrap tbody tr')) {
    const cells = [...tr.querySelectorAll('td')].map((td) => {
      const input = td.querySelector('input');
      return input ? input.value : td.textContent.trim();
    });
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    out[tr.getAttribute('data-code')] = row;
  }
  return out;
}

/** อ่านการ์ดสถิติ */
export function stats(window) {
  const doc = window.document;
  const n = (id) => Number(doc.getElementById(id).textContent);
  return {
    total: n('statTotal'),
    critical: n('statCritical'),
    warn: n('statWarn'),
    incoming: n('statIncoming'),
    ok: n('statOk')
  };
}

/** อ่านตารางในกล่องแจ้งเตือน BO orphan */
export function boAlert(window) {
  const box = window.document.getElementById('boAlert');
  if (box.hidden) return null;
  const headers = [...box.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  const rows = [...box.querySelectorAll('tbody tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
  return { head: box.querySelector('.bo-alert-head').textContent, rows };
}

/** แปลงข้อความตัวเลขที่ format แล้ว ("1,580") เป็น number */
export function num(text) {
  return Number(String(text).replace(/[^0-9.-]/g, ''));
}

/** รอ microtask + FileReader/Promise callbacks */
export function tick(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
