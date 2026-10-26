(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  const localDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  };
  const localDateOf = value => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  };
  const safeText = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const WATER_GOAL = 2500;
  const PROTEIN_GOAL = 150;
  const BOSS_HP = 500;
  const MUSCLES = ["chest","shoulders","arms","core","back","glutes","legs"];
  const TEMPLATES = {
    Push: [["Bench press","chest",3,8,95],["Overhead press","shoulders",3,8,45],["Triceps pressdown","arms",3,12,30]],
    Pull: [["Lat pulldown","back",3,10,80],["Dumbbell row","back",3,10,40],["Biceps curl","arms",3,12,20]],
    Legs: [["Squat","legs",4,8,135],["Romanian deadlift","glutes",3,10,95],["Plank","core",3,30,0]],
    "Full Body": [["Squat","legs",3,8,95],["Bench press","chest",3,8,75],["Dumbbell row","back",3,10,35]]
  };
  const app = $("#app-shell");
  let state = null;
  let userId = null;
  let demoMode = false;
  let coreTasks = [];
  let selectedMuscle = "";
  let workoutMode = "strength";
  let syncTimer = 0;
  let syncPending = false;
  let syncInFlight = false;
  let loadId = 0;

  function freshState(level = 1, xp = 0, totalXP = 0) {
    return {
      level: Math.max(1, Number(level) || 1),
      xp: Math.max(0, Number(xp) || 0),
      totalXP: Math.max(0, Number(totalXP) || 0),
      workouts: [],
      streaks: {
        dailyHydrationMl: 0,
        dailyProteinG: 0,
        lastActiveDate: "",
        currentWorkoutStreak: 0,
        trackingDate: localDate(),
        buffClaimedDate: "",
        lastSavedAt: new Date(0).toISOString(),
        customTemplates: [],
        neonThemeEnabled: false
      }
    };
  }
  function normalizeState(data, level = 1, xp = 0) {
    const fresh = freshState(data?.level ?? level, data?.xp ?? xp, data?.totalXP ?? 0);
    const workouts = Array.isArray(data?.workouts) ? data.workouts : [];
    fresh.workouts = workouts.filter(w => w && typeof w === "object").map(w => ({
      id: w.id || uid(),
      date: w.date || new Date().toISOString(),
      routineName: String(w.routineName || "Workout"),
      durationMins: Math.max(0, Number(w.durationMins) || 0),
      totalVolumeLbs: Math.max(0, Number(w.totalVolumeLbs) || 0),
      energySpent: ["low","medium","high"].includes(w.energySpent) ? w.energySpent : "medium",
      exercises: Array.isArray(w.exercises) ? w.exercises : [],
      activityType: w.activityType === "cardio" ? "cardio" : "strength",
      cardioActivity: String(w.cardioActivity || "Running"),
      distance: Math.max(0, Number(w.distance) || 0),
      distanceUnit: w.distanceUnit === "mi" ? "mi" : "km"
    }));
    fresh.streaks = { ...fresh.streaks, ...(data?.streaks || {}) };
    fresh.streaks.dailyHydrationMl = Math.max(0,Math.min(WATER_GOAL,Number(fresh.streaks.dailyHydrationMl)||0));
    fresh.streaks.dailyProteinG = Math.max(0,Math.min(PROTEIN_GOAL,Number(fresh.streaks.dailyProteinG)||0));
    fresh.streaks.customTemplates = Array.isArray(fresh.streaks.customTemplates) ? fresh.streaks.customTemplates : [];
    if (fresh.streaks.trackingDate !== localDate()) {
      fresh.streaks.dailyHydrationMl = 0;
      fresh.streaks.dailyProteinG = 0;
      fresh.streaks.trackingDate = localDate();
      fresh.streaks.buffClaimedDate = "";
    }
    return fresh;
  }
  function xpForNextLevel(level) { return level * 100; }
  function earnedXpForWorkout(volume, duration) {
    return 25 + Math.min(40, Math.floor(duration / 10) * 5) +
      Math.min(35, Math.floor(volume / 500) * 5);
  }
  function workoutXpMultiplier() {
    const buffActive = state.streaks.dailyHydrationMl >= WATER_GOAL &&
      state.streaks.dailyProteinG >= PROTEIN_GOAL;
    return buffActive ? 1 + Math.min(.5,state.streaks.currentWorkoutStreak*.05) : 1;
  }
  function awardXP(amount) {
    state.xp += amount;
    state.totalXP += amount;
    while (state.xp >= xpForNextLevel(state.level)) {
      state.xp -= xpForNextLevel(state.level);
      state.level += 1;
      notify(`Level up! You're now Level ${state.level}.`);
    }
    if (demoMode) {
      const core = window.QuestlineStorage?.load("local-demo");
      if (core?.profile) {
        core.profile.level = state.level;
        core.profile.xp = state.xp;
        core.profile.totalXP = state.totalXP;
        core.profile.tier = state.level >= 16 ? "master" : state.level >= 6 ? "adept" : "novice";
        window.QuestlineStorage?.save(core, "local-demo");
      }
    }
  }
  function workoutVolume(exercises) {
    return exercises.reduce((total, exercise) =>
      total + exercise.sets.reduce((sum, set) => sum + set.reps * set.weightLbs, 0), 0);
  }
  function bossDamage(volume, duration) {
    return Math.max(1, Math.ceil(volume / 100 + duration * 2));
  }
  function damageToday() {
    const today = localDate();
    return state.workouts.filter(w => localDateOf(w.date) === today)
      .reduce((sum, workout) => sum + bossDamage(workout.totalVolumeLbs, workout.durationMins), 0);
  }
  function tierForLevel(level) {
    if (level >= 16) return { id:"titan", name:"TITAN LEGEND" };
    if (level >= 6) return { id:"iron", name:"IRON WARRIOR" };
    return { id:"recruit", name:"GYM RECRUIT" };
  }
  function getExerciseRows() {
    return $$(".exercise-row").map(row => ({
      name: row.querySelector(".exercise-name").value.trim(),
      muscle: row.querySelector(".exercise-muscle").value,
      sets: Array.from({length:Math.max(1,Number(row.querySelector('[data-field="sets"]').value)||1)},(_,setIndex)=>{
        const reps = Math.max(0,Number(row.querySelector('[data-field="reps"]').value)||0);
        const weightLbs = Math.max(0,Number(row.querySelector('[data-field="weight"]').value)||0);
        return { set: setIndex + 1, reps, weightLbs };
      })
    })).filter(exercise => exercise.name);
  }
  function renderExerciseRows(exercises = [{name:"Bench press",muscle:"chest",sets:3,reps:8,weight:95}]) {
    $("#exercise-list").innerHTML = exercises.map(exercise => `
      <div class="exercise-row">
        <input class="exercise-name" aria-label="Exercise name" maxlength="50" value="${safeText(exercise.name)}" placeholder="Exercise">
        <select class="exercise-muscle" aria-label="Target muscle">${MUSCLES.map(m=>`<option value="${m}" ${m===exercise.muscle?"selected":""}>${m[0].toUpperCase()+m.slice(1)}</option>`).join("")}</select>
        <div class="stepper"><button type="button" data-step="sets" data-change="-1" aria-label="Decrease sets">−</button><input data-field="sets" type="number" min="1" max="20" value="${exercise.sets}" aria-label="Sets"><button type="button" data-step="sets" data-change="1" aria-label="Increase sets">+</button></div>
        <div class="stepper"><button type="button" data-step="reps" data-change="-1" aria-label="Decrease reps">−</button><input data-field="reps" type="number" min="0" max="999" value="${exercise.reps}" aria-label="Reps"><button type="button" data-step="reps" data-change="1" aria-label="Increase reps">+</button></div>
        <div class="stepper"><button type="button" data-step="weight" data-change="-5" aria-label="Decrease weight">−</button><input data-field="weight" type="number" min="0" max="2000" step="5" value="${exercise.weight}" aria-label="Weight in pounds"><button type="button" data-step="weight" data-change="5" aria-label="Increase weight">+</button></div>
        <button class="remove-exercise" type="button" aria-label="Remove exercise">×</button>
      </div>`).join("");
    updateWorkoutEstimate();
  }
  function updateWorkoutEstimate() {
    if (!state) return;
    const isCardio = workoutMode === "cardio";
    const exercises = isCardio ? [] : getExerciseRows();
    const volume = workoutVolume(exercises);
    const duration = Math.max(1, Number($("#duration-input").value) || 1);
    $("#volume-label").textContent = isCardio ? "DISTANCE" : "TOTAL VOLUME";
    $("#volume-unit").textContent = isCardio ? $("#cardio-unit").value : "lb";
    $("#volume-value").textContent = isCardio
      ? (Number($("#cardio-distance").value) || 0).toLocaleString(undefined,{maximumFractionDigits:2})
      : Math.round(volume).toLocaleString();
    $("#damage-value").innerHTML = `${bossDamage(volume,duration)} <small>DMG</small>`;
    $("#reward-value").innerHTML = `${Math.round(earnedXpForWorkout(volume,duration)*workoutXpMultiplier())} <small>XP</small>`;
  }
  function renderCoreProgress() {
    const tier = tierForLevel(state.level);
    document.body.dataset.gymTier = tier.id;
    document.body.dataset.gymTheme = state.level >= 6 && state.streaks.neonThemeEnabled ? "neon" : "default";
    $("#fitness-tier").textContent = tier.name;
    $("#fitness-level").textContent = `LEVEL ${state.level}`;
    $("#gym-theme-toggle").hidden = state.level < 6;
    $("#gym-theme-toggle").textContent = state.streaks.neonThemeEnabled ? "Neon Pulse: On" : "Enable Neon Pulse";
    $("#fitness-xp-label").textContent = `${state.xp} / ${xpForNextLevel(state.level)} XP`;
    $("#fitness-xp-progress").style.width = `${Math.min(100,state.xp/xpForNextLevel(state.level)*100)}%`;
    const unlocked = state.level >= 6;
    $("#muscle-map").setAttribute("aria-disabled", String(!unlocked));
    $("#muscle-tier").textContent = unlocked ? (selectedMuscle ? selectedMuscle.toUpperCase() : "IRON WARRIOR") : "LOCKED · LV 6";
    $("#muscle-hint").textContent = unlocked
      ? "Tap a muscle group to filter battles by target."
      : "Unlocks at Iron Warrior (Level 6). Tap a muscle to filter your workout history.";
    $("#macro-lock").hidden = state.level >= 16;
    $("#streak-flame").hidden = state.level < 16;
    $("#streak-count").textContent = state.streaks.currentWorkoutStreak;
    const flameIntensity=Math.min(1,state.streaks.currentWorkoutStreak/30);
    $("#streak-flame").style.setProperty("--flame-duration",`${1.45-flameIntensity*1.05}s`);
    $("#streak-flame").style.setProperty("--flame-scale",(1.05+flameIntensity*.2).toFixed(2));
    $("#streak-flame").style.setProperty("--flame-glow",`${8+flameIntensity*24}px`);
    $("#streak-caption").textContent = state.level >= 16
      ? `Titan flame intensity scales with your ${state.streaks.currentWorkoutStreak}-day streak.`
      : state.streaks.lastActiveDate === localDate()
        ? "Workout logged today. Come back tomorrow to keep the streak alive."
        : "Log a workout today to ignite your streak.";
    $$(".muscle-target").forEach(target => {
      target.classList.toggle("selected", target.dataset.muscle === selectedMuscle);
      target.setAttribute("aria-disabled", String(!unlocked));
    });
  }
  function renderResources() {
    const water = state.streaks.dailyHydrationMl;
    const protein = state.streaks.dailyProteinG;
    const waterPercent = Math.min(100, water / WATER_GOAL * 100);
    const proteinPercent = Math.min(100, protein / PROTEIN_GOAL * 100);
    $("#water-value").textContent = water.toLocaleString();
    $("#water-fill").style.height = `${waterPercent}%`;
    $("#water-progress").style.width = `${waterPercent}%`;
    $("#water-vessel").setAttribute("aria-label", `${Math.round(waterPercent)} percent of daily water goal`);
    $("#protein-value").textContent = protein;
    $("#protein-blocks").innerHTML = Array.from({length:15},(_,i)=>
      `<i class="${i < Math.ceil(proteinPercent/100*15) ? "filled" : ""}"></i>`).join("");
    renderTemplateOptions();
    const buffActive = water >= WATER_GOAL && protein >= PROTEIN_GOAL;
    $("#buff-card").classList.toggle("active", buffActive);
    $("#buff-title").textContent = buffActive ? "Well-Fed & Fully Hydrated" : "Fuel your next level";
    $("#buff-copy").textContent = buffActive
      ? `Daily goals complete. +20 XP claimed; workouts earn ×${workoutXpMultiplier().toFixed(2)} streak XP.`
      : "Hit both daily resource goals to activate Well-Fed & Fully Hydrated: +20 bonus XP.";
    $("#buff-state").textContent = buffActive ? "BUFF ACTIVE" : "INACTIVE";
    if (buffActive && state.streaks.buffClaimedDate !== localDate()) {
      state.streaks.buffClaimedDate = localDate();
      awardXP(20);
      persist();
      notify("Well-Fed & Fully Hydrated buff! <strong>+20 XP</strong>");
      renderCoreProgress();
    }
  }
  function renderBoss() {
    const damage = damageToday();
    const remaining = Math.max(0, BOSS_HP - damage);
    $("#boss-hp").textContent = remaining;
    $("#boss-damage").textContent = `${damage.toLocaleString()} DMG`;
    $("#boss-health-fill").style.width = `${Math.max(0,remaining/BOSS_HP*100)}%`;
    $("#boss-name").textContent = remaining ? (damage ? "The Warden, Wounded" : "The Iron Warden") : "The Iron Warden · Defeated";
    $("#boss-card").classList.toggle("boss-defeated", remaining === 0);
  }
  function renderHistory() {
    const filtered = selectedMuscle
      ? state.workouts.filter(w=>w.exercises.some(ex=>ex.muscle===selectedMuscle))
      : state.workouts;
    $("#history-empty").hidden = filtered.length > 0;
    $("#workout-history").innerHTML = filtered.slice(0,6).map(workout=>{
      const date = new Date(workout.date).toLocaleDateString(undefined,{month:"short",day:"numeric"});
      const isCardio = workout.activityType === "cardio";
      const details = isCardio
        ? `${workout.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${workout.distanceUnit} · ${safeText(workout.cardioActivity)}`
        : workout.exercises.map(e=>e.name).join(", ");
      const measure = isCardio
        ? `${workout.distance.toLocaleString(undefined,{maximumFractionDigits:2})} ${workout.distanceUnit}`
        : `${workout.totalVolumeLbs.toLocaleString()} lb`;
      const icon=isCardio?(workout.cardioActivity==="Biking"?"🚴":workout.cardioActivity==="Swimming"?"🏊":"🏃"):"⚔";
      return `<article class="history-item"><span class="history-icon">${icon}</span><div><strong>${safeText(workout.routineName)}</strong><small>${safeText(date)} · ${workout.durationMins} min · ${safeText(details)}</small></div><span class="history-xp">${measure}</span></article>`;
    }).join("");
  }
  function renderStreakDays() {
    const today = new Date();
    const days = Array.from({length:7},(_,i)=>{
      const date = new Date(today);
      date.setDate(today.getDate()-(6-i));
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
      const completed = state.workouts.some(w=>localDateOf(w.date)===key);
      return `<span class="${completed?"done":""}" title="${key}">${completed?"✦":date.toLocaleDateString(undefined,{weekday:"narrow"})}</span>`;
    }).join("");
    $("#streak-dots").innerHTML = days;
  }
  function energyAudit() {
    const active = coreTasks.filter(task=>task.status!=="completed");
    const load = active.reduce((sum,task)=>sum+({low:1,medium:2,high:3}[task.energy]||2),0);
    const remaining = Math.max(0,12-load);
    let recommendation = "⚡⚡⚡ High-Intensity Blast";
    if (remaining <= 3) recommendation = "⚡ Low Recovery";
    else if (remaining <= 7) recommendation = "⚡⚡ Medium Split";
    const select = $("#energy-select");
    select.value = remaining <= 3 ? "low" : remaining <= 7 ? "medium" : "high";
    $("#energy-advice").textContent = `Recommended: ${recommendation}. You have roughly ${remaining} mental-stamina points from ${active.length} unfinished quest${active.length===1?"":"s"}.`;
    $("#energy-meter-fill").style.width = `${remaining/12*100}%`;
    $("#energy-detail").textContent = coreTasks.length
      ? "Based on unfinished quests and their cognitive energy costs."
      : "No productivity tasks found. Choose an intensity that feels right.";
  }
  function renderAll() {
    renderCoreProgress();
    renderResources();
    renderBoss();
    renderHistory();
    renderStreakDays();
    energyAudit();
    updateWorkoutEstimate();
  }
  function updateSyncStatus(message) {
    $("#fitness-sync-status").textContent = message;
  }
  function renderTemplateOptions() {
    const select=$("#template-select");
    const customOptions=(state?.streaks.customTemplates||[]).map((template,index)=>
      `<option value="custom:${index}">${safeText(template.name)}</option>`).join("");
    const existing=[...select.options].filter(option=>option.value.startsWith("custom:"));
    if(existing.length) existing.forEach(option=>option.remove());
    const macroOption=select.querySelector('option[value="custom"]');
    if(macroOption) macroOption.insertAdjacentHTML("beforebegin",customOptions);
  }
  function notify(message) {
    const toast = document.createElement("div");
    toast.className = "fitness-toast";
    toast.innerHTML = message;
    $("#fitness-toasts").append(toast);
    window.setTimeout(()=>toast.remove(),4000);
  }
  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }
  function persist() {
    if (!state || !userId) return;
    state.streaks.lastSavedAt = new Date().toISOString();
    const ok = window.QuestlineStorage?.save(state, `fitness-${userId}`);
    if (ok === false) {
      updateSyncStatus("Local save failed");
      notify("Could not save locally. Browser storage may be full.");
    }
    syncPending = !demoMode;
    if (demoMode) {
      updateSyncStatus("Local demo · saved only on this device");
      return;
    }
    if (!navigator.onLine) {
      updateSyncStatus("Offline · saved locally");
      return;
    }
    updateSyncStatus("Syncing fitness data…");
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncNow,700);
  }
  async function syncNow() {
    if (!syncPending || !state || !userId || demoMode || !navigator.onLine || syncInFlight) return;
    syncPending = false;
    syncInFlight = true;
    const syncUserId = userId;
    const data = snapshot();
    let failed=false;
    try {
      await window.QuestlineAuth.syncFitnessState(syncUserId,data);
      if (userId === syncUserId) updateSyncStatus("Synced to your account");
    } catch(error) {
      failed=true;
      if (userId === syncUserId) {
        syncPending = true;
        updateSyncStatus("Cloud sync failed · saved locally");
        notify(`Cloud sync failed: ${safeText(error.message || "Check fitness SQL setup and network.")}`);
      }
    } finally {
      syncInFlight = false;
      if (syncPending && navigator.onLine && (!failed || userId !== syncUserId)) {
        syncTimer=window.setTimeout(syncNow,failed?1200:350);
      }
    }
  }
  function exerciseFromRow(row) {
    return {
      name: row.name,
      muscle: MUSCLES.includes(row.muscle) ? row.muscle : "core",
      sets: row.sets.map(set=>({reps:Math.max(0,Number(set.reps)||0),weightLbs:Math.max(0,Number(set.weightLbs)||0)}))
    };
  }
  function updateStreak() {
    const streaks = state.streaks;
    const today = localDate();
    if (streaks.lastActiveDate === today) return;
    if (streaks.lastActiveDate) {
      const previous = new Date(`${streaks.lastActiveDate}T12:00:00`);
      const current = new Date(`${today}T12:00:00`);
      const gap = Math.round((current-previous)/86400000);
      streaks.currentWorkoutStreak = gap === 1 ? streaks.currentWorkoutStreak + 1 : 1;
    } else streaks.currentWorkoutStreak = 1;
    streaks.lastActiveDate = today;
  }
  function logWorkout() {
    const isCardio = workoutMode === "cardio";
    const rows = isCardio ? [] : getExerciseRows().map(exerciseFromRow);
    const name = $("#routine-name").value.trim();
    const duration = Math.min(360,Math.max(1,Number($("#duration-input").value)||0));
    const distance = Number($("#cardio-distance").value);
    if (!name) {
      $("#routine-name").focus();
      notify("Give this workout a routine name first.");
      return;
    }
    if (!isCardio && !rows.length) {
      notify("Add at least one exercise before logging your workout.");
      return;
    }
    if (isCardio && (!Number.isFinite(distance) || distance <= 0 || distance > 1000)) {
      $("#cardio-distance").focus();
      notify("Enter a cardio distance greater than 0 and no more than 1,000.");
      return;
    }
    if (rows.some(exercise=>exercise.sets.some(set=>set.reps < 0 || set.weightLbs < 0))) {
      notify("Sets, reps, and weight must be zero or greater.");
      return;
    }
    const volume = workoutVolume(rows);
    const xp = Math.round(earnedXpForWorkout(volume,duration)*workoutXpMultiplier());
    const workout = {
      id:uid(),
      date:new Date().toISOString(),
      routineName:name,
      durationMins:duration,
      totalVolumeLbs:Math.round(volume),
      energySpent:$("#energy-select").value,
      exercises:rows,
      activityType:isCardio?"cardio":"strength",
      cardioActivity:isCardio?$("#cardio-activity").value:"",
      distance:isCardio?distance:0,
      distanceUnit:isCardio?$("#cardio-unit").value:"km"
    };
    state.workouts.unshift(workout);
    updateStreak();
    awardXP(xp);
    persist();
    renderAll();
    notify(`${isCardio?"Cardio session":"Workout"} logged — <strong>${bossDamage(volume,duration)} damage</strong> and <strong>+${xp} XP</strong>.`);
    $("#routine-name").value=isCardio?`${workout.cardioActivity} session`:"Custom workout";
  }
  function adjustResource(type, amount) {
    const field = type === "water" ? "dailyHydrationMl" : "dailyProteinG";
    const maximum = type === "water" ? WATER_GOAL : PROTEIN_GOAL;
    state.streaks[field] = Math.max(0,Math.min(maximum,state.streaks[field]+amount));
    renderResources();
    persist();
  }
  function applyTemplate(name) {
    if (name === "custom" && state.level < 16) {
      $("#macro-lock").hidden = false;
      $("#template-select").value = "";
      notify("Custom routine macros unlock at Titan Legend (Level 16).");
      return;
    }
    if (!TEMPLATES[name]) return;
    $("#routine-name").value = `${name} day`;
    renderExerciseRows(TEMPLATES[name].map(([exercise,muscle,sets,reps,weight])=>({name:exercise,muscle,sets,reps,weight})));
  }
  function applyCustomTemplate(value) {
    const index=Number(value.slice("custom:".length));
    const template=state.streaks.customTemplates[index];
    if(!template)return;
    $("#routine-name").value=template.name;
    renderExerciseRows(template.exercises.map(exercise=>({
      name:exercise.name,muscle:exercise.muscle,sets:exercise.sets.length,
      reps:exercise.sets[0]?.reps||8,weight:exercise.sets[0]?.weightLbs||0
    })));
  }
  function saveCustomTemplate(name) {
    if(!name?.trim()) {
      $("#template-select").value="";
      return;
    }
    const exercises=getExerciseRows().map(exerciseFromRow);
    if(!exercises.length) {
      $("#template-select").value="";
      notify("Add at least one exercise before saving a custom macro.");
      return;
    }
    state.streaks.customTemplates.push({name:name.trim().slice(0,40),exercises});
    persist();
    renderTemplateOptions();
    notify(`Custom macro saved: <strong>${safeText(name.trim())}</strong>.`);
    $("#template-select").value="";
  }
  function selectMuscle(target) {
    if (state.level < 6) {
      notify("Interactive muscle map unlocks at Iron Warrior (Level 6).");
      return;
    }
    selectedMuscle = selectedMuscle === target.dataset.muscle ? "" : target.dataset.muscle;
    $("#clear-muscle").hidden = !selectedMuscle;
    renderCoreProgress();
    renderHistory();
  }
  function bindEvents() {
    $$("[data-workout-mode]").forEach(button=>button.addEventListener("click",()=>{
      const previousMode=workoutMode;
      workoutMode=button.dataset.workoutMode;
      const isCardio=workoutMode==="cardio";
      const routineName=$("#routine-name");
      if(isCardio&&routineName.value==="Custom workout") {
        routineName.value=`${$("#cardio-activity").value} session`;
      } else if(!isCardio&&previousMode==="cardio"&&routineName.value===`${$("#cardio-activity").value} session`) {
        routineName.value="Custom workout";
      }
      $$("[data-workout-mode]").forEach(modeButton=>{
        const active=modeButton===button;
        modeButton.classList.toggle("active",active);
        modeButton.setAttribute("aria-pressed",String(active));
      });
      $("#strength-fields").hidden=isCardio;
      $("#cardio-fields").hidden=!isCardio;
      $("#log-workout").textContent=isCardio?"🏃 Log cardio session":"⚔ Log workout & attack boss";
      updateWorkoutEstimate();
    }));
    $("#exercise-list").addEventListener("click",event=>{
      const step=event.target.closest("[data-step]");
      if(step) {
        const input=step.parentElement.querySelector(`[data-field="${step.dataset.step}"]`);
        const minimum=Number(input.min)||0;
        const maximum=Number(input.max)||999;
        input.value=Math.min(maximum,Math.max(minimum,(Number(input.value)||0)+Number(step.dataset.change)));
        updateWorkoutEstimate();
        return;
      }
      if(event.target.closest(".remove-exercise")) {
        event.target.closest(".exercise-row").remove();
        updateWorkoutEstimate();
      }
    });
    $("#exercise-list").addEventListener("input",updateWorkoutEstimate);
    $("#exercise-list").addEventListener("change",updateWorkoutEstimate);
    $("#duration-input").addEventListener("input",updateWorkoutEstimate);
    $("#cardio-distance").addEventListener("input",updateWorkoutEstimate);
    $("#cardio-unit").addEventListener("change",updateWorkoutEstimate);
    $("#cardio-activity").addEventListener("change",event=>{
      const previousName=`${event.target.dataset.previousValue || "Running"} session`;
      if(workoutMode==="cardio"&&($("#routine-name").value===previousName||$("#routine-name").value==="Custom workout")) {
        $("#routine-name").value=`${event.target.value} session`;
      }
      event.target.dataset.previousValue=event.target.value;
    });
    $("#add-exercise").addEventListener("click",()=>{
      const current = getExerciseRows().map(ex=>({
        name:ex.name,
        muscle:ex.muscle,
        sets:ex.sets.length,
        reps:ex.sets[0]?.reps||8,
        weight:ex.sets[0]?.weightLbs||0
      }));
      renderExerciseRows([...current,{name:"",muscle:"chest",sets:3,reps:8,weight:0}]);
      const inputs=$$(".exercise-name");
      inputs.at(-1)?.focus();
    });
    $("#template-select").addEventListener("change",event=>{
      const value=event.target.value;
      if(value==="custom") {
        if(state.level<16) {
          $("#template-select").value="";
          return;
        }
        $("#macro-name").value="";
        $("#macro-dialog").showModal();
        $("#macro-name").focus();
        return;
      }
      if(value.startsWith("custom:")) {
        applyCustomTemplate(value);
        return;
      }
      applyTemplate(value);
    });
    $("#macro-form").addEventListener("submit",event=>{
      event.preventDefault();
      saveCustomTemplate($("#macro-name").value);
      $("#macro-dialog").close();
    });
    [$("#macro-cancel"),$("#macro-cancel-x")].forEach(button=>
      button.addEventListener("click",()=>{
        $("#macro-dialog").close();
        $("#template-select").value="";
      }));
    $("#log-workout").addEventListener("click",logWorkout);
    $("#start-workout").addEventListener("click",()=>$("#routine-name").focus());
    $("#water-vessel").addEventListener("click",()=>adjustResource("water",250));
    $("#water-vessel").addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" ") {
        event.preventDefault();
        adjustResource("water",250);
      }
    });
    $$(".quick-add button").forEach(button=>button.addEventListener("click",()=>{
      if(button.dataset.water) adjustResource("water",Number(button.dataset.water));
      if(button.dataset.protein) adjustResource("protein",Number(button.dataset.protein));
    }));
    $("#water-form").addEventListener("submit",event=>{
      event.preventDefault();
      const input=$("#water-custom");
      const amount=Number(input.value);
      if(!Number.isFinite(amount)||!Number.isInteger(amount)||amount<1||amount>5000) {
        input.setCustomValidity("Enter a whole-number water amount from 1 to 5,000 ml.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      adjustResource("water",amount);
      input.value="";
      notify(`Added <strong>${amount.toLocaleString()} ml</strong> of water.`);
      input.focus();
    });
    $("#protein-form").addEventListener("submit",event=>{
      event.preventDefault();
      const input=$("#protein-custom");
      const amount=Number(input.value);
      if(!Number.isFinite(amount)||!Number.isInteger(amount)||amount<1||amount>300) {
        input.setCustomValidity("Enter a whole-number protein amount from 1 to 300 g.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      adjustResource("protein",amount);
      input.value="";
      notify(`Added <strong>${amount} g</strong> of protein.`);
      input.focus();
    });
    $("#muscle-map").addEventListener("click",event=>{
      const target=event.target.closest(".muscle-target");
      if(target) selectMuscle(target);
    });
    $("#muscle-map").addEventListener("keydown",event=>{
      if((event.key==="Enter"||event.key===" ")&&event.target.matches(".muscle-target")) {
        event.preventDefault();
        selectMuscle(event.target);
      }
    });
    $("#clear-muscle").addEventListener("click",()=>{
      selectedMuscle="";
      $("#clear-muscle").hidden=true;
      renderCoreProgress();
      renderHistory();
    });
    $("#fitness-exit").addEventListener("click",async()=>{
      const button=$("#fitness-exit");
      button.disabled=true;
      try {
        if(window.QuestlineAuth.isDemo) window.QuestlineAuth.exitDemo();
        else await window.QuestlineAuth.signOut();
      } catch(error) {
        notify(`Could not sign out: ${safeText(error.message||"Please try again.")}`);
      } finally { button.disabled=false; }
    });
    $("#gym-theme-toggle").addEventListener("click",()=>{
      if(state.level<6)return;
      state.streaks.neonThemeEnabled=!state.streaks.neonThemeEnabled;
      renderCoreProgress();
      persist();
    });
    window.addEventListener("online",()=>{if(syncPending)syncNow();});
  }
  async function startForUser(user) {
    if(!user?.id) return;
    if(userId===user.id && state) return;
    const request=++loadId;
    userId=user.id;
    demoMode=user.isDemo===true;
    app.hidden=true;
    app.inert=true;
    app.setAttribute("aria-hidden","true");
    $("#fitness-sync-status").textContent=demoMode?"Loading local demo…":"Loading your training data…";
    const localData=window.QuestlineStorage?.load(`fitness-${user.id}`);
    let data=null;
    let level=1;
    let xp=0;
    let totalXP=0;
    let cloudAvailable=false;
    coreTasks=[];
    if(!demoMode) {
      try {
        const remote=await window.QuestlineAuth.loadFitnessState(user.id);
        cloudAvailable=true;
        if(remote) {
          data=remote;
          level=remote.level;
          xp=remote.xp;
          totalXP=remote.totalXP;
        }
        const productivity=await window.QuestlineAuth.loadState(user.id);
        coreTasks=productivity?.tasks||[];
      } catch(error) {
        if(!localData) notify(`Could not load cloud training data: ${safeText(error.message||"Check connection and SQL setup.")}`);
      }
    }
    if(request!==loadId || userId!==user.id) return;
    if(localData && (!data || new Date(localData.streaks?.lastSavedAt||0)>new Date(data.streaks?.lastSavedAt||0))) {
      data=localData;
      level=localData.level;
      xp=localData.xp;
      totalXP=localData.totalXP;
    }
    if(!demoMode && data?.streaks?.trackingDate && data.streaks.trackingDate!==localDate()) {
      syncPending=true;
    }
    state=normalizeState(data,level,xp);
    state.totalXP=Number(data?.totalXP ?? totalXP) || 0;
    if(demoMode) {
      const core=window.QuestlineStorage?.load("local-demo");
      state=normalizeState(data||freshState(core?.profile?.level||1,core?.profile?.xp||0),core?.profile?.level||1,core?.profile?.xp||0);
      state.totalXP=core?.profile?.totalXP||0;
      coreTasks=core?.tasks||[];
    }
    if(!demoMode && (!cloudAvailable || !data)) syncPending=true;
    if(!window.__questlineFitnessEventsBound) {
      bindEvents();
      window.__questlineFitnessEventsBound=true;
    }
    $("#fitness-exit").textContent=demoMode?"Exit demo":"Sign out";
    app.hidden=false;
    app.inert=false;
    app.setAttribute("aria-hidden","false");
    renderExerciseRows();
    renderAll();
    window.QuestlineAuth.showDashboard();
    updateSyncStatus(demoMode?"Local demo · saved only on this device":syncPending?"Local copy · syncing when online":"Fitness data loaded");
    if(syncPending && navigator.onLine && !demoMode) syncNow();
  }
  function lockPage() {
    loadId+=1;
    userId=null;
    state=null;
    demoMode=false;
    syncPending=false;
    window.clearTimeout(syncTimer);
    app.hidden=true;
    app.inert=true;
    app.setAttribute("aria-hidden","true");
  }

  window.addEventListener("questline:auth",event=>{
    if(event.detail.user?.isDemo && window.QuestlineAuth.isDemo) void startForUser(event.detail.user);
    else if(event.detail.user && window.QuestlineAuth.user?.id===event.detail.user.id) void startForUser(event.detail.user);
    else if(!event.detail.user && !window.QuestlineAuth.user && !window.QuestlineAuth.isDemo) lockPage();
  });
  window.QuestlineAuth.ready.then(({user})=>{
    if(user) void startForUser(user);
    else if(window.QuestlineAuth.isDemo) void startForUser({id:"local-demo",email:"demo@local.invalid",isDemo:true});
    else lockPage();
  }).catch(error=>notify(`Could not initialize Fitness Arena: ${safeText(error.message||"Auth is unavailable.")}`));
})();
