// ============================================================
// 肌骨康复速查 V6.0 - 核心逻辑
// ============================================================

// ==================== 全局状态 ====================
var currentTab = 'muscle';
var currentMuscleRegion = '';
var currentDiseaseRegion = '';
var currentScaleId = null;
var currentScaleTab = 'list';
var currentAssessmentQuestionIdx = 0;
var currentAssessmentAnswers = [];
var currentProtocolCat = 'ALL';
var currentToolsCategory = 'ALL';
var currentGuidelinesCategory = 'ALL';
var currentMorePage = null;
var searchDebounceTimers = {};

// ==================== 安全转义 ====================
function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escAttr(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==================== 图标函数 ====================
function icon(name, size) {
  if (typeof icons === 'undefined' || !icons[name]) return '';
  size = size || 24;
  return icons[name].replace('<svg ', '<svg style="width:' + size + 'px;height:' + size + 'px;" ');
}

function setIcon(id, name, size) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = icon(name, size);
}

function initIcons() {
  var iconMap = {
    navBackIcon: 'back',
    navMoreIcon: 'more',
    muscleSearchIcon: 'search',
    diagnosisSearchIcon: 'search',
    assessmentSearchIcon: 'search',
    protocolSearchIcon: 'search',
    muscleSectionIcon: 'muscle',
    diagnosisSectionIcon: 'diagnosis',
    protocolSectionIcon: 'protocol',
    moreSectionIcon: 'other',
    tabMuscleIcon: 'muscle',
    tabDiagnosisIcon: 'diagnosis',
    tabAssessmentIcon: 'assessment',
    tabProtocolIcon: 'protocol',
    tabMoreIcon: 'other'
  };
  for (var id in iconMap) {
    setIcon(id, iconMap[id], 22);
  }
}

// ==================== 搜索系统 ====================
function getSearchHistory(key) {
  try { return JSON.parse(localStorage.getItem('searchHistory_' + key) || '[]') || []; }
  catch (e) { return []; }
}

function getAssessmentHistory() {
  try { return JSON.parse(localStorage.getItem('assessmentHistory') || '[]') || []; }
  catch (e) { return []; }
}

function saveSearchHistory(key, term) {
  if (!term || term.length < 1) return;
  var history = getSearchHistory(key);
  history = history.filter(function(h) { return h !== term; });
  history.unshift(term);
  history = history.slice(0, 8);
  localStorage.setItem('searchHistory_' + key, JSON.stringify(history));
}

function renderSearchHistory(containerId, key, inputId, onSelectFn) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var history = getSearchHistory(key);
  if (history.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '<div class="search-history-section">' +
    history.map(function(h) {
      return '<span class="search-history-tag" data-input="' + escAttr(inputId) + '" data-name="' + escAttr(h) + '" data-action="search-history">' +
        '<span class="icon">' + icon('search', 14) + '</span>' + esc(h) +
      '</span>';
    }).join('') +
  '</div>';
}

