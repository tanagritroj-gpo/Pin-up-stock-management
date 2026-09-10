import { describe, it, expect } from 'vitest';
import { loadApp, uploadFixture, uploadStandard, calc, tableRows, stats } from './helpers.mjs';

describe('การนำเข้าไฟล์ + จับคู่คอลัมน์', () => {
  it('อ่านไฟล์สต็อกและรายงานจำนวนรายการ', async () => {
    const { window } = await loadApp();
    await uploadFixture(window, 'stock', 'stock.csv');
    const status = window.document.getElementById('status-stock');
    expect(status.textContent).toBe('โหลดแล้ว 4 รายการ');
    expect(status.className).toContain('loaded');
  });

  it('ปุ่มคำนวณจะเปิดเมื่อครบ 3 ไฟล์จำเป็น (stock+bo+sales)', async () => {
    const { window } = await loadApp();
    const btn = window.document.getElementById('calcBtn');
    expect(btn.disabled).toBe(true);
    await uploadFixture(window, 'stock', 'stock.csv');
    expect(btn.disabled).toBe(true);
    await uploadFixture(window, 'bo', 'bo.csv');
    expect(btn.disabled).toBe(true);
    await uploadFixture(window, 'sales', 'sales.csv');
    expect(btn.disabled).toBe(false);
    expect(window.document.getElementById('modalCalcBtn').disabled).toBe(false);
  });

  it('แจ้ง error เมื่อไม่พบคอลัมน์รหัสสินค้า', async () => {
    const { window } = await loadApp();
    const file = new window.File(['foo,bar\n1,2\n'], 'bad.csv', { type: 'text/csv' });
    const input = window.document.querySelector('input[data-target="stock"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    const status = window.document.getElementById('status-stock');
    expect(status.textContent).toContain('ไม่พบคอลัมน์รหัสสินค้า');
    expect(status.className).toContain('error');
  });

  it('หาแถวหัวคอลัมน์อัตโนมัติ — มองข้ามแถวชื่อรายงาน/แถวว่างด้านบน', async () => {
    const { window } = await loadApp();
    await uploadFixture(window, 'stock', 'stock-with-title.csv');
    const status = window.document.getElementById('status-stock');
    expect(status.textContent).toBe('โหลดแล้ว 4 รายการ');
    expect(status.className).toContain('loaded');
  });

  it('รองรับ alias Material / Unrestricted และจับคู่แบบตรงทั้งช่องก่อน', async () => {
    const { window } = await loadApp();
    await uploadFixture(window, 'stock', 'stock-batch.csv');
    await uploadFixture(window, 'bo', 'bo.csv');
    await uploadFixture(window, 'sales', 'sales.csv');
    await calc(window);
    const rows = tableRows(window);
    // B001 มี 3 แถว (LOT-1..3) → รวมเป็น 100+50+25 = 175
    expect(rows.B001).toBeDefined();
    expect(rows.B001['สต็อก']).toBe('175');
    expect(rows.B002['สต็อก']).toBe('7');
  });

  it('รวมยอดแถวซ้ำ (batch) อัตโนมัติและแจ้งจำนวนแถวที่รวม', async () => {
    const { window } = await loadApp();
    await uploadFixture(window, 'stock', 'stock-batch.csv');
    const status = window.document.getElementById('status-stock');
    expect(status.textContent).toContain('รวม 4 แถว → 2 รายการ');
    expect(status.textContent).toContain('พบรหัสซ้ำ 2 แถว');
  });

  it('Master List ไม่เพิ่มแถวในตารางเบิก — ใช้เติมชื่อเท่านั้น', async () => {
    const { window } = await loadApp();
    await uploadStandard(window, { master: 'master.csv' });
    await calc(window);
    const rows = tableRows(window);
    const codes = Object.keys(rows).sort();
    // P999 (master-only) ต้องไม่อยู่ · P900 (BO orphan) ต้องไม่อยู่ในตารางหลัก
    expect(codes).toEqual(['P001', 'P002', 'P003', 'P004']);
    expect(stats(window).total).toBe(4);
  });
});
