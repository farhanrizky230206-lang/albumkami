(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const DEFAULTS = {
    id: 1,
    couple_name: "Farhan & Tiara",
    subtitle: "Every picture keeps a version of us that time can never take away.",
    hero_text:
      "This is our quiet corner of the internet — for blurry photos, loud laughs, ordinary afternoons, and everything that somehow became special because it was us.",
    quote_text:
      "Maybe home was never a place. Maybe it was all the little moments where I found you.",
    love_note:
      "I hope we never stop collecting the small things: random photos, late-night talks, silly jokes, quiet rides, and days that look ordinary to everyone else but mean everything to us.",
    start_date: null,
    cover_url: null,
    cover_url_2: null,
    music_url: null,
    song_label: "Our song ♡"
  };

  let db = null;
  let settings = { ...DEFAULTS };
  let memories = [];
  let currentFilter = "all";
  let currentSearch = "";
  let session = null;
  let isAdmin = false;
  let musicStarted = false;

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheEls();
    bindUI();
    $("#yearText").textContent = `© ${new Date().getFullYear()} — kept with love ♡`;

    const cfg = window.ALBUM_CONFIG || {};
    const ready =
      cfg.SUPABASE_URL &&
      cfg.SUPABASE_ANON_KEY &&
      !cfg.SUPABASE_URL.includes("PASTE_") &&
      !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

    if (!ready) {
      renderSettings();
      renderMemories();
      toast("Demo mode: isi config.js agar database aktif.");
      return;
    }

    try {
      db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      const { data } = await db.auth.getSession();
      session = data.session;
      await refreshAdminState();

      await Promise.all([loadSettings(), loadMemories()]);
      subscribeAuth();
    } catch (err) {
      console.error(err);
      toast("Gagal terhubung ke Supabase.");
      renderSettings();
      renderMemories();
    }
  }

  function cacheEls() {
    [
      "opening","enterBtn","app","openingCouple","openingSubtitle","navCouple",
      "daysTogether","sinceText","heroText","coverPhoto","coverPhoto2","coverCaption","quoteText",
      "memoryGrid","emptyState","searchInput","addMemoryFab","loveNoteBtn",
      "letterOpenBtn","loveNotePreview","footerCouple","adminBtn","musicBtn",
      "musicDock","closeMusicBtn","musicEmbed","songLabel","loginModal","loginForm",
      "loginEmail","loginPassword","loginError","adminModal","logoutBtn","uploadForm",
      "mediaFiles","fileNames","albumTitle","memoryCaption","memoryDate","memoryFavorite",
      "uploadProgressWrap","uploadProgress","uploadStatus","uploadError",
      "settingsForm","settingCouple","settingStartDate","settingSubtitle",
      "settingHeroText","settingQuote","settingLoveNote","settingMusicUrl",
      "settingSongLabel","coverFile","coverFile2","settingsError","letterModal","letterTitle",
      "fullLoveNote","lightbox","lightboxMedia","lightboxCaption","lightboxDate",
      "toast","heartLayer"
    ].forEach(id => els[id] = document.getElementById(id));
  }

  function bindUI() {
    els.enterBtn.addEventListener("click", () => {
      els.opening.classList.add("is-hidden");
      els.app.classList.remove("is-hidden");
      startHearts();
      if (settings.music_url) {
        openMusic(true);
      }
      window.scrollTo({ top: 0 });
    });

    els.adminBtn.addEventListener("click", async () => {
      if (!db) return toast("Isi config.js dulu untuk mengaktifkan login.");
      if (isAdmin) openDialog(els.adminModal);
      else openDialog(els.loginModal);
    });

    els.addMemoryFab.addEventListener("click", () => {
      switchAdminTab("upload");
      openDialog(els.adminModal);
    });

    els.musicBtn.addEventListener("click", () => openMusic(false));
    els.closeMusicBtn.addEventListener("click", () => els.musicDock.classList.add("is-hidden"));

    els.loveNoteBtn.addEventListener("click", openLetter);
    els.letterOpenBtn.addEventListener("click", openLetter);

    $$("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        const d = document.getElementById(btn.dataset.close);
        if (d?.open) d.close();
      });
    });

    $$(".modal").forEach(d => {
      d.addEventListener("click", e => {
        if (e.target === d) d.close();
      });
    });

    $$(".filter-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        $$(".filter-chip").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        renderMemories();
      });
    });

    els.searchInput.addEventListener("input", e => {
      currentSearch = e.target.value.trim().toLowerCase();
      renderMemories();
    });

    $$(".admin-tab").forEach(btn => {
      btn.addEventListener("click", () => switchAdminTab(btn.dataset.tab));
    });

    els.mediaFiles.addEventListener("change", showFileNames);
    els.loginForm.addEventListener("submit", handleLogin);
    els.logoutBtn.addEventListener("click", handleLogout);
    els.uploadForm.addEventListener("submit", handleUpload);
    els.settingsForm.addEventListener("submit", handleSettingsSave);

    els.lightbox.addEventListener("click", e => {
      if (e.target === els.lightbox) els.lightbox.close();
    });
  }

  function subscribeAuth() {
    db.auth.onAuthStateChange(async (_event, newSession) => {
      session = newSession;
      await refreshAdminState();
    });
  }

  async function refreshAdminState() {
    isAdmin = false;
    if (db && session?.user) {
      const { data, error } = await db.rpc("is_album_admin");
      if (!error) isAdmin = data === true;
    }
    els.addMemoryFab.classList.toggle("is-hidden", !isAdmin);
    els.adminBtn.title = isAdmin ? "Album controls" : "Owner login";
  }

  async function loadSettings() {
    if (!db) return;
    const { data, error } = await db
      .from("album_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error(error);
      toast("Settings belum bisa dibaca. Jalankan supabase.sql.");
    } else if (data) {
      settings = { ...DEFAULTS, ...data };
    }
    renderSettings();
  }

  async function loadMemories() {
    if (!db) return;
    const { data, error } = await db
      .from("memories")
      .select("*")
      .order("memory_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast("Memories belum bisa dibaca. Cek SQL/RLS.");
      memories = [];
    } else {
      memories = data || [];
    }
    renderMemories();
  }

  function renderSettings() {
    const couple = settings.couple_name || DEFAULTS.couple_name;
    els.openingCouple.innerHTML = escapeHtml(couple).replace("&amp;", "<i>&amp;</i>");
    els.openingSubtitle.textContent = settings.subtitle || DEFAULTS.subtitle;
    els.navCouple.textContent = couple;
    els.footerCouple.textContent = couple;
    els.heroText.textContent = settings.hero_text || DEFAULTS.hero_text;
    els.quoteText.textContent = settings.quote_text || DEFAULTS.quote_text;
    els.loveNotePreview.textContent = truncate(settings.love_note || DEFAULTS.love_note, 330);
    els.letterTitle.textContent = couple;
    els.fullLoveNote.textContent = settings.love_note || DEFAULTS.love_note;
    els.songLabel.textContent = settings.song_label || "Our song ♡";

    if (settings.cover_url) {
      els.coverPhoto.style.backgroundImage = `url("${cssUrl(settings.cover_url)}")`;
      els.coverPhoto.innerHTML = "";
    } else {
      els.coverPhoto.style.backgroundImage = "";
      els.coverPhoto.innerHTML = "<span>add our favorite photo</span>";
    }

    if (settings.cover_url_2) {
      els.coverPhoto2.style.backgroundImage = `url("${cssUrl(settings.cover_url_2)}")`;
      els.coverPhoto2.innerHTML = "";
    } else {
      els.coverPhoto2.style.backgroundImage = "";
      els.coverPhoto2.innerHTML = "<span>add another favorite photo</span>";
    }

    setTogetherCounter();
    fillSettingsForm();
    if (!els.musicDock.classList.contains("is-hidden")) renderMusic(false);
  }

  function setTogetherCounter() {
    if (!settings.start_date) {
      els.daysTogether.textContent = "—";
      els.sinceText.textContent = "set your anniversary in Album Settings";
      return;
    }
    const start = new Date(`${settings.start_date}T00:00:00`);
    const now = new Date();
    const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.max(0, Math.floor((nowUTC - startUTC) / 86400000) + 1);
    els.daysTogether.textContent = days.toLocaleString("id-ID");
    els.sinceText.textContent = `since ${formatDate(settings.start_date)}`;
  }

  function fillSettingsForm() {
    els.settingCouple.value = settings.couple_name || "";
    els.settingStartDate.value = settings.start_date || "";
    els.settingSubtitle.value = settings.subtitle || "";
    els.settingHeroText.value = settings.hero_text || "";
    els.settingQuote.value = settings.quote_text || "";
    els.settingLoveNote.value = settings.love_note || "";
    els.settingMusicUrl.value = settings.music_url || "";
    els.settingSongLabel.value = settings.song_label || "";
  }

  function renderMemories() {
    // Group database rows into one visual album/moment.
    const groupedMap = new Map();

    for (const item of memories) {
      const groupKey = item.album_id || item.id;
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          album_id: groupKey,
          album_title: item.album_title || "",
          caption: item.caption || "",
          memory_date: item.memory_date || null,
          is_favorite: !!item.is_favorite,
          created_at: item.created_at,
          items: []
        });
      }
      const group = groupedMap.get(groupKey);
      group.items.push(item);

      // If old/single rows have slightly different metadata, keep useful values.
      if (!group.album_title && item.album_title) group.album_title = item.album_title;
      if (!group.caption && item.caption) group.caption = item.caption;
      if (!group.memory_date && item.memory_date) group.memory_date = item.memory_date;
      if (item.is_favorite) group.is_favorite = true;
    }

    let groups = [...groupedMap.values()];

    for (const group of groups) {
      group.items.sort((a, b) => {
        const pa = Number.isFinite(a.album_position) ? a.album_position : 999999;
        const pb = Number.isFinite(b.album_position) ? b.album_position : 999999;
        if (pa !== pb) return pa - pb;
        return String(a.created_at || "").localeCompare(String(b.created_at || ""));
      });
    }

    if (currentFilter === "favorite") groups = groups.filter(x => x.is_favorite);
    if (currentFilter === "image") groups = groups.filter(x => x.items.some(i => i.file_type === "image"));
    if (currentFilter === "video") groups = groups.filter(x => x.items.some(i => i.file_type === "video"));
    if (currentSearch) {
      groups = groups.filter(x =>
        `${x.album_title || ""} ${x.caption || ""}`.toLowerCase().includes(currentSearch)
      );
    }

    groups.sort((a, b) => {
      const da = a.memory_date || a.created_at || "";
      const db = b.memory_date || b.created_at || "";
      return String(db).localeCompare(String(da));
    });

    els.emptyState.classList.toggle("is-hidden", groups.length > 0);
    els.memoryGrid.innerHTML = "";

    for (const group of groups) {
      const card = document.createElement("article");
      card.className = "memory-card";

      const slider = document.createElement("div");
      slider.className = "album-slider";

      let slideIndex = 0;
      const slides = [];

      group.items.forEach((item, index) => {
        const slide = document.createElement("div");
        slide.className = `album-slide${index === 0 ? " active" : ""}`;

        if (item.file_type === "video") {
          const v = document.createElement("video");
          v.src = item.public_url;
          v.preload = "metadata";
          v.muted = true;
          v.playsInline = true;
          slide.appendChild(v);

          const badge = document.createElement("span");
          badge.className = "video-badge";
          badge.textContent = "▶ video";
          slide.appendChild(badge);
        } else {
          const img = document.createElement("img");
          img.src = item.public_url;
          img.alt = group.album_title || group.caption || "Farhan & Tiara memory";
          img.loading = "lazy";
          slide.appendChild(img);
        }

        if (group.is_favorite) {
          const fav = document.createElement("span");
          fav.className = "favorite-badge";
          fav.textContent = "♡";
          slide.appendChild(fav);
        }

        slide.addEventListener("click", () => openAlbumLightbox(group, index));
        slides.push(slide);
        slider.appendChild(slide);
      });

      const updateSlider = () => {
        slides.forEach((s, i) => s.classList.toggle("active", i === slideIndex));
        const count = slider.querySelector(".album-count");
        if (count) count.textContent = `${slideIndex + 1}/${slides.length}`;
        card.querySelectorAll(".album-dot").forEach((d, i) =>
          d.classList.toggle("active", i === slideIndex)
        );
      };

      if (group.items.length > 1) {
        const prev = document.createElement("button");
        prev.className = "album-nav prev";
        prev.type = "button";
        prev.textContent = "‹";
        prev.setAttribute("aria-label", "Previous photo");
        prev.addEventListener("click", e => {
          e.stopPropagation();
          slideIndex = (slideIndex - 1 + slides.length) % slides.length;
          updateSlider();
        });

        const next = document.createElement("button");
        next.className = "album-nav next";
        next.type = "button";
        next.textContent = "›";
        next.setAttribute("aria-label", "Next photo");
        next.addEventListener("click", e => {
          e.stopPropagation();
          slideIndex = (slideIndex + 1) % slides.length;
          updateSlider();
        });

        const count = document.createElement("span");
        count.className = "album-count";
        count.textContent = `1/${group.items.length}`;

        const stack = document.createElement("span");
        stack.className = "album-stack-badge";
        stack.textContent = `${group.items.length} files`;

        slider.append(prev, next, count, stack);
      }

      const content = document.createElement("div");
      content.className = "memory-content";

      if (group.album_title) {
        const h4 = document.createElement("h4");
        h4.textContent = group.album_title;
        content.appendChild(h4);
      }

      if (group.caption) {
        const p = document.createElement("p");
        p.textContent = group.caption;
        content.appendChild(p);
      }

      const date = document.createElement("small");
      date.textContent = group.memory_date ? formatDate(group.memory_date) : "a little moment ♡";
      content.appendChild(date);

      if (group.items.length > 1) {
        const dots = document.createElement("div");
        dots.className = "album-dots";
        group.items.forEach((_, i) => {
          const dot = document.createElement("button");
          dot.type = "button";
          dot.className = `album-dot${i === 0 ? " active" : ""}`;
          dot.setAttribute("aria-label", `Open item ${i + 1}`);
          dot.addEventListener("click", () => {
            slideIndex = i;
            updateSlider();
          });
          dots.appendChild(dot);
        });
        content.appendChild(dots);
      }

      if (isAdmin) {
        const actions = document.createElement("div");
        actions.className = "memory-admin-actions";

        const favBtn = document.createElement("button");
        favBtn.className = "mini-btn";
        favBtn.textContent = group.is_favorite ? "Unfavorite" : "♡ Favorite";
        favBtn.addEventListener("click", () => toggleAlbumFavorite(group));

        const delBtn = document.createElement("button");
        delBtn.className = "mini-btn danger";
        delBtn.textContent = "Delete album";
        delBtn.addEventListener("click", () => deleteAlbum(group));

        actions.append(favBtn, delBtn);
        content.appendChild(actions);
      }

      card.append(slider, content);
      els.memoryGrid.appendChild(card);
    }
  }

  function openAlbumLightbox(group, startIndex = 0) {
    let index = startIndex;

    const draw = () => {
      const item = group.items[index];
      els.lightboxMedia.innerHTML = "";

      const wrap = document.createElement("div");
      wrap.style.position = "relative";
      wrap.style.display = "grid";
      wrap.style.placeItems = "center";

      if (item.file_type === "video") {
        const video = document.createElement("video");
        video.src = item.public_url;
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        wrap.appendChild(video);
      } else {
        const img = document.createElement("img");
        img.src = item.public_url;
        img.alt = group.album_title || group.caption || "Memory";
        wrap.appendChild(img);
      }

      if (group.items.length > 1) {
        const prev = document.createElement("button");
        prev.type = "button";
        prev.className = "album-nav prev";
        prev.textContent = "‹";
        prev.addEventListener("click", e => {
          e.stopPropagation();
          index = (index - 1 + group.items.length) % group.items.length;
          draw();
        });

        const next = document.createElement("button");
        next.type = "button";
        next.className = "album-nav next";
        next.textContent = "›";
        next.addEventListener("click", e => {
          e.stopPropagation();
          index = (index + 1) % group.items.length;
          draw();
        });

        const count = document.createElement("span");
        count.className = "album-count";
        count.textContent = `${index + 1}/${group.items.length}`;
        wrap.append(prev, next, count);
      }

      els.lightboxMedia.appendChild(wrap);
      els.lightboxCaption.textContent =
        [group.album_title, group.caption].filter(Boolean).join(" — ");
      els.lightboxDate.textContent = group.memory_date ? formatDate(group.memory_date) : "";
    };

    draw();
    openDialog(els.lightbox);
  }

  async function toggleAlbumFavorite(group) {
    if (!isAdmin) return;
    const ids = group.items.map(x => x.id);
    const { error } = await db
      .from("memories")
      .update({ is_favorite: !group.is_favorite })
      .in("id", ids);

    if (error) return toast(error.message);
    await loadMemories();
  }

  async function deleteAlbum(group) {
    if (!isAdmin) return;
    const label = group.album_title ? `“${group.album_title}”` : "album ini";
    if (!confirm(`Hapus ${label} beserta ${group.items.length} file?`)) return;

    const ids = group.items.map(x => x.id);
    const paths = group.items.map(x => x.file_path).filter(Boolean);

    const { error: rowError } = await db
      .from("memories")
      .delete()
      .in("id", ids);

    if (rowError) return toast(rowError.message);

    if (paths.length) {
      const { error: storageError } = await db.storage
        .from("album-media")
        .remove(paths);
      if (storageError) console.warn(storageError);
    }

    await loadMemories();
    toast("Album deleted.");
  }

  async function handleLogin(e) {
    e.preventDefault();
    els.loginError.textContent = "";
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      els.loginError.textContent = error.message;
      return;
    }

    session = data.session;
    await refreshAdminState();

    if (!isAdmin) {
      await db.auth.signOut();
      els.loginError.textContent = "Akun ini bukan owner album.";
      return;
    }

    els.loginForm.reset();
    els.loginModal.close();
    openDialog(els.adminModal);
    toast("Welcome back ♡");
    renderMemories();
  }

  async function handleLogout() {
    if (!db) return;
    await db.auth.signOut();
    session = null;
    isAdmin = false;
    els.adminModal.close();
    els.addMemoryFab.classList.add("is-hidden");
    renderMemories();
    toast("Logged out.");
  }

  function showFileNames() {
    els.fileNames.innerHTML = "";
    [...els.mediaFiles.files].forEach(file => {
      const tag = document.createElement("span");
      tag.className = "file-tag";
      tag.textContent = `${file.name} · ${prettyBytes(file.size)}`;
      els.fileNames.appendChild(tag);
    });
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!db || !isAdmin) return;

    const files = [...els.mediaFiles.files];
    if (!files.length) return;

    els.uploadError.textContent = "";
    els.uploadProgressWrap.classList.remove("is-hidden");
    els.uploadProgress.style.width = "0%";

    let done = 0;
    const albumId = crypto.randomUUID();
    const albumTitle = els.albumTitle.value.trim() || null;
    const caption = els.memoryCaption.value.trim() || null;
    const memoryDate = els.memoryDate.value || null;
    const favorite = els.memoryFavorite.checked;

    try {
      for (let index = 0; index < files.length; index++) {
        const originalFile = files[index];
        const isImage = originalFile.type.startsWith("image/");
        const isVideo = originalFile.type.startsWith("video/");
        if (!isImage && !isVideo) throw new Error(`Unsupported file: ${originalFile.name}`);

        let file = originalFile;

        if (isImage && originalFile.size > 2.5 * 1024 * 1024) {
          els.uploadStatus.textContent = `Optimizing ${originalFile.name}…`;
          file = await compressImage(originalFile, 2200, 0.86);
        }

        if (file.size > 8 * 1024 * 1024) {
          throw new Error(`${originalFile.name} masih lebih dari 8 MB. Kompres dulu atau pakai file yang lebih kecil.`);
        }

        els.uploadStatus.textContent = `Uploading ${index + 1}/${files.length}: ${originalFile.name}…`;

        const ext = fileExtension(file.name, file.type);
        const filePath = `memories/${new Date().getFullYear()}/${albumId}/${crypto.randomUUID()}.${ext}`;

        const { error: storageError } = await db.storage
          .from("album-media")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
          });

        if (storageError) throw storageError;

        const { data: publicData } = db.storage
          .from("album-media")
          .getPublicUrl(filePath);

        const { error: insertError } = await db.from("memories").insert({
          album_id: albumId,
          album_title: albumTitle,
          album_position: index,
          file_path: filePath,
          public_url: publicData.publicUrl,
          file_type: isVideo ? "video" : "image",
          caption,
          memory_date: memoryDate,
          is_favorite: favorite
        });

        if (insertError) {
          await db.storage.from("album-media").remove([filePath]);
          throw insertError;
        }

        done += 1;
        els.uploadProgress.style.width = `${Math.round(done / files.length * 100)}%`;
      }

      els.uploadStatus.textContent = "Album uploaded ♡";
      els.uploadForm.reset();
      els.fileNames.innerHTML = "";
      await loadMemories();
      toast(`${done} file masuk ke 1 album ♡`);
      setTimeout(() => els.uploadProgressWrap.classList.add("is-hidden"), 900);
    } catch (err) {
      console.error(err);
      els.uploadError.textContent = err.message || "Upload failed.";
      els.uploadStatus.textContent = "Upload stopped.";
    }
  }

  async function handleSettingsSave(e) {
    e.preventDefault();
    if (!db || !isAdmin) return;

    els.settingsError.textContent = "";
    const saveBtn = e.submitter;
    if (saveBtn) saveBtn.disabled = true;

    try {
      let coverUrl = settings.cover_url || null;
      let coverUrl2 = settings.cover_url_2 || null;

      const uploadCover = async (inputEl, label) => {
        const selected = inputEl.files[0];
        if (!selected) return null;

        let file = selected;
        if (selected.size > 2.5 * 1024 * 1024) {
          file = await compressImage(selected, 2200, 0.88);
        }
        if (file.size > 8 * 1024 * 1024) {
          throw new Error(`${label} terlalu besar.`);
        }

        const ext = fileExtension(file.name, file.type);
        const path = `covers/${crypto.randomUUID()}.${ext}`;

        const { error: coverErr } = await db.storage
          .from("album-media")
          .upload(path, file, { upsert: false, contentType: file.type });

        if (coverErr) throw coverErr;

        const { data: pub } = db.storage.from("album-media").getPublicUrl(path);
        return pub.publicUrl;
      };

      const newCover1 = await uploadCover(els.coverFile, "Cover photo 1");
      if (newCover1) coverUrl = newCover1;

      const newCover2 = await uploadCover(els.coverFile2, "Cover photo 2");
      if (newCover2) coverUrl2 = newCover2;

      const payload = {
        id: 1,
        couple_name: els.settingCouple.value.trim() || "Farhan & Tiara",
        start_date: els.settingStartDate.value || null,
        subtitle: els.settingSubtitle.value.trim() || DEFAULTS.subtitle,
        hero_text: els.settingHeroText.value.trim() || DEFAULTS.hero_text,
        quote_text: els.settingQuote.value.trim() || DEFAULTS.quote_text,
        love_note: els.settingLoveNote.value.trim() || DEFAULTS.love_note,
        music_url: els.settingMusicUrl.value.trim() || null,
        song_label: els.settingSongLabel.value.trim() || "Our song ♡",
        cover_url: coverUrl,
        cover_url_2: coverUrl2,
        updated_at: new Date().toISOString()
      };

      const { error } = await db
        .from("album_settings")
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;

      settings = { ...DEFAULTS, ...payload };
      renderSettings();
      els.coverFile.value = "";
      els.coverFile2.value = "";
      toast("Album settings saved ♡");
    } catch (err) {
      console.error(err);
      els.settingsError.textContent = err.message || "Could not save settings.";
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function toggleFavorite(item) {
    if (!isAdmin) return;
    const { error } = await db
      .from("memories")
      .update({ is_favorite: !item.is_favorite })
      .eq("id", item.id);

    if (error) return toast(error.message);
    await loadMemories();
  }

  async function deleteMemory(item) {
    if (!isAdmin) return;
    if (!confirm("Hapus memory ini dari album?")) return;

    const { error: rowError } = await db.from("memories").delete().eq("id", item.id);
    if (rowError) return toast(rowError.message);

    const { error: storageError } = await db.storage
      .from("album-media")
      .remove([item.file_path]);

    if (storageError) console.warn(storageError);
    await loadMemories();
    toast("Memory deleted.");
  }

  function openLetter() {
    els.fullLoveNote.textContent = settings.love_note || DEFAULTS.love_note;
    els.letterTitle.textContent = settings.couple_name || "Farhan & Tiara";
    openDialog(els.letterModal);
  }

  function openLightbox(item) {
    els.lightboxMedia.innerHTML = "";

    if (item.file_type === "video") {
      const video = document.createElement("video");
      video.src = item.public_url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      els.lightboxMedia.appendChild(video);
    } else {
      const img = document.createElement("img");
      img.src = item.public_url;
      img.alt = item.caption || "Memory";
      els.lightboxMedia.appendChild(img);
    }

    els.lightboxCaption.textContent = item.caption || "";
    els.lightboxDate.textContent = item.memory_date ? formatDate(item.memory_date) : "";
    openDialog(els.lightbox);
  }

  function openMusic(fromEntry) {
    els.musicDock.classList.remove("is-hidden");
    renderMusic(fromEntry);
  }

  function renderMusic(fromEntry) {
    const url = (settings.music_url || "").trim();
    els.songLabel.textContent = settings.song_label || "Our song ♡";

    if (!url) {
      els.musicEmbed.innerHTML = `
        <div class="music-empty">
          <span>♫</span>
          <p>The owner can set a Spotify or YouTube link in Album Settings.</p>
        </div>`;
      return;
    }

    const spotify = parseSpotify(url);
    const youtube = parseYouTube(url);

    if (spotify) {
      // Spotify embeds intentionally keep the official player visible.
      els.musicEmbed.innerHTML = `
        <iframe
          src="https://open.spotify.com/embed/${spotify.type}/${spotify.id}?utm_source=generator&theme=0"
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy">
        </iframe>`;
      musicStarted = true;
      return;
    }

    if (youtube) {
      // Because this runs after a real tap on the opening screen,
      // browsers may allow autoplay with sound. If not, user can press play.
      const autoplay = fromEntry ? 1 : 0;
      els.musicEmbed.innerHTML = `
        <iframe
          height="218"
          src="https://www.youtube.com/embed/${youtube}?autoplay=${autoplay}&loop=1&playlist=${youtube}&playsinline=1&rel=0"
          title="Our song"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen>
        </iframe>`;
      musicStarted = true;
      return;
    }

    els.musicEmbed.innerHTML = `
      <div class="music-empty">
        <span>♫</span>
        <p>Link belum dikenali. Gunakan link Spotify track/playlist/album atau link YouTube.</p>
      </div>`;
  }

  function parseSpotify(url) {
    try {
      const u = new URL(url);
      if (!u.hostname.includes("spotify.com")) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      const typeIndex = parts.findIndex(x => ["track","playlist","album","episode","show"].includes(x));
      if (typeIndex < 0 || !parts[typeIndex + 1]) return null;
      return {
        type: parts[typeIndex],
        id: parts[typeIndex + 1].split("?")[0]
      };
    } catch {
      return null;
    }
  }

  function parseYouTube(url) {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") return u.pathname.split("/").filter(Boolean)[0] || null;
      if (u.hostname.includes("youtube.com")) {
        if (u.pathname === "/watch") return u.searchParams.get("v");
        const parts = u.pathname.split("/").filter(Boolean);
        if (["shorts","embed","live"].includes(parts[0])) return parts[1] || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  function switchAdminTab(name) {
    $$(".admin-tab").forEach(x => x.classList.toggle("active", x.dataset.tab === name));
    $("#uploadTab").classList.toggle("active", name === "upload");
    $("#settingsTab").classList.toggle("active", name === "settings");
  }

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  function startHearts() {
    if (startHearts.started) return;
    startHearts.started = true;

    setInterval(() => {
      if (document.hidden) return;
      const h = document.createElement("span");
      h.className = "float-heart";
      h.textContent = Math.random() > .18 ? "♡" : "✦";
      h.style.left = `${Math.random() * 100}%`;
      h.style.fontSize = `${12 + Math.random() * 18}px`;
      h.style.animationDuration = `${6 + Math.random() * 5}s`;
      h.style.opacity = `${.18 + Math.random() * .35}`;
      els.heartLayer.appendChild(h);
      setTimeout(() => h.remove(), 11500);
    }, 1100);
  }

  async function compressImage(file, maxSide = 2200, quality = .86) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + ".jpg",
      { type: "image/jpeg", lastModified: Date.now() }
    );
  }

  function fileExtension(name, type) {
    const fromName = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    if (/^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
    const map = {
      "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif",
      "video/mp4":"mp4","video/quicktime":"mov","video/webm":"webm"
    };
    return map[type] || "bin";
  }

  function prettyBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  function formatDate(dateString) {
    try {
      const [y,m,d] = dateString.split("-").map(Number);
      return new Intl.DateTimeFormat("en", {
        day:"numeric", month:"long", year:"numeric"
      }).format(new Date(y, m - 1, d));
    } catch {
      return dateString;
    }
  }

  function truncate(text, max) {
    if (!text || text.length <= max) return text || "";
    return text.slice(0, max).trimEnd() + "…";
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function cssUrl(url) {
    return String(url).replace(/["\\\n\r]/g, "");
  }

  let toastTimer;
  function toast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2800);
  }
})();
