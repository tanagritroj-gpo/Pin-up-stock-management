import { describe, it, expect } from 'vitest';
import {
  loadApp,
  uploadStandard,
  uploadFixture,
  calc,
  boAlert,
  num
} from './helpers.mjs';

describe('Modal นำเข้าไฟล์ / เทมเพลต', () => {
  it('เปิด/ปิด modal ด้วยปุ่ม, กากบาท, Esc', async () => {
    const { window } = await loadApp();
    const doc = window.document;
    const modal = doc.getElementById('importModal');
    expect(modal.hidden).toBe(true);

    doc.getElementById('openImportBtn').click();
    expect(modal.hidden).toBe(false);
    expect(doc.body.style.overflow).toBe('hidden');

    modal.querySelector('[data-close-modal]').click();
    expect(modal.hidden).toBe(true);
    expect(doc.body.style.overflow).toBe('');

    doc.getElementById('openImportBtn').click();
    doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.hidden).toBe(true);
  });

  it('modal เทมเพลตมี 6 รายการให้ดาวน์โหลด', async () => {
    const { window } = await loadApp();
    const doc = window.document;
    doc.getElementById('openTmplBtn').click();
    expect(doc.getElementById('tmplModal').hidden).toBe(false);
    expect(doc.querySelectorAll('#tmplModal .tmpl-row [data-tmpl]').length).toBe(6);
  });
});

describe('ปุ่มส่งออก CSV', () => {
  it('ปิดใช้งานจนกว่าจะคำนวณเสร็จและมีรายการ', async () => {
    const { window } = await loadApp();
    const exportBtns = () => [...window.document.querySelectorAll('.js-export')];
    expect(exportBtns().every((b) => b.disabled)).toBe(true);

    await uploadStandard(window);
    expect(exportBtns().every((b) => b.disabled)).toBe(true); // ยังไม่กดคำนวณ

    await calc(window);
    expect(exportBtns().every((b) => !b.disabled)).toBe(true);
  });

  it('CSV มีหัวคอลัมน์ครบและมีแถว BO orphan อยู่ต้นไฟล์', async () => {
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

    await uploadStandard(window, { master: 'master.csv' });
    await calc(window);
    window.document.querySelector('.js-export').click();
    await new Promise((r) => setTimeout(r, 20));

    const lines = captured.replace(/^﻿/, '').split('\r\n');
    expect(lines[0]).toContain('ยอดขายเฉลี่ยต่อเดือน');
    expect(lines[0]).toContain('Safety Stock (หน่วยที่ใช้จริง)');
    // แถวแรกหลัง header = BO orphan P900
    expect(lines[1]).toContain('P900');
    expect(lines[1]).toContain('ยาพิเศษ Z (จาก Master List)');
  });
});

