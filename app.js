(function () {
    'use strict';

    const LS_KEYS = {
        lang: 'pzConfigEditor.language',
        values: 'pzConfigEditor.values',
        customSchema: 'pzConfigEditor.customSchema',
        exportNoticeSeen: 'pzConfigEditor.exportNoticeSeen',
    };

    // Sync backend lives at the same origin under /api (see server/), gated by
    // Cloudflare Access, and always targets the one server configured in its
    // .env. /api/whoami tells us whether this browser is logged in; if it
    // isn't (no backend, or Access denies), sync stays hidden.
    const API_BASE = '';

    const state = {
        schema: null,          // { version, sections: [...] }
        translations: null,    // { ui, sections, params }
        values: {},             // path -> current value
        lang: 'en',
        search: '',
        authEmail: null,        // email from /api/whoami, or null if logged out
        server: null,           // /api/status result, or null if not fetched yet
    };

    const els = {};

    // Mirrors the server's step sequence in server/index.js, used only to
    // size the progress bar — order must match what /api/sync/push emits.
    const SYNC_STEP_ORDER = ['validate', 'backup', 'countdown', 'save', 'stop', 'write', 'start', 'done'];
    let syncInFlight = false;      // a push request is currently streaming
    let syncCancellable = true;    // mirrors the latest event's `cancellable` flag
    let syncAbortController = null;

    function qs(id) { return document.getElementById(id); }

    function cacheEls() {
        els.sidebar = qs('sidebar');
        els.mainPanel = qs('main-panel');
        els.searchInput = qs('search-input');
        els.langToggle = qs('lang-toggle');
        els.loadFileBtn = qs('load-file-btn');
        els.fileInput = qs('file-input');
        els.authStatus = qs('auth-status');
        els.loginLink = qs('login-link');
        els.syncPullBtn = qs('sync-pull-btn');
        els.syncPushBtn = qs('sync-push-btn');
        els.serverBtn = qs('server-btn');
        els.serverModal = qs('server-modal');
        els.serverModalTitle = qs('server-modal-title');
        els.serverStatusDot = qs('server-status-dot');
        els.serverStatusText = qs('server-status-text');
        els.serverPlayers = qs('server-players');
        els.announceInput = qs('announce-input');
        els.announceSendBtn = qs('announce-send-btn');
        els.serverCloseBtn = qs('server-close-btn');
        els.exportBtn = qs('export-btn');
        els.appTitle = qs('app-title');
        els.versionBadge = qs('version-badge');
        els.tooltipLayer = qs('tooltip-layer');
        els.exportModal = qs('export-modal');
        els.exportModalBody = qs('export-modal-body');
        els.exportConfirmBtn = qs('export-confirm-btn');
        els.exportCancelBtn = qs('export-cancel-btn');
        els.syncModal = qs('sync-modal');
        els.syncModalBody = qs('sync-modal-body');
        els.syncProgress = qs('sync-progress');
        els.syncProgressBar = qs('sync-progress-bar');
        els.syncLog = qs('sync-log');
        els.syncConfirmBtn = qs('sync-confirm-btn');
        els.syncCancelBtn = qs('sync-cancel-btn');
        els.syncBgBtn = qs('sync-bg-btn');
        els.syncBgIndicator = qs('sync-bg-indicator');
        els.syncBgText = qs('sync-bg-text');
        els.toast = qs('toast');
        els.layout = qs('layout');
        els.onboardingScreen = qs('onboarding-screen');
        els.onboardingTitle = qs('onboarding-title');
        els.onboardingBody = qs('onboarding-body');
        els.onboardingScratchBtn = qs('onboarding-scratch-btn');
        els.onboardingImportBtn = qs('onboarding-import-btn');
    }

    // ---------- translation helpers ----------

    function t(key) {
        const entry = state.translations.ui[key];
        if (!entry) return key;
        return entry[state.lang] || entry.en || key;
    }

    function humanizeKey(key) {
        return key
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .replace(/_/g, ' ')
            .trim();
    }

    function getSectionLabel(sectionName) {
        const entry = state.translations.sections[sectionName];
        if (!entry) return sectionName;
        return entry[state.lang] || entry.en || sectionName;
    }

    function getParamTranslation(path) {
        return (state.translations.params && state.translations.params[path]) || null;
    }

    function getParamLabel(param) {
        const tr = getParamTranslation(param.path);
        if (tr && tr.label) return tr.label[state.lang] || tr.label.en;
        return humanizeKey(param.key);
    }

    function getParamDescription(param) {
        const tr = getParamTranslation(param.path);
        if (tr && tr.description) {
            const d = tr.description[state.lang] || tr.description.en;
            if (d) return d;
        }
        return param.description || (state.lang === 'uk' ? 'Опис відсутній.' : 'No description available.');
    }

    function getOptionLabel(param, optValue) {
        const tr = getParamTranslation(param.path);
        if (tr && tr.options && tr.options[String(optValue)]) {
            const o = tr.options[String(optValue)];
            return o[state.lang] || o.en;
        }
        const raw = (param.options || []).find((o) => o.value === optValue);
        return raw ? raw.label : String(optValue);
    }

    // ---------- default / modified helpers ----------

    function getDefaultValue(param) {
        if (param.default === null || param.default === undefined) return undefined;
        if (param.type === 'enum') {
            if (typeof param.default === 'number') return param.default;
            const target = String(param.default).trim().toLowerCase();
            const match = (param.options || []).find((o) => o.label.trim().toLowerCase() === target);
            return match ? match.value : undefined;
        }
        if (param.type === 'integer') return Math.trunc(param.default);
        if (param.type === 'float') return param.default;
        return undefined;
    }

    function currentValue(param) {
        return state.values[param.path] !== undefined ? state.values[param.path] : param.value;
    }

    function findParamByPath(path) {
        for (const section of state.schema.sections) {
            const found = section.params.find((p) => p.path === path);
            if (found) return found;
        }
        return undefined;
    }

    // The per-skill multipliers are irrelevant once GlobalToggle is on — the
    // Global multiplier applies to every skill instead.
    function isGlobalMultiplierLocked(param) {
        if (param.section !== 'MultiplierConfig') return false;
        if (param.key === 'Global' || param.key === 'GlobalToggle') return false;
        const toggle = findParamByPath('MultiplierConfig.GlobalToggle');
        return toggle ? !!currentValue(toggle) : false;
    }

    function isModified(param) {
        const def = getDefaultValue(param);
        if (def === undefined) return false;
        return currentValue(param) !== def;
    }

    // ---------- persistence ----------

    function persist() {
        try {
            localStorage.setItem(LS_KEYS.lang, state.lang);
            localStorage.setItem(LS_KEYS.values, JSON.stringify(state.values));
        } catch (e) { /* storage unavailable, ignore */ }
    }

    function persistCustomSchema() {
        try {
            localStorage.setItem(LS_KEYS.customSchema, JSON.stringify(state.schema));
        } catch (e) { /* ignore */ }
    }

    function loadPersisted() {
        try {
            const lang = localStorage.getItem(LS_KEYS.lang);
            if (lang === 'en' || lang === 'uk') state.lang = lang;
            const values = localStorage.getItem(LS_KEYS.values);
            if (values) state.values = JSON.parse(values);
            const customSchema = localStorage.getItem(LS_KEYS.customSchema);
            if (customSchema) state.schema = JSON.parse(customSchema);
        } catch (e) { /* ignore corrupt storage */ }
    }

    // ---------- rendering ----------

    function render() {
        renderChrome();
        renderSidebar();
        renderMain();
    }

    function renderChrome() {
        document.documentElement.lang = state.lang;
        els.appTitle.textContent = t('app_title');
        document.title = t('app_title');
        els.searchInput.placeholder = t('search_placeholder');
        els.loadFileBtn.textContent = t('load_file');
        els.syncPullBtn.textContent = t('sync_from_server');
        els.syncPushBtn.textContent = t('sync_to_server');
        els.syncBgBtn.textContent = t('sync_background_btn');
        els.exportBtn.textContent = t('export_lua');
        els.langToggle.setAttribute('aria-pressed', state.lang === 'uk' ? 'true' : 'false');
        els.versionBadge.textContent = `${t('version_label')}: ${state.schema.version != null ? state.schema.version : '?'}`;
        els.onboardingTitle.textContent = t('onboarding_title');
        els.onboardingBody.textContent = t('onboarding_body');
        els.onboardingScratchBtn.textContent = t('onboarding_scratch');
        els.onboardingImportBtn.textContent = t('onboarding_import');
        els.loginLink.textContent = t('login_to_sync');
        els.serverBtn.textContent = t('server_btn');
        els.serverModalTitle.textContent = t('server_status_title');
        els.announceInput.placeholder = t('announce_placeholder');
        els.announceSendBtn.textContent = t('announce_send');
        els.serverCloseBtn.textContent = t('close');
        renderAuthStatus();
    }

    // "Signed in as {email}" needs the live email, so it's re-applied on every
    // render (not just once in checkAuth) — otherwise it'd stay in whichever
    // language was active at login and never update on a language toggle.
    function renderAuthStatus() {
        if (!state.authEmail) return;
        els.authStatus.textContent = t('signed_in_as').replace('{email}', state.authEmail);
    }

    function showOnboarding() {
        els.onboardingScreen.hidden = false;
        els.layout.hidden = true;
        els.searchInput.disabled = true;
        els.exportBtn.disabled = true;
        els.loadFileBtn.disabled = true;
        els.syncPushBtn.disabled = true;
    }

    function hideOnboarding() {
        els.onboardingScreen.hidden = true;
        els.layout.hidden = false;
        els.searchInput.disabled = false;
        els.exportBtn.disabled = false;
        els.loadFileBtn.disabled = false;
        els.syncPushBtn.disabled = false;
    }

    function startFromScratch() {
        const values = {};
        for (const section of state.schema.sections) {
            for (const param of section.params) {
                const def = getDefaultValue(param);
                if (def !== undefined) values[param.path] = def;
            }
        }
        state.values = values;
        persist();
        hideOnboarding();
        render();
    }

    function renderSidebar() {
        els.sidebar.innerHTML = '';
        const heading = document.createElement('div');
        heading.className = 'sidebar-item';
        heading.style.cursor = 'default';
        heading.style.color = 'var(--text-faint)';
        heading.style.fontSize = '11px';
        heading.style.textTransform = 'uppercase';
        heading.style.letterSpacing = '0.05em';
        heading.textContent = t('sections');
        els.sidebar.appendChild(heading);

        for (const section of state.schema.sections) {
            const item = document.createElement('div');
            item.className = 'sidebar-item';
            item.dataset.section = section.name;
            item.tabIndex = 0;
            item.setAttribute('role', 'button');

            const label = document.createElement('span');
            label.textContent = getSectionLabel(section.name);
            const count = document.createElement('span');
            count.className = 'sidebar-count';
            count.textContent = section.params.length;

            item.appendChild(label);
            item.appendChild(count);
            item.addEventListener('click', () => {
                const target = document.getElementById(`section-${section.name}`);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); }
            });
            els.sidebar.appendChild(item);
        }
    }

    function matchesSearch(param) {
        if (!state.search) return true;
        const q = state.search.toLowerCase();
        const label = getParamLabel(param).toLowerCase();
        const desc = getParamDescription(param).toLowerCase();
        const key = param.key.toLowerCase();
        return label.includes(q) || desc.includes(q) || key.includes(q);
    }

    function renderMain() {
        els.mainPanel.innerHTML = '';
        let anyVisible = false;

        for (const section of state.schema.sections) {
            const visibleParams = section.params.filter(matchesSearch);
            if (visibleParams.length === 0) continue;
            anyVisible = true;

            const block = document.createElement('section');
            block.className = 'section-block';
            block.id = `section-${section.name}`;

            const headingRow = document.createElement('div');
            headingRow.className = 'section-heading';
            const h2 = document.createElement('h2');
            h2.textContent = getSectionLabel(section.name);
            const countSpan = document.createElement('span');
            countSpan.className = 'section-count';
            countSpan.textContent = `${visibleParams.length} ${t('param_count')}`;
            headingRow.appendChild(h2);
            headingRow.appendChild(countSpan);
            block.appendChild(headingRow);

            const grid = document.createElement('div');
            grid.className = 'param-grid';
            for (const param of visibleParams) {
                grid.appendChild(renderParamCard(param));
            }
            block.appendChild(grid);
            els.mainPanel.appendChild(block);
        }

        if (!anyVisible) {
            const empty = document.createElement('div');
            empty.className = 'no-results';
            empty.textContent = t('no_results');
            els.mainPanel.appendChild(empty);
        }

        setupScrollSpy();
    }

    function renderParamCard(param) {
        const card = document.createElement('div');
        card.className = 'param-card';
        if (isModified(param)) card.classList.add('is-modified');
        if (isGlobalMultiplierLocked(param)) card.classList.add('is-locked');

        const header = document.createElement('div');
        header.className = 'param-header';

        const dot = document.createElement('span');
        dot.className = 'modified-dot';
        dot.title = t('modified');
        header.appendChild(dot);

        const label = document.createElement('span');
        label.className = 'param-label';
        label.textContent = getParamLabel(param);
        header.appendChild(label);

        const helpBtn = document.createElement('button');
        helpBtn.type = 'button';
        helpBtn.className = 'help-btn';
        helpBtn.textContent = '?';
        helpBtn.setAttribute('aria-label', getParamLabel(param) + ' – ' + t('close'));
        attachTooltip(helpBtn, param);
        header.appendChild(helpBtn);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'reset-btn';
        resetBtn.innerHTML = '&#8634;';
        resetBtn.title = t('reset_to_default');
        resetBtn.setAttribute('aria-label', t('reset_to_default'));
        const def = getDefaultValue(param);
        resetBtn.disabled = def === undefined;
        resetBtn.addEventListener('click', () => {
            if (def === undefined) return;
            state.values[param.path] = def;
            persist();
            renderMain();
        });
        header.appendChild(resetBtn);

        card.appendChild(header);

        const keyLine = document.createElement('div');
        keyLine.className = 'param-key';
        keyLine.textContent = param.path;
        card.appendChild(keyLine);

        const controlRow = document.createElement('div');
        controlRow.className = 'param-control-row';
        controlRow.appendChild(buildControl(param));
        card.appendChild(controlRow);

        const meta = buildMetaLine(param);
        if (meta) card.appendChild(meta);

        return card;
    }

    function buildControl(param) {
        const locked = isGlobalMultiplierLocked(param);
        const value = locked ? currentValue(findParamByPath('MultiplierConfig.Global')) : currentValue(param);

        if (param.type === 'boolean') {
            const wrap = document.createElement('label');
            wrap.className = 'toggle-switch';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!value;
            input.addEventListener('change', () => {
                state.values[param.path] = input.checked;
                persist();
                renderParamCardInPlace(param);
            });
            const track = document.createElement('span');
            track.className = 'toggle-track';
            const thumb = document.createElement('span');
            thumb.className = 'toggle-thumb';
            wrap.appendChild(input);
            wrap.appendChild(track);
            wrap.appendChild(thumb);

            const stateLabel = document.createElement('span');
            stateLabel.className = 'toggle-state-label';
            stateLabel.textContent = value ? t('toggle_on') : t('toggle_off');

            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.gap = '8px';
            container.appendChild(wrap);
            container.appendChild(stateLabel);
            return container;
        }

        if (param.type === 'enum') {
            const select = document.createElement('select');
            for (const opt of param.options) {
                const optionEl = document.createElement('option');
                optionEl.value = String(opt.value);
                optionEl.textContent = getOptionLabel(param, opt.value);
                if (opt.value === value) optionEl.selected = true;
                select.appendChild(optionEl);
            }
            select.addEventListener('change', () => {
                state.values[param.path] = parseInt(select.value, 10);
                persist();
                renderParamCardInPlace(param);
            });
            return select;
        }

        if (param.type === 'integer' || param.type === 'float') {
            const input = document.createElement('input');
            input.type = 'number';
            if (param.min !== null && param.min !== undefined) input.min = String(param.min);
            if (param.max !== null && param.max !== undefined) input.max = String(param.max);
            input.step = param.type === 'integer' ? '1' : 'any';
            input.value = String(value);
            input.disabled = locked;
            input.addEventListener('change', () => {
                let v = param.type === 'integer' ? parseInt(input.value, 10) : parseFloat(input.value);
                if (Number.isNaN(v)) v = value;
                if (param.min !== null && param.min !== undefined) v = Math.max(param.min, v);
                if (param.max !== null && param.max !== undefined) v = Math.min(param.max, v);
                input.value = String(v);
                state.values[param.path] = v;
                persist();
                renderParamCardInPlace(param);
            });
            return input;
        }

        // string
        const input = document.createElement('input');
        input.type = 'text';
        input.value = String(value);
        input.addEventListener('change', () => {
            state.values[param.path] = input.value;
            persist();
            renderParamCardInPlace(param);
        });
        return input;
    }

    function buildMetaLine(param) {
        const parts = [];
        if (param.type === 'integer' || param.type === 'float') {
            if (param.min !== null && param.min !== undefined) parts.push(`${t('min_label')}: ${param.min}`);
            if (param.max !== null && param.max !== undefined) parts.push(`${t('max_label')}: ${param.max}`);
        }
        const def = getDefaultValue(param);
        if (def !== undefined) {
            const defLabel = param.type === 'enum' ? getOptionLabel(param, def) : def;
            parts.push(`${t('default_label')}: ${defLabel}`);
        }
        if (parts.length === 0) return null;
        const div = document.createElement('div');
        div.className = 'param-meta';
        div.textContent = parts.join('   ·   ');
        return div;
    }

    // Re-render just one card in place (keeps scroll position / focus stable enough for this app's scale)
    function renderParamCardInPlace(param) {
        // Toggling GlobalToggle (or changing Global itself) changes how every
        // other multiplier card in the section renders (locked + displayed value),
        // so refresh the whole section instead of just this one card.
        if (param.section === 'MultiplierConfig' && (param.key === 'GlobalToggle' || param.key === 'Global')) {
            renderSectionInPlace(param.section);
            return;
        }
        const grid = document.getElementById(`section-${param.section}`);
        if (!grid) { renderMain(); return; }
        renderSidebarCounts();
        const cards = grid.querySelectorAll('.param-card');
        for (const card of cards) {
            const keyLine = card.querySelector('.param-key');
            if (keyLine && keyLine.textContent === param.path) {
                const newCard = renderParamCard(param);
                card.replaceWith(newCard);
                return;
            }
        }
    }

    function renderSectionInPlace(sectionName) {
        const block = document.getElementById(`section-${sectionName}`);
        const section = state.schema.sections.find((s) => s.name === sectionName);
        if (!block || !section) { renderMain(); return; }
        const grid = block.querySelector('.param-grid');
        if (!grid) { renderMain(); return; }
        grid.innerHTML = '';
        for (const param of section.params.filter(matchesSearch)) {
            grid.appendChild(renderParamCard(param));
        }
        renderSidebarCounts();
    }

    function renderSidebarCounts() {
        // counts are static (total params per section), nothing to update currently
    }

    // ---------- tooltip ----------

    let activeTooltipBtn = null;

    function attachTooltip(btn, param) {
        function show() {
            activeTooltipBtn = btn;
            const layer = els.tooltipLayer;
            const typeLabel = t('type_' + param.type);
            let html = `<strong>${escapeHtml(getParamLabel(param))}</strong><br>${escapeHtml(getParamDescription(param))}`;
            html += `<br><span style="color:var(--text-faint)">${escapeHtml(typeLabel)}</span>`;
            layer.innerHTML = html;
            layer.hidden = false;
            positionTooltip(btn, layer);
        }
        function hide() {
            if (activeTooltipBtn === btn) {
                els.tooltipLayer.hidden = true;
                activeTooltipBtn = null;
            }
        }
        btn.addEventListener('mouseenter', show);
        btn.addEventListener('mouseleave', hide);
        btn.addEventListener('focus', show);
        btn.addEventListener('blur', hide);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (els.tooltipLayer.hidden || activeTooltipBtn !== btn) show(); else hide();
        });
    }

    function positionTooltip(btn, layer) {
        const rect = btn.getBoundingClientRect();
        const layerRect = layer.getBoundingClientRect();
        let top = rect.bottom + 8;
        let left = rect.left;
        if (left + layerRect.width > window.innerWidth - 12) {
            left = window.innerWidth - layerRect.width - 12;
        }
        if (top + layerRect.height > window.innerHeight - 12) {
            top = rect.top - layerRect.height - 8;
        }
        layer.style.top = `${Math.max(8, top)}px`;
        layer.style.left = `${Math.max(8, left)}px`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    document.addEventListener('click', () => {
        if (activeTooltipBtn) {
            els.tooltipLayer.hidden = true;
            activeTooltipBtn = null;
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeTooltipBtn) {
            els.tooltipLayer.hidden = true;
            activeTooltipBtn = null;
        }
    });

    // ---------- scroll spy ----------

    let observer = null;
    function setupScrollSpy() {
        if (observer) observer.disconnect();
        const blocks = document.querySelectorAll('.section-block');
        if (!blocks.length) return;
        observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const name = entry.target.id.replace('section-', '');
                    highlightSidebar(name);
                    break;
                }
            }
        }, { rootMargin: '-64px 0px -70% 0px', threshold: 0 });
        blocks.forEach((b) => observer.observe(b));
    }

    function highlightSidebar(sectionName) {
        els.sidebar.querySelectorAll('.sidebar-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.section === sectionName);
        });
    }

    // ---------- events ----------

    function bindEvents() {
        els.searchInput.addEventListener('input', () => {
            state.search = els.searchInput.value.trim();
            renderMain();
        });

        els.langToggle.addEventListener('click', () => {
            state.lang = state.lang === 'en' ? 'uk' : 'en';
            persist();
            render();
        });

        els.loadFileBtn.addEventListener('click', () => els.fileInput.click());
        els.onboardingScratchBtn.addEventListener('click', startFromScratch);
        els.onboardingImportBtn.addEventListener('click', () => els.fileInput.click());
        els.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) loadLuaFile(file);
            els.fileInput.value = '';
        });

        els.exportBtn.addEventListener('click', onExportClick);
        els.exportConfirmBtn.addEventListener('click', () => {
            try { localStorage.setItem(LS_KEYS.exportNoticeSeen, '1'); } catch (e) {}
            els.exportModal.hidden = true;
            doExport();
        });
        els.exportCancelBtn.addEventListener('click', () => { els.exportModal.hidden = true; });
        els.exportModal.addEventListener('click', (e) => {
            if (e.target === els.exportModal) els.exportModal.hidden = true;
        });

        els.syncPullBtn.addEventListener('click', onSyncPullClick);
        els.syncPushBtn.addEventListener('click', onSyncPushClick);
        els.syncConfirmBtn.addEventListener('click', doSyncPush);
        els.syncCancelBtn.addEventListener('click', () => {
            if (syncInFlight) {
                if (syncCancellable && syncAbortController) syncAbortController.abort();
                return;
            }
            closeSyncModal();
        });
        els.syncBgBtn.addEventListener('click', sendSyncToBackground);
        els.syncBgIndicator.addEventListener('click', () => {
            els.syncBgIndicator.hidden = true;
            els.syncModal.hidden = false;
        });
        els.syncBgIndicator.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                els.syncBgIndicator.click();
            }
        });
        els.syncModal.addEventListener('click', (e) => {
            if (e.target !== els.syncModal) return;
            if (syncInFlight) sendSyncToBackground();
            else closeSyncModal();
        });

        els.serverBtn.addEventListener('click', openServerPanel);
        els.serverCloseBtn.addEventListener('click', closeServerPanel);
        els.serverModal.addEventListener('click', (e) => {
            if (e.target === els.serverModal) closeServerPanel();
        });
        els.announceSendBtn.addEventListener('click', onAnnounceSend);
        els.announceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') onAnnounceSend();
        });

        bindDragAndDrop();
    }

    function bindDragAndDrop() {
        let dragCounter = 0;
        const overlay = document.createElement('div');
        overlay.className = 'drop-overlay';
        overlay.hidden = true;
        document.body.appendChild(overlay);

        function updateOverlayText() {
            overlay.textContent = t('drop_here');
        }

        window.addEventListener('dragenter', (e) => {
            if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
            e.preventDefault();
            dragCounter++;
            updateOverlayText();
            overlay.hidden = false;
        });
        window.addEventListener('dragover', (e) => {
            if (!Array.from(e.dataTransfer.types || []).includes('Files')) return;
            e.preventDefault();
        });
        window.addEventListener('dragleave', () => {
            dragCounter = Math.max(0, dragCounter - 1);
            if (dragCounter === 0) overlay.hidden = true;
        });
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            dragCounter = 0;
            overlay.hidden = true;
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) loadLuaFile(file);
        });

        bindDragAndDrop._overlay = overlay;
    }

    function loadLuaFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const result = LuaParser.parseSandboxVars(reader.result);
                if (result.totalParams === 0) throw new Error('No parameters found');
                state.schema = {
                    version: result.version,
                    sections: result.sections,
                };
                state.values = {};
                persistCustomSchema();
                persist();
                showToast(state.lang === 'uk'
                    ? `Завантажено ${result.totalParams} параметрів.`
                    : `Loaded ${result.totalParams} parameters.`);
                hideOnboarding();
                render();
            } catch (err) {
                alert(t('parse_error'));
                console.error(err);
            }
        };
        reader.onerror = () => alert(t('parse_error'));
        reader.readAsText(file);
    }

    function onExportClick() {
        let seen = false;
        try { seen = localStorage.getItem(LS_KEYS.exportNoticeSeen) === '1'; } catch (e) {}
        if (seen) { doExport(); return; }
        els.exportModalBody.textContent = t('export_confirm_body');
        qs('export-modal-title').textContent = t('export_confirm_title');
        els.exportConfirmBtn.textContent = t('confirm');
        els.exportCancelBtn.textContent = t('cancel');
        els.exportModal.hidden = false;
    }

    function doExport() {
        const lua = LuaParser.generateLua(state.schema.sections, state.values, state.schema.version);
        const blob = new Blob([lua], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SandboxVars.lua';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast(state.lang === 'uk' ? 'Файл експортовано.' : 'File exported.');
    }

    function showToast(msg) {
        els.toast.textContent = msg;
        els.toast.hidden = false;
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => { els.toast.hidden = true; }, 2600);
    }

    // ---------- server sync ----------

    // Check login status once at startup (and after returning from an Access
    // login). If logged in, reveal the sync buttons and show who's logged in;
    // otherwise show a "log in" link and keep sync hidden. With no backend at
    // all (static-only deployment), this just fails quietly.
    async function checkAuth() {
        try {
            const resp = await fetch(`${API_BASE}/api/whoami`, { cache: 'no-store' });
            if (!resp.ok) throw new Error('not authenticated');
            const data = await resp.json();
            if (!data.email) throw new Error('not authenticated');
            state.authEmail = data.email;
            els.authStatus.hidden = false;
            renderAuthStatus();
            els.loginLink.hidden = true;
            els.syncPullBtn.hidden = false;
            els.syncPushBtn.hidden = false;
            els.serverBtn.hidden = false;
            checkServerStatus();
        } catch (e) {
            state.authEmail = null;
            els.authStatus.hidden = true;
            els.syncPullBtn.hidden = true;
            els.syncPushBtn.hidden = true;
            els.serverBtn.hidden = true;
            closeServerPanel();
            // Just link straight at the protected endpoint. Cloudflare Access
            // transparently intercepts any request to a path it protects and
            // shows its login challenge before the request ever reaches this
            // app — no need for the special /cdn-cgi/access/login/<domain>
            // redirect endpoint, which doesn't reliably resolve applications
            // scoped to a sub-path (only /api* here, not the whole domain).
            // Once authenticated, our own /api/whoami?return=<here> handling
            // bounces the browser straight back to this page (see index.js).
            const here = location.pathname + location.search;
            els.loginLink.href = `/api/whoami?return=${encodeURIComponent(here)}`;
            els.loginLink.hidden = false;
        }
    }

    // Fetch the server's countdown/dry-run config once logged in, so the push
    // confirm dialog can show the real countdown instead of a guess.
    async function checkServerStatus() {
        try {
            const resp = await fetch(`${API_BASE}/api/status`, { cache: 'no-store' });
            if (!resp.ok) return;
            state.server = await resp.json();
        } catch (e) { /* leave state.server null, dialog falls back to defaults */ }
    }

    // ---------- server status panel (uptime, players, announce) ----------

    let serverPanelPollTimer = null;

    function formatUptime(seconds) {
        if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const parts = [];
        if (d) parts.push(`${d}d`);
        if (d || h) parts.push(`${h}h`);
        parts.push(`${m}m`);
        return parts.join(' ');
    }

    async function refreshServerInfo() {
        try {
            const resp = await fetch(`${API_BASE}/api/server/info`, { cache: 'no-store' });
            if (!resp.ok) throw new Error('unreachable');
            const data = await resp.json();
            els.serverStatusDot.classList.toggle('is-up', Boolean(data.up));
            els.serverStatusDot.classList.toggle('is-down', !data.up);
            const uptime = formatUptime(data.uptimeSeconds);
            const statusWord = data.up ? t('online') : t('offline');
            els.serverStatusText.textContent = uptime ? `${statusWord} · ${t('uptime')}: ${uptime}` : statusWord;
            const names = (data.players && data.players.names) || [];
            els.serverPlayers.textContent = names.length
                ? `${t('players')} (${names.length}): ${names.join(', ')}`
                : t('no_players_online');
        } catch (e) {
            els.serverStatusDot.classList.remove('is-up', 'is-down');
            els.serverStatusText.textContent = t('server_unreachable');
            els.serverPlayers.textContent = '';
        }
    }

    function openServerPanel() {
        els.serverModal.hidden = false;
        refreshServerInfo();
        clearInterval(serverPanelPollTimer);
        serverPanelPollTimer = setInterval(refreshServerInfo, 20000);
    }

    function closeServerPanel() {
        els.serverModal.hidden = true;
        clearInterval(serverPanelPollTimer);
        serverPanelPollTimer = null;
    }

    async function onAnnounceSend() {
        const message = els.announceInput.value.trim();
        if (!message) return;
        els.announceSendBtn.disabled = true;
        try {
            const resp = await fetch(`${API_BASE}/api/server/announce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Announce failed');
            els.announceInput.value = '';
            showToast(t('announce_sent'));
        } catch (err) {
            alert(t('announce_failed') + ': ' + err.message);
        } finally {
            els.announceSendBtn.disabled = false;
        }
    }

    async function onSyncPullClick() {
        els.syncPullBtn.disabled = true;
        try {
            const resp = await fetch(`${API_BASE}/api/sync/pull`, { cache: 'no-store' });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Pull failed');
            const result = LuaParser.parseSandboxVars(data.lua);
            if (result.totalParams === 0) throw new Error('No parameters found');
            state.schema = { version: result.version, sections: result.sections };
            state.values = {};
            persistCustomSchema();
            persist();
            hideOnboarding();
            render();
            showToast(state.lang === 'uk'
                ? `Завантажено з сервера: ${result.totalParams} параметрів.`
                : `Loaded ${result.totalParams} parameters from server.`);
        } catch (err) {
            alert((state.lang === 'uk' ? 'Помилка синхронізації: ' : 'Sync error: ') + err.message);
            console.error(err);
        } finally {
            els.syncPullBtn.disabled = false;
        }
    }

    function onSyncPushClick() {
        if (syncInFlight) {
            // Already streaming (possibly backgrounded) — bring it back to the
            // foreground instead of resetting the confirm screen.
            els.syncBgIndicator.hidden = true;
            els.syncModal.hidden = false;
            return;
        }
        qs('sync-modal-title').textContent = t('sync_to_server');
        const countdown = (state.server && state.server.countdown != null) ? state.server.countdown : 60;
        let body = t('sync_confirm_body').replace('{seconds}', countdown);
        if (state.server && state.server.dryRun) body += ' ' + t('sync_dryrun_note');
        els.syncModalBody.textContent = body;
        els.syncConfirmBtn.hidden = false;
        els.syncConfirmBtn.textContent = t('sync_confirm_btn');
        els.syncConfirmBtn.disabled = false;
        els.syncBgBtn.hidden = true;
        els.syncCancelBtn.textContent = t('cancel');
        els.syncCancelBtn.disabled = false;
        els.syncProgress.hidden = true;
        els.syncProgressBar.style.width = '0%';
        els.syncProgressBar.className = 'sync-progress-bar';
        els.syncLog.hidden = true;
        els.syncLog.innerHTML = '';
        els.syncModal.hidden = false;
    }

    // Hides the modal without touching the in-flight request (if any).
    function closeSyncModal() {
        els.syncModal.hidden = true;
        els.syncBgIndicator.hidden = true;
    }

    // Hides the modal but keeps the push streaming; a floating indicator
    // stays up so the user can reopen it later.
    function sendSyncToBackground() {
        els.syncModal.hidden = true;
        els.syncBgIndicator.hidden = false;
        els.syncBgIndicator.title = t('sync_bg_reopen_hint');
    }

    function updateBgIndicator(text, statusClass) {
        els.syncBgText.textContent = text;
        els.syncBgIndicator.classList.remove('is-done', 'is-error');
        if (statusClass) els.syncBgIndicator.classList.add(statusClass);
    }

    // Cancel is only meaningful (and only enabled) while the server says the
    // step is still `cancellable` — see the comment in server/index.js on the
    // "point of no return" once the stop command has actually been issued.
    function updateCancelButtonState() {
        if (!syncInFlight) return;
        els.syncCancelBtn.disabled = !syncCancellable;
        els.syncCancelBtn.textContent = t(syncCancellable ? 'sync_cancel_running_btn' : 'sync_cancel_locked_btn');
    }

    function setSyncProgress(step, status) {
        const idx = SYNC_STEP_ORDER.indexOf(step);
        if (idx !== -1) {
            els.syncProgressBar.style.width = Math.round(((idx + 1) / SYNC_STEP_ORDER.length) * 100) + '%';
        }
        els.syncProgressBar.classList.remove('is-error', 'is-done', 'is-cancelled');
        if (status === 'error') els.syncProgressBar.classList.add('is-error');
        else if (step === 'done') els.syncProgressBar.classList.add('is-done');
        else if (step === 'cancelled') els.syncProgressBar.classList.add('is-cancelled');
    }

    function appendSyncLog(status, message) {
        const line = document.createElement('div');
        line.className = 'sync-log-line ' + (status || '');
        line.textContent = message;
        els.syncLog.appendChild(line);
        els.syncLog.scrollTop = els.syncLog.scrollHeight;
    }

    // Stream the push and render the NDJSON step log live.
    async function doSyncPush() {
        syncInFlight = true;
        syncCancellable = true;
        els.syncConfirmBtn.hidden = true;
        els.syncBgBtn.hidden = false;
        els.syncBgBtn.disabled = false;
        updateCancelButtonState();
        els.syncProgress.hidden = false;
        els.syncProgressBar.style.width = '0%';
        els.syncProgressBar.className = 'sync-progress-bar';
        els.syncLog.hidden = false;
        els.syncLog.innerHTML = '';
        appendSyncLog('running', t('sync_starting'));
        updateBgIndicator(t('sync_bg_running'));

        const lua = LuaParser.generateLua(state.schema.sections, state.values, state.schema.version);
        let ok = true;
        let cancelled = false;
        const controller = new AbortController();
        syncAbortController = controller;
        try {
            const resp = await fetch(`${API_BASE}/api/sync/push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lua }),
                signal: controller.signal,
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.error || `Server returned ${resp.status}`);
            }
            els.syncLog.innerHTML = '';
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let nl;
                while ((nl = buf.indexOf('\n')) >= 0) {
                    const line = buf.slice(0, nl).trim();
                    buf = buf.slice(nl + 1);
                    if (!line) continue;
                    try {
                        const evt = JSON.parse(line);
                        if (evt.status === 'error') ok = false;
                        appendSyncLog(evt.status, evt.message);
                        setSyncProgress(evt.step, evt.status);
                        syncCancellable = evt.cancellable !== false;
                        updateCancelButtonState();
                        updateBgIndicator(evt.message);
                    } catch (e) { /* ignore malformed line */ }
                }
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                cancelled = true;
                ok = false;
                appendSyncLog('warn', t('sync_cancelled_log'));
                setSyncProgress('cancelled', 'warn');
            } else {
                ok = false;
                appendSyncLog('error', err.message);
                setSyncProgress('error', 'error');
            }
        } finally {
            syncInFlight = false;
            syncAbortController = null;
            els.syncConfirmBtn.hidden = false;
            els.syncConfirmBtn.disabled = false;
            els.syncBgBtn.hidden = true;
            els.syncCancelBtn.disabled = false;
            els.syncCancelBtn.textContent = t('close');
            if (els.syncModal.hidden) {
                // Still backgrounded — leave the indicator up showing the final
                // state; the user reopens it (or dismisses it) on their own time.
                updateBgIndicator(
                    cancelled ? t('sync_cancelled_toast') : (ok ? t('sync_done') : t('sync_failed')),
                    cancelled ? null : (ok ? 'is-done' : 'is-error')
                );
            } else {
                els.syncBgIndicator.hidden = true;
            }
        }
        showToast(cancelled ? t('sync_cancelled_toast') : (ok ? t('sync_done') : t('sync_failed')));
    }

    // ---------- init ----------

    async function init() {
        cacheEls();

        let needsOnboarding = false;
        try {
            needsOnboarding = localStorage.getItem(LS_KEYS.values) === null
                && localStorage.getItem(LS_KEYS.customSchema) === null;
        } catch (e) { needsOnboarding = false; }

        loadPersisted();

        const [schemaResp, translationsResp] = await Promise.all([
            fetch('config-schema.json'),
            fetch('translations.json'),
        ]);
        const defaultSchema = await schemaResp.json();
        state.translations = await translationsResp.json();

        if (!state.schema) state.schema = defaultSchema;

        bindEvents();
        render();
        if (needsOnboarding) showOnboarding();
        checkAuth();
    }

    init();
})();
