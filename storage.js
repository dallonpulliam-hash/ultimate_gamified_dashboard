/* Questline persistence layer: the app owns one state object; this module only serializes it. */
(() => {
  "use strict";
  const KEY = "questline-state-v1";
  const scopedKey = userId => `${KEY}:${encodeURIComponent(userId || "guest")}`;
  const Storage = {
    load(userId) {
      try {
        const raw = localStorage.getItem(scopedKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (error) {
        console.warn("Questline could not load saved data.", error);
        return null;
      }
    },
    save(state, userId) {
      try {
        localStorage.setItem(scopedKey(userId), JSON.stringify(state));
        return true;
      } catch (error) {
        console.warn("Questline could not save data.", error);
        return false;
      }
    },
    clear(userId) {
      try { localStorage.removeItem(scopedKey(userId)); return true; }
      catch (error) { console.warn("Questline could not clear data.", error); return false; }
    }
  };
  window.QuestlineStorage = Storage;
})();