describe('กล่องแจ้งเตือน BO orphan', () => {
  it('แสดงเฉพาะรายการที่มี BO แต่ไม่มีในไฟล์สต็อก', async () => {
    const { window } = await loadApp();
    await uploadStandard(window);
    await calc(window);
    const alert = boAlert(window);
    expect(alert).not.toBeNull();
    expect(alert.head).toContain('1 รายการ');
    expect(alert.rows).toHaveLength(1);
    expect(alert.rows[0]['รหัสสินค้า']).toBe('P900');
  });

  it('เติมชื่อสินค้าจาก Master List (ไม่ขึ้น —)', async () => {
    const { window } = await loadApp();
    await uploadStandard(window, { master: 'master.csv' });
    await calc(window);
    const alert = boAlert(window);
    expect(alert.rows[0]['ชื่อสินค้า']).toBe('ยาพิเศษ Z (จาก Master List)');
  });

  it('ปุ่ม "ส่งออก CSV" ในกล่อง — ได้ไฟล์เฉพาะรายการ BO orphan', async () => {
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

    await uploadStandard(window, { master: 'master.csv' });
    await calc(window);
    window.document.querySelector('.js-export-bo').click();
    await new Promise((r) => setTimeout(r, 20));

    const lines = captured.replace(/^﻿/, '').split('\r\n');
    expect(lines[0]).toBe('รหัสสินค้า,ชื่อสินค้า,BO ค้างส่ง,ยอดขายช่วงเวลา,ยอดขายเฉลี่ยต่อเดือน,ยอดขายเฉลี่ยต่อวัน');
    expect(lines).toHaveLength(2); // header + P900 เท่านั้น
    expect(lines[1]).toContain('P900');
    expect(lines[1]).toContain('ยาพิเศษ Z (จาก Master List)');
  });

  it('มีคอลัมน์ยอดขาย/ช่วง, เฉลี่ย/เดือน, เฉลี่ย/วัน จากไฟล์ยอดขาย', async () => {
    const { window } = await loadApp();
    await uploadStandard(window);
    await calc(window);
    const r = boAlert(window).rows[0];
    // P900: sales 150, periodDays 30 → avgDaily 5, avgMonthly 150
    expect(num(r['ยอดขาย/ช่วง'])).toBe(150);
    expect(num(r['เฉลี่ย/เดือน'])).toBe(150);
    expect(num(r['เฉลี่ย/วัน'])).toBe(5);
  });

  it('แสดง — เมื่อรหัส BO orphan ไม่มีในไฟล์ยอดขายเลย', async () => {
    const { window } = await loadApp();
    await uploadFixture(window, 'stock', 'stock.csv');
    await uploadFixture(window, 'bo', 'bo.csv');
    // sales ที่ไม่มี P900
    const salesNoOrphan = 'รหัสสินค้า,จำนวนขาย\nP001,900\nP002,300\n';
    const file = new window.File([salesNoOrphan], 'sales2.csv', { type: 'text/csv' });
    const input = window.document.querySelector('input[data-target="sales"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    await calc(window);

    const r = boAlert(window).rows[0];
    expect(r['ยอดขาย/ช่วง']).toBe('—');
    expect(r['เฉลี่ย/เดือน']).toBe('—');
    expect(r['เฉลี่ย/วัน']).toBe('—');
  });
});

describe('การบันทึก/กู้คืนข้อมูล (localStorage)', () => {
  it('บันทึกแล้วกู้คืนได้ในหน้าใหม่ พร้อมคำนวณอัตโนมัติ', async () => {
    const first = await loadApp();
    await uploadStandard(first.window, { lt: 'lt.csv', master: 'master.csv' });
    first.window.document.querySelector('input[name=safetyMode][value="fixed"]').click();
    first.window.document.getElementById('defaultSafety').value = '77';
    first.window.document
      .getElementById('defaultSafety')
      .dispatchEvent(new first.window.Event('change', { bubbles: true }));
    await calc(first.window);

    const saved = first.window.localStorage.getItem('pinup-stock-v1');
    expect(saved).toBeTruthy();

    const second = await loadApp({ savedState: saved });
    const doc = second.window.document;
    expect(doc.getElementById('restoreBar').classList.contains('show')).toBe(true);
    expect(doc.getElementById('status-stock').textContent).toContain('กู้คืนแล้ว');
    expect(doc.getElementById('results').style.display).toBe('block');
    expect(doc.querySelector('input[name=safetyMode]:checked').value).toBe('fixed');
    expect(doc.getElementById('defaultSafety').value).toBe('77');
    // ตารางถูก render ใหม่
    expect(doc.querySelectorAll('#tableWrap tbody tr').length).toBeGreaterThan(0);
  });

  it('รองรับข้อมูลเก่ารูปแบบ safetyMonths → โหมด "เดือน"', async () => {
    const legacy = JSON.stringify({
      v: 1,
      savedAt: new Date().toISOString(),
      data: { stock: {}, bo: {}, sales: {}, lt: null, master: null },
      settings: { periodDays: '30', defaultLeadTime: '10', safetyMonths: '1.5' }
    });
    const { window } = await loadApp({ savedState: legacy });
    expect(window.document.querySelector('input[name=safetyMode]:checked').value).toBe('months');
    expect(window.document.getElementById('defaultSafety').value).toBe('1.5');
  });
});
