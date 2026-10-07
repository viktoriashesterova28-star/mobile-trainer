// ============================================================================
// Логика мобильного тренажера по дарк-паттернам
// ============================================================================

(function () {
  "use strict";

  var app = document.getElementById("app");

  var state = {
    index: 0,
    answers: [],
    currentSelected: -1,
    survey: null,
  };

  // --- утилиты -------------------------------------------------------------------

  // Неразрывные пробелы после коротких предлогов/союзов, чтобы не оставлять их
  // одних в конце строки (правило русской типографики).
  function nbspJoin(text) {
    var s = String(text);
    // короткие предлоги/союзы не оставляем в конце строки
    s = s.replace(/(\s)(в|к|с|о|у|за|на|до|по|из|от|об|без|для|но|и|а)\s+(?=\S)/g, "$1$2\u00A0");
    // число + единица измерения (₽, %, $, €)
    s = s.replace(/(\d)\s+([₽$€%])/g, "$1\u00A0$2");
    // единица + следующее слово (чтобы «₽ в день» не рвалось)
    s = s.replace(/([₽$€%])\s+(?=\S)/g, "$1\u00A0");
    return s;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = nbspJoin(text);
    return node;
  }

  function render(node) {
    app.innerHTML = "";
    app.appendChild(node);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function correctCount() {
    return state.answers.filter(function (a) { return a.correct; }).length;
  }

  // ============================================================================
  // Телефон и экраны приложений
  // ============================================================================

  // Обертка телефона с рамкой, островом, статус-баром и home-индикатором
  function phoneFrame(content, darkStatus, tint) {
    var wrap = el("div", "phone-wrap");
    var phone = el("div", "phone");
    var screen = el("div", "phone-screen" + (tint ? " tint-" + tint : ""));

    screen.appendChild(el("div", "island"));

    // статус-бар
    var status = el("div", "app-statusbar" + (darkStatus ? " status-dark" : ""));
    status.appendChild(el("span", "status-time", "9:41"));
    var icons = el("span", "status-icons");
    icons.appendChild(el("span", "", "▲"));
    icons.appendChild(el("span", "", "●"));
    icons.appendChild(el("span", "", "▮▮▮"));
    status.appendChild(icons);
    screen.appendChild(status);

    screen.appendChild(content);
    screen.appendChild(el("div", "home-indicator"));
    phone.appendChild(screen);
    wrap.appendChild(phone);
    return wrap;
  }

  // Заголовок приложения внутри экрана
  function appHeader(screenData) {
    var header = el("div", "app-header");
    header.appendChild(el("div", "app-name", screenData.app || ""));
    header.appendChild(el("div", "app-title", screenData.header.title));
    if (screenData.header.subtitle) {
      header.appendChild(el("div", "app-subtitle", screenData.header.subtitle));
    }
    return header;
  }

  // Рендер одного блока интерфейса
  function renderBlock(b) {
    switch (b.t) {
      case "card": {
        var card = el("div", "blk blk-card");
        card.appendChild(el("div", "card-label", b.label));
        card.appendChild(el("div", "card-balance", b.balance));
        if (b.sub) card.appendChild(el("div", "card-sub", b.sub));
        return card;
      }
      case "title":
        return el("h3", "blk blk-title", b.text);
      case "text":
        return el("p", "blk blk-text", b.text);
      case "offer": {
        var offer = el("div", "blk blk-offer");
        offer.appendChild(el("span", "offer-tag", b.tag));
        offer.appendChild(el("div", "offer-title", b.title));
        if (b.text) offer.appendChild(el("p", "offer-text", b.text));
        return offer;
      }
      case "compare": {
        var cmp = el("div", "blk blk-compare");
        b.rows.forEach(function (r) {
          var row = el("div", "compare-row" + (r.accent ? " accent" : ""));
          row.appendChild(el("span", "cr-label", r.label));
          row.appendChild(el("span", "cr-value", r.value));
          cmp.appendChild(row);
        });
        return cmp;
      }
      case "price": {
        var price = el("div", "blk blk-price");
        price.appendChild(el("div", "price-current", b.current));
        if (b.old) price.appendChild(el("div", "price-old", b.old));
        if (b.note) price.appendChild(el("div", "price-note", b.note));
        return price;
      }
      case "bullets": {
        var ul = el("div", "blk blk-bullets");
        b.items.forEach(function (it) {
          ul.appendChild(el("div", "bullet", it));
        });
        return ul;
      }
      case "badge": {
        var badgeWrap = el("div", "blk blk-badge");
        badgeWrap.appendChild(el("span", "badge-screen tone-" + (b.tone || "danger"), b.text));
        return badgeWrap;
      }
      case "note": {
        var note = el("p", "blk blk-note" + (b.tone ? " tone-" + b.tone : ""), b.text);
        return note;
      }
      case "disclosure": {
        var dis = el("div", "blk blk-disclosure");
        dis.appendChild(el("span", "disclosure-title", b.title));
        dis.appendChild(el("span", "disclosure-caret", "⌄"));
        return dis;
      }
      case "toggle": {
        var tg = el("div", "blk blk-toggle" + (b.checked ? " checked" : ""));
        var tgBody = el("div", "toggle-body");
        tgBody.appendChild(el("div", "toggle-title", b.title));
        if (b.desc) tgBody.appendChild(el("div", "toggle-desc", b.desc));
        tg.appendChild(tgBody);
        tg.appendChild(el("span", "toggle-switch"));
        return tg;
      }
      case "buttons": {
        var btns = el("div", "blk blk-buttons");
        b.items.forEach(function (it) {
          var cls = it.kind === "ghost" ? "btn-ghost-screen" : "btn-primary-screen";
          if (it.shame) cls += " shame";
          var btn = el("button", cls, it.text);
          btns.appendChild(btn);
        });
        return btns;
      }
      default:
        return el("div", "blk");
    }
  }

  // Экран кейса внутри телефона
  function renderCaseScreen(screenData) {
    var frag = document.createDocumentFragment();
    frag.appendChild(appHeader(screenData));

    var body = el("div", "app-body");
    var ctaBlocks = [];
    screenData.blocks.forEach(function (b) {
      if (b.t === "cta") {
        ctaBlocks.push(b);
      } else {
        body.appendChild(renderBlock(b));
      }
    });
    frag.appendChild(body);

    if (ctaBlocks.length) {
      var cta = el("div", "app-cta");
      var btn = el("button", "btn-screen", ctaBlocks[0].text);
      cta.appendChild(btn);
      frag.appendChild(cta);
    }

    return frag;
  }

  // Десктоп: кейс как лендинг/страница в браузере
  function desktopFrame(screenData, tint) {
    var wrap = el("div", "desktop-wrap");
    var browser = el("div", "browser" + (tint ? " tint-" + tint : ""));

    var bar = el("div", "browser-bar");
    bar.appendChild(el("span", "dot dot-r"));
    bar.appendChild(el("span", "dot dot-y"));
    bar.appendChild(el("span", "dot dot-g"));
    bar.appendChild(el("span", "browser-url", screenData.url || ((screenData.app || "site") + ".ru")));
    browser.appendChild(bar);

    var body = el("div", "browser-body");
    var head = el("div", "browser-header");
    head.appendChild(el("div", "browser-app", screenData.app || ""));
    head.appendChild(el("div", "browser-title", screenData.header.title));
    if (screenData.header.subtitle) {
      head.appendChild(el("div", "browser-subtitle", screenData.header.subtitle));
    }
    body.appendChild(head);

    var ctaBlocks = [];
    screenData.blocks.forEach(function (b) {
      if (b.t === "cta") {
        ctaBlocks.push(b);
      } else {
        body.appendChild(renderBlock(b));
      }
    });
    browser.appendChild(body);

    if (ctaBlocks.length) {
      var cta = el("div", "browser-cta");
      var btn = el("button", "btn-browser", ctaBlocks[0].text);
      cta.appendChild(btn);
      browser.appendChild(cta);
    }

    wrap.appendChild(browser);
    return wrap;
  }

  // Форматы кейсов: пуш, баннер, сторис, лендинг — рисуем внутри телефона
  // иконка приложения (скруглённый квадрат с эмодзи)
  function appIcon(icon) {
    var i = el("span", "app-icon");
    i.textContent = icon || "✦";
    return i;
  }

  // иллюстрация (цветной блок с эмодзи)
  function illust(icon, size) {
    var d = el("div", "illust" + (size ? " size-" + size : ""));
    d.textContent = icon || "✦";
    return d;
  }

  function getCta(sd) {
    var c = null;
    sd.blocks.forEach(function (b) { if (b.t === "cta") c = b.text; });
    return c;
  }

  // короткая подпись формата (одна строка), без лишнего текста
  function subText(sd) {
    var s = null;
    sd.blocks.forEach(function (b) {
      if (s) return;
      if (b.t === "offer" && b.text) s = b.text;
      else if (b.t === "text") s = b.text;
    });
    return s;
  }

  function pushScreen(sd) {
    var screen = el("div", "fmt-screen fmt-screen-push");
    screen.appendChild(el("div", "push-stack"));
    var notif = el("div", "push-notif");
    notif.appendChild(el("div", "push-grabber"));
    var head = el("div", "push-head");
    var iconWrap = el("div", "push-icon");
    iconWrap.appendChild(appIcon(sd.icon));
    iconWrap.appendChild(el("span", "push-badge", "2"));
    head.appendChild(iconWrap);
    var col = el("div", "push-app-col");
    col.appendChild(el("div", "push-app", sd.app || ""));
    col.appendChild(el("div", "push-time", "сейчас"));
    head.appendChild(col);
    notif.appendChild(head);
    notif.appendChild(el("div", "push-title", sd.header.title));
    var sub = subText(sd);
    if (sub) notif.appendChild(el("div", "push-line", sub));
    screen.appendChild(notif);
    return screen;
  }

  function bannerScreen(sd) {
    var screen = el("div", "fmt-screen fmt-screen-banner");
    var card = el("div", "banner-card");
    card.appendChild(el("span", "banner-close", "×"));
    var vis = el("div", "banner-vis");
    vis.appendChild(el("div", "banner-emoji", sd.icon));
    card.appendChild(vis);
    var brand = el("div", "banner-brand");
    brand.appendChild(appIcon(sd.icon));
    brand.appendChild(el("span", "banner-brand-name", sd.app || ""));
    card.appendChild(brand);
    card.appendChild(el("div", "banner-headline", sd.header.title));
    var sub = subText(sd);
    if (sub) card.appendChild(el("div", "banner-line", sub));
    var cta = getCta(sd);
    if (cta) card.appendChild(el("button", "btn-banner", cta));
    screen.appendChild(card);
    return screen;
  }

  function storyScreen(sd) {
    var screen = el("div", "fmt-screen fmt-screen-story");
    var prog = el("div", "story-progress");
    for (var i = 0; i < 4; i++) prog.appendChild(el("span", i === 0 ? "on" : (i === 1 ? "half" : "")));
    screen.appendChild(prog);

    var head = el("div", "story-head");
    var ring = el("span", "story-ring");
    ring.appendChild(el("span", "story-avatar", sd.icon || "✦"));
    head.appendChild(ring);
    var col = el("div", "story-id");
    col.appendChild(el("div", "story-user", sd.app || ""));
    col.appendChild(el("div", "story-time", "сейчас"));
    head.appendChild(col);
    head.appendChild(el("span", "story-more", "⋯"));
    head.appendChild(el("span", "story-close", "×"));
    screen.appendChild(head);

    var offerTitle = null, offerText = null, bullets = null;
    sd.blocks.forEach(function (b) {
      if (b.t === "offer" && b.title && !offerTitle) offerTitle = b.title;
      if (b.t === "offer" && b.text && !offerText) offerText = b.text;
      if (b.t === "bullets" && !bullets) bullets = b.items;
    });

    var vis = el("div", "story-main");
    vis.appendChild(el("div", "story-emoji", sd.icon));
    vis.appendChild(el("div", "story-headline", offerTitle || sd.header.title));
    var text = bullets ? bullets.join(" · ") : (offerText || subText(sd));
    if (text) vis.appendChild(el("div", "story-text", text));
    screen.appendChild(vis);

    var bottom = el("div", "story-bottom");
    bottom.appendChild(el("div", "story-reply", "Ответить..."));
    bottom.appendChild(el("span", "story-send", "➤"));
    screen.appendChild(bottom);
    return screen;
  }

  function landingScreen(sd) {
    var screen = el("div", "fmt-screen fmt-screen-landing");

    var bar = el("div", "landing-bar");
    bar.appendChild(el("span", "landing-back", "‹"));
    bar.appendChild(el("span", "landing-bar-title", sd.app || ""));
    bar.appendChild(el("span", "landing-share", "⋯"));
    screen.appendChild(bar);

    var page = el("div", "landing-page");
    var hero = el("div", "landing-hero");
    hero.appendChild(illust(sd.icon, "lg"));
    page.appendChild(hero);

    page.appendChild(el("h2", "landing-title", sd.header.title));
    var sub = subText(sd);
    if (sub) page.appendChild(el("div", "landing-subtitle", sub));

    var cta = getCta(sd);
    screen.appendChild(page);

    if (cta) {
      var ctaBox = el("div", "landing-cta");
      ctaBox.appendChild(el("button", "btn-landing", cta));
      screen.appendChild(ctaBox);
    }
    return screen;
  }

  // ОФФЕР — карточка спецпредложения
  function offerScreen(sd) {
    var screen = el("div", "fmt-screen fmt-screen-offer");
    var card = el("div", "offer-card");
    var tag = null;
    sd.blocks.forEach(function (b) { if (b.t === "offer" && b.tag) tag = b.tag; });
    card.appendChild(el("span", "offer-badge", tag || "Специальное предложение"));
    card.appendChild(el("div", "offer-headline", sd.header.title));
    var sub = subText(sd);
    if (sub) card.appendChild(el("div", "offer-line", sub));
    var cta = getCta(sd);
    if (cta) card.appendChild(el("button", "btn-offer", cta));
    screen.appendChild(card);
    return screen;
  }

  // НОТИФИКАЦИЯ — системное уведомление
  function notificationScreen(sd) {
    var screen = el("div", "fmt-screen fmt-screen-notif");
    var card = el("div", "notif-card");
    var head = el("div", "notif-head");
    head.appendChild(appIcon(sd.icon));
    var col = el("div", "notif-app-col");
    col.appendChild(el("div", "notif-app", sd.app || ""));
    col.appendChild(el("div", "notif-time", "сейчас"));
    head.appendChild(col);
    card.appendChild(head);
    card.appendChild(el("div", "notif-title", sd.header.title));
    var sub = subText(sd);
    if (sub) card.appendChild(el("div", "notif-line", sub));
    var cta = getCta(sd);
    var actions = el("div", "notif-actions");
    actions.appendChild(el("button", "notif-btn", cta || "Открыть"));
    actions.appendChild(el("button", "notif-btn ghost", "Позже"));
    card.appendChild(actions);
    screen.appendChild(card);
    return screen;
  }

  // СООБЩЕНИЕ — SMS / email / чат
  function messageScreen(sd) {
    var screen = el("div", "fmt-screen fmt-screen-msg");
    var card = el("div", "msg-card");
    var head = el("div", "msg-head");
    head.appendChild(el("span", "msg-sender", sd.app || "Сервис"));
    head.appendChild(el("span", "msg-time", "сейчас"));
    card.appendChild(head);
    card.appendChild(el("div", "msg-subject", sd.header.title));
    var sub = subText(sd);
    if (sub) card.appendChild(el("div", "msg-line", sub));
    var cta = getCta(sd);
    if (cta) card.appendChild(el("div", "msg-cta", "→ " + cta));
    screen.appendChild(card);
    return screen;
  }

  function formatLabel(f) {
    return ({ push: "Пуш", banner: "Баннер", story: "Сторис", landing: "Лендинг", offer: "Оффер", notification: "Нотификация", message: "Сообщение" })[f] || "Формат";
  }

  // собираем текст формата из блоков кейса (всегда как текст, без UI-элементов)
  function collectText(sd) {
    var lines = [];
    sd.blocks.forEach(function (b) {
      if (b.t === "text") lines.push(b.text);
      else if (b.t === "offer") {
        if (b.title) lines.push(b.title + (b.text ? " — " + b.text : ""));
        else if (b.text) lines.push(b.text);
      }
      else if (b.t === "badge") lines.push(b.text);
      else if (b.t === "note") lines.push(b.text);
      else if (b.t === "price") lines.push(b.old ? b.old + " → " + b.current : b.current);
      else if (b.t === "compare") {
        b.rows.forEach(function (r) { lines.push(r.label + ": " + r.value); });
      }
      else if (b.t === "bullets") {
        b.items.forEach(function (it) { lines.push("• " + it); });
      }
      else if (b.t === "card") {
        var s = (b.label ? b.label + " — " : "") + (b.balance || "");
        if (b.sub) s += " (" + b.sub + ")";
        lines.push(s);
      }
    });
    return lines;
  }

  // формат-лист: как текст, который пишет продуктовый редактор
  function formatSheet(format, sd) {
    var wrap = el("div", "sheet-wrap");
    var card = el("div", "sheet-card" + (sd.tint ? " tint-" + sd.tint : ""));

    var chip = el("div", "sheet-chip");
    chip.appendChild(el("span", "sheet-fmt", formatLabel(format)));
    if (sd.app) chip.appendChild(el("span", "sheet-app", sd.app));
    card.appendChild(chip);

    var body = el("div", "sheet-body");

    var headline = null;
    sd.blocks.forEach(function (b) { if (b.t === "offer" && b.title) headline = b.title; });
    body.appendChild(el("div", "sheet-headline", headline || sd.header.title));

    if (sd.header.subtitle) body.appendChild(el("div", "sheet-sub", sd.header.subtitle));

    var textLines = collectText(sd);
    if (textLines.length) {
      var txt = el("div", "sheet-text");
      textLines.forEach(function (ln) { txt.appendChild(el("div", "sheet-line", ln)); });
      body.appendChild(txt);
    }

    var cta = null;
    sd.blocks.forEach(function (b) { if (b.t === "cta") cta = b.text; });
    if (cta) {
      var ctaRow = el("div", "sheet-cta");
      ctaRow.appendChild(el("span", "sheet-cta-label", "Кнопка"));
      ctaRow.appendChild(el("span", "sheet-cta-text", cta));
      body.appendChild(ctaRow);
    }

    card.appendChild(body);
    wrap.appendChild(card);
    return wrap;
  }

  function renderFormatScreen(format, sd) {
    var screen;
    if (format === "push") screen = pushScreen(sd);
    else if (format === "banner") screen = bannerScreen(sd);
    else if (format === "story") screen = storyScreen(sd);
    else if (format === "offer") screen = offerScreen(sd);
    else if (format === "notification") screen = notificationScreen(sd);
    else if (format === "message") screen = messageScreen(sd);
    else screen = landingScreen(sd);
    attachPhoneTaps(screen, sd);
    return screen;
  }

  // Кнопки на телефоне реагируют на тап: появляется попап, как ответ приложения
  function attachPhoneTaps(screen, sd) {
    var tappable = screen.querySelectorAll("button, .msg-cta");
    Array.prototype.forEach.call(tappable, function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        showPhonePopup(screen, b.textContent, sd);
      });
    });
  }

  function showPhonePopup(screen, action, sd) {
    var popup = el("div", "phone-popup");
    var card = el("div", "phone-popup-card");

    // 1) фаза загрузки
    var loading = el("div", "phone-popup-loading");
    loading.appendChild(el("span", "phone-spinner"));
    loading.appendChild(el("div", "phone-popup-loading-text", "Отправляем…"));
    card.appendChild(loading);
    popup.appendChild(card);
    screen.appendChild(popup);

    function close() { popup.remove(); }

    // 2) через мгновение — подтверждение
    setTimeout(function () {
      card.innerHTML = "";
      var success = el("div", "phone-popup-success");
      success.appendChild(el("div", "phone-popup-check", "✓"));
      success.appendChild(el("div", "phone-popup-title", (sd.popup && sd.popup.title) || "Готово"));
      if (sd.popup && sd.popup.text) success.appendChild(el("div", "phone-popup-text", sd.popup.text));
      success.appendChild(el("button", "phone-popup-ok", "Понятно"));
      card.appendChild(success);
      card.appendChild(el("span", "phone-popup-close", "×"));
      card.querySelector(".phone-popup-ok").addEventListener("click", close);
      card.querySelector(".phone-popup-close").addEventListener("click", close);
      card.querySelector(".phone-popup-check").classList.add("show");
    }, 650);

    popup.addEventListener("click", function (e) {
      if (e.target === popup) close();
    });
  }

  // Кейс рисуем внутри телефона, а внутри — нужный формат
  function caseFrame(screenData) {
    var format = screenData.format || "landing";
    var dark = format === "story";
    return phoneFrame(renderFormatScreen(format, screenData), dark, screenData.tint);
  }

  // ============================================================================
  // 1. Интро
  // ============================================================================
  function renderIntro() {
    var wrap = el("div", "screen layout");

    // телефон с заставкой
    var fmts = {};
    CASES.forEach(function (c) { if (c.screen && c.screen.format) fmts[c.screen.format] = 1; });
    var fmtCount = Object.keys(fmts).length;

    var introScreen = el("div", "intro-screen");
    introScreen.appendChild(el("div", "intro-emoji", "📱"));
    introScreen.appendChild(el("h1", "intro-title", TRENER_TITLE));
    introScreen.appendChild(el("p", "intro-lead", TRENER_INTRO));

    var stats = el("div", "intro-stats");
    var statCase = el("div", "intro-stat");
    statCase.appendChild(el("div", "stat-num", String(CASES.length)));
    statCase.appendChild(el("div", "stat-label", "кейсов"));
    stats.appendChild(statCase);
    var statFmt = el("div", "intro-stat");
    statFmt.appendChild(el("div", "stat-num", String(fmtCount)));
    statFmt.appendChild(el("div", "stat-label", "форматов"));
    stats.appendChild(statFmt);
    introScreen.appendChild(stats);

    introScreen.appendChild(el("div", "intro-tap", "👆 Нажми на кнопку на экране"));

    var introPhone = el("div", "intro-phone");
    introPhone.appendChild(phoneFrame(introScreen, true));
    wrap.appendChild(introPhone);

    // панель справа — коротко и по делу
    var panel = el("div", "panel");
    panel.appendChild(el("h2", "panel-title", "Привет!"));
    panel.appendChild(el("p", "panel-lead",
      "Это тренажер для продуктовых редакторов. Учимся замечать дарк-паттерны в формулировках и подаче информации."));

    // определение
    var def = el("div", "intro-def");
    def.appendChild(el("div", "intro-def-label", "Дарк-паттерны"));
    def.appendChild(el("div", "intro-def-text",
      "Это приемы в тексте, которые создают у клиента неверное ожидание или подталкивают к поспешному решению. Формально все может быть правдой, но смысл искажается."));
    panel.appendChild(def);

    // подсказка про интерактив
    var tip = el("div", "intro-tip");
    tip.appendChild(el("span", "intro-tip-ico", "👆"));
    tip.appendChild(el("div", "intro-tip-text", "Кнопки на экране телефона кликабельные — нажми на любую и посмотри, как отреагирует приложение."));
    panel.appendChild(tip);

    // правила
    var rules = el("div", "review-list");
    var rulesTitle = el("div", "rules-title", "Как это работает");
    panel.appendChild(rulesTitle);
    rules.appendChild(reviewItem("Читаем текст и контекст", "На экране реклама, письмо, пуш или баннер. Оцениваем формулировку, а не оформление."));
    rules.appendChild(reviewItem("Выбираем ожидание", "Ответьте, какое ожидание формирует текст."));
    rules.appendChild(reviewItem("Смотрим разбор", "В чем проблема и как исправить подачу."));
    panel.appendChild(rules);

    var actions = el("div", "panel-actions");
    var goBtn = el("button", "btn btn-primary", "Поехали 🚀");
    goBtn.addEventListener("click", function () {
      state.index = 0;
      state.answers = [];
      state.currentSelected = -1;
      renderQuiz();
    });
    actions.appendChild(goBtn);
    panel.appendChild(actions);

    wrap.appendChild(panel);
    render(wrap);
  }

  function reviewItem(title, hint) {
    var item = el("div", "review-item");
    item.appendChild(el("div", "review-name", title));
    item.appendChild(el("div", "review-hint", hint));
    return item;
  }

  // короткая «выжимка» разбора для списка результатов
  function breakdownTakeaway(b) {
    if (b.fix) return b.fix;
    if (b.rows && b.rows.length) return b.rows[b.rows.length - 1].text;
    return "";
  }

  // ============================================================================
  // 2. Квиз
  // ============================================================================
  function renderQuiz() {
    if (state.index >= CASES.length) {
      renderResults();
      return;
    }

    var c = CASES[state.index];
    var wrap = el("div", "screen layout");

    // фрейм кейса (телефон или десктоп/браузер)
    var casePhone = el("div", "");
    casePhone.appendChild(caseFrame(c.screen));
    wrap.appendChild(casePhone);

    // панель с заданием
    var panel = el("div", "panel");

    // кнопка «Назад» к предыдущему кейсу
    if (state.index > 0) {
      var backRow = el("div", "quiz-back");
      var backBtn = el("button", "btn-back", "← Назад");
      backBtn.addEventListener("click", function () {
        state.index -= 1;
        state.currentSelected = -1;
        var cid = CASES[state.index].id;
        state.answers = state.answers.filter(function (a) { return a.caseId !== cid; });
        renderQuiz();
      });
      backRow.appendChild(backBtn);
      panel.appendChild(backRow);
    }

    // прогресс
    var progressRow = el("div", "progress-row");
    var progressTop = el("div", "progress-top");
    progressTop.appendChild(el("span", "", "Кейс " + (state.index + 1) + " из " + CASES.length));
    progressRow.appendChild(progressTop);
    var track = el("div", "progress-track");
    var fill = el("div", "progress-fill");
    fill.style.width = ((state.index) / CASES.length * 100) + "%";
    track.appendChild(fill);
    progressRow.appendChild(track);
    panel.appendChild(progressRow);

    // условия задания (контекст для редактора) — перед вопросом
    if (c.context) {
      var ctx = el("div", "case-context");
      ctx.appendChild(el("div", "case-context-label", "Условия задания"));
      ctx.appendChild(el("div", "case-context-text", c.context));
      panel.appendChild(ctx);
    }

    // вопрос
    panel.appendChild(el("h3", "panel-question", c.question || DEFAULT_QUESTION));

    // варианты
    var optionsWrap = el("div", "options");
    c.options.forEach(function (opt, i) {
      var label = el("button", "option");
      label.setAttribute("data-idx", String(i));
      label.appendChild(el("span", "option-key", String.fromCharCode(65 + i)));
      label.appendChild(el("span", "option-text", opt.text));
      label.addEventListener("click", function () {
        if (state.currentSelected !== -1) return;
        selectOption(c, i);
      });
      optionsWrap.appendChild(label);
    });
    panel.appendChild(optionsWrap);

    // обратная связь
    var feedback = el("div", "feedback");
    feedback.id = "feedback";
    panel.appendChild(feedback);

    wrap.appendChild(panel);
    render(wrap);
  }

  function selectOption(c, idx) {
    state.currentSelected = idx;
    state.answers.push({ caseId: c.id, selectedIndex: idx, correct: c.options[idx].isCorrect });

    var opts = document.querySelectorAll(".option");
    opts.forEach(function (label, i) {
      var chosen = i === idx;
      if (c.options[i].isCorrect) {
        label.classList.add("option-correct");
      } else if (chosen) {
        label.classList.add("option-wrong");
      } else {
        label.classList.add("option-dim");
      }
    });

    renderFeedback(c, idx);
  }

  function renderFeedback(c, idx) {
    var fb = document.getElementById("feedback");
    fb.innerHTML = "";

    var chosen = c.options[idx];

    // вердикт
    var verdict = el("div", "verdict " + (chosen.isCorrect ? "verdict-correct" : "verdict-wrong"));
    verdict.textContent = chosen.isCorrect ? "Верно" : "Не совсем";
    fb.appendChild(verdict);

    // плашки разбора (стандартные три или кастомный набор)
    var b = c.breakdown;
    if (b.rows) {
      b.rows.forEach(function (r) { fb.appendChild(breakdownRow(r.label, r.text, r.kind)); });
    } else {
      fb.appendChild(breakdownRow("Что клиент может понять неверно", b.misconception, "mis"));
      fb.appendChild(breakdownRow("Почему это происходит", b.why, "why"));
      fb.appendChild(breakdownRow("Как исправить", b.fix, "fix"));
    }

    var next = el("button", "btn btn-primary", state.index === CASES.length - 1 ? "Показать результаты" : "Следующий кейс");
    next.addEventListener("click", function () {
      state.index += 1;
      state.currentSelected = -1;
      renderQuiz();
    });
    fb.appendChild(next);

    // показать разбор без ручной прокрутки
    fb.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function breakdownRow(label, text, kind) {
    var icons = { focus: "◎", crit: "◎", mis: "⚠", why: "◆", fix: "✓" };
    var row = el("div", "breakdown" + (kind ? " breakdown-" + kind : ""));
    var head = el("div", "breakdown-head");
    head.appendChild(el("span", "breakdown-ico", icons[kind] || "•"));
    head.appendChild(el("span", "breakdown-label", label));
    row.appendChild(head);
    row.appendChild(el("div", "breakdown-text", text));
    return row;
  }

  // ============================================================================
  // 3. Результаты
  // ============================================================================
  function renderResults() {
    var total = CASES.length;
    var correct = correctCount();
    var pct = Math.round(correct / total * 100);

    var wrap = el("div", "screen layout");

    // телефон с результатом
    var resScreen = el("div", "intro-screen");
    resScreen.appendChild(el("div", "intro-emoji", pct >= 70 ? "🎉" : pct >= 40 ? "💪" : "🌱"));
    var ring = el("div", "score-ring " + (pct >= 70 ? "score-good" : pct >= 40 ? "score-mid" : "score-low"));
    var num = el("div", "score-num");
    num.appendChild(el("span", "score-value", String(pct)));
    num.appendChild(el("span", "score-pct", "%"));
    ring.appendChild(num);
    ring.appendChild(el("div", "score-caption", "верно " + correct + " из " + total));
    resScreen.appendChild(ring);
    resScreen.appendChild(el("h1", "intro-title", resultsTitle(pct)));
    resScreen.appendChild(el("p", "intro-lead", resultsLead(pct)));

    var resPhone = el("div", "");
    resPhone.appendChild(phoneFrame(resScreen, true));
    wrap.appendChild(resPhone);

    // панель с разбором ошибок
    var panel = el("div", "panel");
    panel.appendChild(el("h2", "panel-title", resultsTitle(pct)));
    panel.appendChild(el("p", "panel-lead", resultsLead(pct)));

    var wrong = state.answers.filter(function (a) { return !a.correct; });
    if (wrong.length > 0) {
      var list = el("div", "review-list");
      wrong.forEach(function (a) {
        var item = CASES.filter(function (c) { return c.id === a.caseId; })[0];
        list.appendChild(reviewItem(item.title, "Как исправить подачу: " + breakdownTakeaway(item.breakdown)));
      });
      panel.appendChild(list);
    } else {
      panel.appendChild(el("p", "all-correct", "Вы справились со всеми кейсами. Отличная работа!"));
    }

    var actions = el("div", "panel-actions");
    var continueBtn = el("button", "btn btn-primary", "Оценить тренажер");
    continueBtn.addEventListener("click", renderSurvey);
    actions.appendChild(continueBtn);

    var restart = el("button", "btn btn-ghost", "Пройти заново");
    restart.addEventListener("click", function () {
      state.index = 0;
      state.answers = [];
      state.currentSelected = -1;
      renderIntro();
    });
    actions.appendChild(restart);
    panel.appendChild(actions);

    wrap.appendChild(panel);
    render(wrap);
  }

  function resultsTitle(pct) {
    if (pct >= 80) return "Отличная насмотренность";
    if (pct >= 60) return "Хороший результат";
    if (pct >= 40) return "Неплохо, но есть над чем поработать";
    return "Начало положено";
  }

  function resultsLead(pct) {
    if (pct >= 80) return "Вы хорошо различаете, как формулировки формируют ожидания клиента.";
    if (pct >= 60) return "Большинство паттернов вы замечаете. Разборы в конце кейсов помогут закрепить.";
    if (pct >= 40) return "Часть приемов еще «проскакивает». Вернитесь к разборам, там логика каждого случая.";
    return "Это нормально для первого раза: дарк-паттерны потому и неочевидны. Разборы покажут, на что смотреть.";
  }

  // ============================================================================
  // 4. Опрос
  // ============================================================================
  function renderSurvey() {
    var wrap = el("div", "screen layout");

    var sScreen = el("div", "intro-screen");
    sScreen.appendChild(el("div", "intro-emoji", "🙋"));
    sScreen.appendChild(el("h1", "intro-title", "Пара вопросов в конце"));
    sScreen.appendChild(el("p", "intro-lead", "Ваши ответы помогут понять, стоит ли развивать тренажер."));
    var sPhone = el("div", "");
    sPhone.appendChild(phoneFrame(sScreen, true));
    wrap.appendChild(sPhone);

    var panel = el("div", "panel");
    panel.appendChild(el("h2", "panel-title", "Обратная связь"));
    panel.appendChild(el("p", "panel-lead", "Пара коротких вопросов, и все."));

    var q1 = el("div", "survey-q");
    q1.appendChild(el("div", "survey-q-text", "Насколько полезен был тренажер?"));
    q1.appendChild(ratingButtons("rating"));
    panel.appendChild(q1);

    var q2 = el("div", "survey-q");
    q2.appendChild(el("div", "survey-q-text", "Комментарий (необязательно)"));
    var ta = el("textarea", "survey-textarea");
    ta.rows = 4;
    ta.placeholder = "Что понравилось или что улучшить?";
    q2.appendChild(ta);
    panel.appendChild(q2);

    var submit = el("button", "btn btn-primary", "Отправить и завершить");
    submit.disabled = true;
    submit.id = "survey-submit";
    submit.addEventListener("click", function () {
      state.survey = state.survey || {};
      state.survey.comment = ta.value;
      renderThanks();
    });
    panel.appendChild(submit);

    wrap.appendChild(panel);
    render(wrap);
  }

  function ratingButtons(key) {
    var wrap = el("div", "rating");
    for (var i = 1; i <= 5; i++) {
      (function (val) {
        var b = el("button", "rating-btn", String(val));
        b.addEventListener("click", function () {
          state.survey = state.survey || {};
          state.survey[key] = val;
          var all = wrap.querySelectorAll(".rating-btn");
          all.forEach(function (x) { x.classList.remove("rating-btn-active"); });
          b.classList.add("rating-btn-active");
          var submit = document.getElementById("survey-submit");
          if (submit) submit.disabled = false;
        });
        wrap.appendChild(b);
      })(i);
    }
    return wrap;
  }

  // ============================================================================
  // 5. Спасибо
  // ============================================================================
  function renderThanks() {
    var wrap = el("div", "screen layout");

    var tScreen = el("div", "intro-screen");
    var check = el("div", "thanks-check", "✓");
    tScreen.appendChild(check);
    tScreen.appendChild(el("h1", "intro-title", "Спасибо!"));
    tScreen.appendChild(el("p", "intro-lead", "Тренажер пройден. Если захотите вернуться к разборам, начните заново."));
    var tPhone = el("div", "");
    tPhone.appendChild(phoneFrame(tScreen, true));
    wrap.appendChild(tPhone);

    var panel = el("div", "panel");
    panel.appendChild(el("h2", "panel-title", "Готово!"));
    panel.appendChild(el("p", "panel-lead", "Спасибо, что прошли тренажер. Возвращайтесь к разборам, когда захотите прокачать насмотренность на дарк-паттерны."));

    var actions = el("div", "panel-actions");
    var restart = el("button", "btn btn-primary", "Пройти еще раз");
    restart.addEventListener("click", function () {
      state.index = 0;
      state.answers = [];
      state.currentSelected = -1;
      renderIntro();
    });
    actions.appendChild(restart);
    panel.appendChild(actions);

    wrap.appendChild(panel);
    render(wrap);
  }

  // --- запуск --------------------------------------------------------------------
  renderIntro();
})();