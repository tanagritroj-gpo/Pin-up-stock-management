import { describe, it, expect } from 'vitest';
import {
  loadApp,
  uploadFixture,
  uploadStandard,
  calc,
  tableRows,
  stats,
  num
} from './helpers.mjs';

describe('ไฟล์ที่ 6: รายการที่เบิกไปแล้ว (รอของเข้าคลัง)', () => {
  it('ไม่บังคับ — ปุ่มคำนวณเปิดได้โดยไม่ต้องมีไฟล์นี้', async () => {
    const { window } = await loadApp();
    await uploadStandard(window);
    expect(window.document.getElementById('calcBtn').disabled).toBe(false);
  });

  it('คอลัมน์ "รอเข้าคลัง" โผล่เฉพาะเมื่ออัปโหลดไฟล์ที่ 6', async () => {
    const { window } = await loadApp();
    await uploadStandard(window);
    await calc(window);
    let headers = [...window.document.querySelectorAll('#tableWrap thead th')].map((th) =>
      th.textContent.replace(/[▲▼]/g, '').trim()
    );
    expect(headers).not.toContain('รอเข้าคลัง');

    await uploadFixture(window, 'incoming', 'incoming.csv');
    await calc(window);
    headers = [...window.document.querySelectorAll('#tableWrap thead th')].map((th) =>
      th.textContent.replace(/[▲▼]/g, '').trim()
    );
    expect(headers).toContain('รอเข้าคลัง');
  });

  it('หัก "รอเข้าคลัง" ออกจากแนะนำเบิก และเปลี่ยนสถานะเป็น "รอของเข้า" เมื่อคลุมครบ', async () => {
    const { window } = await loadApp();
    await uploadStandard(window, { lt: 'lt.csv', incoming: 'incoming.csv' });
    await calc(window);
    const rows = tableRows(window);

    // P001: ต้องเบิกรวม 1580, รอเข้า 500 → เหลือแนะนำเบิก 1080, ยังเป็น "ควรเบิก"
    expect(num(rows.P001['รอเข้าคลัง'])).toBe(500);
    expect(num(rows.P001['แนะนำเบิก'])).toBe(1080);
    expect(rows.P001['สถานะ']).toBe('ควรเบิก');

    // P002: ต้องเบิกรวม 560, รอเข้า 560 → แนะนำเบิก 0, สถานะ "รอของเข้า" (เดิม critical)
    expect(num(rows.P002['รอเข้าคลัง'])).toBe(560);
    expect(num(rows.P002['แนะนำเบิก'])).toBe(0);
    expect(rows.P002['สถานะ']).toBe('รอของเข้า');
  });

  it('นับการ์ดสถิติ "รอของเข้า" ถูกต้อง', async () => {
    const { window } = await loadApp();
    await uploadStandard(window, { lt: 'lt.csv', incoming: 'incoming.csv' });
    await calc(window);
    expect(stats(window)).toEqual({ total: 4, critical: 0, warn: 1, incoming: 1, ok: 2 });
  });

  it('รวมยอดแถวซ้ำ (batch) ในไฟล์รอเข้าให้อัตโนมัติ + รองรับ alias "On Order"', async () => {
    const { window } = await loadApp();
    await uploadFixture(window, 'stock', 'stock.csv');
    await uploadFixture(window, 'bo', 'bo.csv');
    await uploadFixture(window, 'sales', 'sales.csv');
    const csv = 'รหัสสินค้า,On Order\nP002,300\nP002,260\n';
    const file = new window.File([csv], 'oo.csv', { type: 'text/csv' });
    const input = window.document.querySelector('input[data-target="incoming"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));

    const status = window.document.getElementById('status-incoming');
    expect(status.textContent).toContain('พบรหัสซ้ำ');
    await calc(window);
    // 300 + 260 = 560 รอเข้า → P002 แนะนำเบิก 0
    expect(num(tableRows(window).P002['รอเข้าคลัง'])).toBe(560);
  });

  it('แจ้ง error เมื่อไม่พบคอลัมน์จำนวนรอเข้า', async () => {
    const { window } = await loadApp();
    const file = new window.File(['รหัสสินค้า,อย่างอื่น\nP001,5\n'], 'bad.csv', { type: 'text/csv' });
    const input = window.document.querySelector('input[data-target="incoming"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    const status = window.document.getElementById('status-incoming');
    expect(status.textContent).toContain('ไม่พบคอลัมน์จำนวนรอเข้า');
    expect(status.className).toContain('error');
  });

  it('CSV ส่งออกมีคอลัมน์ "รอเข้าคลัง"', async () => {
    const { window } = await loadApp();
    let captured = null;
    window.URL.createObjectURL = () => 'blob:test';
    window.URL.revokeObjectURL = () => {};
    window.Blob = class {
      constructor(parts) {
        captured = parts.join('');
      }
    };
    window.HTMLAnchorElement.prototype.click = function () {};

    await uploadStandard(window, { lt: 'lt.csv', incoming: 'incoming.csv' });
    await calc(window);
    window.document.querySelector('.js-export').click();
    await new Promise((r) => setTimeout(r, 20));

    const lines = captured.replace(/^﻿/, '').split('\r\n');
    expect(lines[0]).toContain('รอเข้าคลัง');
    const p002 = lines.find((l) => l.includes('P002'));
    expect(p002).toContain('"560"');
  });
});
