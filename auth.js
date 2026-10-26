/* First run supabase-setup.sql, then replace both placeholders with the Project URL
   and publishable anon key from Project Settings > API. Never use service_role here. */
const SUPABASE_URL = "https://jmvfwlbxcbkwkgfiqxfc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdmZ3bGJ4Y2Jrd2tnZmlxeGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NzM2OTEsImV4cCI6MjEwODU0OTY5MX0._s51KOgsDwsGOpnxxIlBqu8-u-7rEgSXuFpiA2NIfKo";

(() => {
  "use strict";
  const gate = document.getElementById("auth-gate");
  const signinForm = document.getElementById("signin-panel");
  const signupForm = document.getElementById("signup-panel");
  const message = document.getElementById("auth-message");
  const signinTab = document.getElementById("signin-tab");
  const signupTab = document.getElementById("signup-tab");
  const tabs = gate.querySelector(".auth-tabs");
  const footnote = gate.querySelector(".auth-footnote");
  const configured = SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  const client = configured && window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
    : null;

  let session = null;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  function setMessage(text, kind = "") {
    message.textContent = text;
    message.dataset.kind = kind;
  }
  function showGate() {
    gate.hidden = false;
    tabs.hidden = false;
    footnote.hidden = false;
    signinForm.hidden = false;
    signupForm.hidden = true;
    signinTab.classList.add("active");
    signupTab.classList.remove("active");
    signinTab.setAttribute("aria-selected", "true");
    signupTab.setAttribute("aria-selected", "false");
    document.getElementById("auth-title").textContent = "Welcome back.";
    setMessage("");
    document.getElementById("app-shell").hidden = true;
    document.getElementById("app-shell").inert = true;
    document.getElementById("app-shell").setAttribute("aria-hidden", "true");
  }
  function showDashboard() {
    gate.hidden = true;
  }
  function showLoading() {
    gate.hidden = false;
    tabs.hidden = true;
    footnote.hidden = true;
    signinForm.hidden = true;
    signupForm.hidden = true;
    document.getElementById("auth-title").textContent = "Loading your progress.";
    setMessage("Securely loading your account…");
    const app = document.getElementById("app-shell");
    app.hidden = true;
    app.inert = true;
    app.setAttribute("aria-hidden", "true");
  }
  function setTab(tab) {
    const signingIn = tab === "signin";
    signinForm.hidden = !signingIn;
    signupForm.hidden = signingIn;
    signinTab.classList.toggle("active", signingIn);
    signupTab.classList.toggle("active", !signingIn);
    signinTab.setAttribute("aria-selected", String(signingIn));
    signupTab.setAttribute("aria-selected", String(!signingIn));
    document.getElementById("auth-title").textContent = signingIn ? "Welcome back." : "Start your next chapter.";
    setMessage("");
  }
  function friendlyError(error) {
    const text = String(error?.message || "");
    if (/already registered|already exists|user already/i.test(text)) return "An account already exists for that email. Sign in instead.";
    if (/invalid login credentials/i.test(text)) return "That email and password combination was not recognized.";
    if (/email not confirmed/i.test(text)) return "Please confirm your email using the link we sent before signing in.";
    return text || "Authentication failed. Please try again.";
  }
  function publishSession(nextSession, eventName) {
    const previousId = session?.user?.id || null;
    session = nextSession;
    if (session?.user) {
      if (previousId !== session.user.id) showLoading();
    } else showGate();
    if (previousId !== (session?.user?.id || null) || eventName === "SIGNED_OUT") {
      const detail = { user: session?.user || null, event: eventName };
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("questline:auth", { detail })), 0);
    }
  }
  async function initialize() {
    if (!client) {
      showGate();
      setMessage(
        configured
          ? "The Supabase CDN client did not load. Check your connection and reload."
          : "Setup required: add your Supabase Project URL and publishable anon key at the top of auth.js.",
        "error"
      );
      resolveReady({ client: null, session: null, user: null });
      return;
    }

    client.auth.onAuthStateChange((event, nextSession) => {
      publishSession(nextSession, event);
    });
    const { data, error } = await client.auth.getSession();
    if (error) {
      showGate();
      setMessage(`Could not check your session: ${friendlyError(error)}`, "error");
      resolveReady({ client, session: null, user: null });
      return;
    }
    publishSession(data.session, "INITIAL_SESSION");
    resolveReady({ client, session, user: session?.user || null });
  }

  signinTab.addEventListener("click", () => setTab("signin"));
  signupTab.addEventListener("click", () => setTab("signup"));

  signinForm.addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;
    if (password.length < 8) {
      setMessage("Your password must be at least 8 characters.", "error");
      return;
    }
    if (!client) return;
    const submit = signinForm.querySelector('[type="submit"]');
    submit.disabled = true;
    setMessage("Signing in…");
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      publishSession(data.session, "SIGNED_IN");
      setMessage("");
    } catch (error) {
      setMessage(friendlyError(error), "error");
    } finally {
      submit.disabled = false;
    }
  });

  signupForm.addEventListener("submit", async event => {
    event.preventDefault();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmation = document.getElementById("signup-confirm").value;
    if (password.length < 8) {
      setMessage("Your password must be at least 8 characters.", "error");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.", "error");
      return;
    }
    if (!client) return;
    const submit = signupForm.querySelector('[type="submit"]');
    submit.disabled = true;
    setMessage("Creating your account…");
    try {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user?.identities?.length === 0) {
        setMessage("An account already exists for that email. Sign in instead.", "error");
        return;
      }
      if (data.session) {
        const { error: profileError } = await client.from("profiles").upsert({
          id: data.user.id,
          level: 1,
          xp: 0,
          active_tier: "novice",
          theme_preference: "dark"
        }, { onConflict: "id", ignoreDuplicates: true });
        if (profileError) throw profileError;
        publishSession(data.session, "SIGNED_IN");
        setMessage("");
      } else {
        setTab("signin");
        setMessage("Account created. Check your email to confirm your account, then sign in.", "success");
        document.getElementById("signin-email").value = email;
      }
    } catch (error) {
      setMessage(friendlyError(error), "error");
    } finally {
      submit.disabled = false;
    }
  });

  const api = {
    get client() { return client; },
    get session() { return session; },
    get user() { return session?.user || null; },
    ready,
    showDashboard,
    showLoading,
    async signOut() {
      if (!client) throw new Error("Supabase is not configured.");
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    async loadState(userId) {
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("id, level, xp, active_tier, theme_preference, metadata")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) return null;
      const { data: tasks, error: taskError } = await client
        .from("tasks")
        .select("id, title, description, priority, status, subtasks, due_date, tags, energy_cost, created_at, completed_at, completion_rewarded")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (taskError) throw taskError;
      const metadata = profile.metadata && typeof profile.metadata === "object" ? profile.metadata : {};
      const profileMetadata = metadata.profile && typeof metadata.profile === "object" ? metadata.profile : {};
      return {
        profile: {
          ...profileMetadata,
          level: profile.level,
          xp: profile.xp,
          tier: profile.active_tier,
          activeTheme: profile.theme_preference
        },
        tasks: (tasks || []).map(task => ({
          id: task.id,
          title: task.title,
          description: task.description || "",
          priority: task.priority,
          status: task.status,
          subtasks: task.subtasks || [],
          dueDate: task.due_date ? String(task.due_date).slice(0, 10) : "",
          tags: task.tags || [],
          energy: task.energy_cost,
          createdAt: task.created_at ? new Date(task.created_at).getTime() : Date.now(),
          completedAt: task.completed_at ? new Date(task.completed_at).getTime() : null,
          completionRewarded: !!task.completion_rewarded
        })),
        activity: metadata.activity || { completions: [], focus: [] },
        settings: metadata.settings || {}
      };
    },
    async syncState(userId, state) {
      const { error: profileError } = await client.from("profiles").upsert({
        id: userId,
        level: state.profile.level,
        xp: state.profile.xp,
        active_tier: state.profile.tier,
        theme_preference: state.profile.activeTheme,
        metadata: {
          profile: state.profile,
          activity: state.activity,
          settings: state.settings
        }
      }, { onConflict: "id" });
      if (profileError) throw profileError;

      const rows = state.tasks.map(task => ({
        id: task.id,
        user_id: userId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        subtasks: task.subtasks,
        due_date: task.dueDate ? `${task.dueDate}T12:00:00.000Z` : null,
        tags: task.tags,
        energy_cost: task.energy,
        created_at: new Date(task.createdAt).toISOString(),
        completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        completion_rewarded: task.completionRewarded
      }));
      if (rows.length) {
        const { error: taskUpsertError } = await client.from("tasks").upsert(rows, { onConflict: "id" });
        if (taskUpsertError) throw taskUpsertError;
      }

      const { data: existing, error: existingError } = await client
        .from("tasks")
        .select("id")
        .eq("user_id", userId);
      if (existingError) throw existingError;
      const retainedIds = new Set(rows.map(row => row.id));
      for (const task of existing || []) {
        if (!retainedIds.has(task.id)) {
          const { error: deleteError } = await client.from("tasks")
            .delete()
            .eq("user_id", userId)
            .eq("id", task.id);
          if (deleteError) throw deleteError;
        }
      }
    }
  };
  window.QuestlineAuth = api;
  showGate();
  api.ready = ready;
  initialize().catch(error => {
    showGate();
    setMessage(`Could not initialize authentication: ${friendlyError(error)}`, "error");
    resolveReady({ client, session: null, user: null });
  });
})();
