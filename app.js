/* Questline application state engine. No framework or build step required. */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    if (crypto.getRandomValues) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      return [...bytes].map((byte,index)=>`${[4,6,8,10].includes(index)?"-":""}${byte.toString(16).padStart(2,"0")}`).join("");
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,char=>{
      const random=Math.random()*16|0;
      return (char==="x"?random:(random&3|8)).toString(16);
    });
  };
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const THEMES = {
    dark: { name:"Midnight", description:"Classic Questline dark", level:1, color:"#a78bfa", bg:"#11172a" },
    light: { name:"Daylight", description:"Clean and bright", level:1, color:"#7255d9", bg:"#e9eef9" },
    nordic: { name:"Nordic Frost", description:"Ice-blue calm", level:6, color:"#79d4ed", bg:"#111d2b" },
    cyber: { name:"Cyber Slate", description:"Electric purple edge", level:6, color:"#b58aff", bg:"#17171e" },
    neon: { name:"Quantum Neon", description:"High-contrast master mode", level:16, color:"#4cf6d2", bg:"#07111b" }
  };
  const BASE_TAGS = ["Work", "Personal"];
  const ADEPT_TAGS = ["Side Hustle", "Deep Work", "Health"];
  const MASTER_TAGS = ["Legacy", "High ROI"];
  const STATUS = [
    { key:"todo", label:"To-Do", color:"#a78bfa" },
    { key:"progress", label:"In Progress", color:"#60a5fa" },
    { key:"review", label:"Review", color:"#f4b860" },
    { key:"completed", label:"Completed", color:"#52d6a1" }
  ];
  const seed = () => ({
    profile: { name:"Quest Starter", level:1, xp:0, totalXP:0, tier:"novice", activeTheme:"dark", unlockedThemes:["dark","light"], tags:[...BASE_TAGS], customTags:[], streak:0, lastActiveDate:"", completedDates:[], focusMinutes:0, focusSessions:0 },
    tasks: [
      { id:uid(), title:"Plan your top priorities", description:"Choose the three things that would make today feel like a win.", priority:"critical", status:"todo", subtasks:[{id:uid(),title:"Review the week",done:false},{id:uid(),title:"Pick three priorities",done:false},{id:uid(),title:"Block focus time",done:false}], dueDate:todayISO(), tags:["Personal"], energy:"medium", createdAt:Date.now(), completedAt:null, completionRewarded:false },
      { id:uid(), title:"Make progress on a big goal", description:"Break a big goal into a small, achievable next step.", priority:"medium", status:"progress", subtasks:[{id:uid(),title:"Define the next action",done:false},{id:uid(),title:"Spend 20 minutes on it",done:false}], dueDate:"", tags:["Deep Work"], energy:"high", createdAt:Date.now(), completedAt:null, completionRewarded:false },
      { id:uid(), title:"Clear a little mental space", description:"Take a short reset, then come back ready to focus.", priority:"low", status:"todo", subtasks:[], dueDate:"", tags:["Health"], energy:"low", createdAt:Date.now(), completedAt:null, completionRewarded:false }
    ],
    activity: { completions:[], focus:[] },
    settings: { view:"board" }
  });
  const normalizeState = loaded => {
    const fresh = seed();
    if (!loaded || typeof loaded !== "object") return fresh;
    const p = loaded.profile && typeof loaded.profile === "object" ? loaded.profile : {};
    const allowedThemes = Object.keys(THEMES);
    const level = Math.max(1, Number(p.level) || 1);
    const tier = level >= 16 ? "master" : level >= 6 ? "adept" : "novice";
    const tags = Array.isArray(p.tags) ? p.tags.filter(x => typeof x === "string") : [...BASE_TAGS];
    const customTags = Array.isArray(p.customTags) ? p.customTags.filter(x => typeof x === "string") : [];
    const unlocked = Array.isArray(p.unlockedThemes) ? p.unlockedThemes.filter(x => allowedThemes.includes(x)) : ["dark","light"];
    if (!unlocked.includes("dark")) unlocked.push("dark");
    if (!unlocked.includes("light")) unlocked.push("light");
    if (level >= 6) ["nordic","cyber"].forEach(t => { if (!unlocked.includes(t)) unlocked.push(t); });
    if (level >= 16 && !unlocked.includes("neon")) unlocked.push("neon");
    const taskArray = Array.isArray(loaded.tasks) ? loaded.tasks : fresh.tasks;
    return {
      profile: { ...fresh.profile, ...p, level, tier, tags:[...new Set([...BASE_TAGS,...(level>=6?ADEPT_TAGS:[]),...(level>=16?MASTER_TAGS:[]),...tags,...customTags])], customTags, unlockedThemes:unlocked, activeTheme:unlocked.includes(p.activeTheme)?p.activeTheme:"dark", xp:Math.max(0,Number(p.xp)||0), totalXP:Math.max(0,Number(p.totalXP)||0), completedDates:Array.isArray(p.completedDates)?p.completedDates:[] },
      tasks: taskArray.map(t => ({ id:t.id||uid(), title:String(t.title||"Untitled quest"), description:String(t.description||""), priority:["critical","medium","low"].includes(t.priority)?t.priority:"medium", status:STATUS.some(s=>s.key===t.status)?t.status:"todo", subtasks:Array.isArray(t.subtasks)?t.subtasks.map(s=>typeof s==="string"?{id:uid(),title:s,done:false}:{id:s.id||uid(),title:String(s.title||""),done:!!s.done}):[], dueDate:t.dueDate||"", tags:Array.isArray(t.tags)?t.tags:[], energy:["low","medium","high"].includes(t.energy)?t.energy:"medium", createdAt:t.createdAt||Date.now(), completedAt:t.completedAt||null, completionRewarded:!!t.completionRewarded })),
      activity: { completions:Array.isArray(loaded.activity?.completions)?loaded.activity.completions:[], focus:Array.isArray(loaded.activity?.focus)?loaded.activity.focus:[] },
      settings: { ...fresh.settings, ...(loaded.settings||{}) }
    };
  };

  let state = null;
  let view = "board";
  let activeUserId = null;
  let activeUserIsDemo = false;
  let initializationId = 0;
  let initializationPromise = null;
  let initialized = false;
  let syncTimer = null;
  let syncInFlight = false;
  let syncPending = false;
  let eventsBound = false;
  let timer = { duration:25*60, remaining:25*60, running:false, endAt:0, interval:null, mode:"focus" };
  let lastNotifiedLevel = 1;
  let activeDragId = null;
  const ringCircumference = 2 * Math.PI * 96;
  const ENERGY = { low:"⚡ Low", medium:"⚡⚡ Medium", high:"⚡⚡⚡ High" };

  function persist() {
    if (!state || !activeUserId) return;
    state.profile.tier = state.profile.level >= 16 ? "master" : state.profile.level >= 6 ? "adept" : "novice";
    state.settings.view = view;
    const ok = window.QuestlineStorage?.save(state, activeUserId);
    if (ok === false) {
      toast("Could not save locally. Your browser storage may be full.");
      updateSyncStatus("Local save failed", true);
    }
    scheduleSync();
  }
  function updateSyncStatus(text, error = false) {
    const status = $("#sync-status");
    const dot = $("#sync-dot");
    if (!status || !dot) return;
    status.textContent = text;
    dot.style.background = error ? "var(--rose)" : "";
  }
  function scheduleSync(delay = 650) {
    if (!activeUserId || !state) return;
    if (activeUserIsDemo) {
      updateSyncStatus("Local demo · saved only on this device");
      return;
    }
    syncPending = true;
    if (!navigator.onLine) {
      updateSyncStatus("Offline · saved on this device");
      return;
    }
    updateSyncStatus("Syncing…");
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(flushSync, delay);
  }
  async function flushSync() {
    if (!syncPending || !activeUserId || !state) return;
    if (!navigator.onLine) {
      updateSyncStatus("Offline · saved on this device");
      return;
    }
    if (syncInFlight) return;
    const userId = activeUserId;
    const snapshot = JSON.parse(JSON.stringify(state));
    syncPending = false;
    syncInFlight = true;
    let failed = false;
    try {
      await window.QuestlineAuth.syncState(userId, snapshot);
      if (activeUserId === userId) updateSyncStatus("Synced to your account");
    } catch (error) {
      failed = true;
      if (activeUserId === userId) {
        updateSyncStatus("Cloud sync failed · saved locally", true);
        toast(`Cloud sync failed: ${escapeHTML(error?.message || "Please try again when online.")}`);
        syncPending = true;
      }
    } finally {
      syncInFlight = false;
      if (syncPending && navigator.onLine && activeUserId &&
          (!failed || activeUserId !== userId)) scheduleSync(1000);
    }
  }
  function tierLabel() { return state.profile.tier === "master" ? "Master" : state.profile.tier === "adept" ? "Adept" : "Novice"; }
  function xpForNextLevel(level) { return level * 100; }
  function xpToNextLevel() { return xpForNextLevel(state.profile.level); }
  function progressInLevel() { return Math.min(100, state.profile.xp / xpToNextLevel() * 100); }
  function availableTags() {
    const tags = [...BASE_TAGS];
    if (state.profile.level >= 6) tags.push(...ADEPT_TAGS);
    if (state.profile.level >= 16) tags.push(...MASTER_TAGS);
    tags.push(...state.profile.customTags);
    return [...new Set(tags)];
  }
  function updateUnlocks() {
    const p = state.profile;
    const oldThemes = [...p.unlockedThemes];
    if (p.level >= 6) {
      ["nordic","cyber"].forEach(t => { if (!p.unlockedThemes.includes(t)) p.unlockedThemes.push(t); });
      ADEPT_TAGS.forEach(t => { if (!p.tags.includes(t)) p.tags.push(t); });
    }
    if (p.level >= 16) {
      if (!p.unlockedThemes.includes("neon")) p.unlockedThemes.push("neon");
      MASTER_TAGS.forEach(t => { if (!p.tags.includes(t)) p.tags.push(t); });
    }
    p.tier = p.level >= 16 ? "master" : p.level >= 6 ? "adept" : "novice";
    return p.unlockedThemes.filter(t => !oldThemes.includes(t));
  }
  function awardXP(amount, reason) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const oldLevel = state.profile.level;
    state.profile.xp += amount;
    state.profile.totalXP += amount;
    while (state.profile.xp >= xpForNextLevel(state.profile.level)) {
      state.profile.xp -= xpForNextLevel(state.profile.level);
      state.profile.level += 1;
    }
    const newThemes = updateUnlocks();
    persist();
    renderAll();
    if (state.profile.level > oldLevel) {
      lastNotifiedLevel = state.profile.level;
      showLevelUp(oldLevel, state.profile.level, newThemes);
      burstConfetti();
    } else {
      toast(`<strong>+${amount} XP</strong> · ${escapeHTML(reason)}`);
    }
  }
  function showLevelUp(oldLevel, newLevel, newThemes) {
    const rewards = [];
    if (oldLevel < 6 && newLevel >= 6) rewards.push("Adept tier: premium tags, Nordic Frost + Cyber Slate themes, silver particle effects.");
    if (oldLevel < 16 && newLevel >= 16) rewards.push("Master tier: Legacy + High ROI tags, Quantum Neon theme, custom tag creator, glowing borders.");
    if (!rewards.length) rewards.push(`Level ${newLevel} reached. Your XP bar and player badge have upgraded.`);
    $("#levelup-title").textContent = `Level ${newLevel} unlocked!`;
    $("#levelup-copy").textContent = newLevel >= 16 ? "You've reached the Master tier. Build a workspace that matches your ambition." : "Another milestone in the books. Keep stacking small wins.";
    $("#levelup-rewards").innerHTML = rewards.map(r=>`<div>✦ ${escapeHTML(r)}</div>`).join("") + newThemes.map(t=>`<div>🎨 New theme: ${escapeHTML(THEMES[t].name)}</div>`).join("");
    const dialog = $("#levelup-dialog");
    if (!dialog.open) dialog.showModal();
  }
  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = message;
    $("#toast-region").append(node);
    window.setTimeout(() => node.remove(), 3300);
  }
  function renderHeader() {
    const p = state.profile;
    const initials = p.name.trim().split(/\s+/).map(s=>s[0]).join("").slice(0,2).toUpperCase() || "Q";
    $("#avatar").textContent = initials;
    $("#top-avatar").textContent = initials;
    $("#profile-name").textContent = p.name;
    $("#profile-tier").textContent = `${tierLabel()} · Level ${p.level}`;
    $("#level-number").textContent = String(p.level).padStart(2,"0");
    $("#tier-name").textContent = p.tier === "master" ? "Master Architect" : p.tier === "adept" ? "Adept Strategist" : "Novice Explorer";
    $("#tier-chip").textContent = tierLabel().toUpperCase();
    $("#level-caption").textContent = p.tier === "master" ? "You make your own momentum." : p.tier === "adept" ? "Your systems are getting stronger." : "Every master starts somewhere.";
    $("#xp-label").textContent = `${p.xp} / ${xpToNextLevel()} XP`;
    $("#xp-progress").style.width = `${progressInLevel()}%`;
    $("#total-xp").textContent = p.totalXP.toLocaleString();
    $("#next-level-text").textContent = `${Math.max(0,xpToNextLevel()-p.xp)} XP to Level ${p.level+1}`;
    $("#reward-note").textContent = p.level >= 16 ? "Master tier active · Custom tags, gold tags, Quantum Neon." : p.level >= 6 ? `${16-p.level} level${16-p.level===1?"":"s"} to Master tier · Premium tags unlocked.` : `${6-p.level} level${6-p.level===1?"":"s"} to Adept tier · Unlock premium themes and tags.`;
    $("#nav-task-count").textContent = state.tasks.filter(t=>t.status!=="completed").length;
    $("#date-label").textContent = `YOUR SPACE · ${new Date().toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"}).toUpperCase()}`;
    document.body.dataset.theme = p.activeTheme;
    document.body.dataset.tier = p.tier;
  }
  function renderStats() {
    const completed = state.tasks.filter(t=>t.status==="completed").length;
    $("#stat-active").textContent = state.tasks.filter(t=>t.status!=="completed").length;
    $("#stat-completed").textContent = completed;
    $("#stat-focus").textContent = state.profile.focusMinutes;
    $("#stat-streak").innerHTML = `${state.profile.streak} <small>days</small>`;
    const todayCount = state.activity.completions.filter(a=>a.date===localDate()).length;
    $("#daily-progress").style.width = `${Math.min(100,todayCount/3*100)}%`;
    $("#daily-text").textContent = `${Math.min(3,todayCount)} of 3 tasks completed`;
    $("#week-completed").textContent = `${state.activity.completions.filter(a=>Date.now()-new Date(a.date).getTime()<7*86400000).length} this week`;
    const tips = ["Start with one small task. Consistency beats intensity.","Try pairing one high-energy task with a short recovery break.","Choose your next task based on your energy, not just its urgency.","A 25-minute focus session can turn a vague goal into progress.","Celebrate completed steps. Momentum grows when you notice it."];
    $("#momentum-tip").textContent = tips[new Date().getDay()%tips.length];
  }
  function taskMatches(t) {
    const query = $("#search-input").value.trim().toLowerCase();
    const priority = $("#priority-filter").value;
    const energy = $("#energy-filter").value;
    const tag = $("#tag-filter").value;
    return (!query || `${t.title} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(query)) &&
      (priority==="all" || t.priority===priority) && (energy==="all" || t.energy===energy) && (tag==="all" || t.tags.includes(tag));
  }
  function renderFilterOptions() {
    const current = $("#tag-filter").value;
    $("#tag-filter").innerHTML = `<option value="all">All tags</option>${availableTags().map(t=>`<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("")}`;
    if ([...$("#tag-filter").options].some(o=>o.value===current)) $("#tag-filter").value=current;
    const taskTag = $("#task-tag");
    const old = taskTag.value;
    taskTag.innerHTML = availableTags().map(t=>`<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join("");
    if ([...taskTag.options].some(o=>o.value===old)) taskTag.value=old;
  }
  function progressFor(task) {
    const total = task.subtasks.length;
    const done = task.subtasks.filter(s=>s.done).length;
    return { total, done, percent:total ? Math.round(done/total*100) : (task.status==="completed"?100:0) };
  }
  function dueMarkup(task) {
    if (!task.dueDate) return "";
    const overdue = task.dueDate < todayISO() && task.status !== "completed";
    const date = new Date(`${task.dueDate}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"});
    return `<span class="due-chip ${overdue?"overdue":""}">◷ ${overdue?"Overdue · ":""}${escapeHTML(date)}</span>`;
  }
  function taskCard(task) {
    const p = progressFor(task);
    const subtasks = task.subtasks.length ? `<div class="task-progress"><div class="progress-meta"><span>SUBTASKS · ${p.done}/${p.total}</span><span>${p.percent}%</span></div><div class="progress-track"><span style="width:${p.percent}%"></span></div><ul class="subtask-list">${task.subtasks.map((s,i)=>`<li class="${s.done?"done":""}"><input type="checkbox" data-subtask="${escapeHTML(s.id)}" data-task="${escapeHTML(task.id)}" ${s.done?"checked":""} aria-label="Complete ${escapeHTML(s.title)}"><span>${escapeHTML(s.title)}</span></li>`).join("")}</ul></div>` : "";
    const tagMarkup = task.tags.map(tag=>`<span class="tag-chip">${escapeHTML(tag)}</span>`).join("");
    const statusNext = STATUS[(STATUS.findIndex(s=>s.key===task.status)+1)%STATUS.length];
    return `<article class="task-card" draggable="true" data-task-card="${escapeHTML(task.id)}">
      <div class="task-top"><span class="priority ${task.priority}">${task.priority}</span><button class="task-menu" data-action="menu" data-id="${escapeHTML(task.id)}" aria-label="Task actions">···</button></div>
      <h3>${escapeHTML(task.title)}</h3>${task.description?`<p class="task-description">${escapeHTML(task.description)}</p>`:""}
      <div class="task-tags">${tagMarkup}</div>${dueMarkup(task)}
      ${subtasks}
      <div class="task-footer"><span class="energy ${task.energy}">${ENERGY[task.energy]}</span><div class="task-actions"><button class="tiny-btn" data-action="edit" data-id="${escapeHTML(task.id)}">Edit</button><button class="tiny-btn" data-action="status" data-id="${escapeHTML(task.id)}" title="Move to ${statusNext.label}">→ ${statusNext.label}</button></div></div>
    </article>`;
  }
  function renderWorkspace() {
    const tasks = state.tasks.filter(taskMatches);
    const target = $("#task-workspace");
    target.className = view==="board" ? "kanban-grid" : "list-view";
    $("#empty-state").hidden = tasks.length > 0;
    target.hidden = tasks.length===0;
    if (view==="board") {
      target.innerHTML = STATUS.map(status=>{
        const columnTasks = tasks.filter(t=>t.status===status.key);
        return `<section class="kanban-column" data-column="${status.key}"><div class="column-head"><span class="column-title"><i class="column-dot" style="background:${status.color}"></i>${status.label}</span><span class="column-count">${columnTasks.length}</span></div><div class="task-stack">${columnTasks.map(taskCard).join("")}</div></section>`;
      }).join("");
    } else {
      target.innerHTML = tasks.map(t=>`<article class="list-task"><div class="list-task-title"><span class="priority ${t.priority}"></span><div><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.tags.join(" · ")||"No tag")}</small></div></div><span class="list-status">${STATUS.find(s=>s.key===t.status)?.label||t.status}</span><span class="energy ${t.energy}">${ENERGY[t.energy]}</span>${dueMarkup(t)}<div class="task-actions"><button class="tiny-btn" data-action="edit" data-id="${escapeHTML(t.id)}">Edit</button><button class="tiny-btn" data-action="status" data-id="${escapeHTML(t.id)}">Move →</button><button class="tiny-btn" data-action="delete" data-id="${escapeHTML(t.id)}">×</button></div></article>`).join("");
    }
    $$(".view-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    renderFocusTaskOptions();
  }
  function renderFocusTaskOptions() {
    const select = $("#focus-task-select");
    const old = select.value;
    select.innerHTML = `<option value="">Choose a task (optional)</option>` + state.tasks.filter(t=>t.status!=="completed").map(t=>`<option value="${escapeHTML(t.id)}">${escapeHTML(t.title)}</option>`).join("");
    if ([...select.options].some(o=>o.value===old)) select.value=old;
  }
  function renderThemes() {
    const p = state.profile;
    $("#unlock-count").textContent = `${p.unlockedThemes.length} theme${p.unlockedThemes.length===1?"":"s"} unlocked`;
    $("#theme-grid").innerHTML = Object.entries(THEMES).map(([id,theme])=>{
      const unlocked = p.unlockedThemes.includes(id);
      const selected = p.activeTheme===id;
      return `<button class="theme-card ${selected?"selected":""}" data-theme-choice="${id}" ${!unlocked?"disabled":""} aria-pressed="${selected}">
        <div class="theme-preview" style="background:${theme.bg}"><span class="preview-side" style="background:${theme.color}"></span><span class="preview-main"><span></span><span style="background:${theme.color};opacity:.55"></span></span></div>
        <strong>${escapeHTML(theme.name)} ${selected?"✓":""}</strong><small>${escapeHTML(theme.description)}</small>${!unlocked?`<span class="theme-lock">🔒 Level ${theme.level}</span>`:""}
      </button>`;
    }).join("");
    $("#custom-tag-area").hidden = p.level < 16;
  }
  function renderChart() {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate()-6);
    const days = [];
    for (let i=0;i<7;i++) {
      const d = new Date(start); d.setDate(start.getDate()+i);
      const key = localDate(d);
      const count = state.activity.completions.filter(c=>c.date===key).length;
      days.push({label:d.toLocaleDateString(undefined,{weekday:"short"}).slice(0,2),count,key,today:key===localDate()});
    }
    const max = Math.max(1,...days.map(d=>d.count));
    $("#rhythm-chart").innerHTML = days.map(d=>`<div class="chart-day ${d.today?"today":""}" title="${d.count} tasks completed"><div class="chart-bar" style="height:${Math.max(4,d.count/max*82)}%"></div><small>${d.label}</small></div>`).join("");
  }
  function renderTimer() {
    const mins = Math.floor(timer.remaining/60);
    const secs = timer.remaining%60;
    $("#timer-display").textContent = `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
    $("#timer-status").textContent = timer.running ? "SESSION IN PROGRESS" : timer.remaining===0 ? "SESSION COMPLETE" : "READY TO FOCUS";
    $("#timer-start").innerHTML = timer.running ? "Ⅱ Pause focus" : timer.remaining===0 ? "↻ Start again" : "▶ Start focus";
    $("#timer-mode").textContent = timer.mode==="focus"?"FOCUS SESSION":"SHORT BREAK";
    $("#timer-subtitle").textContent = timer.running?"Stay with this one thing.":timer.remaining===0?"Nice work. Take a breath.":"One thing at a time.";
    $("#timer-ring").style.strokeDasharray = ringCircumference;
    $("#timer-ring").style.strokeDashoffset = ringCircumference * (1 - timer.remaining/timer.duration);
    $$(".preset").forEach(b=>b.classList.toggle("active",Number(b.dataset.minutes)*60===timer.duration));
  }
  function renderAll() {
    renderHeader(); renderStats(); renderFilterOptions(); renderWorkspace(); renderThemes(); renderChart(); renderTimer();
  }

  function openTaskDialog(task=null) {
    const form = $("#task-form");
    form.reset();
    $("#task-id").value = task?.id || "";
    $("#task-dialog-title").textContent = task ? "Edit quest" : "Create a quest";
    $("#task-title").value = task?.title || "";
    $("#task-description").value = task?.description || "";
    $("#task-priority").value = task?.priority || "medium";
    $("#task-status").value = task?.status || "todo";
    $("#task-due").value = task?.dueDate || "";
    $("#task-energy").value = task?.energy || "medium";
    $("#task-tag").value = task?.tags?.[0] || availableTags()[0];
    $("#task-subtasks").value = task?.subtasks?.map(s=>s.title).join("\n") || "";
    $("#task-dialog").showModal();
    $("#task-title").focus();
  }
  function recordCompletion() {
    const date = localDate();
    state.activity.completions.push({date,at:Date.now()});
    const p = state.profile;
    if (!p.lastActiveDate) p.streak=1;
    else {
      const prev = new Date(`${p.lastActiveDate}T12:00:00`);
      const curr = new Date(`${date}T12:00:00`);
      const diff = Math.round((curr-prev)/86400000);
      if (diff===1) p.streak+=1;
      else if (diff>1) p.streak=1;
    }
    p.lastActiveDate=date;
    if (!p.completedDates.includes(date)) p.completedDates.push(date);
  }
  function saveTaskFromForm(event) {
    event.preventDefault();
    const id = $("#task-id").value;
    const previous = state.tasks.find(t=>t.id===id);
    const title = $("#task-title").value.trim();
    if (!title) return;
    const subtasks = $("#task-subtasks").value.split("\n").map(s=>s.trim()).filter(Boolean).map(text=>{
      const old = previous?.subtasks.find(s=>s.title===text);
      return {id:old?.id||uid(),title:text,done:old?.done||false};
    });
    const next = { id:id||uid(), title, description:$("#task-description").value.trim(), priority:$("#task-priority").value, status:$("#task-status").value, subtasks, dueDate:$("#task-due").value, tags:[$("#task-tag").value], energy:$("#task-energy").value, createdAt:previous?.createdAt||Date.now(), completedAt:previous?.completedAt||null, completionRewarded:previous?.completionRewarded||false };
    if (previous) {
      const wasComplete=previous.status==="completed";
      Object.assign(previous,next);
      if (!wasComplete && next.status==="completed") completeTask(previous);
      else { persist(); renderAll(); toast("Quest updated."); }
    } else {
      state.tasks.unshift(next);
      if (next.status==="completed") completeTask(next);
      else { persist(); renderAll(); toast("Quest added to your board."); }
    }
    $("#task-dialog").close();
  }
  function completeTask(task) {
    if (!task.completionRewarded) {
      task.completionRewarded=true;
      task.completedAt=Date.now();
      recordCompletion();
      persist();
      $("#task-dialog").open && $("#task-dialog").close();
      awardXP(50, "quest completed");
    } else { persist(); renderAll(); }
  }
  function moveTask(id) {
    const task=state.tasks.find(t=>t.id===id); if(!task)return;
    const old=task.status;
    task.status=STATUS[(STATUS.findIndex(s=>s.key===task.status)+1)%STATUS.length].key;
    if(old!=="completed"&&task.status==="completed") completeTask(task);
    else { persist();renderAll(); }
  }
  function deleteTask(id) {
    const task=state.tasks.find(t=>t.id===id); if(!task)return;
    if(!confirm(`Delete "${task.title}"? This cannot be undone.`))return;
    state.tasks=state.tasks.filter(t=>t.id!==id);persist();renderAll();toast("Quest deleted.");
  }
  function handleWorkspaceClick(event) {
    const check=event.target.closest("[data-subtask]");
    if(check) {
      const task=state.tasks.find(t=>t.id===check.dataset.task); const sub=task?.subtasks.find(s=>s.id===check.dataset.subtask);
      if(!task||!sub)return;
      sub.done=check.checked;
      if(task.subtasks.length && task.subtasks.every(s=>s.done) && task.status!=="completed") {
        task.status="completed";
        if(!task.completionRewarded) { completeTask(task); toast("All subtasks complete — quest finished!"); return; }
      }
      persist();renderAll();return;
    }
    const action=event.target.closest("[data-action]");
    if(!action)return;
    const task=state.tasks.find(t=>t.id===action.dataset.id);if(!task)return;
    if(action.dataset.action==="edit")openTaskDialog(task);
    else if(action.dataset.action==="status")moveTask(task.id);
    else if(action.dataset.action==="delete")deleteTask(task.id);
    else if(action.dataset.action==="menu") {
      const choice=prompt(`Task: ${task.title}\nType "edit", "delete", "google", or "ics":`);
      if(choice==="edit")openTaskDialog(task);
      if(choice==="delete")deleteTask(task.id);
      if(choice==="google")exportGoogle(task);
      if(choice==="ics")exportICS(task);
    }
  }
  function startDrag(event) {
    const card=event.target.closest("[data-task-card]"); if(!card)return;
    activeDragId=card.dataset.taskCard;card.classList.add("dragging");
    event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",activeDragId);
  }
  function endDrag() { $$(".dragging").forEach(n=>n.classList.remove("dragging")); $$(".drag-over").forEach(n=>n.classList.remove("drag-over"));activeDragId=null; }
  function initDragEvents() {
    $("#task-workspace").addEventListener("dragstart",startDrag);
    $("#task-workspace").addEventListener("dragend",endDrag);
    $("#task-workspace").addEventListener("dragover",event=>{const col=event.target.closest("[data-column]");if(!col)return;event.preventDefault();col.classList.add("drag-over");});
    $("#task-workspace").addEventListener("dragleave",event=>{const col=event.target.closest("[data-column]");if(col&&!col.contains(event.relatedTarget))col.classList.remove("drag-over");});
    $("#task-workspace").addEventListener("drop",event=>{
      const col=event.target.closest("[data-column]");if(!col)return;event.preventDefault();
      const id=event.dataTransfer.getData("text/plain")||activeDragId;const task=state.tasks.find(t=>t.id===id);
      if(task&&task.status!==col.dataset.column){const was=task.status;task.status=col.dataset.column;if(was!=="completed"&&task.status==="completed")completeTask(task);else{persist();renderAll();}}
      endDrag();
    });
  }

  function timerTick() {
    if(!timer.running)return;
    timer.remaining=Math.max(0,Math.ceil((timer.endAt-Date.now())/1000));
    renderTimer();
    if(timer.remaining===0)finishTimer();
  }
  function toggleTimer() {
    if(timer.running) { timer.running=false;clearInterval(timer.interval);timer.interval=null;renderTimer();return; }
    if(timer.remaining===0)timer.remaining=timer.duration;
    timer.running=true;timer.endAt=Date.now()+timer.remaining*1000;
    clearInterval(timer.interval);timer.interval=setInterval(timerTick,250);renderTimer();
  }
  function resetTimer() {
    timer.running=false;clearInterval(timer.interval);timer.interval=null;timer.remaining=timer.duration;renderTimer();
  }
  function finishTimer() {
    timer.running=false;clearInterval(timer.interval);timer.interval=null;
    const minutes=Math.round(timer.duration/60);
    state.profile.focusMinutes+=minutes;
    state.profile.focusSessions+=1;
    state.activity.focus.push({date:localDate(),minutes,at:Date.now()});
    const taskId=$("#focus-task-select").value;
    if(taskId) {
      const task=state.tasks.find(t=>t.id===taskId);
      if(task&&task.status==="todo")task.status="progress";
    }
    persist();renderAll();awardXP(25,"focus session complete");
    toast(`Focus session complete — ${minutes} minutes logged.`);
    timer.remaining=timer.duration;renderTimer();
  }

  function exportGoogle(task) {
    const start = task.dueDate ? new Date(`${task.dueDate}T09:00:00`) : new Date(Date.now()+3600000);
    const end = new Date(start.getTime()+30*60000);
    const fmt = date => date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
    const details = task.description || `Questline task · Priority: ${task.priority} · Energy: ${task.energy}`;
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action","TEMPLATE");url.searchParams.set("text",task.title);
    url.searchParams.set("details",details);url.searchParams.set("dates",`${fmt(start)}/${fmt(end)}`);
    window.open(url.toString(),"_blank","noopener,noreferrer");
  }
  function icsEscape(value) { return String(value||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;"); }
  function exportICS(task) {
    const start=task.dueDate?new Date(`${task.dueDate}T09:00:00`):new Date(Date.now()+3600000);
    const end=new Date(start.getTime()+30*60000);
    const fmt=date=>date.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
    const description=[task.description,`Priority: ${task.priority}`,`Energy: ${task.energy}`,`Tags: ${task.tags.join(", ")}`].filter(Boolean).join("\n");
    const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Questline//Productivity Dashboard//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",`UID:${task.id}@questline.local`,`DTSTAMP:${fmt(new Date())}`,`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,`SUMMARY:${icsEscape(task.title)}`,`DESCRIPTION:${icsEscape(description)}`,"END:VEVENT","END:VCALENDAR"];
    const blob=new Blob([lines.join("\r\n")+"\r\n"],{type:"text/calendar;charset=utf-8"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${task.title.replace(/[^a-z0-9-_]+/gi,"-").replace(/^-|-$/g,"")||"quest"}.ics`;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
    toast("Calendar file downloaded.");
  }
  function burstConfetti() {
    const canvas=$("#fx-canvas"),ctx=canvas.getContext("2d");
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=window.innerWidth*dpr;canvas.height=window.innerHeight*dpr;canvas.style.width="100%";canvas.style.height="100%";ctx.scale(dpr,dpr);
    const colors=["#a78bfa","#52d6a1","#f4b860","#fb7185","#79d4ed","#ffffff"];
    const pieces=Array.from({length:180},()=>({x:window.innerWidth/2+(Math.random()-.5)*180,y:window.innerHeight*.35,vx:(Math.random()-.5)*9,vy:-Math.random()*10-2,gravity:.22,rotation:Math.random()*Math.PI,size:3+Math.random()*5,color:colors[Math.floor(Math.random()*colors.length)],life:100+Math.random()*50}));
    let frame=0;
    function draw(){ctx.clearRect(0,0,window.innerWidth,window.innerHeight);let alive=false;for(const p of pieces){if(p.life<=0)continue;alive=true;p.vy+=p.gravity;p.x+=p.vx;p.y+=p.vy;p.rotation+=.1;p.life--;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.fillStyle=p.color;ctx.globalAlpha=Math.min(1,p.life/25);ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.7);ctx.restore();}if(alive&&frame++<220)requestAnimationFrame(draw);else ctx.clearRect(0,0,canvas.width,canvas.height);}
    draw();
  }
  let particleFrame=0;
  let particleFrameId=0;
  function particleLoop() {
    const canvas=$("#fx-canvas");if(!canvas)return;
    if(!state)return;
    const ctx=canvas.getContext("2d");const w=window.innerWidth,h=window.innerHeight,dpr=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=`${w}px`;canvas.style.height=`${h}px`;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    if(state.profile.level>=6&&state.profile.level<16) {
      for(let i=0;i<45;i++){const x=(i*137.5+particleFrame*.12)%w;const y=(i*83.7+Math.sin(particleFrame*.008+i)*18)%h;ctx.fillStyle=`rgba(210,225,255,${.12+((i%5)/30)})`;ctx.beginPath();ctx.arc(x,y,i%4===0?1.5:.7,0,Math.PI*2);ctx.fill();}
    }
    particleFrame++;
    particleFrameId=requestAnimationFrame(particleLoop);
  }
  function exportBackup() {
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`questline-backup-${todayISO()}.json`;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);toast("Backup exported.");
  }

  function bindEvents() {
    $("#new-task-btn").addEventListener("click",()=>openTaskDialog());
    $("#empty-new-task").addEventListener("click",()=>openTaskDialog());
    $("#jump-tasks").addEventListener("click",()=>$("#workspace").scrollIntoView({behavior:"smooth"}));
    $("#task-form").addEventListener("submit",saveTaskFromForm);
    $("#task-workspace").addEventListener("click",handleWorkspaceClick);
    $$(".close-dialog").forEach(btn=>btn.addEventListener("click",()=>btn.closest("dialog").close()));
    [$("#search-input"),$("#priority-filter"),$("#energy-filter"),$("#tag-filter")].forEach(el=>el.addEventListener("input",renderWorkspace));
    $$(".view-btn").forEach(btn=>btn.addEventListener("click",()=>{view=btn.dataset.view;persist();renderWorkspace();}));
    $$(".nav-item[data-nav]").forEach(btn=>btn.addEventListener("click",()=>{
      $$(".nav-item[data-nav]").forEach(n=>n.classList.toggle("active",n===btn));
      const map={dashboard:".topbar",tasks:"#workspace",focus:"#focus-panel",rewards:"#rewards-panel"};
      $(map[btn.dataset.nav])?.scrollIntoView({behavior:"smooth",block:"start"});
    }));
    $("#theme-toggle").addEventListener("click",()=>{const next=state.profile.activeTheme==="light"?"dark":"light";state.profile.activeTheme=next;persist();renderAll();});
    $("#theme-grid").addEventListener("click",event=>{
      const btn=event.target.closest("[data-theme-choice]");if(!btn)return;
      const id=btn.dataset.themeChoice;if(!state.profile.unlockedThemes.includes(id))return;
      state.profile.activeTheme=id;persist();renderAll();toast(`${THEMES[id].name} theme applied.`);
    });
    $("#top-avatar").addEventListener("click",()=>{ $("#profile-input").value=state.profile.name;$("#profile-dialog").showModal(); });
    $("#settings-btn").addEventListener("click",()=>{ $("#profile-input").value=state.profile.name;$("#profile-dialog").showModal(); });
    $("#profile-form").addEventListener("submit",event=>{event.preventDefault();state.profile.name=$("#profile-input").value.trim()||"Quest Starter";persist();renderAll();$("#profile-dialog").close();toast("Profile updated.");});
    $("#levelup-close").addEventListener("click",()=>$("#levelup-dialog").close());
    $$(".preset").forEach(btn=>btn.addEventListener("click",()=>{if(timer.running){toast("Pause your current session before changing duration.");return;}timer.duration=Number(btn.dataset.minutes)*60;timer.remaining=timer.duration;renderTimer();}));
    $("#timer-start").addEventListener("click",toggleTimer);
    $("#timer-reset").addEventListener("click",resetTimer);
    $("#custom-tag-form").addEventListener("submit",event=>{
      event.preventDefault();if(state.profile.level<16)return;
      const tag=$("#custom-tag-input").value.trim().replace(/\s+/g," ");
      if(!tag)return;if(availableTags().some(t=>t.toLowerCase()===tag.toLowerCase())){toast("That tag already exists.");return;}
      state.profile.customTags.push(tag);state.profile.tags.push(tag);$("#custom-tag-input").value="";persist();renderAll();toast(`Custom tag “${escapeHTML(tag)}” added.`);
    });
    $("#export-backup").addEventListener("click",exportBackup);
    $("#signout-btn").addEventListener("click",async()=>{
      const button=$("#signout-btn");
      button.disabled=true;
      try {
        if (window.QuestlineAuth.isDemo) window.QuestlineAuth.exitDemo();
        else await window.QuestlineAuth.signOut();
      }
      catch(error) { toast(`Could not sign out: ${escapeHTML(error?.message||"Please try again.")}`); }
      finally { button.disabled=false; }
    });
    initDragEvents();
    window.addEventListener("beforeunload",()=>{if(timer.running){timer.running=false;clearInterval(timer.interval);}});
  }
  async function startForUser(user) {
    if (!user?.id) return;
    if (activeUserId === user.id && initialized) return;
    if (activeUserId === user.id && initializationPromise) return initializationPromise;

    activeUserId = user.id;
    activeUserIsDemo = user.isDemo === true;
    initialized = false;
    const requestId = ++initializationId;
    const app = $("#app-shell");
    app.hidden = true;
    app.inert = true;
    app.setAttribute("aria-hidden", "true");
    updateSyncStatus(activeUserIsDemo ? "Loading local demo…" : "Loading your progress…");

    const operation = (async()=>{
      let loaded = null;
      let remoteAvailable = false;
      try {
        if (activeUserIsDemo) {
          loaded = window.QuestlineStorage?.load(user.id) || null;
        } else {
          loaded = await window.QuestlineAuth.loadState(user.id);
          remoteAvailable = true;
        }
      } catch(error) {
        loaded = window.QuestlineStorage?.load(user.id) || null;
        updateSyncStatus("Cloud unavailable · using local copy", true);
        toast(`Could not load cloud data: ${escapeHTML(error?.message||"Check your connection and database setup.")}`);
      }
      if (requestId !== initializationId || activeUserId !== user.id) return;
      if (!loaded) {
        loaded = window.QuestlineStorage?.load(user.id) || (activeUserIsDemo ? null : {
          profile: {
            name: user.email?.split("@")[0] || "Quest Starter",
            level: 1,
            xp: 0,
            totalXP: 0,
            tier: "novice",
            activeTheme: "dark",
            unlockedThemes: ["dark", "light"]
          },
          tasks: [],
          activity: { completions: [], focus: [] },
          settings: { view: "board" }
        });
      }
      state = normalizeState(loaded);
      view = state.settings.view === "list" ? "list" : "board";
      updateUnlocks();
      lastNotifiedLevel = state.profile.level;
      initialized = true;
      if (!eventsBound) {
        bindEvents();
        $("#task-workspace").addEventListener("dblclick",event=>{
          const card=event.target.closest("[data-task-card]");
          if(card){const task=state.tasks.find(t=>t.id===card.dataset.taskCard);if(task)openTaskDialog(task);}
        });
        eventsBound = true;
        window.addEventListener("online",()=>{if(syncPending)scheduleSync(0);});
      }
      app.hidden = false;
      app.inert = false;
      app.setAttribute("aria-hidden", "false");
      renderAll();
      window.QuestlineAuth.showDashboard();
      $("#signout-btn").textContent = activeUserIsDemo ? "Exit demo" : "Sign out";
      updateSyncStatus(activeUserIsDemo ? "Local demo · saved only on this device" : "Synced to your account");
      persist();
      if (!remoteAvailable) syncPending = true;
      if (!particleFrameId) particleLoop();
    })();
    initializationPromise = operation;
    try { await operation; }
    finally {
      if (initializationPromise === operation) initializationPromise = null;
    }
  }
  function lockDashboard() {
    initializationId += 1;
    activeUserId = null;
    initialized = false;
    initializationPromise = null;
    activeUserIsDemo = false;
    syncPending = false;
    window.clearTimeout(syncTimer);
    if (particleFrameId) {
      window.cancelAnimationFrame(particleFrameId);
      particleFrameId = 0;
    }
    if (timer.running) {
      timer.running = false;
      window.clearInterval(timer.interval);
      timer.interval = null;
    }
    const app = $("#app-shell");
    app.hidden = true;
    app.inert = true;
    app.setAttribute("aria-hidden", "true");
    state = null;
  }

  window.addEventListener("questline:auth",event=>{
    const currentUser = window.QuestlineAuth.user;
    if (event.detail.user?.isDemo && window.QuestlineAuth.isDemo) void startForUser(event.detail.user);
    else if (event.detail.user && currentUser?.id === event.detail.user.id) void startForUser(event.detail.user);
    else if (!event.detail.user && !currentUser && !window.QuestlineAuth.isDemo) lockDashboard();
  });
  window.QuestlineAuth.ready.then(({user})=>{
    if (user) void startForUser(user);
    else if (window.QuestlineAuth.isDemo) {
      void startForUser({id:"local-demo",email:"demo@local.invalid",isDemo:true});
    } else lockDashboard();
  }).catch(error=>{
    lockDashboard();
    toast(`Could not start the dashboard: ${escapeHTML(error?.message||"Authentication is unavailable.")}`);
  });
})();
