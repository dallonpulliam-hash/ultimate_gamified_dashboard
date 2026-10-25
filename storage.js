/* Questline persistence layer: the app owns one state object; this module only serializes it. */
(() => {
  "use strict";
  const KEY = "questline-state-v1";
  const Storage = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (error) {
        console.warn("Questline could not load saved data.", error);
        return null;
      }
    },
    save(state) {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (error) {
        console.warn("Questline could not save data.", error);
        return false;
      }
    },
    clear() {
      try { localStorage.removeItem(KEY); return true; }
      catch (error) { console.warn("Questline could not clear data.", error); return false; }
    }
  };
  window.QuestlineStorage = Storage;
})();