function fuzzyMatch(text, query) {
  var qi = 0;
  for (var ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

function highlightKeyword(text, keyword) {
  if (!keyword) return esc(text || '');
  // 先转义text中的HTML字符，再替换keyword为<mark>
  var escaped = esc(text || '');
  // keyword中的特殊regex字符需要转义
  var kwEscaped = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    var regex = new RegExp('(' + kwEscaped + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  } catch (e) {
    return escaped;
  }
}

function setupSearch(inputId, dropdownId, historyContainerId, historyKey, dataSource, renderFn, selectFn) {
  var input = document.getElementById(inputId);
  var dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  input.addEventListener('input', function() {
    var val = this.value.trim().toLowerCase();
    clearTimeout(searchDebounceTimers[inputId]);

    if (!val) {
      dropdown.classList.remove('show');
      if (historyContainerId) {
        renderSearchHistory(historyContainerId, historyKey, inputId, selectFn);
      }
      renderFn();
      return;
    }

    searchDebounceTimers[inputId] = setTimeout(function() {
      var matches = dataSource.filter(function(item) {
        var name = (item.name || item['肌肉名称'] || item['疾病名称'] || item['具体病症'] || '').toLowerCase();
        return name.indexOf(val) >= 0 || fuzzyMatch(name, val);
      }).slice(0, 8);

      if (matches.length === 0) {
        dropdown.classList.remove('show');
      } else {
        dropdown.innerHTML = '<div class="autocomplete-header"><span>搜索建议</span></div>' +
          matches.map(function(m) {
            var name = m.name || m['肌肉名称'] || m['疾病名称'] || m['具体病症'] || '';
            var highlighted = highlightKeyword(name, val);
            var idAttr = m.id ? ' data-id="' + escAttr(m.id) + '"' : '';
            return '<div class="autocomplete-item" data-name="' + escAttr(name) + '"' + idAttr + ' data-action="' + escAttr(selectFn) + '" data-input="' + escAttr(inputId) + '">' +
              '<span class="icon">' + icon('search', 18) + '</span>' +
              '<span>' + highlighted + '</span>' +
            '</div>';
          }).join('');
        dropdown.classList.add('show');
      }
      renderFn();
    }, 200);
  });

  input.addEventListener('focus', function() {
    if (!this.value.trim() && historyContainerId) {
      renderSearchHistory(historyContainerId, historyKey, inputId, selectFn);
    }
  });

  input.addEventListener('blur', function() {
    setTimeout(function() { dropdown.classList.remove('show'); }, 200);
  });
}

// ==================== 红旗警报 ====================
function showRedflagAlert(title, content) {
  var titleEl = document.getElementById('redflagTitle');
  var contentEl = document.getElementById('redflagContent');
  var maskEl = document.getElementById('redflagMask');
  var alertEl = document.getElementById('redflagAlert');
  if (titleEl) titleEl.textContent = title || '红旗征警示';
  // content是开发者构建的HTML，对动态部分需要保证转义；这里使用innerHTML因为是受信任的
  if (contentEl) contentEl.innerHTML = content;
  if (maskEl) maskEl.classList.add('show');
  if (alertEl) alertEl.classList.add('show');
}

// 安全的红旗征内容构造器 - 对动态数据转义
function buildRedflagContent(name, content, warning) {
  return '<p><strong>' + esc(name) + '</strong></p>' +
    '<p style="margin-top:8px;line-height:1.8;">' + esc(content) + '</p>' +
    '<p style="margin-top:8px;color:var(--danger);font-weight:600;">' + esc(warning) + '</p>';
}

function hideRedflagAlert() {
  var maskEl = document.getElementById('redflagMask');
  var alertEl = document.getElementById('redflagAlert');
  if (maskEl) maskEl.classList.remove('show');
  if (alertEl) alertEl.classList.remove('show');
}

// ==================== Tab 导航 ====================
function getTabTitle(tab) {
  var titles = {
    muscle: '肌肉',
    diagnosis: '诊断',
    assessment: '评估',
    protocol: '循证方案',
    more: '更多功能'
  };
  return titles[tab] || '肌骨康复速查';
}

function switchTab(tab) {
  currentTab = tab;
  currentMorePage = null;

  // 重置 more 页面内容
  var morePage = document.getElementById('page-more');
  if (morePage && morePage.dataset.originalContent) {
    morePage.innerHTML = morePage.dataset.originalContent;
    delete morePage.dataset.originalContent;
  }

  // 移除动态详情页
  var dynamicIds = ['page-detail', 'page-protocol-detail', 'page-assessment-detail', 'page-assessment-result'];
  dynamicIds.forEach(function(id) {
    var p = document.getElementById(id);
    if (p) p.remove();
  });

  document.querySelectorAll('.tab-item').forEach(function(el) {
    el.classList.remove('active');
    if (el.dataset.tab === tab) el.classList.add('active');
  });
  document.querySelectorAll('.page').forEach(function(el) {
    el.classList.remove('active');
  });
  var page = document.getElementById('page-' + tab);
  if (page) page.classList.add('active');
  document.getElementById('navTitle').textContent = getTabTitle(tab);
  document.getElementById('navBack').style.display = 'none';
  document.getElementById('content').scrollTop = 0;

  if (tab === 'more') renderMoreMenu();
  if (tab === 'protocol') {
    renderProtocolCatBar();
    renderProtocolList();
  }
}

function showPage(pageId, hideCurrent) {
  var targetId = pageId.indexOf('page-') === 0 ? pageId : 'page-' + pageId;
  var target = document.getElementById(targetId);
  if (!target) return;

  document.querySelectorAll('.page').forEach(function(p) {
    if (hideCurrent || p.id !== 'page-' + currentTab) {
      p.classList.remove('active');
    }
  });

  target.classList.add('active');
  target.classList.add('fade-in');
  setTimeout(function() { target.classList.remove('fade-in'); }, 200);
  document.getElementById('content').scrollTop = 0;
}

function goBack() {
  // 尝试移除当前激活的动态详情页
  var dynamicIds = ['page-detail', 'page-protocol-detail', 'page-assessment-detail', 'page-assessment-result'];
  var removed = false;

  for (var i = 0; i < dynamicIds.length; i++) {
    var p = document.getElementById(dynamicIds[i]);
    if (p && p.classList.contains('active')) {
      p.remove();
      removed = true;
      break;
    }
  }

  if (removed) {
    var tabPage = document.getElementById('page-' + currentTab);
    if (tabPage) tabPage.classList.add('active');

    if (currentTab === 'more' && currentMorePage) {
      var moreTitles = { tools: '临床工具', guidelines: '临床指南', dashboard: '数据看板' };
      document.getElementById('navTitle').textContent = moreTitles[currentMorePage] || '更多功能';
      document.getElementById('navBack').style.display = 'flex';
    } else {
      document.getElementById('navTitle').textContent = getTabTitle(currentTab);
      document.getElementById('navBack').style.display = 'none';
    }
    document.getElementById('content').scrollTop = 0;
    return;
  }

  // 从更多子页面返回菜单
  if (currentTab === 'more' && currentMorePage) {
    currentMorePage = null;
    var morePage = document.getElementById('page-more');
    if (morePage && morePage.dataset.originalContent) {
      morePage.innerHTML = morePage.dataset.originalContent;
      delete morePage.dataset.originalContent;
    }
    renderMoreMenu();
    setIcon('moreSectionIcon', 'other', 26);
    document.getElementById('navTitle').textContent = '更多功能';
    document.getElementById('navBack').style.display = 'none';
    document.getElementById('content').scrollTop = 0;
    return;
  }

  // 默认回退
  document.getElementById('navBack').style.display = 'none';
  document.getElementById('navTitle').textContent = getTabTitle(currentTab);
  var tabPage2 = document.getElementById('page-' + currentTab);
  if (tabPage2) tabPage2.classList.add('active');
  document.getElementById('content').scrollTop = 0;
}

// ==================== 更多页面 ====================
function showMoreMenu() {
  switchTab('more');
}

function renderMoreMenu() {
  var container = document.getElementById('moreMenuList');
  if (!container) return;
  var items = [
    { id: 'tools', name: '临床工具', desc: '关节测量、肌力评定等', icon: 'tool' },
    { id: 'guidelines', name: '临床指南', desc: '循证医学指南参考', icon: 'guideline' },
    { id: 'dashboard', name: '数据看板', desc: '评估数据统计分析', icon: 'chart' }
  ];
  container.innerHTML = items.map(function(item) {
    return '<div class="list-item" data-action="show-more-page" data-page="' + escAttr(item.id) + '">' +
      '<span class="icon">' + icon(item.icon, 44) + '</span>' +
      '<div class="list-item-content">' +
        '<div class="list-item-title">' + esc(item.name) + '</div>' +
        '<div class="list-item-desc">' + esc(item.desc) + '</div>' +
      '</div>' +
      '<span class="list-item-arrow">' + icon('chevronRight', 24) + '</span>' +
    '</div>';
  }).join('');
}

function showMorePage(pageId) {
  currentMorePage = pageId;
  var container = document.getElementById('page-more');
  if (!container) return;

  // 保存原始内容
  if (!container.dataset.originalContent) {
    container.dataset.originalContent = container.innerHTML;
  }

  document.getElementById('navBack').style.display = 'flex';
  document.getElementById('content').scrollTop = 0;

  if (pageId === 'tools') {
    document.getElementById('navTitle').textContent = '临床工具';
    container.innerHTML =
      '<div class="section-title"><span class="icon">' + icon('tool', 26) + '</span><span>临床工具</span></div>' +
      '<div class="protocol-cat-bar" id="toolsCategoryBar"></div>' +
      '<div id="toolsList"></div>';
    renderToolsCategoryBar();
    renderToolsList();
  } else if (pageId === 'guidelines') {
    document.getElementById('navTitle').textContent = '临床指南';
    container.innerHTML =
      '<div class="section-title"><span class="icon">' + icon('guideline', 26) + '</span><span>临床指南</span></div>' +
      '<div class="protocol-cat-bar" id="guidelinesCategoryBar"></div>' +
      '<div id="guidelinesList"></div>';
    renderGuidelinesCategoryBar();
    renderGuidelinesList();
  } else if (pageId === 'dashboard') {
    document.getElementById('navTitle').textContent = '数据看板';
    container.innerHTML =
      '<div class="page-head"><div class="page-head-title">' + icon('chart', 24) + ' 数据看板</div>' +
      '<div class="page-head-sub" id="dashboardSubtitle"></div></div>' +
      '<div id="dashboardStats" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;"></div>' +
      '<div class="chart-container"><div class="chart-head"><div class="chart-head-title">' + icon('chart', 22) + ' 月度评估趋势</div>' +
      '<div class="chart-head-sub">近6个月评估次数</div></div><canvas id="dashboardChart" class="chart-canvas"></canvas></div>' +
      '<div class="chart-container"><div class="chart-head"><div class="chart-head-title">' + icon('chart', 22) + ' 评估分布</div></div>' +
      '<div id="dashboardDistChart"></div></div>' +
      '<div class="chart-container"><div class="chart-head"><div class="chart-head-title">' + icon('evidence', 22) + ' 热门量表</div></div>' +
      '<ul id="dashboardRankList" style="list-style:none;padding:0;margin:0;"></ul></div>';
    renderDashboard();
  }
}

// ==================== 肌肉模块 ====================
var muscleBodyPartKeywords = {
  'neck': ['头颈', '头部'],
  'upperarm': ['肩', '上肢'],
  'back': ['背'],
  'trunk': ['胸', '腹', '膈'],
  'forearm': ['前臂', '手'],
  'pelvis': ['腰', '臀', '骨盆', '盆底'],
  'thigh': ['大腿'],
  'lowerleg': ['小腿', '足']
};

function renderMuscleBodyGrid() {
  var grid = document.getElementById('muscleBodyGrid');
  var list = document.getElementById('muscleList');
  if (!grid) return;
  var search = ((document.getElementById('muscleSearch') || {}).value || '').toLowerCase();

  if (typeof muscleBodyParts === 'undefined' || typeof muscles === 'undefined') {
    grid.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>数据加载中...</div>';
    if (list) list.innerHTML = '';
    return;
  }

  // 计算每个身体部位的实际肌肉数量
  var regionCounts = {};
  muscleBodyParts.forEach(function(bp) {
    var keywords = muscleBodyPartKeywords[bp.id] || [bp.name];
    var count = muscles.filter(function(m) {
      var region = m['身体区域'] || '';
      return keywords.some(function(kw) { return region.indexOf(kw) >= 0; });
    }).length;
    regionCounts[bp.id] = count;
  });

  var filteredParts = muscleBodyParts.filter(function(bp) {
    if (!search) return true;
    return bp.name.toLowerCase().indexOf(search) >= 0 || fuzzyMatch(bp.name.toLowerCase(), search);
  });

  // 搜索时直接显示肌肉列表
  if (search) {
    grid.innerHTML = '';
    renderMuscleList();
    return;
  }

  if (filteredParts.length === 0) {
    grid.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>未找到匹配区域</div>';
    if (list) list.innerHTML = '';
    return;
  }

  grid.innerHTML = filteredParts.map(function(bp) {
    var activeClass = currentMuscleRegion === bp.id ? ' active' : '';
    return '<div class="body-card' + activeClass + '" data-action="select-muscle-region" data-region="' + escAttr(bp.id) + '">' +
      '<span class="icon">' + icon(bp.icon, 48) + '</span>' +
      '<span class="body-card-name">' + esc(bp.name || '') + '</span>' +
      '<span class="body-card-count mono">' + esc(String(regionCounts[bp.id] || 0)) + ' 个肌肉</span>' +
    '</div>';
  }).join('');

  if (!currentMuscleRegion) {
    renderMuscleList();
  } else {
    if (list) list.innerHTML = '';
  }
}

function selectMuscleRegion(regionId) {
  currentMuscleRegion = currentMuscleRegion === regionId ? '' : regionId;
  renderMuscleBodyGrid();
  renderMuscleList();
  if (currentMuscleRegion) {
    var list = document.getElementById('muscleList');
    if (list) {
      try { list.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e) {}
    }
  }
}

function renderMuscleList() {
  var list = document.getElementById('muscleList');
  if (!list) return;
  var search = ((document.getElementById('muscleSearch') || {}).value || '').toLowerCase();

  if (typeof muscles === 'undefined') {
    list.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>数据加载中...</div>';
    return;
  }

  var filtered = muscles.filter(function(m) {
    var keywords = currentMuscleRegion ? (muscleBodyPartKeywords[currentMuscleRegion] || []) : null;
    var regionMatch = !keywords || keywords.some(function(kw) {
      return (m['身体区域'] || '').indexOf(kw) >= 0;
    });
    var searchMatch = !search ||
      (m['肌肉名称'] || '').toLowerCase().indexOf(search) >= 0 ||
      (m['主要功能'] || '').toLowerCase().indexOf(search) >= 0 ||
      fuzzyMatch((m['肌肉名称'] || '').toLowerCase(), search);
    return regionMatch && searchMatch;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>未找到匹配肌肉</div>';
    return;
  }

  list.innerHTML = filtered.map(function(m) {
    var name = m['肌肉名称'] || '';
    var highlightedName = search ? highlightKeyword(name, search) : esc(name);
    return '<div class="list-item" data-action="show-muscle-detail" data-name="' + escAttr(name) + '">' +
      '<span class="icon">' + icon('muscle', 44) + '</span>' +
      '<div class="list-item-content">' +
        '<div class="list-item-title">' + highlightedName + '</div>' +
        '<div class="list-item-desc">' + esc(m['主要功能'] || '') + '</div>' +
      '</div>' +
      '<span class="list-item-arrow">' + icon('chevronRight', 24) + '</span>' +
    '</div>';
  }).join('');
}

function showMuscleDetail(name) {
  if (typeof muscles === 'undefined') return;
  var muscle = muscles.find(function(m) { return m['肌肉名称'] === name; });
  if (!muscle) return;

  saveSearchHistory('muscle', name);

  showPage('detail', true);

  var container = document.getElementById('page-detail');
  if (!container) {
    container = document.createElement('div');
    container.className = 'page';
    container.id = 'page-detail';
    document.getElementById('content').appendChild(container);
  }

  document.getElementById('navTitle').textContent = muscle['肌肉名称'];
  document.getElementById('navBack').style.display = 'flex';

  var sections = [
    {
      id: 'basic', title: '基本信息', icon: 'info', preview: '功能、损伤、触发点...',
      fields: ['主要功能', '常见损伤', '激痛点', '身体区域']
    },
    {
      id: 'assessment', title: '评估与诊断', icon: 'assessment', preview: '评估方法、诊断标准、影像学...',
      fields: ['评估方法', '诊断标准', '影像学特征', '鉴别诊断', '常用评估量表']
    },
    {
      id: 'treatment', title: '治疗方案', icon: 'treatment', preview: '急性期处理、康复训练、重返标准...',
      fields: ['急性期处理', '康复训练', '治疗方案', '药物治疗', '注射治疗', '手术指征', '重返标准', '循证等级']
    },
    {
      id: 'redflag', title: '红黄牌警示', icon: 'warning', preview: '治疗禁忌、红旗征...',
      fields: ['治疗禁忌', '康复禁忌动作', '红旗征', '红旗征/紧急预警']
    }
  ];

  var sectionsHtml = sections.map(function(s, idx) {
    var isOpen = idx === 0;
    var fieldsHtml = s.fields.map(function(f) {
      var val = muscle[f];
      if (!val || val === '暂无') return '';
      return '<div class="field-row"><div class="field-label">' + esc(f) + '</div><div class="field-value">' + esc(val) + '</div></div>';
    }).join('');
    if (!fieldsHtml) return '';
    return '<div class="accordion-item' + (isOpen ? ' open' : '') + '" data-section="' + s.id + '">' +
      '<div class="accordion-header" data-action="toggle-accordion" data-section="' + escAttr(s.id) + '">' +
        '<div class="accordion-header-top">' +
          '<span class="icon">' + icon(s.icon, 28) + '</span>' +
          '<span class="accordion-title">' + esc(s.title) + '</span>' +
          '<span class="accordion-chevron">' + icon('chevronDown', 24) + '</span>' +
        '</div>' +
        '<div class="accordion-preview">' + esc(s.preview) + '</div>' +
      '</div>' +
      '<div class="accordion-body">' +
        '<div class="accordion-content">' + fieldsHtml + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = '<div class="detail-header">' +
    '<div class="detail-header-title">' + esc(muscle['肌肉名称'] || '') + '</div>' +
    '<div class="detail-header-sub">' + esc(muscle['身体区域'] || '') + '</div>' +
    '<div class="detail-tags">' +
      '<span class="detail-tag">' + esc(muscle['主要功能'] || '') + '</span>' +
      '<span class="detail-tag">' + esc(muscle['常见损伤'] || '') + '</span>' +
    '</div>' +
  '</div>' +
  '<div class="quick-nav">' +
    '<div class="quick-nav-item active" data-action="toggle-accordion" data-section="basic">基本信息</div>' +
    '<div class="quick-nav-item" data-action="toggle-accordion" data-section="assessment">评估诊断</div>' +
    '<div class="quick-nav-item" data-action="toggle-accordion" data-section="treatment">治疗方案</div>' +
    '<div class="quick-nav-item" data-action="toggle-accordion" data-section="redflag">红黄牌</div>' +
  '</div>' + sectionsHtml;

  container.classList.add('active');
  container.classList.add('fade-in');
  setTimeout(function() { container.classList.remove('fade-in'); }, 200);
  document.getElementById('content').scrollTop = 0;

  // 红旗征检查
  var redflagContent = muscle['红旗征'] || muscle['红旗征/紧急预警'] || '';
  if (redflagContent && redflagContent !== '暂无' && redflagContent.trim()) {
    setTimeout(function() {
      showRedflagAlert('红旗征警示',
        buildRedflagContent(muscle['肌肉名称'] + ' 存在以下红旗征', redflagContent, '请务必在临床实践中注意排查以上警示情况。'));
    }, 300);
  }
}

function toggleAccordion(section) {
  if (!section || !/^[\w-]+$/.test(section)) return;
  var item = document.querySelector('.accordion-item[data-section="' + section + '"]');
  if (item) {
    item.classList.toggle('open');
  }
  document.querySelectorAll('.quick-nav-item').forEach(function(el) {
    el.classList.remove('active');
    if (el.dataset.section === section) el.classList.add('active');
  });
}

// ==================== 诊断模块 ====================
var diseaseBodyPartKeywords = {
  'cervical': ['颈椎'],
  'thoracic': ['胸椎'],
  'lumbar': ['腰椎'],
  'shoulder': ['肩关节'],
  'elbow': ['肘关节'],
  'wrist': ['腕关节'],
  'hip-pelvis': ['髋', '骨盆'],
  'knee': ['膝关节'],
  'ankle': ['脚踝', '踝']
};

function renderDiseaseBodyGrid() {
  var grid = document.getElementById('diseaseBodyGrid');
  var list = document.getElementById('diseaseList');
  if (!grid) return;
  var search = ((document.getElementById('diagnosisSearch') || {}).value || '').toLowerCase();

  if (typeof diseaseBodyParts === 'undefined' || typeof diseases === 'undefined') {
    grid.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>数据加载中...</div>';
    if (list) list.innerHTML = '';
    return;
  }

  var regionCounts = {};
  diseaseBodyParts.forEach(function(bp) {
    var keywords = diseaseBodyPartKeywords[bp.id] || [bp.name];
    var count = diseases.filter(function(d) {
      var part = d['部位'] || '';
      return keywords.some(function(kw) { return part.indexOf(kw) >= 0; });
    }).length;
    regionCounts[bp.id] = count;
  });

  var filteredParts = diseaseBodyParts.filter(function(bp) {
    if (!search) return true;
    return bp.name.toLowerCase().indexOf(search) >= 0 || fuzzyMatch(bp.name.toLowerCase(), search);
  });

  if (search) {
    grid.innerHTML = '';
    renderDiseaseList();
    return;
  }

  if (filteredParts.length === 0) {
    grid.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>未找到匹配区域</div>';
    if (list) list.innerHTML = '';
    return;
  }

  grid.innerHTML = filteredParts.map(function(bp) {
    var activeClass = currentDiseaseRegion === bp.id ? ' active' : '';
    return '<div class="body-card' + activeClass + '" data-action="select-disease-region" data-region="' + escAttr(bp.id) + '">' +
      '<span class="icon">' + icon(bp.icon, 48) + '</span>' +
      '<span class="body-card-name">' + esc(bp.name || '') + '</span>' +
      '<span class="body-card-count mono">' + esc(String(regionCounts[bp.id] || 0)) + ' 个疾病</span>' +
    '</div>';
  }).join('');

  if (!currentDiseaseRegion) {
    renderDiseaseList();
  } else {
    if (list) list.innerHTML = '';
  }
}

function selectDiseaseRegion(regionId) {
  currentDiseaseRegion = currentDiseaseRegion === regionId ? '' : regionId;
  renderDiseaseBodyGrid();
  renderDiseaseList();
  if (currentDiseaseRegion) {
    var list = document.getElementById('diseaseList');
    if (list) {
      try { list.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e) {}
    }
  }
}

function renderDiseaseList() {
  var list = document.getElementById('diseaseList');
  if (!list) return;
  var search = ((document.getElementById('diagnosisSearch') || {}).value || '').toLowerCase();

  if (typeof diseases === 'undefined') {
    list.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>数据加载中...</div>';
    return;
  }

  var filtered = diseases.filter(function(d) {
    var keywords = currentDiseaseRegion ? (diseaseBodyPartKeywords[currentDiseaseRegion] || []) : null;
    var regionMatch = !keywords || keywords.some(function(kw) {
      return (d['部位'] || '').indexOf(kw) >= 0;
    });
    var name = d['具体病症'] || '';
    var searchMatch = !search ||
      name.toLowerCase().indexOf(search) >= 0 ||
      (d['疾病分类'] || '').toLowerCase().indexOf(search) >= 0 ||
      fuzzyMatch(name.toLowerCase(), search);
    return regionMatch && searchMatch;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>未找到匹配疾病</div>';
    return;
  }

  list.innerHTML = filtered.map(function(d) {
    var name = d['具体病症'] || '';
    var highlightedName = search ? highlightKeyword(name, search) : esc(name);
    return '<div class="list-item" data-action="show-disease-detail" data-name="' + escAttr(name) + '">' +
      '<span class="icon">' + icon('diagnosis', 44) + '</span>' +
      '<div class="list-item-content">' +
        '<div class="list-item-title">' + highlightedName + '</div>' +
        '<div class="list-item-desc">' + esc(d['疾病分类'] || '') + '</div>' +
      '</div>' +
      '<span class="list-item-arrow">' + icon('chevronRight', 24) + '</span>' +
    '</div>';
  }).join('');
}

function showDiseaseDetail(name) {
  if (typeof diseases === 'undefined') return;
  var disease = diseases.find(function(d) { return d['具体病症'] === name; });
  if (!disease) return;

  saveSearchHistory('diagnosis', name);

  showPage('detail', true);

  var container = document.getElementById('page-detail');
  if (!container) {
    container = document.createElement('div');
    container.className = 'page';
    container.id = 'page-detail';
    document.getElementById('content').appendChild(container);
  }

  document.getElementById('navTitle').textContent = disease['具体病症'];
  document.getElementById('navBack').style.display = 'flex';

  var sections = [
    {
      id: 'symptoms', title: '症状与体征', icon: 'warning', preview: '典型症状、分类、分级...',
      fields: ['典型症状与体征', '疾病分类', '疾病分级', '分期/严重度分级']
    },
    {
      id: 'imaging', title: '影像学检查', icon: 'search', preview: '影像学特征...',
      fields: ['影像学特征']
    },
    {
      id: 'diagnosis', title: '鉴别诊断', icon: 'diagnosis', preview: '鉴别诊断...',
      fields: ['鉴别诊断', 'ICD-10编码']
    },
    {
      id: 'assessment', title: '评估量表', icon: 'assessment', preview: '常用评估量表...',
      fields: ['常用评估量表']
    },
    {
      id: 'treatment', title: '治疗方案', icon: 'treatment', preview: '治疗方案、药物、手术...',
      fields: ['治疗方案', '药物治疗', '注射治疗', '手术指征', '康复训练方案']
    },
    {
      id: 'redflag', title: '红黄牌警示', icon: 'warning', preview: '红旗征、紧急预警...',
      fields: ['红旗征/紧急预警', '康复禁忌动作', '特殊人群适配']
    }
  ];

  var sectionsHtml = sections.map(function(s, idx) {
    var isOpen = idx === 0;
    var fieldsHtml = s.fields.map(function(f) {
      var val = disease[f];
      if (!val || val === '暂无') return '';
      return '<div class="field-row"><div class="field-label">' + esc(f) + '</div><div class="field-value">' + esc(val) + '</div></div>';
    }).join('');
    if (!fieldsHtml) return '';
    return '<div class="accordion-item' + (isOpen ? ' open' : '') + '" data-section="' + s.id + '">' +
      '<div class="accordion-header" data-action="toggle-accordion" data-section="' + escAttr(s.id) + '">' +
        '<div class="accordion-header-top">' +
          '<span class="icon">' + icon(s.icon, 28) + '</span>' +
          '<span class="accordion-title">' + esc(s.title) + '</span>' +
          '<span class="accordion-chevron">' + icon('chevronDown', 24) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="accordion-body">' +
        '<div class="accordion-content">' + fieldsHtml + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = '<div class="detail-header">' +
    '<div class="detail-header-title">' + esc(disease['具体病症'] || '') + '</div>' +
    '<div class="detail-header-sub">' + esc(disease['部位'] || '') + ' · ' + esc(disease['疾病分类'] || '') + '</div>' +
    '<div class="detail-tags">' +
      '<span class="detail-tag">' + esc(disease['疾病分级'] || '') + '</span>' +
      '<span class="detail-tag">' + esc(disease['ICD-10编码'] || '') + '</span>' +
    '</div>' +
  '</div>' + sectionsHtml;

  container.classList.add('active');
  container.classList.add('fade-in');
  setTimeout(function() { container.classList.remove('fade-in'); }, 200);
  document.getElementById('content').scrollTop = 0;

  // 红旗征检查
  var redflagContent = disease['红旗征/紧急预警'] || '';
  if (redflagContent && redflagContent !== '暂无' && redflagContent.trim()) {
    setTimeout(function() {
      showRedflagAlert('红旗征警示',
        buildRedflagContent(disease['具体病症'] + ' 存在以下红旗征/紧急预警', redflagContent, '出现以上情况时需紧急处理或转诊。'));
    }, 300);
  }
}

// ==================== 评估模块 ====================
function switchAssessmentTab(tab) {
  currentScaleTab = tab;
  document.querySelectorAll('.tab-btn').forEach(function(el) {
    el.classList.remove('active');
  });
  var btn = document.getElementById('btnScale' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (btn) btn.classList.add('active');

  var listEl = document.getElementById('scaleListContent');
  var historyEl = document.getElementById('scaleHistoryContent');
  var chartEl = document.getElementById('scaleChartContent');
  if (listEl) listEl.style.display = tab === 'list' ? 'block' : 'none';
  if (historyEl) historyEl.style.display = tab === 'history' ? 'block' : 'none';
  if (chartEl) chartEl.style.display = tab === 'chart' ? 'block' : 'none';

  if (tab === 'history') renderAssessmentHistory();
  if (tab === 'chart') renderAssessmentChart();
}

function renderScaleList() {
  var container = document.getElementById('scaleListContent');
  if (!container) return;
  var search = ((document.getElementById('assessmentSearch') || {}).value || '').toLowerCase();

  if (typeof assessmentScales === 'undefined') {
    container.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>数据加载中...</div>';
    return;
  }

  var filtered = assessmentScales.filter(function(s) {
    return !search ||
      (s.name || '').toLowerCase().indexOf(search) >= 0 ||
      (s.description || '').toLowerCase().indexOf(search) >= 0 ||
      fuzzyMatch((s.name || '').toLowerCase(), search);
  });

  var grouped = {};
  filtered.forEach(function(s) {
    var cat = s.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  var html = '';
  for (var cat in grouped) {
    var catInfo;
    if (typeof scaleCategoryInfo !== 'undefined' && scaleCategoryInfo[cat]) {
      catInfo = scaleCategoryInfo[cat];
    } else {
      catInfo = { name: '其他', icon: 'other' };
    }
    html += '<div class="scale-category">' +
      '<div class="scale-category-title">' +
        '<span class="icon">' + icon(catInfo.icon, 22) + '</span>' +
        '<span>' + esc(catInfo.name) + '</span>' +
      '</div>';

    html += grouped[cat].map(function(s) {
      var name = s.name || '';
      var highlightedName = search ? highlightKeyword(name, search) : esc(name);
      return '<div class="list-item" data-action="start-assessment" data-id="' + escAttr(s.id) + '">' +
        '<span class="icon">' + icon('assessment', 44) + '</span>' +
        '<div class="list-item-content">' +
          '<div class="list-item-title">' + highlightedName + '</div>' +
          '<div class="list-item-desc">' + esc(s.description || '') + '</div>' +
        '</div>' +
        '<span class="list-item-arrow">' + icon('chevronRight', 24) + '</span>' +
      '</div>';
    }).join('');
    html += '</div>';
  }

  if (!html) {
    html = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>未找到匹配量表</div>';
  }

  container.innerHTML = html;
}

function startAssessmentByName(name) {
  if (typeof assessmentScales === 'undefined') return;
  var scale = assessmentScales.find(function(s) { return s.name === name; });
  if (scale) startAssessment(scale.id);
}

function startAssessment(scaleId) {
  if (typeof assessmentScales === 'undefined') return;
  var scale = assessmentScales.find(function(s) { return s.id === scaleId; });
  if (!scale) return;

  currentScaleId = scaleId;
  currentAssessmentQuestionIdx = 0;
  currentAssessmentAnswers = [];

  showPage('assessment-detail', true);

  var container = document.getElementById('page-assessment-detail');
  if (!container) {
    container = document.createElement('div');
    container.className = 'page';
    container.id = 'page-assessment-detail';
    document.getElementById('content').appendChild(container);
  }

  document.getElementById('navTitle').textContent = scale.name;
  document.getElementById('navBack').style.display = 'flex';

  container.innerHTML = '<div class="detail-header">' +
    '<div class="detail-header-title">' + esc(scale.name || '') + '</div>' +
    '<div class="detail-header-sub">' + esc(scale.description || '') + '</div>' +
  '</div>' +
  '<div class="info-banner">' +
    '信度：' + esc(scale.reliability || '暂无') + ' | 参考：' + esc(scale.reference || '暂无') +
  '</div>' +
  '<div id="assessmentQuestionContainer"></div>';

  container.classList.add('active');
  container.classList.add('fade-in');
  setTimeout(function() { container.classList.remove('fade-in'); }, 200);

  showAssessmentQuestion();
}

function showAssessmentQuestion() {
  if (typeof assessmentScales === 'undefined') return;
  var scale = assessmentScales.find(function(s) { return s.id === currentScaleId; });
  if (!scale) return;

  var container = document.getElementById('assessmentQuestionContainer');
  if (!container) return;

  var html = '';

  if (scale.type === 'slider') {
    var sliderVal = currentAssessmentAnswers[0] || 0;
    html = '<div class="scale-question">' +
      '<div class="scale-question-num">评估项</div>' +
      '<div class="scale-question-text">' + esc(scale.question || '') + '</div>' +
      '<div class="scale-slider-labels">' + esc(scale.labels ? scale.labels[0] : '') + ' · 0</div>' +
      '<div class="scale-slider">' +
        '<input type="range" id="scaleSlider" data-input-type="slider" min="0" max="' + escAttr(String(scale.totalScore)) + '" step="1" value="' + escAttr(String(sliderVal)) + '">' +
      '</div>' +
      '<div class="scale-score-display mono" id="scaleScoreDisplay">' + esc(String(sliderVal)) + '</div>' +
      '<div class="scale-slider-labels">' + esc(scale.labels ? scale.labels[1] : '') + ' · ' + esc(String(scale.totalScore)) + '</div>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button class="btn btn-outline" data-action="go-back">取消</button>' +
      '<button class="btn btn-primary" data-action="submit-assessment">提交评估</button>' +
    '</div>';
  } else if (scale.type === 'number') {
    var numVal = currentAssessmentAnswers[0] !== undefined ? currentAssessmentAnswers[0] : '';
    html = '<div class="scale-question">' +
      '<div class="scale-question-num">评估项</div>' +
      '<div class="scale-question-text">' + esc(scale.question || '') + '</div>' +
      '<input type="number" id="scaleNumber" data-input-type="number" min="' + escAttr(String(scale.min || 0)) + '" max="' + escAttr(String(scale.max || 10)) + '" class="form-input" placeholder="请输入数值" value="' + escAttr(String(numVal)) + '">' +
      '<div class="scale-score-display mono" id="scaleScoreDisplay">' + esc(String(numVal || 0)) + '</div>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button class="btn btn-outline" data-action="go-back">取消</button>' +
      '<button class="btn btn-primary" data-action="submit-assessment">提交评估</button>' +
    '</div>';
  } else if (scale.type === 'choice') {
    var totalQ = scale.questions.length;
    var q = scale.questions[currentAssessmentQuestionIdx];
    var isLast = currentAssessmentQuestionIdx === totalQ - 1;

    var dots = '';
    for (var i = 0; i < totalQ; i++) {
      var dotClass = 'progress-dot';
      if (i < currentAssessmentQuestionIdx) dotClass += ' completed';
      else if (i === currentAssessmentQuestionIdx) dotClass += ' active';
      dots += '<div class="' + dotClass + '"></div>';
    }

    html = '<div class="progress-indicator">' + dots + '</div>' +
      '<div class="scale-question">' +
        '<div class="scale-question-num">第 <span class="mono">' + (currentAssessmentQuestionIdx + 1) + '</span> / <span class="mono">' + totalQ + '</span> 题</div>' +
        '<div class="scale-question-text">' + esc(q.text) + '</div>' +
        '<div class="scale-options">' +
          q.options.map(function(o, j) {
            var selected = currentAssessmentAnswers[currentAssessmentQuestionIdx] === q.scores[j] ? ' selected' : '';
            return '<div class="scale-option' + selected + '" data-action="select-choice-option" data-idx="' + j + '" data-score="' + q.scores[j] + '">' + esc(o) + '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="btn-row">';
    if (currentAssessmentQuestionIdx > 0) {
      html += '<button class="btn btn-outline" data-action="prev-assessment">上一题</button>';
    } else {
      html += '<button class="btn btn-outline" data-action="go-back">取消</button>';
    }
    if (isLast) {
      html += '<button class="btn btn-primary" data-action="submit-assessment">提交评估</button>';
    } else {
      html += '<button class="btn btn-primary" data-action="next-assessment">下一题</button>';
    }
    html += '</div>';
  } else if (scale.type === 'yesno') {
    var totalY = scale.questions.length;
    var qText = scale.questions[currentAssessmentQuestionIdx];
    var isLastY = currentAssessmentQuestionIdx === totalY - 1;

    var dotsY = '';
    for (var i = 0; i < totalY; i++) {
      var dotClassY = 'progress-dot';
      if (i < currentAssessmentQuestionIdx) dotClassY += ' completed';
      else if (i === currentAssessmentQuestionIdx) dotClassY += ' active';
      dotsY += '<div class="' + dotClassY + '"></div>';
    }

    var selectedY = currentAssessmentAnswers[currentAssessmentQuestionIdx];
    html = '<div class="progress-indicator">' + dotsY + '</div>' +
      '<div class="scale-question">' +
        '<div class="scale-question-num">第 <span class="mono">' + (currentAssessmentQuestionIdx + 1) + '</span> / <span class="mono">' + totalY + '</span> 题</div>' +
        '<div class="scale-question-text">' + esc(qText) + '</div>' +
        '<div class="scale-options">' +
          '<div class="scale-option' + (selectedY === true ? ' selected' : '') + '" data-action="select-yesno" data-val="true">是</div>' +
          '<div class="scale-option' + (selectedY === false ? ' selected' : '') + '" data-action="select-yesno" data-val="false">否</div>' +
        '</div>' +
      '</div>' +
      '<div class="btn-row">';
    if (currentAssessmentQuestionIdx > 0) {
      html += '<button class="btn btn-outline" data-action="prev-assessment">上一题</button>';
    } else {
      html += '<button class="btn btn-outline" data-action="go-back">取消</button>';
    }
    if (isLastY) {
      html += '<button class="btn btn-primary" data-action="submit-assessment">提交评估</button>';
    } else {
      html += '<button class="btn btn-primary" data-action="next-assessment">下一题</button>';
    }
    html += '</div>';
  }

  container.innerHTML = html;

  // 为新插入的输入控件绑定input事件（替代内联oninput）
  var slider = document.getElementById('scaleSlider');
  if (slider) {
    slider.addEventListener('input', function() { updateSliderValue(this.value); });
  }
  var numIn = document.getElementById('scaleNumber');
  if (numIn) {
    numIn.addEventListener('input', function() { updateNumberValue(this.value); });
  }

  document.getElementById('content').scrollTop = 0;
}

function updateSliderValue(val) {
  var display = document.getElementById('scaleScoreDisplay');
  if (display) display.textContent = val;
  currentAssessmentAnswers = [parseFloat(val)];
}

function updateNumberValue(val) {
  var display = document.getElementById('scaleScoreDisplay');
  if (display) display.textContent = val || 0;
  currentAssessmentAnswers = [parseFloat(val) || 0];
}

function selectChoiceOption(optionIdx, score) {
  currentAssessmentAnswers[currentAssessmentQuestionIdx] = score;
  var options = document.querySelectorAll('.scale-option');
  options.forEach(function(o) { o.classList.remove('selected'); });
  if (options[optionIdx]) options[optionIdx].classList.add('selected');

  if (typeof assessmentScales === 'undefined') return;
  var scale = assessmentScales.find(function(s) { return s.id === currentScaleId; });
  if (!scale || !scale.questions) return;
  if (currentAssessmentQuestionIdx < scale.questions.length - 1) {
    setTimeout(function() { nextAssessmentQuestion(); }, 300);
  }
}

function selectYesNoOption(answer) {
  currentAssessmentAnswers[currentAssessmentQuestionIdx] = answer;
  var options = document.querySelectorAll('.scale-option');
  options.forEach(function(o) { o.classList.remove('selected'); });
  if (answer && options[0]) options[0].classList.add('selected');
  else if (!answer && options[1]) options[1].classList.add('selected');

  if (typeof assessmentScales === 'undefined') return;
  var scale = assessmentScales.find(function(s) { return s.id === currentScaleId; });
  if (!scale || !scale.questions) return;
  if (currentAssessmentQuestionIdx < scale.questions.length - 1) {
    setTimeout(function() { nextAssessmentQuestion(); }, 300);
  }
}

function nextAssessmentQuestion() {
  if (typeof assessmentScales === 'undefined') return;
  var scale = assessmentScales.find(function(s) { return s.id === currentScaleId; });
  if (!scale || !scale.questions) return;
  if (currentAssessmentQuestionIdx < scale.questions.length - 1) {
    currentAssessmentQuestionIdx++;
    showAssessmentQuestion();
  }
}

function prevAssessmentQuestion() {
  if (currentAssessmentQuestionIdx > 0) {
    currentAssessmentQuestionIdx--;
    showAssessmentQuestion();
  }
}

function submitAssessment() {
  if (typeof assessmentScales === 'undefined') return;
  var scale = assessmentScales.find(function(s) { return s.id === currentScaleId; });
  if (!scale) return;

  // 验证答案完整性
  if (scale.type === 'choice' || scale.type === 'yesno') {
    for (var i = 0; i < scale.questions.length; i++) {
      if (currentAssessmentAnswers[i] === undefined) {
        alert('请完成第 ' + (i + 1) + ' 题的作答');
        currentAssessmentQuestionIdx = i;
        showAssessmentQuestion();
        return;
      }
    }
  } else if (scale.type === 'slider' || scale.type === 'number') {
    if (currentAssessmentAnswers[0] === undefined) {
      alert('请先完成评估');
      return;
    }
  }

  var result = scale.calculate(currentAssessmentAnswers);
  var score = result.score;
  var maxScore = result.maxScore || scale.totalScore;

  var interp = scale.interpretation.find(function(item) {
    return score >= item.min && score <= item.max;
  }) || { level: '未知', color: 'warning', desc: '无法评估' };

  var record = {
    id: Date.now().toString(),
    scaleId: scale.id,
    scaleName: scale.name,
    score: score,
    maxScore: maxScore,
    level: interp.level,
    date: new Date().toISOString(),
    category: scale.category
  };

  var history = getAssessmentHistory();
  history.unshift(record);
  localStorage.setItem('assessmentHistory', JSON.stringify(history));

  // 保存搜索历史
  saveSearchHistory('assessment', scale.name);

  // 红旗征检查：结果为危险级别
  if (interp.color === 'danger') {
    setTimeout(function() {
      showRedflagAlert('评估结果警示',
        '<p><strong>' + esc(scale.name) + '</strong> 评估结果为：<strong>' + esc(interp.level) + '</strong></p>' +
        '<p style="margin-top:8px;">' + esc(interp.desc || '无法评估') + '</p>' +
        '<p style="margin-top:8px;color:var(--danger);font-weight:600;">建议尽快就医，寻求专业医疗帮助。</p>');
    }, 300);
  }

  // PHQ-9 特殊检查：第9题（自伤念头）
  if (scale.id === 'phq9' && currentAssessmentAnswers[8] > 0) {
    setTimeout(function() {
      showRedflagAlert('自杀风险警示',
        '<p>PHQ-9 第9题（自伤/自杀念头）评分为 <strong class="mono">' + esc(String(currentAssessmentAnswers[8])) + '</strong> 分。</p>' +
        '<p style="margin-top:8px;color:var(--danger);font-weight:600;">此为红旗征，需立即进行心理危机干预。</p>' +
        '<p style="margin-top:8px;">请立即联系精神科医生或心理危机干预热线。</p>');
    }, 600);
  }

  showAssessmentResult(record, interp, scale);
}

function showAssessmentResult(record, interp, scale) {
  var container = document.getElementById('page-assessment-result');
  if (!container) {
    container = document.createElement('div');
    container.className = 'page';
    container.id = 'page-assessment-result';
    document.getElementById('content').appendChild(container);
  }

  // 隐藏评估详情页
  var detailPage = document.getElementById('page-assessment-detail');
  if (detailPage) detailPage.classList.remove('active');

  document.getElementById('navTitle').textContent = '评估结果';
  document.getElementById('navBack').style.display = 'flex';

  // 三层信息架构
  // 第一层：摘要 - 大字得分
  var safeColor = /^(good|warning|danger)$/.test(interp.color) ? interp.color : 'warning';
  var summaryHtml = '<div class="info-layer-summary">' +
    '<div class="info-layer-summary-label">' + esc(record.scaleName || '') + ' 评估结果</div>' +
    '<div class="info-layer-summary-value mono">' + esc(String(record.score)) + '<small style="font-size:16px;color:var(--text-3);"> / ' + esc(String(record.maxScore)) + '</small></div>' +
    '<div class="result-level ' + escAttr(safeColor) + '" style="margin-top:10px;">' + esc(interp.level || '未知') + '</div>' +
  '</div>';

  // 第二层：详情 - 详细解读
  var detailHtml = '<div class="info-layer-detail">' +
    '<div class="result-detail-title">' + icon('assessment', 22) + ' 详细解读</div>' +
    '<div style="font-size:15px;color:var(--text-2);line-height:1.8;">' +
      '<p style="margin-bottom:10px;">' + esc(interp.desc || '无法评估') + '</p>' +
      '<div class="field-row"><div class="field-label">本次得分</div><div class="field-value"><span class="mono">' + esc(String(record.score)) + '</span> / <span class="mono">' + esc(String(record.maxScore)) + '</span> 分</div></div>' +
      '<div class="field-row"><div class="field-label">评估级别</div><div class="field-value">' + esc(interp.level || '未知') + '</div></div>' +
      '<div class="field-row"><div class="field-label">评估时间</div><div class="field-value">' + esc(new Date(record.date).toLocaleString()) + '</div></div>' +
    '</div>' +
  '</div>';

  // 第三层：解释 - 建议与说明
  var explainHtml = '<div class="info-layer-explain">' +
    '<strong>临床建议</strong><br>' +
    '请结合临床实际情况综合判断评估结果。如结果提示中重度问题，建议咨询专业医师进行进一步检查和制定个体化康复方案。' +
    (scale && scale.reliability ? '<br><br><strong>量表信度：</strong>' + esc(scale.reliability) : '') +
    (scale && scale.reference ? '<br><strong>参考标准：</strong>' + esc(scale.reference) : '') +
  '</div>';

  container.innerHTML = summaryHtml + detailHtml + explainHtml +
    '<div class="btn-row">' +
      '<button class="btn btn-outline" data-action="go-back">返回</button>' +
      '<button class="btn btn-primary" data-action="switch-tab" data-tab="assessment">继续评估</button>' +
    '</div>';

  container.classList.add('active');
  container.classList.add('fade-in');
  setTimeout(function() { container.classList.remove('fade-in'); }, 200);
  document.getElementById('content').scrollTop = 0;
}

function renderAssessmentHistory() {
  var container = document.getElementById('scaleHistoryContent');
  if (!container) return;
  var history = getAssessmentHistory();

  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state-guide">' +
      '<div class="empty-state-guide-icon">📋</div>' +
      '<div class="empty-state-guide-title">暂无评估记录</div>' +
      '<div class="empty-state-guide-desc">完成量表评估后，记录将保存在这里</div>' +
      '<button class="btn btn-primary empty-state-btn" data-action="go-to-assessment-list">' +
        icon('assessment', 16) + ' 开始评估' +
      '</button>' +
    '</div>';
    return;
  }

  container.innerHTML = history.map(function(r) {
    var colorClass;
    if (r.level === '无痛' || r.level === '正常' || r.level === '轻度' || r.level === '轻度疼痛' ||
        r.level === '轻微疼痛' || r.level === '轻微功能障碍' || r.level === '无功能障碍' ||
        r.level === '无焦虑症状' || r.level === '无抑郁症状' || r.level === '轻度焦虑' || r.level === '轻度抑郁' ||
        r.level === '优' || r.level === '良' || r.level === '无功能障碍' || r.level === '正常') {
      colorClass = 'good';
    } else if (r.level === '中度' || r.level === '中度疼痛' || r.level === '中度功能障碍' ||
               r.level === '中度焦虑' || r.level === '中度抑郁' || r.level === '中重度抑郁' ||
               r.level === '可' || r.level === '重度功能障碍' || r.level === '轻度功能障碍') {
      colorClass = 'warning';
    } else {
      colorClass = 'danger';
    }
    return '<div class="history-card ' + colorClass + '" data-action="show-assessment-detail" data-id="' + escAttr(r.id) + '">' +
      '<div class="history-card-top">' +
        '<div class="history-card-name">' + esc(r.scaleName) + '</div>' +
        '<div class="status-tag status-' + escAttr(colorClass) + '">' + esc(r.level) + '</div>' +
      '</div>' +
      '<div class="history-card-body">' +
        '<span class="history-card-score">' + esc(String(r.score)) + '</span>' +
        '<span class="history-card-max">/ ' + esc(String(r.maxScore)) + '</span>' +
      '</div>' +
      '<div class="history-card-meta">' +
        '<span class="history-card-meta-item">' + icon('calendar', 14) + ' ' + esc(new Date(r.date).toLocaleDateString()) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

function showAssessmentDetail(id) {
  var history = getAssessmentHistory();
  var record = history.find(function(r) { return r.id === id; });
  if (!record) return;

  var scale = null;
  var interp = null;
  if (typeof assessmentScales !== 'undefined') {
    scale = assessmentScales.find(function(s) { return s.id === record.scaleId; });
    if (scale) {
      interp = scale.interpretation.find(function(i) {
        return record.score >= i.min && record.score <= i.max;
      });
    }
  }

  showPage('assessment-detail', true);

  var container = document.getElementById('page-assessment-detail');
  if (!container) {
    container = document.createElement('div');
    container.className = 'page';
    container.id = 'page-assessment-detail';
    document.getElementById('content').appendChild(container);
  }

  document.getElementById('navTitle').textContent = '评估详情';
  document.getElementById('navBack').style.display = 'flex';

  var levelText = interp ? interp.level : record.level || '未知';
  var colorClass = interp ? interp.color : 'warning';
  if (!/^(good|warning|danger)$/.test(colorClass)) colorClass = 'warning';
  var descText = interp ? interp.desc : '无法评估';

  // 三层信息架构
  var summaryHtml = '<div class="info-layer-summary">' +
    '<div class="info-layer-summary-label">' + esc(record.scaleName || '') + '</div>' +
    '<div class="info-layer-summary-value mono">' + esc(String(record.score)) + '<small style="font-size:16px;color:var(--text-3);"> / ' + esc(String(record.maxScore)) + '</small></div>' +
    '<div class="result-level ' + escAttr(colorClass) + '" style="margin-top:10px;">' + esc(levelText) + '</div>' +
  '</div>';

  var detailHtml = '<div class="info-layer-detail">' +
    '<div class="result-detail-title">' + icon('assessment', 22) + ' 详细解读</div>' +
    '<div style="font-size:15px;color:var(--text-2);line-height:1.8;">' +
      '<p style="margin-bottom:10px;">' + esc(descText) + '</p>' +
      '<div class="field-row"><div class="field-label">得分</div><div class="field-value"><span class="mono">' + esc(String(record.score)) + '</span> / <span class="mono">' + esc(String(record.maxScore)) + '</span> 分</div></div>' +
      '<div class="field-row"><div class="field-label">评估时间</div><div class="field-value">' + esc(new Date(record.date).toLocaleString()) + '</div></div>' +
    '</div>' +
  '</div>';

  var explainHtml = '<div class="info-layer-explain">' +
    '<strong>说明</strong><br>' +
    '此记录为历史评估结果，仅供参考。如需更新评估，请重新进行评估测试。' +
    (scale && scale.reliability ? '<br><br><strong>量表信度：</strong>' + esc(scale.reliability) : '') +
    (scale && scale.reference ? '<br><strong>参考标准：</strong>' + esc(scale.reference) : '') +
  '</div>';

  container.innerHTML = summaryHtml + detailHtml + explainHtml +
    '<div class="btn-row">' +
      '<button class="btn btn-outline" data-action="go-back">返回</button>' +
    '</div>';

  container.classList.add('active');
  container.classList.add('fade-in');
  setTimeout(function() { container.classList.remove('fade-in'); }, 200);
  document.getElementById('content').scrollTop = 0;
}

function renderAssessmentChart() {
  var container = document.getElementById('scaleChartContent');
  if (!container) return;
  var history = getAssessmentHistory();

  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state-guide">' +
      '<div class="empty-state-guide-icon">📈</div>' +
      '<div class="empty-state-guide-title">暂无趋势数据</div>' +
      '<div class="empty-state-guide-desc">完成多次评估后，这里将显示趋势图表</div>' +
      '<button class="btn btn-primary empty-state-btn" data-action="go-to-assessment-list">' +
        icon('assessment', 16) + ' 开始评估' +
      '</button>' +
    '</div>';
    return;
  }

  container.innerHTML = '<div class="chart-container">' +
    '<div class="chart-head">' +
      '<div class="chart-head-title">' + icon('chart', 22) + ' 评估趋势</div>' +
      '<div class="chart-head-sub">近30天评估记录</div>' +
    '</div>' +
    '<canvas id="trendChart" class="chart-canvas"></canvas>' +
  '</div>';

  setTimeout(function() { drawTrendChart(history); }, 50);
}

function drawTrendChart(records) {
  var canvas = document.getElementById('trendChart');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  var w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  var last30Days = [];
  for (var i = 29; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    last30Days.push(d.toLocaleDateString());
  }

  var data = {};
  last30Days.forEach(function(d) { data[d] = []; });

  records.forEach(function(r) {
    if (!r.date) return;
    var date = new Date(r.date).toLocaleDateString();
    if (data[date]) data[date].push(r);
  });

  var points = last30Days.map(function(d) {
    var dayRecords = data[d];
    if (dayRecords.length === 0) return null;
    var avg = dayRecords.reduce(function(sum, r) { return sum + r.score; }, 0) / dayRecords.length;
    return { date: d, score: avg };
  }).filter(function(p) { return p !== null; });

  if (points.length === 0) {
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据', w / 2, h / 2);
    return;
  }

  var maxVal = Math.max.apply(null, points.map(function(p) { return p.score; }));
  var minVal = Math.min.apply(null, points.map(function(p) { return p.score; }));
  var range = maxVal - minVal || 1;

  var padding = { top: 20, right: 20, bottom: 30, left: 40 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 0.5;
  for (var i = 0; i <= 4; i++) {
    var y = padding.top + chartH * i / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
  }

  if (points.length >= 2) {
    var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(13, 110, 140, 0.3)');
    gradient.addColorStop(1, 'rgba(13, 110, 140, 0)');

    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    points.forEach(function(p, i) {
      var x = padding.left + (chartW / (points.length - 1)) * i;
      var y = padding.top + chartH - ((p.score - minVal) / range) * chartH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    points.forEach(function(p, i) {
      var x = padding.left + (chartW / (points.length - 1)) * i;
      var y = padding.top + chartH - ((p.score - minVal) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#0d6e8c';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  points.forEach(function(p, i) {
    if (points.length >= 2) {
      var x = padding.left + (chartW / (points.length - 1)) * i;
      var y = padding.top + chartH - ((p.score - minVal) / range) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#0d6e8c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

// ==================== 方案模块 ====================
var protocolCategories = [
  { id: 'PT', name: '物理治疗' },
  { id: 'OT', name: '作业治疗' },
  { id: 'PAIN', name: '疼痛管理' },
  { id: 'PRO', name: '心理支持' }
];

function renderProtocolCatBar() {
  var bar = document.getElementById('protocolCatBar');
  if (!bar) return;

  var cats = [{ id: 'ALL', name: '全部' }].concat(protocolCategories);
  bar.innerHTML = cats.map(function(c) {
    var activeClass = currentProtocolCat === c.id ? ' active' : '';
    return '<div class="protocol-cat-chip' + activeClass + '" data-cat="' + c.id + '" data-action="select-protocol-cat">' + esc(c.name) + '</div>';
  }).join('');
}

function selectProtocolCat(cat) {
  currentProtocolCat = cat;
  renderProtocolCatBar();
  renderProtocolList();
}

function renderProtocolList() {
  var container = document.getElementById('protocolListContainer');
  if (!container) return;
  var search = ((document.getElementById('protocolSearch') || {}).value || '').toLowerCase();

  if (typeof rehabProtocols === 'undefined') {
    container.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>数据加载中...</div>';
    return;
  }

  var filtered = rehabProtocols.filter(function(p) {
    var catMatch = currentProtocolCat === 'ALL' || p.category === currentProtocolCat;
    var searchMatch = !search ||
      (p.name || '').toLowerCase().indexOf(search) >= 0 ||
      (p.description || '').toLowerCase().indexOf(search) >= 0 ||
      fuzzyMatch((p.name || '').toLowerCase(), search);
    return catMatch && searchMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>未找到匹配方案</div>';
    return;
  }

  container.innerHTML = filtered.map(function(p) {
    var catInfo = protocolCategories.find(function(c) { return c.id === p.category; });
    var catName = catInfo ? catInfo.name : (p.categoryName || '');
    var stageTags = p.stages ? p.stages.map(function(s) {
      return '<span class="protocol-stage-tag">' + esc(s.name) + '</span>';
    }).join('') : '';
    var highlightedName = search ? highlightKeyword(p.name, search) : esc(p.name);
    return '<div class="protocol-card" data-action="show-protocol-detail" data-id="' + escAttr(p.id) + '">' +
      '<div class="protocol-card-header">' +
        '<div class="protocol-card-icon" data-cat="' + escAttr(p.category) + '">' + icon('treatment', 26) + '</div>' +
        '<div class="protocol-card-info">' +
          '<div class="protocol-card-title">' + highlightedName + '</div>' +
          '<div class="protocol-card-evidence">' + esc(p.evidence || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="protocol-card-desc">' + esc(p.description || '') + '</div>' +
      '<span class="protocol-card-badge" data-cat="' + escAttr(p.category) + '">' + esc(catName) + '</span>' +
      '<div class="protocol-card-stages">' + stageTags + '</div>' +
    '</div>';
  }).join('');
}

function showProtocolDetail(id) {
  if (typeof rehabProtocols === 'undefined') return;
  var p = rehabProtocols.find(function(x) { return x.id === id; });
  if (!p) return;

  saveSearchHistory('protocol', p.name);

  showPage('protocol-detail', true);

  var container = document.getElementById('page-protocol-detail');
  if (!container) {
    container = document.createElement('div');
    container.className = 'page';
    container.id = 'page-protocol-detail';
    document.getElementById('content').appendChild(container);
  }

  var catInfo = protocolCategories.find(function(c) { return c.id === p.category; });
  var catName = catInfo ? catInfo.name : (p.categoryName || '');

  var stagesHtml = p.stages ? p.stages.map(function(s, i) {
    var exercises = s.exercises ? s.exercises.map(function(e) {
      return '<li class="stage-exercise-item">' + esc(e) + '</li>';
    }).join('') : '';
    var caution = s.cautions ? '<div class="stage-caution"><strong>⚠ 注意事项</strong><br>' + esc(s.cautions) + '</div>' : '';
    var criteria = s.criteria ? '<div class="stage-criteria"><strong>✓ 进阶标准</strong><br>' + esc(s.criteria) + '</div>' : '';
    return '<div class="stage-card">' +
      '<div class="stage-header" data-action="toggle-stage">' +
        '<div class="stage-number mono">' + (i + 1) + '</div>' +
        '<div class="stage-name">' + esc(s.name) + '</div>' +
        '<span class="icon stage-arrow" style="width:20px;height:20px;">' + icon('chevronRight', 20) + '</span>' +
      '</div>' +
      '<div class="stage-content open">' +
        '<div class="stage-goal"><strong>目标</strong>：' + esc(s.goal || '') + '</div>' +
        '<div class="stage-duration">时长：' + esc(s.duration || '') + '</div>' +
        '<ul class="stage-exercise-list">' + exercises + '</ul>' +
        caution + criteria +
      '</div>' +
    '</div>';
  }).join('') : '';

  container.innerHTML = '<div class="protocol-detail">' +
    '<div class="protocol-detail-header">' +
      '<div class="protocol-detail-title">' + esc(p.name || '') + '</div>' +
      '<div class="protocol-detail-evidence">' + esc(p.evidence || '') + '</div>' +
      '<div class="protocol-detail-desc">' + esc(p.description || '') + '</div>' +
      '<span class="protocol-card-badge" data-cat="' + escAttr(p.category || '') + '" style="margin-top:8px;">' + esc(catName) + '</span>' +
    '</div>' +
    '<div style="padding:0 16px 20px;">' + stagesHtml + '</div>' +
  '</div>';

  container.classList.add('active');
  container.classList.add('fade-in');
  setTimeout(function() { container.classList.remove('fade-in'); }, 200);
  document.getElementById('content').scrollTop = 0;
  document.getElementById('navBack').style.display = 'flex';
}

// ==================== 临床工具模块 ====================
function renderToolsCategoryBar() {
  var bar = document.getElementById('toolsCategoryBar');
  if (!bar) return;
  var cats = ['ALL', 'PT', 'OT', 'ST', '心理'];
  bar.innerHTML = cats.map(function(c) {
    var activeClass = currentToolsCategory === c ? ' active' : '';
    var label = c === 'ALL' ? '全部' : c;
    return '<div class="protocol-cat-chip' + activeClass + '" data-action="select-tools-category" data-cat="' + escAttr(c) + '">' + label + '</div>';
  }).join('');
}

function selectToolsCategory(cat) {
  currentToolsCategory = cat;
  renderToolsCategoryBar();
  renderToolsList();
}

function renderToolsList() {
  var container = document.getElementById('toolsList');
  if (!container) return;

  if (typeof clinicalTools === 'undefined') {
    container.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>数据加载中...</div>';
    return;
  }

  var filtered = clinicalTools.filter(function(t) {
    var catMatch = currentToolsCategory === 'ALL' || t.category === currentToolsCategory;
    return catMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>未找到匹配工具</div>';
    return;
  }

  container.innerHTML = filtered.map(function(t) {
    return '<div class="list-item" data-action="show-tool-detail" data-id="' + escAttr(t.id) + '">' +
      '<span class="icon">' + icon('tool', 44) + '</span>' +
      '<div class="list-item-content">' +
        '<div class="list-item-title">' + esc(t.name) + '</div>' +
        '<div class="list-item-desc">' + esc(t.description || '') + '</div>' +
      '</div>' +
      '<span class="list-item-arrow">' + icon('chevronRight', 24) + '</span>' +
    '</div>';
  }).join('');
}

function showToolDetail(id) {
  if (typeof clinicalTools === 'undefined') return;
  var tool = clinicalTools.find(function(t) { return t.id === id; });
  if (!tool) return;

  showPage('detail', true);

  var container = document.getElementById('page-detail');
  if (!container) {
    container = document.createElement('div');
    container.className = 'page';
    container.id = 'page-detail';
    document.getElementById('content').appendChild(container);
  }

  document.getElementById('navTitle').textContent = tool.name;
  document.getElementById('navBack').style.display = 'flex';

  container.innerHTML = '<div class="detail-header">' +
    '<div class="detail-header-title">' + esc(tool.name) + '</div>' +
    '<div class="detail-header-sub">' + esc(tool.category || '') + '</div>' +
  '</div>' +
  '<div class="accordion-item open" data-section="tool-desc">' +
    '<div class="accordion-header" data-action="toggle-accordion" data-section="tool-desc">' +
      '<div class="accordion-header-top">' +
        '<span class="icon">' + icon('info', 28) + '</span>' +
        '<span class="accordion-title">工具说明</span>' +
        '<span class="accordion-chevron">' + icon('chevronDown', 24) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="accordion-body">' +
      '<div class="accordion-content">' +
        '<div class="field-row"><div class="field-label">描述</div><div class="field-value">' + esc(tool.description || '') + '</div></div>' +
        '<div class="field-row"><div class="field-label">使用方法</div><div class="field-value">' + esc(tool.usage || '').replace(/\n/g, '<br>') + '</div></div>' +
        '<div class="field-row"><div class="field-label">注意事项</div><div class="field-value">' + esc(tool.notes || '') + '</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  container.classList.add('active');
  container.classList.add('fade-in');
  setTimeout(function() { container.classList.remove('fade-in'); }, 200);
  document.getElementById('content').scrollTop = 0;
}

// ==================== 临床指南模块 ====================
function renderGuidelinesCategoryBar() {
  var bar = document.getElementById('guidelinesCategoryBar');
  if (!bar) return;
  var cats = ['ALL', 'PT', 'OT', 'ST', '疼痛', '神经'];
  bar.innerHTML = cats.map(function(c) {
    var activeClass = currentGuidelinesCategory === c ? ' active' : '';
    var label = c === 'ALL' ? '全部' : c;
    return '<div class="protocol-cat-chip' + activeClass + '" data-action="select-guidelines-category" data-cat="' + escAttr(c) + '">' + esc(label) + '</div>';
  }).join('');
}

function selectGuidelinesCategory(cat) {
  currentGuidelinesCategory = cat;
  renderGuidelinesCategoryBar();
  renderGuidelinesList();
}

function renderGuidelinesList() {
  var container = document.getElementById('guidelinesList');
  if (!container) return;

  if (typeof clinicalGuidelines === 'undefined') {
    container.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>数据加载中...</div>';
    return;
  }

  var filtered = clinicalGuidelines.filter(function(g) {
    var catMatch = currentGuidelinesCategory === 'ALL' || g.category === currentGuidelinesCategory;
    return catMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">' + icon('search', 48) + '</div>未找到匹配指南</div>';
    return;
  }

  container.innerHTML = filtered.map(function(g) {
    return '<div class="list-item" data-action="show-guideline-detail" data-id="' + escAttr(g.id) + '">' +
      '<span class="icon">' + icon('guideline', 44) + '</span>' +
      '<div class="list-item-content">' +
        '<div class="list-item-title">' + esc(g.name) + '</div>' +
        '<div class="list-item-desc">' + esc(g.description || '') + '</div>' +
      '</div>' +
      '<span class="list-item-arrow">' + icon('chevronRight', 24) + '</span>' +
    '</div>';
  }).join('');
}

function showGuidelineDetail(id) {
  if (typeof clinicalGuidelines === 'undefined') return;
  var guideline = clinicalGuidelines.find(function(g) { return g.id === id; });
  if (!guideline) return;

  showPage('detail', true);

  var container = document.getElementById('page-detail');
  if (!container) {
    container = document.createElement('div');
    container.className = 'page';
    container.id = 'page-detail';
    document.getElementById('content').appendChild(container);
  }

  document.getElementById('navTitle').textContent = guideline.name;
  document.getElementById('navBack').style.display = 'flex';

  container.innerHTML = '<div class="detail-header">' +
    '<div class="detail-header-title">' + esc(guideline.name) + '</div>' +
    '<div class="detail-header-sub">' + esc(guideline.source || '') + '</div>' +
  '</div>' +
  '<div class="accordion-item open" data-section="guide-desc">' +
    '<div class="accordion-header" data-action="toggle-accordion" data-section="guide-desc">' +
      '<div class="accordion-header-top">' +
        '<span class="icon">' + icon('info', 28) + '</span>' +
        '<span class="accordion-title">指南内容</span>' +
        '<span class="accordion-chevron">' + icon('chevronDown', 24) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="accordion-body">' +
      '<div class="accordion-content">' +
        '<div class="field-row"><div class="field-label">概述</div><div class="field-value">' + esc(guideline.description || '') + '</div></div>' +
        '<div class="field-row"><div class="field-label">推荐意见</div><div class="field-value">' + esc(guideline.recommendations || '').replace(/\n/g, '<br>') + '</div></div>' +
        '<div class="field-row"><div class="field-label">证据等级</div><div class="field-value">' + esc(guideline.evidence || '') + '</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';

  container.classList.add('active');
  container.classList.add('fade-in');
  setTimeout(function() { container.classList.remove('fade-in'); }, 200);
  document.getElementById('content').scrollTop = 0;
}

// ==================== 数据看板模块 ====================
var dashboardCategoryMap = {
  'pain': { name: '疼痛评估', color: '#f59e0b' },
  'neck': { name: '颈肩评估', color: '#3b82f6' },
  'back': { name: '腰背评估', color: '#10b981' },
  'upper': { name: '上肢评估', color: '#8b5cf6' },
  'wrist': { name: '腕手评估', color: '#ec4899' },
  'lower': { name: '下肢评估', color: '#6366f1' },
  'ankle': { name: '踝足评估', color: '#14b8a6' },
  'function': { name: '功能与生活能力', color: '#0d6e8c' },
  'balance': { name: '平衡与步行', color: '#f97316' },
  'quality': { name: '生活质量', color: '#84cc16' },
  'muscle': { name: '肌肉与关节功能', color: '#06b6d4' },
  'mental': { name: '心理状态', color: '#ef4444' }
};
var dashboardCategoryColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#ef4444'];

function renderDashboard() {
  var records = getAssessmentHistory();
  var totalAssessments = records.length;

  var subtitle = document.getElementById('dashboardSubtitle');
  if (subtitle) {
    subtitle.textContent = totalAssessments + ' 条评定';
  }

  var statsContainer = document.getElementById('dashboardStats');
  if (!statsContainer) return;

  if (totalAssessments === 0) {
    statsContainer.innerHTML = '<div class="empty-state-guide" style="grid-column:1/-1;">' +
      '<div class="empty-state-guide-icon">📊</div>' +
      '<div class="empty-state-guide-title">暂无评估数据</div>' +
      '<div class="empty-state-guide-desc">完成量表评估后，这里将自动统计您的评估次数、趋势分析等数据</div>' +
      '<button class="btn btn-primary empty-state-btn" data-action="go-to-assessment-tab">' +
        icon('assessment', 16) + ' 开始评估' +
      '</button>' +
    '</div>';
    return;
  }

  var weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  var weekAssessments = records.filter(function(r) { return r.date && new Date(r.date).getTime() > weekAgo; }).length;

  statsContainer.innerHTML =
    '<div class="stat-card"><div class="stat-card-emoji">📋</div><div class="stat-card-value mono">' + totalAssessments + '</div><div class="stat-card-label">总评定数</div></div>' +
    '<div class="stat-card"><div class="stat-card-emoji">📅</div><div class="stat-card-value mono">' + weekAssessments + '</div><div class="stat-card-label">本周评定</div></div>';

  drawDashboardChart(records);
  renderDashboardDist(records);
  renderDashboardRank(records);
}

function renderDashboardDist(records) {
  var container = document.getElementById('dashboardDistChart');
  if (!container) return;

  var counts = {};
  records.forEach(function(r) {
    var cat = r.category || 'other';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  var keys = Object.keys(counts);
  if (keys.length === 0) {
    container.innerHTML = '<div class="dist-empty">暂无评估数据</div>';
    return;
  }

  var total = records.length;
  var sorted = keys.map(function(k) {
    var info = dashboardCategoryMap[k] || { name: '其他' };
    return { key: k, name: info.name, count: counts[k], color: info.color };
  }).sort(function(a, b) { return b.count - a.count; });

  sorted.forEach(function(item, i) {
    if (!item.color) item.color = dashboardCategoryColors[i % dashboardCategoryColors.length];
  });

  var maxVal = sorted[0].count;
  container.innerHTML = sorted.map(function(item) {
    var pct = Math.round(item.count / total * 100);
    var widthPct = Math.round(item.count / maxVal * 100);
    var safeColor = /^#[0-9a-fA-F]{3,6}$/.test(item.color || '') ? item.color : '#0d6e8c';
    return '<div class="dist-item">' +
      '<div class="dist-label">' + esc(item.name || '') + '</div>' +
      '<div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:' + widthPct + '%;background:' + safeColor + ';"></div></div>' +
      '<div class="dist-count mono">' + esc(String(item.count)) + ' · ' + esc(String(pct)) + '%</div>' +
    '</div>';
  }).join('');
}

function renderDashboardRank(records) {
  var list = document.getElementById('dashboardRankList');
  if (!list) return;

  var counts = {};
  records.forEach(function(r) {
    if (r.scaleName) counts[r.scaleName] = (counts[r.scaleName] || 0) + 1;
  });

  var sorted = Object.keys(counts).map(function(name) {
    return { name: name, count: counts[name] };
  }).sort(function(a, b) { return b.count - a.count; }).slice(0, 10);

  if (sorted.length === 0) {
    list.innerHTML = '<div class="dashboard-empty">暂无评估数据</div>';
    return;
  }

  list.innerHTML = sorted.map(function(item, i) {
    var numClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : 'other';
    return '<li class="rank-item">' +
      '<div class="rank-num ' + numClass + ' mono">' + (i + 1) + '</div>' +
      '<div class="rank-name">' + esc(item.name) + '</div>' +
      '<div class="rank-count mono">' + esc(String(item.count)) + ' 次</div>' +
    '</li>';
  }).join('');
}

function drawDashboardChart(records) {
  var canvas = document.getElementById('dashboardChart');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  var w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  var months = [];
  var now = new Date();
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), count: 0 });
  }

  records.forEach(function(r) {
    if (!r.date) return;
    var d = new Date(r.date);
    months.forEach(function(m) {
      if (m.year === d.getFullYear() && m.month === d.getMonth()) m.count++;
    });
  });

  var maxVal = Math.max.apply(null, months.map(function(m) { return m.count; }));
  if (maxVal === 0) maxVal = 1;

  var padding = { top: 20, right: 20, bottom: 30, left: 35 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 0.5;
  for (var i = 0; i <= 4; i++) {
    var y = padding.top + chartH * i / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * (4 - i) / 4), padding.left - 5, y + 3);
  }

  var barW = chartW / months.length * 0.5;
  months.forEach(function(m, i) {
    var x = padding.left + (chartW / months.length) * (i + 0.5) - barW / 2;
    var barH = (m.count / maxVal) * chartH;
    var y = padding.top + chartH - barH;

    var gradient = ctx.createLinearGradient(0, y, 0, padding.top + chartH);
    gradient.addColorStop(0, '#4a9fb8');
    gradient.addColorStop(1, '#0d6e8c');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.rect(x, y, barW, barH);
    ctx.fill();

    if (m.count > 0) {
      ctx.fillStyle = '#085066';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.count, x + barW / 2, y - 5);
    }

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((m.month + 1) + '月', x + barW / 2, padding.top + chartH + 18);
  });
}

// ==================== 初始化 ====================
function initAllScales() {
  renderScaleList();
}

function init() {
  initIcons();
  initAllScales();
  renderMuscleBodyGrid();
  renderDiseaseBodyGrid();
  renderProtocolCatBar();
  renderProtocolList();
  renderMoreMenu();

  // 设置搜索自动补全
  if (typeof muscles !== 'undefined') {
    setupSearch('muscleSearch', 'muscleAutocomplete', 'muscleSearchHistory', 'muscle',
      muscles, renderMuscleBodyGrid, 'showMuscleDetail');
  }
  if (typeof diseases !== 'undefined') {
    setupSearch('diagnosisSearch', 'diagnosisAutocomplete', 'diagnosisSearchHistory', 'diagnosis',
      diseases, renderDiseaseBodyGrid, 'showDiseaseDetail');
  }
  if (typeof assessmentScales !== 'undefined') {
    setupSearch('assessmentSearch', 'assessmentAutocomplete', null, 'assessment',
      assessmentScales.map(function(s) { return { name: s.name, _ref: s }; }),
      renderScaleList, 'startAssessmentByName');
  }
  if (typeof rehabProtocols !== 'undefined') {
    setupSearch('protocolSearch', 'protocolAutocomplete', null, 'protocol',
      rehabProtocols, renderProtocolList, 'showProtocolDetail');
  }

  // 红旗警报按钮
  var redflagBtn = document.getElementById('redflagConfirmBtn');
  if (redflagBtn) redflagBtn.addEventListener('click', hideRedflagAlert);

  // Tab 点击事件
  document.querySelectorAll('.tab-item').forEach(function(el) {
    el.addEventListener('click', function() {
      switchTab(this.dataset.tab);
    });
  });
}

function hideLoading() {
  var el = document.getElementById('appLoading');
  if (el) {
    el.classList.add('done');
    setTimeout(function() { el.style.display = 'none'; }, 350);
  }
}

var _dataReadyCheckCount = 0;
var _dataRetryCount = 0;
var _maxRetries = 3;

function _getDataVars() {
  return [
    { name: 'muscles', loaded: typeof muscles !== 'undefined' },
    { name: 'diseases', loaded: typeof diseases !== 'undefined' },
    { name: 'muscleBodyParts', loaded: typeof muscleBodyParts !== 'undefined' },
    { name: 'diseaseBodyParts', loaded: typeof diseaseBodyParts !== 'undefined' },
    { name: 'assessmentScales', loaded: typeof assessmentScales !== 'undefined' },
    { name: 'rehabProtocols', loaded: typeof rehabProtocols !== 'undefined' },
    { name: 'clinicalTools', loaded: typeof clinicalTools !== 'undefined' },
    { name: 'clinicalGuidelines', loaded: typeof clinicalGuidelines !== 'undefined' }
  ];
}

function _getMissingData() {
  return _getDataVars().filter(function(v) { return !v.loaded; }).map(function(v) { return v.name; });
}

function _reloadScript(src) {
  var oldScripts = document.querySelectorAll('script[src$="' + src + '"]');
  var old = oldScripts[oldScripts.length - 1];
  if (!old) return false;
  var newScript = document.createElement('script');
  newScript.src = src + '?v=' + Date.now();
  newScript.async = true;
  newScript.onerror = function() { this._loadFailed = true; };
  old.parentNode.insertBefore(newScript, old.nextSibling);
  return true;
}

function _retryLoadData() {
  _dataRetryCount++;
  if (_dataRetryCount > _maxRetries) return false;

  var missing = _getMissingData();
  if (missing.length === 0) return true;

  var dataInDataJs = ['muscles', 'diseases', 'muscleBodyParts', 'diseaseBodyParts', 'rehabProtocols', 'clinicalTools', 'clinicalGuidelines'];
  var dataInScalesJs = ['assessmentScales'];

  var needsData = missing.some(function(m) { return dataInDataJs.indexOf(m) >= 0; });
  var needsScales = missing.some(function(m) { return dataInScalesJs.indexOf(m) >= 0; });

  if (needsData) _reloadScript('data.js');
  if (needsScales) _reloadScript('scales.js');

  var el = document.getElementById('appLoading');
  if (el) {
    var textEl = el.querySelector('.app-loading-text');
    if (textEl) {
      textEl.textContent = '数据加载中（第' + _dataRetryCount + '次重试）…';
    }
  }

  _dataReadyCheckCount = 0;
  return true;
}

function checkDataReady() {
  var ready = typeof muscles !== 'undefined' &&
              typeof diseases !== 'undefined' &&
              typeof muscleBodyParts !== 'undefined' &&
              typeof diseaseBodyParts !== 'undefined' &&
              typeof assessmentScales !== 'undefined' &&
              typeof rehabProtocols !== 'undefined' &&
              typeof clinicalTools !== 'undefined' &&
              typeof clinicalGuidelines !== 'undefined';
  if (ready) {
    hideLoading();
    try { init(); } catch (e) {
      console.error('init error:', e);
      _showFatalError('页面初始化失败', e.message || '未知错误');
    }
  } else {
    _dataReadyCheckCount++;
    if (_dataReadyCheckCount > 100) {
      if (_retryLoadData()) {
        setTimeout(checkDataReady, 80);
        return;
      }
      _showLoadError();
      return;
    }
    setTimeout(checkDataReady, 80);
  }
}

function _showLoadError() {
  var el = document.getElementById('appLoading');
  if (!el) return;
  var missing = _getMissingData();
  el.innerHTML = '<div style="padding:24px;text-align:center;max-width:320px;">' +
    '<div style="font-size:40px;margin-bottom:12px;">⚠️</div>' +
    '<div style="font-size:16px;font-weight:600;color:var(--text-1);margin-bottom:8px;">数据加载失败</div>' +
    '<div style="font-size:13px;color:var(--text-3);line-height:1.6;margin-bottom:16px;">' +
    '网络连接不稳定，已尝试 ' + _maxRetries + ' 次仍未成功。' +
    '<br><br>' +
    '建议操作：' +
    '<br>1. 检查网络连接是否正常' +
    '<br>2. 切换 Wi-Fi 或移动数据' +
    '<br>3. 点击下方按钮重新加载' +
    '</div>' +
    '<button onclick="location.reload()" style="padding:12px 32px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:15px;cursor:pointer;margin:0 6px;">重新加载</button>' +
    '<button onclick="location.href=location.pathname+\'?t=\'+Date.now()" style="padding:12px 32px;background:var(--warning);color:#fff;border:none;border-radius:10px;font-size:15px;cursor:pointer;margin:0 6px;">强制刷新</button>' +
    '</div>';
}

function _showFatalError(title, detail) {
  hideLoading();
  var content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = '<div style="padding:40px 20px;text-align:center;">' +
    '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
    '<div style="font-size:18px;font-weight:600;margin-bottom:8px;">' + esc(title) + '</div>' +
    '<div style="font-size:14px;color:var(--text-3);margin-bottom:20px;line-height:1.6;">' + esc(detail || '') + '</div>' +
    '<button onclick="location.reload()" style="padding:12px 28px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:15px;cursor:pointer;">重新加载</button>' +
    '</div>';
}

// 已知安全的全局函数白名单 - 用于 data-action 动态函数名
var _ALLOWED_GLOBAL_FNS = ['showMuscleDetail', 'showDiseaseDetail', 'startAssessmentByName', 'showProtocolDetail'];

function setupEventDelegation() {
  // 单一事件委托处理所有 data-action 点击
  document.addEventListener('click', function(e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    var ds = target.dataset;
    switch (action) {
      case 'search-history':
        var inp = document.getElementById(ds.input);
        if (inp) { inp.value = ds.name; inp.dispatchEvent(new Event('input')); }
        break;
      case 'show-muscle-detail': showMuscleDetail(ds.name); break;
      case 'show-disease-detail': showDiseaseDetail(ds.name); break;
      case 'start-assessment': startAssessment(ds.id); break;
      case 'show-protocol-detail': showProtocolDetail(ds.id); break;
      case 'show-tool-detail': showToolDetail(ds.id); break;
      case 'show-guideline-detail': showGuidelineDetail(ds.id); break;
      case 'show-more-page': showMorePage(ds.page); break;
      case 'show-more-menu': showMoreMenu(); break;
      case 'show-assessment-detail': showAssessmentDetail(ds.id); break;
      case 'select-tools-category': selectToolsCategory(ds.cat); break;
      case 'select-guidelines-category': selectGuidelinesCategory(ds.cat); break;
      case 'select-protocol-cat': selectProtocolCat(ds.cat); break;
      case 'select-muscle-region': selectMuscleRegion(ds.region); break;
      case 'select-disease-region': selectDiseaseRegion(ds.region); break;
      case 'toggle-accordion': toggleAccordion(ds.section); break;
      case 'toggle-stage':
        var sc = target.nextElementSibling;
        if (sc) sc.classList.toggle('open');
        var arrow = target.querySelector('.stage-arrow');
        if (arrow) arrow.classList.toggle('open');
        break;
      case 'switch-tab': switchTab(ds.tab); break;
      case 'switch-assessment-tab': switchAssessmentTab(ds.tab); break;
      case 'go-to-assessment-list': switchAssessmentTab('list'); break;
      case 'go-to-assessment-tab':
        switchTab('assessment');
        switchAssessmentTab('list');
        break;
      case 'go-back': goBack(); break;
      case 'submit-assessment': submitAssessment(); break;
      case 'prev-assessment': prevAssessmentQuestion(); break;
      case 'next-assessment': nextAssessmentQuestion(); break;
      case 'select-choice-option':
        var idx = parseInt(ds.idx, 10);
        var score = parseFloat(ds.score);
        if (!isNaN(idx)) selectChoiceOption(idx, isNaN(score) ? 0 : score);
        break;
      case 'select-yesno':
        var val = ds.val === 'true';
        selectYesNoOption(val);
        break;
      // 动态函数名 - 仅允许白名单中的全局函数
      default:
        if (_ALLOWED_GLOBAL_FNS.indexOf(action) >= 0 && typeof window[action] === 'function') {
          // showProtocolDetail 期望 id，其余期望 name
          var arg = action === 'showProtocolDetail' ? (ds.id || ds.name) : ds.name;
          window[action](arg);
        }
    }
  });
}

checkDataReady();
setupEventDelegation();
