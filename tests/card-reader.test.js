import test from "node:test";
import assert from "node:assert/strict";
import { createCardReader } from "../src/services/cardReader.js";

function scan(reader, text, start, { gap = 10, enter = true } = {}) {
  let time = start;
  const consumed = [];
  for (const key of text) {
    consumed.push(reader.handleKey({ key }, time));
    time += gap;
  }
  if (enter) consumed.push(reader.handleKey({ key: "Enter" }, time));
  return { time, consumed };
}

test("UID dari reader terbaca utuh termasuk nol di depan, lalu Enter mengirimnya", () => {
  const cards = [];
  const reader = createCardReader((card) => cards.push(card));
  const { consumed } = scan(reader, "0108273879", 0);
  assert.deepEqual(cards, ["0108273879"]);
  assert.ok(consumed.every(Boolean));
  assert.equal(reader.pending, "");
});

test("siswa A lalu B dan seterusnya bisa tap beruntun tanpa jeda", () => {
  const cards = [];
  const reader = createCardReader((card) => cards.push(card));
  let { time } = scan(reader, "0108273879", 0);
  ({ time } = scan(reader, "2667147430", time + 1));
  scan(reader, "0710685415", time + 1);
  assert.deepEqual(cards, ["0108273879", "2667147430", "0710685415"]);
});

test("pembacaan ganda kartu yang sama dalam satu tempelan diabaikan, tapi boleh lagi setelah jeda", () => {
  const cards = [];
  const reader = createCardReader((card) => cards.push(card), { duplicateWindowMs: 2000 });
  let { time } = scan(reader, "AB12CD34", 0);
  ({ time } = scan(reader, "AB12CD34", time + 50));
  assert.deepEqual(cards, ["AB12CD34"]);
  scan(reader, "AB12CD34", time + 2500);
  assert.deepEqual(cards, ["AB12CD34", "AB12CD34"]);
});

test("reader tanpa Enter dikirim setelah idle; UID terlalu pendek dibuang", () => {
  const cards = [];
  const reader = createCardReader((card) => cards.push(card), { idleSubmitMs: 250 });
  const { time } = scan(reader, "99887766", 0, { enter: false });
  assert.equal(reader.flushIfIdle(time + 100), false);
  assert.equal(reader.flushIfIdle(time + 300), true);
  assert.deepEqual(cards, ["99887766"]);

  const short = scan(reader, "12", time + 5000, { enter: false });
  assert.equal(reader.flushIfIdle(short.time + 300), false);
  assert.equal(reader.pending, "");
  assert.deepEqual(cards, ["99887766"]);
});

test("ketikan lambat (bukan reader) tidak menjadi absensi", () => {
  const cards = [];
  const reader = createCardReader((card) => cards.push(card), { maxGapMs: 120 });
  scan(reader, "12345678", 0, { gap: 400 });
  assert.deepEqual(cards, []);
});

test("Enter tanpa kartu, spasi awal, kombinasi Ctrl/Alt, dan tombol khusus tidak dipakai reader", () => {
  const cards = [];
  const reader = createCardReader((card) => cards.push(card));
  assert.equal(reader.handleKey({ key: "Enter" }, 0), false);
  assert.equal(reader.handleKey({ key: " " }, 0), false);
  assert.equal(reader.handleKey({ key: "r", ctrlKey: true }, 0), false);
  assert.equal(reader.handleKey({ key: "Shift" }, 0), false);
  assert.equal(reader.handleKey({ key: "ArrowDown" }, 0), false);
  assert.equal(reader.handleKey(undefined, 0), false);
  assert.deepEqual(cards, []);
});

test("UID lebih dari 50 karakter ditolak", () => {
  const cards = [];
  const reader = createCardReader((card) => cards.push(card));
  scan(reader, "A".repeat(51), 0);
  assert.deepEqual(cards, []);
  scan(reader, "B".repeat(50), 10000);
  assert.deepEqual(cards, ["B".repeat(50)]);
});
