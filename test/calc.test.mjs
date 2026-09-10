import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadApp,
  uploadStandard,
  calc,
  tableRows,
  stats,
  setSetting,
  setSafetyMode,
  num
} from './helpers.mjs';

describe('การคำนวณจุดเบิก (โหมด "เดือน" ค่าเริ่มต้น)', () => {
  let window;
  beforeEach(async () => {
    ({ window } = await loadApp());
    await uploadStandard(window, { lt: 'lt.csv' });
    // periodDays=30, defaultLeadTime=10, safetyMode=months, defaultSafety=1.5 (ค่า default ใน HTML)
    await calc(window);
  });

  it('นับสถานะรวมถูกต้อง', () => {
    expect(stats(window)).toEqual({ total: 4, critical: 1, warn: 1, ok: 2 });
  });

  it('P001: warn — reorderPoint 1650, แนะนำเบิก 1580', () => {
    const r = tableRows(window).P001;
    // avgDaily = 900/30 = 30 ; safetyUnits(months) = 30*30*1.5 = 1350
    // reorderPoint = 30*10 + 1350 = 1650 ; แนะนำเบิก = ceil(1650-100) + 30 = 1580
    expect(num(r['เฉลี่ย/วัน'])).toBe(30);
    expect(num(r['เฉลี่ย/เดือน'])).toBe(900);
    expect(num(r['Lead Time'])).toBe(10); // จากไฟล์ lt
    expect(num(r['จุดเบิก'])).toBe(1650);
    expect(num(r['แนะนำเบิก'])).toBe(1580);
    expect(r['สถานะ']).toBe('ควรเบิก');
  });

  it('P002: critical เพราะสต็อกพร้อมใช้จริง ≤ 0', () => {
    const r = tableRows(window).P002;
    expect(num(r['พร้อมใช้จริง'])).toBe(-10); // 0 - 10
    expect(r['สถานะ']).toBe('ขาดสต็อกแล้ว');
    // avgDaily = 10 ; safetyUnits = 10*30*1.5 = 450 ; RP = 10*10 + 450 = 550 ; แนะนำ = ceil(550-0)+10 = 560
    expect(num(r['จุดเบิก'])).toBe(550);
    expect(num(r['แนะนำเบิก'])).toBe(560);
  });

  it('P003: ok — สต็อกคลุมจุดเบิก ไม่มี BO', () => {
    const r = tableRows(window).P003;
    expect(num(r['Lead Time'])).toBe(5); // จากไฟล์ lt
    expect(r['สถานะ']).toBe('เพียงพอ');
    expect(num(r['แนะนำเบิก'])).toBe(0);
  });

  it('P004: ไม่มียอดขายเลย → เฉลี่ยเป็น 0, สถานะเพียงพอ', () => {
    const r = tableRows(window).P004;
    expect(num(r['เฉลี่ย/วัน'])).toBe(0);
    expect(num(r['ยอดขาย/ช่วง'])).toBe(0);
    expect(r['สถานะ']).toBe('เพียงพอ');
  });
});

describe('โหมด Safety Stock', () => {
  it('โหมด "จำนวนคงที่": Safety = ค่าที่กรอกตรง ๆ (ไม่คูณยอดขาย)', async () => {
    const { window } = await loadApp();
    await uploadStandard(window, { lt: 'lt.csv' });
    setSafetyMode(window, 'fixed');
    setSetting(window, 'defaultSafety', 100);
    await calc(window);

    const r = tableRows(window).P001;
    // fixed: safetyUnits = 100 ; RP = 30*10 + 100 = 400 ; แนะนำ = ceil(400-100) + 30 = 330
    expect(num(r['จุดเบิก'])).toBe(400);
    expect(num(r['แนะนำเบิก'])).toBe(330);
    // หัวคอลัมน์เปลี่ยนตามโหมด และไม่มีคอลัมน์ "Safety (หน่วย)"
    const headers = [...window.document.querySelectorAll('#tableWrap thead th')].map((th) =>
      th.textContent.trim()
    );
    expect(headers).toContain('Safety (จำนวน)');
    expect(headers).not.toContain('Safety (หน่วย)');
  });

  it('โหมด "เดือน": มีคอลัมน์ "Safety (หน่วย)" แสดงผลลัพธ์ที่แปลงแล้ว', async () => {
    const { window } = await loadApp();
    await uploadStandard(window, { lt: 'lt.csv' });
    setSafetyMode(window, 'months');
    setSetting(window, 'defaultSafety', 2);
    await calc(window);

    const headers = [...window.document.querySelectorAll('#tableWrap thead th')].map((th) =>
      th.textContent.trim()
    );
    expect(headers).toContain('Safety (เดือน)');
    expect(headers).toContain('Safety (หน่วย)');

    const r = tableRows(window).P001;
    // avgDaily 30 → Safety(หน่วย) = 30*30*2 = 1800
    expect(num(r['Safety (หน่วย)'])).toBe(1800);
  });

  it('เปลี่ยนโหมดหลังคำนวณแล้ว คำนวณใหม่ทันทีโดยไม่ต้องกดปุ่ม', async () => {
    const { window } = await loadApp();
    await uploadStandard(window, { lt: 'lt.csv' });
    await calc(window);
    const before = num(tableRows(window).P001['จุดเบิก']);

    setSafetyMode(window, 'fixed');
    setSetting(window, 'defaultSafety', 0);
    // ไม่กด calc — ต้อง re-render เอง
    const after = num(tableRows(window).P001['จุดเบิก']);
    expect(after).not.toBe(before);
    expect(after).toBe(300); // 30*10 + 0
  });
});

describe('การแก้ค่ารายตัวในตาราง (override)', () => {
  it('แก้ Lead Time ในตาราง แล้วคำนวณใหม่', async () => {
    const { window } = await loadApp();
    await uploadStandard(window);
    await calc(window);

    const input = window.document.querySelector(
      '#tableWrap tr[data-code="P001"] input[data-field="leadTime"]'
    );
    input.value = '0';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    const r = tableRows(window).P001;
    // lead 0 → RP = 0 + 1350 = 1350
    expect(num(r['จุดเบิก'])).toBe(1350);
  });

  it('เว้นช่องว่าง = กลับไปใช้ค่าเริ่มต้น', async () => {
    const { window } = await loadApp();
    await uploadStandard(window);
    await calc(window);

    const sel = '#tableWrap tr[data-code="P002"] input[data-field="leadTime"]';
    let input = window.document.querySelector(sel);
    input.value = '99';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(num(tableRows(window).P002['Lead Time'])).toBe(99);

    input = window.document.querySelector(sel);
    input.value = '';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(num(tableRows(window).P002['Lead Time'])).toBe(10); // default
  });
});
