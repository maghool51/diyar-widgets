/**
 * main.js — نقطه‌ی ورود برنامه. داده‌ها را می‌خواند، رابط را می‌سازد و
 * رویدادها را وصل می‌کند. هیچ داده‌ی مناسبت/طرح/متنی در این فایل
 * هارد-کد نشده — همه از data/*.json خوانده می‌شود.
 */
(function () {
  'use strict';

  const U = window.DiyarCardUtils;
  const R = window.DiyarCardRender;

  /* ============================ تم روشن/تیره ============================ */
  function initTheme() {
    const stored = localStorage.getItem('dq-theme');
    const theme = stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(theme);
    U.$('themeToggle').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('dq-theme', next);
    });
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    U.setText(U.$('themeIcon'), theme === 'dark' ? '☀️' : '🌙');
  }

  /* ============================ راه‌اندازی ============================ */
  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();

    let data;
    try {
      data = await window.DiyarCardData.loadAllData('data/');
    } catch (err) {
      showFatalError();
      return;
    }

    try {
      // نگاشت مسطح id → تمپلیت (برای دسترسی سریع از حالت Viewer یا هر جای دیگر)
      // «_comment» در templates.json یک رشته‌ی مستندسازی است، نه یک گروه
      // Template؛ باید هنگام پیمایش گروه‌ها نادیده گرفته شود.
      const templatesById = {};
      Object.keys(data.templates).forEach((group) => {
        if (!Array.isArray(data.templates[group])) return;
        data.templates[group].forEach((tpl) => { templatesById[tpl.id] = Object.assign({ group }, tpl); });
      });

      const sharedState = window.DiyarCardUrl.readStateFromUrl();
      if (sharedState && sharedState.templateId && templatesById[sharedState.templateId]) {
        initViewer(sharedState, templatesById);
      } else {
        initBuilder(data, templatesById);
      }
    } catch (err) {
      showFatalError();
    }
  });

  function showFatalError() {
    const grid = U.$('categoryGrid');
    if (grid) {
      grid.textContent = '';
      const p = document.createElement('p');
      p.textContent = 'مشکلی در بارگذاری اطلاعات کارت‌پستال پیش آمد. لطفاً صفحه را دوباره بارگذاری کنید.';
      grid.appendChild(p);
    }
  }

  /* ============================ حالت مشاهده (لینک اشتراک‌گذاری‌شده) ============================ */
  function initViewer(state, templatesById) {
    U.$('dqBuilder').hidden = true;
    const viewer = U.$('dqViewer');
    viewer.hidden = false;

    const tpl = templatesById[state.templateId];
    const cardEl = R.buildCardSkeleton(U.$('viewerPreview'));
    R.updateCard(cardEl, {
      layout: tpl.layout, palette: tpl.palette, icon: tpl.icon,
      to: state.to, title: state.title, message: state.message, from: state.from
    });

    const shareUrl = location.href;
    U.$('viewerCopyLink').addEventListener('click', async () => {
      const res = await window.DiyarCardShare.copyToClipboard(shareUrl);
      toast(res.ok ? 'لینک کپی شد ✅' : 'کپی لینک ممکن نشد');
    });
    U.$('viewerShare').addEventListener('click', async () => {
      await window.DiyarCardShare.shareUrl(shareUrl, 'کارت‌پستال دیجیتال دیار قدمگاه');
    });
    U.$('viewerSavePng').addEventListener('click', async () => {
      const res = await window.DiyarCardExport.exportCardAsPng(cardEl, 'diyar-postcard.png');
      toast(res.ok ? 'کارت ذخیره شد 🖼️' : 'ذخیره کارت ممکن نشد');
    });
  }

  /* ============================ حالت ساخت کارت (Wizard) ============================ */
  function initBuilder(data, templatesById) {
    const store = window.DiyarCardState.createStore();
    let currentTemplateGroup = null;
    let currentTemplateList = [];

    /* ---------- ناوبری بین پنل‌ها (با تاریخچه‌ی واقعی برای دکمه‌ی بازگشت) ---------- */
    const stepOrder = { category: 0, occasion: 0, template: 1, form: 2, share: 3 };
    let panelStack = [];
    let currentPanel = null;
    function showPanel(name, opts) {
      opts = opts || {};
      if (currentPanel && currentPanel !== name && !opts.isBack) panelStack.push(currentPanel);
      currentPanel = name;
      U.qsa('.dq-panel').forEach((p) => p.setAttribute('data-active', String(p.dataset.panel === name)));
      const idx = stepOrder[name];
      U.qsa('#dqSteps li').forEach((li, i) => {
        li.setAttribute('data-active', String(i === idx));
        li.setAttribute('data-done', String(i < idx));
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function goBack() {
      showPanel(panelStack.pop() || 'category', { isBack: true });
    }
    U.qsa('[data-back]').forEach((btn) => btn.addEventListener('click', goBack));

    /* ---------- گام ۱: دسته‌ها ---------- */
    R.renderChoiceGrid(U.$('categoryGrid'), data.categories.categories, {
      isSelected: (item) => store.get().categoryId === item.id,
      onSelect: onCategorySelect
    });

    function onCategorySelect(category) {
      store.set({ categoryId: category.id, occasionId: null, occasionLabel: category.title });

      if (category.hasSubcategories) {
        U.setText(U.$('occasionTitle'), 'دسته‌ی مذهبی را انتخاب کنید');
        R.renderOccasionList(U.$('occasionList'), data.categories.religiousSubcategories, {
          onSelect: onReligiousSubcategorySelect
        });
        showPanel('occasion');
        return;
      }

      if (category.hasOccasions) {
        U.setText(U.$('occasionTitle'), 'مناسبت را انتخاب کنید');
        R.renderOccasionList(U.$('occasionList'), data.occasions[category.id] || [], {
          onSelect: (occ) => onOccasionSelect(occ, category.templateGroup)
        });
        showPanel('occasion');
        return;
      }

      goToTemplateStep(category.templateGroup, category.title);
    }

    function onReligiousSubcategorySelect(sub) {
      store.set({ occasionLabel: sub.title });
      U.setText(U.$('occasionTitle'), sub.title + ' را انتخاب کنید');
      R.renderOccasionList(U.$('occasionList'), data.occasions[sub.id] || [], {
        onSelect: (occ) => onOccasionSelect(occ, sub.templateGroup)
      });
    }

    function onOccasionSelect(occasion, templateGroup) {
      store.set({ occasionId: occasion.id, occasionLabel: occasion.title });
      goToTemplateStep(templateGroup, occasion.title);
    }

    /* ---------- گام ۲: طرح‌ها ---------- */
    function goToTemplateStep(templateGroup, label) {
      currentTemplateGroup = templateGroup;
      currentTemplateList = data.templates[templateGroup] || [];
      U.setText(U.qs('#panelTemplate .dq-panel__title'), 'طرح کارت را برای «' + label + '» انتخاب کنید');
      R.renderTemplateGrid(U.$('templateGrid'), currentTemplateList, {}, {
        isSelected: (t) => store.get().templateId === t.id,
        onSelect: onTemplateSelect
      });
      showPanel('template');
    }

    function onTemplateSelect(tpl) {
      store.set({ templateId: tpl.id });

      const messages = data.messages[currentTemplateGroup] || [];
      R.renderMessageChips(U.$('messageChips'), messages, {
        onSelect: (m) => {
          U.$('fieldMessage').value = m.text;
          store.set({ message: m.text });
          updateFormPreview();
        }
      });

      buildPreviewCard('formPreview', tpl);
      updateFormPreview();
      showPanel('form');
    }

    /* ---------- گام ۳: فرم + Live Preview ---------- */
    let formCardEl = null;
    function buildPreviewCard(containerId, tpl) {
      formCardEl = R.buildCardSkeleton(U.$(containerId));
      formCardEl.setAttribute('data-layout', tpl.layout);
      formCardEl.setAttribute('data-palette', tpl.palette);
    }

    function updateFormPreview() {
      const tpl = templatesById[store.get().templateId];
      if (!tpl || !formCardEl) return;
      R.updateCard(formCardEl, Object.assign({}, store.get(), {
        layout: tpl.layout, palette: tpl.palette, icon: tpl.icon
      }));
    }

    function syncFieldsToStore() {
      store.set({
        to: U.sanitizeText(U.$('fieldTo').value, window.DiyarCardUrl.MAX_NAME),
        title: U.sanitizeText(U.$('fieldTitle').value, window.DiyarCardUrl.MAX_TITLE),
        message: U.sanitizeText(U.$('fieldMessage').value, window.DiyarCardUrl.MAX_MESSAGE),
        from: U.sanitizeText(U.$('fieldFrom').value, window.DiyarCardUrl.MAX_NAME)
      });
      updateFormPreview();
    }
    const liveUpdate = U.debounce(syncFieldsToStore, 120);
    ['fieldTo', 'fieldTitle', 'fieldMessage', 'fieldFrom'].forEach((id) => {
      U.$(id).addEventListener('input', liveUpdate);
    });

    U.$('cardForm').addEventListener('submit', (e) => {
      e.preventDefault();
      syncFieldsToStore(); // Sync فوری (نه نسخه‌ی Debounced) تا آخرین مقدار فیلدها از دست نرود
      const tpl = templatesById[store.get().templateId];
      const shareCardEl = R.buildCardSkeleton(U.$('sharePreview'));
      R.updateCard(shareCardEl, Object.assign({}, store.get(), {
        layout: tpl.layout, palette: tpl.palette, icon: tpl.icon
      }));
      wireShareActions(shareCardEl);
      showPanel('share');
    });

    /* ---------- گام ۴: اشتراک‌گذاری ---------- */
    function wireShareActions(cardEl) {
      const shareUrl = window.DiyarCardUrl.buildShareUrl(store.get());

      U.$('btnCopyLink').onclick = async () => {
        const res = await window.DiyarCardShare.copyToClipboard(shareUrl);
        toast(res.ok ? 'لینک کپی شد ✅' : 'کپی لینک ممکن نشد');
      };
      U.$('btnShare').onclick = async () => {
        await window.DiyarCardShare.shareUrl(shareUrl, 'کارت‌پستال دیجیتال دیار قدمگاه');
      };
      U.$('btnSavePng').onclick = async () => {
        const res = await window.DiyarCardExport.exportCardAsPng(cardEl, 'diyar-postcard.png');
        toast(res.ok ? 'کارت ذخیره شد 🖼️' : 'ذخیره کارت ممکن نشد');
      };
    }

    U.$('btnNewCard').addEventListener('click', () => {
      store.set({
        categoryId: null, occasionId: null, templateId: null,
        to: '', title: '', message: '', from: ''
      });
      U.$('cardForm').reset();
      panelStack = [];
      currentPanel = null;
      showPanel('category');
    });

    showPanel('category');
  }

  function toast(message) {
    U.showToast(U.$('dqToast'), message);
  }
})();
