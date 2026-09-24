(() => {
  'use strict';

  function syncThemeButton() {
    const button = document.getElementById('themeToggle');
    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');

    if (!button || !icon || !label) return;

    const current =
      document.documentElement.dataset.theme || 'dark';

    if (current === 'light') {
      icon.textContent = '☾';
      label.textContent = '深色模式';
      button.title = '切换到深色模式';
      button.setAttribute('aria-pressed', 'true');
    } else {
      icon.textContent = '☀';
      label.textContent = '浅色模式';
      button.title = '切换到浅色模式';
      button.setAttribute('aria-pressed', 'false');
    }
  }

  function toggleTheme() {
    const current =
      document.documentElement.dataset.theme || 'dark';

    const next =
      current === 'light' ? 'dark' : 'light';

    document.documentElement.dataset.theme = next;

    try {
      localStorage.setItem('slam-dashboard-theme', next);
    } catch (_) {}

    syncThemeButton();
  }


  const state = { payload: null, selected: new Set(), metric: 'cpu_avg_pct' };

  const metricDefs = {
    cpu_avg_pct: { label: 'CPU Avg', unit: '%', get: e => e.resource?.cpu_avg_pct, direction: 'lower' },
    ram_peak_mb: { label: 'RAM Peak', unit: ' MB', get: e => e.resource?.ram_peak_mb, direction: 'lower' },
    region_a_p95_cm: { label: 'Region A Revisit P95', unit: ' cm', get: e => e.revisit?.region_a?.p95_cm, direction: 'lower' },
    region_b_p95_cm: { label: 'Region B Revisit P95', unit: ' cm', get: e => e.revisit?.region_b?.p95_cm, direction: 'lower' },
    plane_rmse_median_cm: { label: 'Plane RMSE Median', unit: ' cm', get: e => e.geometry?.plane_rmse_median_cm, direction: 'lower' },
    map_points: { label: '5 cm Voxel Map Points', unit: '', get: e => e.map?.points, direction: 'reference', integer: true }
  };

  const directionMeta = {
    lower: { short: '↓ 越低越好', className: 'direction-lower' },
    higher: { short: '↑ 越高越好', className: 'direction-higher' },
    target: { short: '◎ 越接近目标越好', className: 'direction-target' },
    reference: { short: '— 仅供参考', className: 'direction-reference' }
  };

  const metricDirectionByKey = {
    cpu_avg: 'lower', cpu_p95: 'lower', cpu_max: 'lower',
    ram_avg: 'lower', ram_p95: 'lower', ram_peak: 'lower',
    trajectory_length: 'reference', duration: 'target', start_end: 'reference', jump_count: 'lower', samples: 'reference',
    voxel_points: 'reference', plane_rmse_median: 'lower', plane_rmse_p95: 'lower', surface_variation: 'lower',
    planarity: 'higher', planar_fraction: 'higher',
    revisit_median: 'lower', revisit_p95: 'lower', overlap: 'higher',
    loop_count: 'reference', loop_fitness: 'lower', loop_mode: 'reference', resource_status: 'reference'
  };

  function directionBadge(direction, compact = false) {
    const meta = directionMeta[direction || 'reference'] || directionMeta.reference;
    return `<span class="direction-badge ${meta.className}${compact ? ' compact' : ''}">${meta.short}</span>`;
  }


  // 数据字典：新增 benchmark 指标时，优先在这里补一条说明。
  // 网页会自动生成“数据指标说明”，并支持搜索。
  const metricGlossary = [
    {
      group: '资源占用',
      items: [
        { key: 'cpu_avg', name: 'CPU Avg', unit: '%', meaning: '整个实验期间 SLAM 相关进程 CPU 使用率的平均值。', read: '越低通常越利于机载实时部署。Linux 进程 CPU 可超过 100%，约 100% 可理解为持续占满 1 个逻辑核心。', caution: '必须在同一机器、同一 bag、同一播放速率和相同统计口径下比较。' },
        { key: 'cpu_p95', name: 'CPU P95', unit: '%', meaning: 'CPU 使用率的第 95 百分位；约 95% 的采样点不超过这个值。', read: '比平均值更能反映“常见高负载”水平，越低通常越好。', caution: 'P95 不是峰值；极短暂尖峰会更多体现在 CPU Max。' },
        { key: 'cpu_max', name: 'CPU Max', unit: '%', meaning: '资源监控期间观察到的最高 CPU 使用率。', read: '用于检查是否存在很高的瞬时计算峰值。', caution: '单个峰值对采样频率敏感，不应单独作为算法优劣结论。' },
        { key: 'ram_avg', name: 'RAM Avg', unit: 'MB', meaning: '实验运行期间进程占用内存的平均值。', read: '越低越容易在内存较小的机载计算平台部署。', caution: '需保持相同统计工具和进程范围。' },
        { key: 'ram_p95', name: 'RAM P95', unit: 'MB', meaning: '内存占用的第 95 百分位。', read: '代表绝大多数运行时间内需要准备的内存空间。', caution: '如果某组缺失该值，网页显示“—”，不要用 Peak 直接替代。' },
        { key: 'ram_peak', name: 'RAM Peak', unit: 'MB', meaning: '实验期间记录到的最大内存占用。', read: '用于估计最坏情况下的内存余量，越低通常越有利于部署。', caution: '峰值可能受初始化、缓存和日志行为影响。' },
        { key: 'resource_status', name: 'Resource: Formal / Quality run', unit: '', meaning: '标记资源数据是否来自专门的正式资源测试。Formal 表示按统一资源测试流程获得；Quality run 表示建图质量实验过程中顺带记录。', read: '做正式 CPU/RAM 横向比较时优先使用 Formal。', caution: '当前 LIO-SAM ON 的资源值属于 Quality run，后续应补 dedicated formal run。' }
      ]
    },
    {
      group: '轨迹与稳定性',
      items: [
        { key: 'trajectory_length', name: 'Trajectory length', unit: 'm', meaning: 'SLAM 估计轨迹沿时间累积得到的总路径长度。', read: '同一 bag 下，不同算法结果应大体接近；明显异常可能提示尺度、漂移或轨迹跳变问题。', caution: '它不是 Ground Truth 路程，因此不能单独代表定位精度。' },
        { key: 'duration', name: 'Trajectory duration', unit: 's', meaning: '成功输出轨迹覆盖的时间长度。', read: '应接近 bag 的有效时长，用于检查算法是否完整跑完或中途丢失。', caution: '启动/结束同步方式不同可能带来少量时间差。' },
        { key: 'start_end', name: 'Start-End separation', unit: 'm', meaning: '估计轨迹终点与起点之间的欧氏距离。', read: '当真实路线确实回到起点附近时，可作为闭环后首尾一致性的辅助观察。', caution: '它不是 ATE，也不是绝对定位误差；没有 Ground Truth 时不能把它当成“精度”。' },
        { key: 'jump_count', name: 'Jump count', unit: '次', meaning: '轨迹中被判定为异常大位姿跳变的次数。', read: '理想情况为 0；机械狗导航尤其需要避免瞬时位姿跳变。', caution: '结果取决于你 benchmark 脚本中的跳变阈值，比较时必须保持阈值一致。' },
        { key: 'samples', name: 'Trajectory samples', unit: '个', meaning: '用于轨迹统计的位姿样本数量。', read: '主要用于核对输出连续性和采样是否完整。', caution: '样本更多不等于定位更准确。' }
      ]
    },
    {
      group: '地图与局部几何',
      items: [
        { key: 'voxel_points', name: '5 cm Voxel Map Points', unit: 'points', meaning: '所有地图统一经过 5 cm voxel 下采样后剩余的点数。', read: '可观察地图采样密度和覆盖差异。', caution: '点数更多只表示更稠密，不代表地图更准确。' },
        { key: 'plane_rmse_median', name: 'Plane RMSE Median', unit: 'cm', meaning: '在固定邻域内做局部平面拟合后，点到拟合平面的 RMSE 中位数。当前比较使用 20 cm 邻域。', read: '越低表示典型局部区域更贴近平面、局部几何一致性通常更好。', caution: '它衡量局部表面残差，不是全局地图精度。' },
        { key: 'plane_rmse_p95', name: 'Plane RMSE P95', unit: 'cm', meaning: '局部平面拟合 RMSE 的第 95 百分位。', read: '反映局部几何误差的长尾情况；越低说明较差区域也相对稳定。', caution: '会受真实非平面物体、动态物体和边缘区域影响。' },
        { key: 'surface_variation', name: 'Surface variation', unit: '', meaning: '基于局部点云协方差特征值计算的表面变化/粗糙程度指标。', read: '在当前同一实现和相同邻域下，较低通常意味着局部点分布更接近平面。', caution: '不同论文或代码可能采用不同定义，只应在本 benchmark 的同一实现内部横向比较。' },
        { key: 'planarity', name: 'Planarity', unit: '', meaning: '基于局部点云特征值关系得到的平面结构强度指标。', read: '在当前统一实现下，数值更高通常表示局部点集更具有平面特征。', caution: '它不是定位精度；真实场景结构差异也会影响该值。' },
        { key: 'planar_fraction', name: 'Planar fraction', unit: '%', meaning: '满足当前平面判定条件的局部点/邻域比例。', read: '较高表示地图中可稳定识别为平面的区域占比更大。', caution: '依赖当前判定阈值与场景本身，不能跨不同 benchmark 配置直接比较。' }
      ]
    },
    {
      group: '重访一致性（Online Revisit C2C）',
      items: [
        { key: 'region_ab', name: 'Region A / Region B', unit: '', meaning: '从同一条 office bag 中截取的两组“第一次经过 vs 再次经过”时间窗口。A：0–70 s vs 260–303 s；B：99–112 s vs 224–240 s。', read: '用于观察同一区域在不同时间再次建图后能否重合。', caution: '窗口针对当前数据集定义，换数据集后应重新配置。' },
        { key: 'revisit_median', name: 'Revisit Median', unit: 'cm', meaning: '两次重访点云做双向最近邻 Cloud-to-Cloud 距离后的中位数。当前流程使用 5 cm voxel，且不做 ICP 对齐。', read: '越低表示大多数重访点之间重合得越好。', caution: '它衡量在线建图的一致性，不是相对 Ground Truth 的绝对误差。' },
        { key: 'revisit_p95', name: 'Revisit P95', unit: 'cm', meaning: '重访 C2C 距离的第 95 百分位。', read: '越低说明“较差的那部分点”仍能较好重合；对长尾漂移、局部错层非常敏感，因此对导航很有参考价值。', caution: '会受动态物体、视角覆盖差异和点云范围变化影响。' },
        { key: 'overlap', name: 'Overlap ≤ 10 cm', unit: '%', meaning: '重访比较中，最近邻距离不超过 10 cm 的点所占比例。', read: '越高说明两次经过同一区域时有更多点能够在 10 cm 范围内相互对应。', caution: '10 cm 是当前 benchmark 的评价阈值，不应与采用其他阈值的结果混用。' }
      ]
    },
    {
      group: '回环与后端优化',
      items: [
        { key: 'loop_flag', name: 'Loop Closure: None / OFF / ON', unit: '', meaning: 'None 表示方案本身没有回环后端；OFF 表示算法具有回环模块但本次关闭；ON 表示本次启用回环检测与图优化。', read: '用于隔离“前端 LIO”与“回环后端”对结果的影响。', caution: 'ON 不保证一定更好；错误回环也可能拉坏地图，因此需要结合回环质量指标与最终地图检查。' },
        { key: 'accepted_constraints', name: 'Accepted loop constraints', unit: '条', meaning: '通过候选检测和几何验证后，被后端接受并加入位姿图的回环约束数量。', read: '用于确认回环模块确实在工作。', caution: '当前 246 条表示时间分离的空间重叠约束，不是 246 个独立地点；数量越多也不等于越准确。' },
        { key: 'fitness', name: 'Loop fitness (Median / P95 / Max)', unit: '', meaning: '回环几何匹配的拟合残差统计，数值越小通常表示匹配越吻合。', read: 'Median 看典型回环质量，P95 看长尾，Max 看最差已接受约束。', caution: 'Fitness 的定义和尺度依赖具体 ICP/实现，只能在同一实现、同一参数下比较。' },
        { key: 'fitness_threshold', name: 'Fitness threshold', unit: '', meaning: '回环几何验证允许被接受的 fitness 上限。', read: '超过阈值的候选应被拒绝；阈值越严通常误回环风险更低，但可能漏掉真实回环。', caution: '阈值需要根据场景、雷达和点云预处理共同调节。' }
      ]
    },
    {
      group: '实验边界与判读原则',
      items: [
        { key: 'ground_truth', name: 'No Ground Truth', unit: '', meaning: '当前 office_hq_ros2 没有外部高精度真值轨迹。', read: '因此现阶段重点比较资源、稳定性、局部几何和重访一致性。', caution: '不能声称已有 ATE/RPE 或“绝对定位精度”结论；未来若加入 mocap/RTK/高精地图真值，应单独增加 ATE/RPE。' },
        { key: 'same_conditions', name: 'Fair comparison conditions', unit: '', meaning: '正式横向比较应尽量保持同一机器、同一 bag、rate=1.0、相同输入话题和统一评测脚本。', read: '这样才能让算法差异成为主要变量。', caution: 'ROS 版本、编译器、PCL/GTSAM 版本、RViz、保存 PCD 等都可能影响资源结果，应在实验记录中注明。' },
        { key: 'navigation_focus', name: '机械狗部署关注点', unit: '', meaning: '最终选择不是追求单一指标最小，而是在实时性、资源、局部地图质量、长时间一致性、稳定性和工程复杂度之间做约束权衡。', read: '当前 Dashboard 的 Deployment Gate 就是用于快速检查方案是否满足机载约束。', caution: '网页约束筛选是辅助工具，不替代实机导航闭环测试。' }
      ]
    }
  ];

  const el = id => document.getElementById(id);
  const fmt = (v, digits = 2) => v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: digits });
  const expList = () => state.payload?.experiments || [];
  const selectedExps = () => expList().filter(e => state.selected.has(e.id));

  async function loadDefault() {
    const res = await fetch('data/experiments.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    applyPayload(payload, true);
  }

  function applyPayload(payload, resetSelection) {
    if (!payload || !Array.isArray(payload.experiments)) throw new Error('JSON 缺少 experiments 数组');
    state.payload = payload;
    if (resetSelection) state.selected = new Set(payload.experiments.map(e => e.id));
    renderAll();
  }

  function renderDatasetSummary() {
    const ds = state.payload?.project?.dataset || {};
    const target = state.payload?.project?.deployment_target || 'deployment target';
    el('datasetSummary').textContent = `${ds.name || 'dataset'} · ${fmt(ds.duration_s, 2)} s · ${ds.lidar_sensor || ''} · ${ds.lidar_topic || ''} + ${ds.imu_topic || ''} · 目标：${target}`;
  }

  function renderFilters() {
    const box = el('algorithmFilters');
    box.innerHTML = '';
    expList().forEach(exp => {
      const label = document.createElement('label');
      label.className = 'algo-filter';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = state.selected.has(exp.id);
      input.addEventListener('change', () => {
        if (input.checked) state.selected.add(exp.id); else state.selected.delete(exp.id);
        renderDataSections();
      });
      const span = document.createElement('span');
      span.textContent = exp.name;
      label.append(input, span);
      box.appendChild(label);
    });
  }

  function statusBadge(exp) {
    const label = exp.resource_status === 'formal' ? 'Resource: Formal' : exp.resource_status === 'quality-run' ? 'Resource: Quality run' : `Resource: ${exp.resource_status || 'unknown'}`;
    return `<span class="badge ${exp.resource_status || ''}">${label}</span>`;
  }

  function renderSummaryCards() {
    const box = el('summaryCards');
    const items = selectedExps();
    if (!items.length) { box.innerHTML = '<div class="empty-state">至少选择一个方案。</div>'; return; }
    box.innerHTML = items.map(exp => `
      <article class="summary-card">
        <div class="card-head"><div><h3>${escapeHtml(exp.name)}</h3><div class="section-side-note">Loop: ${escapeHtml(String(exp.loop_closure ?? '—'))}</div></div>${statusBadge(exp)}</div>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-label">CPU Avg ${directionBadge('lower', true)}</div><div class="kpi-value">${fmt(exp.resource?.cpu_avg_pct)}%</div></div>
          <div class="kpi"><div class="kpi-label">RAM Peak ${directionBadge('lower', true)}</div><div class="kpi-value">${fmt(exp.resource?.ram_peak_mb)} MB</div></div>
          <div class="kpi"><div class="kpi-label">Region A P95 ${directionBadge('lower', true)}</div><div class="kpi-value">${fmt(exp.revisit?.region_a?.p95_cm)} cm</div></div>
          <div class="kpi"><div class="kpi-label">Plane RMSE ${directionBadge('lower', true)}</div><div class="kpi-value">${fmt(exp.geometry?.plane_rmse_median_cm, 3)} cm</div></div>
        </div>
        <p class="card-note">${escapeHtml(exp.notes || '')}</p>
      </article>`).join('');
  }


  function pickMin(items, getter) {
    return items
      .map(exp => ({ exp, value: Number(getter(exp)) }))
      .filter(x => Number.isFinite(x.value))
      .sort((a, b) => a.value - b.value)[0] || null;
  }

  function pickMax(items, getter) {
    return items
      .map(exp => ({ exp, value: Number(getter(exp)) }))
      .filter(x => Number.isFinite(x.value))
      .sort((a, b) => b.value - a.value)[0] || null;
  }

  function renderCurrentConclusion() {
    const target = el('currentConclusion');
    if (!target) return;
    const items = selectedExps();
    if (!items.length) {
      target.textContent = '至少选择一个方案后，才会生成综合评价。';
      return;
    }

    const cpu = pickMin(items, e => e.resource?.cpu_avg_pct);
    const ram = pickMin(items, e => e.resource?.ram_peak_mb);
    const plane = pickMin(items, e => e.geometry?.plane_rmse_median_cm);
    const revisit = pickMin(items, e => e.revisit?.region_a?.p95_cm);
    const overlap = pickMax(items, e => e.revisit?.region_a?.overlap_10cm_pct);

    const parts = [];
    if (cpu && ram && cpu.exp.id === ram.exp.id) {
      parts.push(`${cpu.exp.name} 的资源占用最低（CPU Avg ${fmt(cpu.value)}%，RAM Peak ${fmt(ram.value)} MB）`);
    } else {
      if (cpu) parts.push(`${cpu.exp.name} 的 CPU Avg 最低（${fmt(cpu.value)}%）`);
      if (ram) parts.push(`${ram.exp.name} 的 RAM Peak 最低（${fmt(ram.value)} MB）`);
    }
    if (plane) parts.push(`${plane.exp.name} 的 Plane RMSE Median 最低（${fmt(plane.value, 3)} cm），局部几何残差表现最好`);
    if (revisit && overlap && revisit.exp.id === overlap.exp.id) {
      parts.push(`${revisit.exp.name} 的 Region A P95 最低（${fmt(revisit.value)} cm）且 Overlap 最高（${fmt(overlap.value)}%），长期重访一致性表现最好`);
    } else {
      if (revisit) parts.push(`${revisit.exp.name} 的 Region A P95 最低（${fmt(revisit.value)} cm）`);
      if (overlap) parts.push(`${overlap.exp.name} 的 Region A Overlap 最高（${fmt(overlap.value)}%）`);
    }

    let tail = '当前没有单一方案在所有维度都占优。';
    const fast = items.find(e => e.id === 'fastlio2');
    const on = items.find(e => e.id === 'liosam_on');
    if (fast && on) {
      tail = '综合当前数据，FAST-LIO2 更突出资源效率与局部几何质量，LIO-SAM ON 更突出回环后的长期重访 / 全局一致性；机械狗部署时应按“机载资源优先”或“长期全局一致性优先”选择。';
    }
    target.textContent = `${parts.join('；')}。${tail}`;
  }

  function renderMetricChart() {
    const box = el('metricChart');
    const def = metricDefs[state.metric];
    const rows = selectedExps().map(exp => ({ exp, value: def.get(exp) })).filter(x => x.value != null && Number.isFinite(Number(x.value)));
    if (!rows.length) { box.innerHTML = '<div class="empty-state">该指标暂无可用数据。</div>'; return; }
    const max = Math.max(...rows.map(r => Number(r.value)), 1);
    box.innerHTML = rows.map(({exp, value}) => {
      const pct = Math.max(1.5, Number(value) / max * 100);
      const val = def.integer ? fmt(value, 0) : fmt(value, 3);
      return `<div class="bar-row"><div class="bar-name">${escapeHtml(exp.name)}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><div class="bar-value">${val}${def.unit}</div></div>`;
    }).join('');
    el('metricNote').innerHTML = `当前指标：<strong>${escapeHtml(def.label)}</strong> ${directionBadge(def.direction || 'reference')}。`;
  }

  function constraintStatus(exp, limits) {
    const cpu = exp.resource?.cpu_avg_pct;
    const ram = exp.resource?.ram_peak_mb;
    const rev = exp.revisit?.region_a?.p95_cm;
    const jumps = exp.trajectory?.jumps;
    if ([cpu, ram, rev, jumps].some(v => v == null)) return {cls:'unknown', text:'数据不完整'};
    const failed = [];
    if (cpu > limits.cpu) failed.push('CPU');
    if (ram > limits.ram) failed.push('RAM');
    if (rev > limits.revisit) failed.push('Revisit');
    if (jumps !== 0) failed.push('Jump');
    if (failed.length) return {cls:'fail', text:`未满足：${failed.join(' / ')}`};
    if (exp.resource_status !== 'formal') return {cls:'unknown', text:'数值满足，但资源数据待正式复测'};
    return {cls:'pass', text:'满足当前约束'};
  }

  function renderConstraints() {
    const limits = { cpu: Number(el('cpuLimit').value), ram: Number(el('ramLimit').value), revisit: Number(el('revisitLimit').value) };
    el('cpuLimitValue').textContent = limits.cpu;
    el('ramLimitValue').textContent = limits.ram;
    el('revisitLimitValue').textContent = limits.revisit;
    const box = el('constraintResults');
    box.innerHTML = selectedExps().map(exp => {
      const s = constraintStatus(exp, limits);
      return `<div class="constraint-row"><strong>${escapeHtml(exp.name)}</strong><span class="${s.cls}">${escapeHtml(s.text)}</span></div>`;
    }).join('') || '<div class="empty-state">请选择方案。</div>';
  }

  const tableRows = [
    { group: '资源占用' },
    { label: 'CPU Avg', key: 'cpu_avg', get: e => e.resource?.cpu_avg_pct, unit: '%' },
    { label: 'CPU P95', key: 'cpu_p95', get: e => e.resource?.cpu_p95_pct, unit: '%' },
    { label: 'CPU Max', key: 'cpu_max', get: e => e.resource?.cpu_max_pct, unit: '%' },
    { label: 'RAM Avg', key: 'ram_avg', get: e => e.resource?.ram_avg_mb, unit: ' MB' },
    { label: 'RAM P95', key: 'ram_p95', get: e => e.resource?.ram_p95_mb, unit: ' MB' },
    { label: 'RAM Peak', key: 'ram_peak', get: e => e.resource?.ram_peak_mb, unit: ' MB' },
    { group: '轨迹' },
    { label: 'Trajectory length', key: 'trajectory_length', get: e => e.trajectory?.length_m, unit: ' m' },
    { label: 'Start-End separation', key: 'start_end', get: e => e.trajectory?.start_end_m, unit: ' m' },
    { label: 'Jump count', key: 'jump_count', get: e => e.trajectory?.jumps, unit: '' },
    { group: '地图 / 几何' },
    { label: '5 cm voxel points', key: 'voxel_points', get: e => e.map?.points, unit: '' },
    { label: 'Plane RMSE median', key: 'plane_rmse_median', get: e => e.geometry?.plane_rmse_median_cm, unit: ' cm' },
    { label: 'Plane RMSE P95', key: 'plane_rmse_p95', get: e => e.geometry?.plane_rmse_p95_cm, unit: ' cm' },
    { label: 'Surface variation', key: 'surface_variation', get: e => e.geometry?.surface_variation, unit: '' },
    { label: 'Planarity', key: 'planarity', get: e => e.geometry?.planarity, unit: '' },
    { label: 'Planar fraction', key: 'planar_fraction', get: e => e.geometry?.planar_fraction_pct, unit: '%' },
    { group: 'Region A revisit' },
    { label: 'Median', key: 'revisit_median', get: e => e.revisit?.region_a?.median_cm, unit: ' cm', scope: 'A' },
    { label: 'P95', key: 'revisit_p95', get: e => e.revisit?.region_a?.p95_cm, unit: ' cm', scope: 'A' },
    { label: 'Overlap ≤ 10 cm', key: 'overlap', get: e => e.revisit?.region_a?.overlap_10cm_pct, unit: '%', scope: 'A' },
    { group: 'Region B revisit' },
    { label: 'Median', key: 'revisit_median', get: e => e.revisit?.region_b?.median_cm, unit: ' cm', scope: 'B' },
    { label: 'P95', key: 'revisit_p95', get: e => e.revisit?.region_b?.p95_cm, unit: ' cm', scope: 'B' },
    { label: 'Overlap ≤ 10 cm', key: 'overlap', get: e => e.revisit?.region_b?.overlap_10cm_pct, unit: '%', scope: 'B' }
  ];

  function tableMetricLabel(row) {
    const key = row.key;
    const labelText = row.scope ? `${row.label} · Region ${row.scope}` : row.label;
    const help = key ? `<a class="metric-help-link" href="#guide-${escapeAttr(key)}" aria-label="查看 ${escapeAttr(labelText)} 的说明" title="查看指标说明">?</a>` : '';
    const direction = key ? directionBadge(metricDirectionByKey[key] || 'reference', true) : '';
    return `<span class="metric-name-with-help">${escapeHtml(labelText)}${direction}${help}</span>`;
  }

  function renderTable() {
    const items = selectedExps();
    const table = el('metricsTable');
    table.querySelector('thead').innerHTML = `<tr><th>Metric</th>${items.map(e => `<th>${escapeHtml(e.name)}</th>`).join('')}</tr>`;
    table.querySelector('tbody').innerHTML = tableRows.map(row => {
      if (!row.get) return `<tr class="group-row"><td colspan="${items.length + 1}">${escapeHtml(row.group)}</td></tr>`;
      return `<tr><td>${tableMetricLabel(row)}</td>${items.map(e => `<td>${formatTableValue(row.get(e), row.unit)}</td>`).join('')}</tr>`;
    }).join('');
  }

  function formatTableValue(v, unit) {
    if (v == null) return '—';
    const digits = Number.isInteger(v) ? 0 : 3;
    return `${fmt(v, digits)}${unit || ''}`;
  }


  function renderMetricGuide() {
    const box = el('metricGuide');
    if (!box) return;
    const q = (el('metricGuideSearch')?.value || '').trim().toLowerCase();
    const groups = metricGlossary.map(group => {
      const items = group.items.filter(item => {
        if (!q) return true;
        return [group.group, item.name, item.unit, item.meaning, item.read, item.caution].join(' ').toLowerCase().includes(q);
      });
      return { ...group, items };
    }).filter(group => group.items.length);

    if (!groups.length) {
      box.innerHTML = '<div class="guide-empty">没有匹配的指标说明。</div>';
      return;
    }

    box.innerHTML = groups.map((group, index) => `
      <details class="guide-group" ${q || index < 2 ? 'open' : ''}>
        <summary><span>${escapeHtml(group.group)}</span><span class="guide-group-count">${group.items.length} 项</span></summary>
        <div class="guide-items">
          ${group.items.map(item => `
            <article class="guide-item" id="guide-${escapeAttr(item.key)}">
              <h3>${escapeHtml(item.name)}${item.unit ? `<span class="guide-unit">${escapeHtml(item.unit)}</span>` : ''}${directionBadge(metricDirectionByKey[item.key] || 'reference', true)}</h3>
              <p>${escapeHtml(item.meaning)}</p>
              <p class="guide-read"><strong>怎么看：</strong>${escapeHtml(item.read)}</p>
              <p class="guide-caution"><strong>注意：</strong>${escapeHtml(item.caution)}</p>
            </article>`).join('')}
        </div>
      </details>`).join('');
  }

  function renderRevisit() {
    const box = el('revisitCards');
    box.innerHTML = selectedExps().map(exp => {
      const a = exp.revisit?.region_a || {}, b = exp.revisit?.region_b || {};
      return `<article class="revisit-card"><h3>${escapeHtml(exp.name)}</h3><div class="revisit-pairs">
        ${revisitRegion('Region A', a)}${revisitRegion('Region B', b)}
      </div></article>`;
    }).join('') || '<div class="empty-state">请选择方案。</div>';
  }

  function revisitRegion(name, r) {
    return `<div class="revisit-region"><strong>${name}</strong><span>Median ${directionBadge('lower', true)}</span><span>${fmt(r.median_cm)} cm</span><span>P95 ${directionBadge('lower', true)}</span><span>${fmt(r.p95_cm)} cm</span><span>Overlap ≤10cm ${directionBadge('higher', true)}</span><span>${fmt(r.overlap_10cm_pct)}%</span></div>`;
  }

  function renderVideos() {
    const box = el('videoGrid');
    box.innerHTML = selectedExps().map(exp => {
      const src = exp.media?.video;
      return `<article class="video-card"><header><strong>${escapeHtml(exp.name)}</strong><span class="badge">${escapeHtml(exp.loop_closure || '—')}</span></header>${src ? `<video controls preload="metadata" src="${escapeAttr(src)}"></video><div class="video-error">若无法播放，请先运行视频准备脚本，把 MKV 无损封装为 MP4。</div>` : '<div class="video-error">暂无视频。</div>'}</article>`;
    }).join('') || '<div class="empty-state">请选择方案。</div>';
  }

  function renderDataSections() {
    renderSummaryCards(); renderCurrentConclusion(); renderMetricChart(); renderConstraints(); renderTable(); renderMetricGuide(); renderRevisit(); renderVideos();
  }

  function renderAll() { renderDatasetSummary(); renderFilters(); renderDataSections(); }

  function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function escapeAttr(s) { return escapeHtml(s); }

  el('metricSelect').addEventListener('change', e => { state.metric = e.target.value; renderMetricChart(); });
  ['cpuLimit','ramLimit','revisitLimit'].forEach(id => el(id).addEventListener('input', renderConstraints));
  el('selectAllBtn').addEventListener('click', () => {
    const allSelected = expList().length && expList().every(e => state.selected.has(e.id));
    state.selected = new Set(allSelected ? [] : expList().map(e => e.id));
    renderFilters(); renderDataSections();
  });
  el('reloadBtn').addEventListener('click', () => loadDefault().catch(showError));
  el('jsonInput').addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try { applyPayload(JSON.parse(await file.text()), true); } catch (err) { showError(err); }
    e.target.value = '';
  });


  function updateMetricSelectLabels() {
    const select = el('metricSelect');
    [...select.options].forEach(opt => {
      const def = metricDefs[opt.value];
      if (!def) return;
      const meta = directionMeta[def.direction || 'reference'];
      opt.textContent = `${def.label} (${meta.short})`;
    });
  }

  function showError(err) {
    console.error(err);
    el('datasetSummary').textContent = `读取失败：${err.message}. 请通过 ./serve.sh 启动网页，而不是直接双击 index.html。`;
  }

  document.getElementById('themeToggle')?.addEventListener(
    'click',
    toggleTheme
  );

  syncThemeButton();

  updateMetricSelectLabels();
  loadDefault().catch(showError);
})();
