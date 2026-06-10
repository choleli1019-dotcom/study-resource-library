const resources = [
  {
    id: "start",
    icon: "目",
    title: "资料目录",
    description: "从更新、留言、教程、工具和学习顺序开始，适合第一次进入资源库的人。",
    items: [
      resource("27新增资料", "查看近期新增和维护记录。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/AIDVwc4LUig2lZkQJiuc2OUdnhc"),
      resource("资料需求留言板", "缺少资料或链接失效时，在这里反馈需求。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/Id1JwO5fZibz9skPcpgcJoxqnOb"),
      resource("资料保存教程演示", "学习如何转存、打开和保存网盘资料。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/I3pPwFBLIiiFdOkLL9dcH18jntd"),
      resource("学习交流群", "加入交流入口，方便反馈和获取更新。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/VorhwG3hjihPeskZe6zc5p6Knne"),
      resource("刷题实用工具", "刷题、记录、复盘会用到的工具集合。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/NyxOwPExAiOqMWkEykqcm8IPnDe"),
      resource("新人学习顺序推荐", "不知道先看哪个时，从这里安排学习路径。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/EWe7wymtgiWQULk1aiKc9KP5n6d"),
      resource("自制壁纸分享", "备考壁纸、提醒图和自用素材。", "网站", "https://zhaoxi-wallpaper-20260609.netlify.app/")
    ]
  },
  {
    id: "civil",
    icon: "公",
    title: "公考类",
    description: "公务员、事业单位、行测职测、真题、面试和专项考试资料。",
    items: [
      resource("公考类资料大合集", "夸克、百度网盘合集入口，适合集中查找公考资料。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/APHHw5AEsinyrBkA7KRcwQDwnId"),
      resource("2027名师 行测、职测、申论模块分类", "按行测、职测、申论和名师课程分类整理。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/KtW7wbeQCiVfr3k931Cc62Syn6b"),
      resource("2026名师 行测、职测、申论模块分类", "按行测、职测、申论和名师课程分类整理。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/FnF9wu8fBigVgJkGGSBcQBqPnmk"),
      resource("公考合集（2025-2027）", "2025 至 2027 公考课程和备考资料合集。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/LmLswnURdip1tbkkQV8cmIngn6f"),
      resource("2026名师课程", "名师课程资源入口。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/OvJxwIGriiPrxakL7MIcrHAEnte"),
      resource("公基、时政、常识合集", "公共基础知识、时政热点和常识资料集合。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/U3wvwPboui8mt1kJQ7BcQVefnkg"),
      resource("历年真题", "公务员和相关考试真题集合。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/QYwZwERjCixiFSkDsJ8cDcq2ncd"),
      resource("事业单位", "事业单位笔试、职测、综应等资料。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/LGddwBTH5ije0akZI8IcfPKpnyo"),
      resource("公考面试", "结构化面试、无领导、小组讨论等备考资料。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/TPCHwG7wJiNeu5klyxtc1quInbc"),
      resource("三支一扶", "三支一扶考试资料和备考内容。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/TkhIw3mK3i4kKokodYkcSBmgnJf"),
      resource("军队文职", "军队文职笔试、面试和岗位相关资料。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/UIu2wkHSdijwZYkyDgqctZWCnCf"),
      resource("社区工作者", "社工考试资料、真题和课程入口。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/AYRew2cbdibKElkxXJ2cjGCDn9b"),
      resource("四六级 / 普通话 / 计算机软考", "通用证书与能力类考试资料。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/EQ1JwoxJOiXWLSkFgP7c3hK7nGh"),
      resource("公安公专", "公安专业科目资料入口。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/DsfFwZlpLiqTpCkzQWVcZG7TnQc"),
      resource("晨读资料", "申论、面试、热点素材等晨读内容。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/EXiUwEve9iau8hkCJJ5c6Lq5nHe"),
      resource("选调 遴选", "选调 遴选资料。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/J0aQwTqXUipURDk56mdctFaEnmc"),
      resource("模考复盘合集", "模考记录、复盘资料和错题整理。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/Gh3VwIdY8iX5jxkDI24c0lc0nOc")
    ]
  },
  {
    id: "teacher",
    icon: "教",
    title: "教招教资",
    description: "教师招聘和教师资格证相关备考资料。",
    items: [
      resource("教师招聘、教师资格 特岗 教师面试", "教招、教资、特岗和教师面试资料集合。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/GYBKwruE3i2MhFkbwnDcm7qsn7b")
    ]
  },
  {
    id: "law",
    icon: "法",
    title: "法考",
    description: "法考备考资料入口。",
    items: [
      resource("2026 法考", "2026 法考课程和资料集合。", "夸克", "https://pan.quark.cn/s/e30eeeb46bbf", "quark")
    ]
  },
  {
    id: "ebooks",
    icon: "书",
    title: "电子书",
    description: "电子书合集，适合找教材、讲义和拓展阅读。",
    items: [
      resource("电子书合集", "各类电子书资源入口。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/VaZxwPNC7iahEokJE0QcfoXqnSz")
    ]
  },
  {
    id: "postgraduate",
    icon: "研",
    title: "考研",
    description: "考研相关资料入口。",
    items: [
      resource("2027 考研", "2027 考研课程、资料和整理页。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/STsXwMhfMihC1Gkr0fKcL2dNnmb")
    ]
  },
  {
    id: "accounting",
    icon: "会",
    title: "会计",
    description: "会计类考试与学习资料。",
    items: [
      resource("会计", "会计考试和学习资料入口。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/CDZtwVTauiwwzFkDqchckBAPnNl")
    ]
  },
  {
    id: "others",
    icon: "其",
    title: "其他类别考试",
    description: "计算机等级、专四专八、央国企等资料。",
    items: [
      resource("其他类型考试资料", "未单独归类的考试资料集合。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/HhbWwcPvSimBurkwA5gcxxW8nNe")
    ]
  },
  {
    id: "media",
    icon: "影",
    title: "影视资源",
    description: "学累了放松一下的影视资源入口。",
    items: [
      resource("影视资源", "休息放松用的影视资源集合。", "飞书", "https://di0occkvoyb.feishu.cn/wiki/GuGawSBowi4RIjkbWxIc3VRYnSd")
    ]
  }
];

