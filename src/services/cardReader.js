// Pembaca kartu RFID USB bekerja seperti keyboard: mengetik UID kartu dengan sangat cepat
// lalu (biasanya) menekan Enter. Modul ini mengumpulkan ketikan cepat tersebut tanpa
// kolom input, sehingga halaman absensi cukup menunggu kartu ditempelkan.

export const CARD_READER_DEFAULTS = Object.freeze({
  // Jeda antar karakter dari reader biasanya < 50 ms; ketikan manusia jauh lebih lambat.
  maxGapMs: 120,
  // Reader tanpa Enter: kirim setelah tidak ada karakter baru selama waktu ini.
  idleSubmitMs: 250,
  minLength: 4,
  maxLength: 50,
  // Reader kadang membaca kartu yang sama dua kali dalam satu tempelan.
  duplicateWindowMs: 2000,
});

export function createCardReader(onCard, options = {}) {
  const config = { ...CARD_READER_DEFAULTS, ...options };
  let buffer = "";
  let lastKeyAt = -Infinity;
  let lastCard = null;
  let lastCardAt = -Infinity;

  function emit(time) {
    const card = buffer.trim();
    buffer = "";
    if (card.length < config.minLength || card.length > config.maxLength) return false;
    if (card === lastCard && time - lastCardAt < config.duplicateWindowMs) return false;
    lastCard = card;
    lastCardAt = time;
    onCard(card);
    return true;
  }

  return {
    /** @returns {boolean} true jika tombol dipakai reader (pemanggil sebaiknya preventDefault). */
    handleKey({ key, ctrlKey = false, altKey = false, metaKey = false } = {}, time = Date.now()) {
      if (ctrlKey || altKey || metaKey || typeof key !== "string") return false;
      if (key === "Enter" || key === "Tab") {
        if (!buffer) return false;
        emit(time);
        return true;
      }
      if (key.length !== 1 || /[\u0000-\u001f\u007f]/.test(key)) return false;
      // Ketikan lambat dianggap bukan dari reader: mulai ulang dari karakter ini.
      if (buffer && time - lastKeyAt > config.maxGapMs) buffer = "";
      if (!buffer && key === " ") return false;
      lastKeyAt = time;
      if (buffer.length < config.maxLength + 1) buffer += key;
      return true;
    },
    /** Dipanggil oleh timer; mengirim UID dari reader yang tidak menekan Enter. */
    flushIfIdle(time = Date.now()) {
      if (!buffer || time - lastKeyAt < config.idleSubmitMs) return false;
      if (buffer.trim().length < config.minLength) {
        buffer = "";
        return false;
      }
      return emit(time);
    },
    reset() {
      buffer = "";
      lastKeyAt = -Infinity;
    },
    get pending() {
      return buffer;
    },
  };
}
