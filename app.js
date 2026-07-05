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

    // Server admin panel state (players/options/world/logs tabs)
    let serverActiveTab = 'status';
    let serverLatestPlayers = [];      // names, refreshed by refreshServerInfo()
    let serverOptionsData = null;      // [{key, value, type}] from last /api/server/options fetch
    let serverOptionsLoading = false;
    let serverLogController = null;    // AbortController for the active logs stream fetch
    let pendingPlayerAction = null;    // fn to run if the player-action confirm modal is accepted

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
        els.serverTabBtns = Array.from(document.querySelectorAll('.server-tab-btn'));
        els.serverTabPanels = Array.from(document.querySelectorAll('.server-tab-panel'));
        els.serverPlayersList = qs('server-players-list');
        els.serverOptionsList = qs('server-options-list');
        els.serverWorldList = qs('server-world-list');
        els.serverLogView = qs('server-log-view');
        els.serverLogFileSelect = qs('server-log-file-select');
        els.playerActionModal = qs('player-action-modal');
        els.playerActionModalTitle = qs('player-action-modal-title');
        els.playerActionModalBody = qs('player-action-modal-body');
        els.playerActionConfirmBtn = qs('player-action-confirm-btn');
        els.playerActionCancelBtn = qs('player-action-cancel-btn');
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

    function getServerOptionTranslation(key) {
        return (state.translations.serverOptions && state.translations.serverOptions[key]) || null;
    }

    function getServerOptionLabel(key) {
        const tr = getServerOptionTranslation(key);
        if (tr && tr.label) return tr.label[state.lang] || tr.label.en;
        return humanizeKey(key);
    }

    function getServerOptionDescription(key) {
        const tr = getServerOptionTranslation(key);
        if (tr && tr.description) {
            const d = tr.description[state.lang] || tr.description.en;
            if (d) return d;
        }
        return state.lang === 'uk' ? 'Опис відсутній.' : 'No description available.';
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
        els.serverModalTitle.textContent = t('server_panel_title');
        els.announceInput.placeholder = t('announce_placeholder');
        els.announceSendBtn.textContent = t('announce_send');
        els.serverCloseBtn.textContent = t('close');
        for (const btn of els.serverTabBtns) {
            btn.textContent = t('server_tab_' + btn.dataset.tab);
        }
        els.playerActionModalTitle.textContent = t('player_action_modal_title');
        els.playerActionCancelBtn.textContent = t('cancel');
        els.playerActionConfirmBtn.textContent = t('confirm_btn');
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
        attachTooltipHtml(btn, () => {
            const typeLabel = t('type_' + param.type);
            let html = `<strong>${escapeHtml(getParamLabel(param))}</strong><br>${escapeHtml(getParamDescription(param))}`;
            html += `<br><span style="color:var(--text-faint)">${escapeHtml(typeLabel)}</span>`;
            return html;
        });
    }

    // Same tooltip behavior as attachTooltip, but for ServerOptions entries
    // ({key, value, type} from /api/server/options), which aren't part of the
    // SandboxVars param schema and so use their own label/description lookup.
    function attachOptionTooltip(btn, opt) {
        attachTooltipHtml(btn, () => {
            const typeLabel = t('type_' + (opt.type === 'number' ? 'float' : opt.type));
            let html = `<strong>${escapeHtml(getServerOptionLabel(opt.key))}</strong><br>${escapeHtml(getServerOptionDescription(opt.key))}`;
            html += `<br><span style="color:var(--text-faint)">${escapeHtml(typeLabel)}</span>`;
            return html;
        });
    }

    function attachTooltipHtml(btn, buildHtml) {
        function show() {
            activeTooltipBtn = btn;
            const layer = els.tooltipLayer;
            layer.innerHTML = buildHtml();
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

        for (const btn of els.serverTabBtns) {
            btn.addEventListener('click', () => switchServerTab(btn.dataset.tab));
        }
        els.serverLogFileSelect.addEventListener('change', () => {
            startLogStream(els.serverLogFileSelect.value);
        });
        els.playerActionCancelBtn.addEventListener('click', closePlayerActionConfirm);
        els.playerActionModal.addEventListener('click', (e) => {
            if (e.target === els.playerActionModal) closePlayerActionConfirm();
        });
        els.playerActionConfirmBtn.addEventListener('click', async () => {
            const fn = pendingPlayerAction;
            closePlayerActionConfirm();
            if (fn) await fn();
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
            serverLatestPlayers = names;
        } catch (e) {
            els.serverStatusDot.classList.remove('is-up', 'is-down');
            els.serverStatusText.textContent = t('server_unreachable');
            els.serverPlayers.textContent = '';
            serverLatestPlayers = [];
        }
    }

    function openServerPanel() {
        els.serverModal.hidden = false;
        switchServerTab('status');
        refreshServerInfo();
        clearInterval(serverPanelPollTimer);
        serverPanelPollTimer = setInterval(async () => {
            await refreshServerInfo();
            if (serverActiveTab === 'players') renderPlayersTab();
            else if (serverActiveTab === 'world') renderWorldTab();
        }, 20000);
    }

    function closeServerPanel() {
        els.serverModal.hidden = true;
        clearInterval(serverPanelPollTimer);
        serverPanelPollTimer = null;
        stopLogStream();
    }

    // ---------- server panel tabs ----------

    async function switchServerTab(tab) {
        serverActiveTab = tab;
        for (const btn of els.serverTabBtns) btn.classList.toggle('active', btn.dataset.tab === tab);
        for (const panel of els.serverTabPanels) panel.hidden = panel.dataset.tabPanel !== tab;
        // Only the Logs tab keeps a stream open; leaving it (or any tab
        // switch) tears the SSH tail -F down via the abort -> res.on('close').
        stopLogStream();
        if (tab === 'players') {
            await refreshServerInfo();
            renderPlayersTab();
        } else if (tab === 'world') {
            await refreshServerInfo();
            renderWorldTab();
        } else if (tab === 'options') {
            loadServerOptions();
        } else if (tab === 'logs') {
            openLogsTab();
        }
    }

    // ---------- players tab (kick/ban/whitelist/access level + grants) ----------

    const ACCESS_LEVELS = ['none', 'observer', 'gm', 'overseer', 'moderator', 'admin'];
    const GRANT_KINDS = ['item', 'xp', 'teleport', 'godmodeOn', 'godmodeOff'];

    function renderPlayersTab() {
        const list = els.serverPlayersList;
        list.innerHTML = '';
        if (!serverLatestPlayers.length) {
            const empty = document.createElement('div');
            empty.className = 'server-empty-note';
            empty.textContent = t('no_players_online');
            list.appendChild(empty);
            return;
        }
        for (const name of serverLatestPlayers) {
            list.appendChild(buildPlayerRow(name));
        }
    }

    function buildPlayerRow(name) {
        const wrap = document.createElement('div');
        wrap.className = 'server-player-row-wrap';
        wrap.appendChild(buildPlayerAdminRow(name));
        wrap.appendChild(buildPlayerGrantRow(name));
        return wrap;
    }

    function buildPlayerAdminRow(name) {
        const row = document.createElement('div');
        row.className = 'server-player-row';

        const label = document.createElement('span');
        label.className = 'server-player-name';
        label.textContent = name;
        row.appendChild(label);

        const actions = document.createElement('div');
        actions.className = 'server-player-actions';

        const kickBtn = document.createElement('button');
        kickBtn.type = 'button';
        kickBtn.className = 'btn';
        kickBtn.textContent = t('player_kick');
        kickBtn.addEventListener('click', () => confirmPlayerAction(
            t('player_kick_confirm').replace('{name}', name),
            () => runPlayerAction(name, 'kick')
        ));
        actions.appendChild(kickBtn);

        const banBtn = document.createElement('button');
        banBtn.type = 'button';
        banBtn.className = 'btn';
        banBtn.textContent = t('player_ban');
        banBtn.addEventListener('click', () => confirmPlayerAction(
            t('player_ban_confirm').replace('{name}', name),
            () => runPlayerAction(name, 'ban')
        ));
        actions.appendChild(banBtn);

        const unbanBtn = document.createElement('button');
        unbanBtn.type = 'button';
        unbanBtn.className = 'btn';
        unbanBtn.textContent = t('player_unban');
        unbanBtn.addEventListener('click', () => runPlayerAction(name, 'unban'));
        actions.appendChild(unbanBtn);

        const wlAddBtn = document.createElement('button');
        wlAddBtn.type = 'button';
        wlAddBtn.className = 'btn';
        wlAddBtn.textContent = t('player_whitelist_add');
        wlAddBtn.addEventListener('click', () => runPlayerAction(name, 'whitelistAdd'));
        actions.appendChild(wlAddBtn);

        const wlRemoveBtn = document.createElement('button');
        wlRemoveBtn.type = 'button';
        wlRemoveBtn.className = 'btn';
        wlRemoveBtn.textContent = t('player_whitelist_remove');
        wlRemoveBtn.addEventListener('click', () => runPlayerAction(name, 'whitelistRemove'));
        actions.appendChild(wlRemoveBtn);

        const levelSelect = document.createElement('select');
        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        placeholderOpt.textContent = t('player_set_access_level');
        levelSelect.appendChild(placeholderOpt);
        for (const lvl of ACCESS_LEVELS) {
            const opt = document.createElement('option');
            opt.value = lvl;
            opt.textContent = t('access_level_' + lvl);
            levelSelect.appendChild(opt);
        }
        levelSelect.addEventListener('change', () => {
            const level = levelSelect.value;
            levelSelect.value = '';
            if (!level) return;
            confirmPlayerAction(
                t('player_access_confirm').replace('{name}', name).replace('{level}', t('access_level_' + level)),
                () => runPlayerAction(name, 'setAccessLevel', { level })
            );
        });
        actions.appendChild(levelSelect);

        row.appendChild(actions);
        return row;
    }

    // Compact per-player "grant" form: one row covers give item / add xp /
    // teleport-to / godmode on-off, switching which inputs show based on kind.
    function buildPlayerGrantRow(name) {
        const row = document.createElement('div');
        row.className = 'server-player-grant-row';

        const kindSelect = document.createElement('select');
        for (const k of GRANT_KINDS) {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = t('grant_' + k);
            kindSelect.appendChild(opt);
        }
        row.appendChild(kindSelect);

        const input1 = document.createElement('input');
        input1.type = 'text';
        row.appendChild(input1);

        const input2 = document.createElement('input');
        input2.type = 'number';
        input2.min = '1';
        row.appendChild(input2);

        const teleportSelect = document.createElement('select');
        row.appendChild(teleportSelect);

        function refreshVisibility() {
            const kind = kindSelect.value;
            input1.hidden = kind === 'godmodeOn' || kind === 'godmodeOff' || kind === 'teleport';
            input2.hidden = kind !== 'item' && kind !== 'xp';
            teleportSelect.hidden = kind !== 'teleport';
            input1.placeholder = kind === 'item' ? t('grant_item_placeholder')
                : kind === 'xp' ? t('grant_perk_placeholder') : '';
            input2.placeholder = kind === 'item' ? t('grant_count_placeholder')
                : kind === 'xp' ? t('grant_amount_placeholder') : '';
            if (kind === 'teleport') {
                teleportSelect.innerHTML = '';
                for (const other of serverLatestPlayers) {
                    if (other === name) continue;
                    const opt = document.createElement('option');
                    opt.value = other;
                    opt.textContent = other;
                    teleportSelect.appendChild(opt);
                }
            }
        }
        kindSelect.addEventListener('change', refreshVisibility);
        refreshVisibility();

        const goBtn = document.createElement('button');
        goBtn.type = 'button';
        goBtn.className = 'btn';
        goBtn.textContent = t('grant_go');
        goBtn.addEventListener('click', async () => {
            const kind = kindSelect.value;
            let body = { name };
            if (kind === 'item') body = { ...body, kind: 'item', item: input1.value.trim(), count: input2.value || 1 };
            else if (kind === 'xp') body = { ...body, kind: 'xp', perk: input1.value.trim(), amount: input2.value || 0 };
            else if (kind === 'teleport') body = { ...body, kind: 'teleport', toName: teleportSelect.value };
            else if (kind === 'godmodeOn') body = { ...body, kind: 'godmode', on: true };
            else if (kind === 'godmodeOff') body = { ...body, kind: 'godmode', on: false };
            goBtn.disabled = true;
            try {
                const resp = await fetch(`${API_BASE}/api/server/player/grant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Grant failed');
                showToast(data.dryRun ? data.message : t('grant_done'));
            } catch (err) {
                alert(t('grant_failed') + ': ' + err.message);
            } finally {
                goBtn.disabled = false;
            }
        });
        row.appendChild(goBtn);

        return row;
    }

    function confirmPlayerAction(bodyText, onConfirm) {
        els.playerActionModalBody.textContent = bodyText;
        pendingPlayerAction = onConfirm;
        els.playerActionModal.hidden = false;
    }

    function closePlayerActionConfirm() {
        els.playerActionModal.hidden = true;
        pendingPlayerAction = null;
    }

    async function runPlayerAction(name, action, opts = {}) {
        try {
            const resp = await fetch(`${API_BASE}/api/server/player/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, action, ...opts }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Action failed');
            showToast(data.dryRun ? data.message : t('player_action_done'));
            await refreshServerInfo();
            if (serverActiveTab === 'players') renderPlayersTab();
        } catch (err) {
            alert(t('player_action_failed') + ': ' + err.message);
        }
    }

    // ---------- options tab (ServerOptions — live, no restart) ----------

    // Visually mirrors the SandboxVars param-card controls (same CSS classes)
    // but is deliberately a separate small renderer, not renderParamCard/
    // buildControl themselves — those are wired to state.schema/state.values/
    // persist()/isModified() for the SandboxVars editor's own bookkeeping, and
    // ServerOptions have nothing to do with that (different values, no
    // SandboxVars "default" to compare against, must never touch state.values
    // or localStorage persistence). Reusing the visual language without
    // reusing the stateful function avoids corrupting the SandboxVars editor.
    async function loadServerOptions() {
        if (serverOptionsLoading) return;
        serverOptionsLoading = true;
        els.serverOptionsList.innerHTML = '';
        const loading = document.createElement('div');
        loading.className = 'server-empty-note';
        loading.textContent = t('loading');
        els.serverOptionsList.appendChild(loading);
        try {
            const resp = await fetch(`${API_BASE}/api/server/options`, { cache: 'no-store' });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to load options');
            serverOptionsData = data.options || [];
            renderServerOptions();
        } catch (err) {
            els.serverOptionsList.innerHTML = '';
            const note = document.createElement('div');
            note.className = 'server-empty-note';
            note.textContent = t('server_options_failed') + ': ' + err.message;
            els.serverOptionsList.appendChild(note);
        } finally {
            serverOptionsLoading = false;
        }
    }

    function renderServerOptions() {
        els.serverOptionsList.innerHTML = '';
        if (!serverOptionsData || !serverOptionsData.length) {
            const note = document.createElement('div');
            note.className = 'server-empty-note';
            note.textContent = t('server_options_empty');
            els.serverOptionsList.appendChild(note);
            return;
        }
        for (const opt of serverOptionsData) {
            els.serverOptionsList.appendChild(buildOptionCard(opt));
        }
    }

    function buildOptionCard(opt) {
        const card = document.createElement('div');
        card.className = 'param-card';

        const header = document.createElement('div');
        header.className = 'param-header';
        const label = document.createElement('span');
        label.className = 'param-label';
        label.textContent = getServerOptionLabel(opt.key);
        header.appendChild(label);

        const helpBtn = document.createElement('button');
        helpBtn.type = 'button';
        helpBtn.className = 'help-btn';
        helpBtn.textContent = '?';
        helpBtn.setAttribute('aria-label', getServerOptionLabel(opt.key) + ' – ' + t('close'));
        attachOptionTooltip(helpBtn, opt);
        header.appendChild(helpBtn);

        card.appendChild(header);

        const keyLine = document.createElement('div');
        keyLine.className = 'param-key';
        keyLine.textContent = opt.key;
        card.appendChild(keyLine);

        const controlRow = document.createElement('div');
        controlRow.className = 'param-control-row';

        if (opt.type === 'boolean') {
            const wrap = document.createElement('label');
            wrap.className = 'toggle-switch';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!opt.value;
            input.addEventListener('change', () => submitOptionChange(opt, input.checked));
            const track = document.createElement('span');
            track.className = 'toggle-track';
            const thumb = document.createElement('span');
            thumb.className = 'toggle-thumb';
            wrap.appendChild(input);
            wrap.appendChild(track);
            wrap.appendChild(thumb);
            controlRow.appendChild(wrap);

            const stateLabel = document.createElement('span');
            stateLabel.className = 'toggle-state-label';
            stateLabel.textContent = opt.value ? t('toggle_on') : t('toggle_off');
            controlRow.appendChild(stateLabel);
        } else if (opt.type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = String(opt.value);
            input.addEventListener('change', () => submitOptionChange(opt, parseFloat(input.value)));
            controlRow.appendChild(input);
        } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.value = String(opt.value);
            input.addEventListener('change', () => submitOptionChange(opt, input.value));
            controlRow.appendChild(input);
        }

        card.appendChild(controlRow);
        return card;
    }

    async function submitOptionChange(opt, newValue) {
        try {
            const resp = await fetch(`${API_BASE}/api/server/options`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: opt.key, value: newValue }),
            });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to set option');
            opt.value = newValue;
            showToast(data.dryRun ? data.message : t('server_option_saved'));
        } catch (err) {
            alert(t('server_option_failed') + ': ' + err.message);
            renderServerOptions(); // revert the control to the last-known-good value
        }
    }

    // ---------- world tab (event "toys", dispatched via the server's fixed allow-map) ----------

    const WORLD_ACTIONS = [
        { action: 'chopper' },
        { action: 'gunshot' },
        { action: 'startrain' },
        { action: 'stoprain' },
        { action: 'startstorm' },
        { action: 'stopweather' },
        { action: 'alarm' },
        { action: 'thunder', needsTarget: true },
        { action: 'lightning', needsTarget: true },
        { action: 'createhorde', needsCount: true, optionalTarget: true },
    ];

    function renderWorldTab() {
        const list = els.serverWorldList;
        list.innerHTML = '';
        for (const spec of WORLD_ACTIONS) {
            list.appendChild(buildWorldRow(spec));
        }
    }

    function buildWorldRow(spec) {
        const row = document.createElement('div');
        row.className = 'server-world-row';

        const label = document.createElement('span');
        label.className = 'server-world-label';
        label.textContent = t('world_' + spec.action);
        row.appendChild(label);

        let targetSelect = null;
        if (spec.needsTarget || spec.optionalTarget) {
            targetSelect = document.createElement('select');
            if (spec.optionalTarget) {
                const noneOpt = document.createElement('option');
                noneOpt.value = '';
                noneOpt.textContent = t('world_no_target');
                targetSelect.appendChild(noneOpt);
            }
            for (const name of serverLatestPlayers) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                targetSelect.appendChild(opt);
            }
            row.appendChild(targetSelect);
        }

        let countInput = null;
        if (spec.needsCount) {
            countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.min = '1';
            countInput.value = '4';
            row.appendChild(countInput);
        }

        const runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'btn btn-primary';
        runBtn.textContent = t('world_run');
        runBtn.addEventListener('click', async () => {
            const target = targetSelect ? targetSelect.value : undefined;
            const count = countInput ? countInput.value : undefined;
            if (spec.needsTarget && !target) { alert(t('world_target_required')); return; }
            runBtn.disabled = true;
            try {
                const resp = await fetch(`${API_BASE}/api/server/world`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: spec.action, target: target || undefined, count: count || undefined }),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'World action failed');
                showToast(data.dryRun ? data.message : t('world_action_done'));
            } catch (err) {
                alert(t('world_action_failed') + ': ' + err.message);
            } finally {
                runBtn.disabled = false;
            }
        });
        row.appendChild(runBtn);

        return row;
    }

    // ---------- logs tab (file picker + live tail over SSH, streamed as NDJSON) ----------

    // Fetch the list of log files in PZ_LOGS_DIR, populate the dropdown, and
    // start tailing whichever one is selected (previous selection if it's
    // still in the list, otherwise the newest file).
    async function openLogsTab() {
        const select = els.serverLogFileSelect;
        const prevValue = select.value;
        select.innerHTML = '';
        try {
            const resp = await fetch(`${API_BASE}/api/server/logs/files`);
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) throw new Error(data.error || `Server returned ${resp.status}`);
            const files = Array.isArray(data.files) ? data.files : [];
            if (!files.length) {
                els.serverLogView.textContent = `[${t('logs_no_files')}]`;
                return;
            }
            for (const file of files) {
                const opt = document.createElement('option');
                opt.value = file;
                opt.textContent = file;
                select.appendChild(opt);
            }
            select.value = files.includes(prevValue) ? prevValue : files[0];
            startLogStream(select.value);
        } catch (err) {
            els.serverLogView.textContent = `[${t('logs_stream_error')}: ${err.message}]`;
        }
    }

    async function startLogStream(filename) {
        els.serverLogView.textContent = '';
        const controller = new AbortController();
        serverLogController = controller;
        try {
            const url = `${API_BASE}/api/server/logs/stream?file=${encodeURIComponent(filename)}`;
            const resp = await fetch(url, { signal: controller.signal });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.error || `Server returned ${resp.status}`);
            }
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
                        if (evt.error) appendLogChunk(`\n[${evt.error}]\n`);
                        else appendLogChunk(evt.line);
                    } catch (e) { /* ignore malformed line */ }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                appendLogChunk(`\n[${t('logs_stream_error')}: ${err.message}]\n`);
            }
        }
    }

    function appendLogChunk(text) {
        els.serverLogView.textContent += text;
        els.serverLogView.scrollTop = els.serverLogView.scrollHeight;
    }

    // Aborting the fetch tears down the SSH `tail -F` + connection server-side
    // via its res.on('close') handler (see /api/server/logs/stream).
    function stopLogStream() {
        if (serverLogController) {
            serverLogController.abort();
            serverLogController = null;
        }
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