const quickNames = ["学习资料使用指南", "资料保存教程演示", "学习交流群", "资料需求留言板"];
const guideLink = resource(
  "学习资料使用指南",
  "PDF 中提示的必看说明和重要声明。",
  "飞书",
  "https://di0occkvoyb.feishu.cn/wiki/I3pPwFBLIiiFdOkLL9dcH18jntd"
);

const state = {
  query: "",
  category: "all"
};

function resource(title, description, source, url, sourceClass = "") {
  return { title, description, source, url, sourceClass };
}

function renderNav() {
  const nav = document.querySelector("#sectionNav");
  nav.innerHTML = resources
    .map(
      (section) => `
        <a class="nav-link" href="#${section.id}">
          <span>${section.icon}</span>
          <span>${section.title}</span>
        </a>
      `
    )
    .join("");
}

function renderFilters() {
  const filters = document.querySelector("#categoryFilters");
  const all = [{ id: "all", title: "全部" }, ...resources.map(({ id, title }) => ({ id, title }))];
  filters.innerHTML = all
    .map(
      (item) => `
        <button class="filter-btn ${item.id === state.category ? "active" : ""}" data-filter="${item.id}" type="button">
          ${item.title}
        </button>
      `
    )
    .join("");
}

function renderQuickLinks() {
  const links = [guideLink, ...resources[0].items.filter((item) => quickNames.includes(item.title))];
  document.querySelector("#quickLinks").innerHTML = links
    .map(
      (item) => `
        <a class="quick-link" href="${item.url}" target="_blank" rel="noopener noreferrer">
          ${item.title}
        </a>
      `
    )
    .join("");
}

function renderResources() {
  const container = document.querySelector("#resourceSections");
  const query = state.query.trim().toLowerCase();
  let visibleCount = 0;

  container.innerHTML = resources
    .map((section) => {
      const categoryVisible = state.category === "all" || state.category === section.id;
      const items = section.items.filter((item) => {
        const text = `${section.title} ${item.title} ${item.description} ${item.source}`.toLowerCase();
        return categoryVisible && (!query || text.includes(query));
      });

      visibleCount += items.length;
      const hidden = items.length === 0 ? "hidden" : "";

      return `
        <section class="section-block ${hidden}" id="${section.id}" data-section="${section.id}">
          <header class="section-header">
            <div class="section-title">
              <span class="section-icon">${section.icon}</span>
              <div>
                <h2>${section.title}</h2>
                <p>${section.description}</p>
              </div>
            </div>
            <div class="section-actions">
              <span class="resource-count">${items.length} 个入口</span>
              ${renderSectionLink(section)}
            </div>
          </header>
          <div class="resource-grid">
            ${items.map(renderCard).join("")}
          </div>
        </section>
      `;
    })
    .join("");

  const empty = document.querySelector(".empty-state");
  if (!empty) {
    container.insertAdjacentHTML("afterend", '<div class="empty-state">没有找到匹配的资料入口</div>');
  }
  document.querySelector(".empty-state").style.display = visibleCount ? "none" : "block";
}

function renderSectionLink(section) {
  const firstLink = section.items[0];
  if (!firstLink?.url) return "";

  const label = firstLink.source === "飞书" ? "进入飞书板块" : `进入${firstLink.source}资料`;
  const className = firstLink.sourceClass ? ` ${firstLink.sourceClass}` : "";

  return `
    <a class="section-link${className}" href="${firstLink.url}" target="_blank" rel="noopener noreferrer">
      ${label}
    </a>
  `;
}

function renderCard(item) {
  const className = item.sourceClass ? ` ${item.sourceClass}` : "";
  return `
    <article class="resource-card">
      <div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </div>
      <div class="card-meta">
        <span class="tag">${item.source}</span>
        <a class="open-link${className}" href="${item.url}" target="_blank" rel="noopener noreferrer">打开</a>
      </div>
    </article>
  `;
}

function bindEvents() {
  document.querySelector("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderResources();
  });

  document.querySelector("#categoryFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.category = button.dataset.filter;
    renderFilters();
    renderResources();
  });
}

renderNav();
renderFilters();
renderQuickLinks();
renderResources();
bindEvents();
