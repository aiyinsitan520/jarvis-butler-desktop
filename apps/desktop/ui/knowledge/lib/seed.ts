// 原创示例数据：仅用于界面演示。真实数据在 M3 接入 Dexie 后取代这里。
export type Notebook = {
  id: string
  name: string
  desc: string
  tone: 'blue' | 'teal' | 'amber' | 'rose' | 'purple'
  updatedAt: string
  sources: number
  notes: number
}

export type FeedItem = {
  id: string
  kind: 'note' | 'todo' | 'inspiration'
  title: string
  excerpt: string
  meta: string
  tone: 'blue' | 'teal' | 'amber' | 'rose' | 'purple'
}

export type Source = {
  id: string
  title: string
  type: 'web' | 'pdf' | 'video' | 'file' | 'audio'
  addedAt: string
  notebook: string
}

export const notebooks: Notebook[] = [
  {
    id: 'nb-local-first',
    name: '本地优先产品研究',
    desc: '把数据主权做成卖点的产品们',
    tone: 'blue',
    updatedAt: '12 分钟前',
    sources: 6,
    notes: 4,
  },
  {
    id: 'nb-design-system',
    name: '紫蓝设计系统',
    desc: '色板、圆角、阴影与组件规范',
    tone: 'purple',
    updatedAt: '今天 09:40',
    sources: 3,
    notes: 7,
  },
  {
    id: 'nb-readwise',
    name: '阅读与剪藏',
    desc: '待读清单与摘录',
    tone: 'teal',
    updatedAt: '昨天',
    sources: 12,
    notes: 2,
  },
  {
    id: 'nb-ideas',
    name: '灵感收集箱',
    desc: '还没归档的零散想法',
    tone: 'rose',
    updatedAt: '11 月 8 日',
    sources: 0,
    notes: 9,
  },
]

export const feed: FeedItem[] = [
  {
    id: 'f1',
    kind: 'note',
    title: '为什么本地优先值得做',
    excerpt: '用户真正在意的不是「有没有 AI」，而是「我的数据会不会被拿去训练」。把这一点讲清楚，比堆功能更有说服力。',
    meta: '本地优先产品研究 · 刚刚',
    tone: 'blue',
  },
  {
    id: 'f2',
    kind: 'todo',
    title: '给设置页补上「导出 / 导入 JSON」',
    excerpt: '数据可携带是本地优先的底线，导出格式要包含关系表。',
    meta: '今天 18:00 前 · 高优先级',
    tone: 'amber',
  },
  {
    id: 'f3',
    kind: 'inspiration',
    title: '把「来源」做成万能入口',
    excerpt: '网页剪藏、本地 PDF、一条灵感、一次对话，都可以先成为一个来源，再被整理成笔记。',
    meta: '灵感 · 3 小时前',
    tone: 'rose',
  },
  {
    id: 'f4',
    kind: 'note',
    title: '三栏布局的折叠策略',
    excerpt: '左栏放来源，中栏写笔记，右栏放 AI 对话。但右栏不要常驻——让它成为一个抽屉，需要时再拉出来。',
    meta: '紫蓝设计系统 · 昨天',
    tone: 'purple',
  },
  {
    id: 'f5',
    kind: 'todo',
    title: '图谱空态加上「建立第一条关联」引导',
    excerpt: '',
    meta: '已完成 · 昨天 20:12',
    tone: 'teal',
  },
]

export const sources: Source[] = [
  {id: 's1', title: 'Local-first software — 七个理想', type: 'web', addedAt: '今天', notebook: '本地优先产品研究'},
  {id: 's2', title: 'open-notebook VISION.md', type: 'web', addedAt: '今天', notebook: '本地优先产品研究'},
  {id: 's3', title: '设计系统色板推导笔记.pdf', type: 'pdf', addedAt: '昨天', notebook: '紫蓝设计系统'},
  {id: 's4', title: '知识图谱布局算法讲解', type: 'video', addedAt: '昨天', notebook: '阅读与剪藏'},
  {id: 's5', title: '组件圆角与阴影对照表.png', type: 'file', addedAt: '11 月 8 日', notebook: '紫蓝设计系统'},
  {id: 's6', title: '播客：数据主权与个人知识库', type: 'audio', addedAt: '11 月 7 日', notebook: '阅读与剪藏'},
]

export const todos = [
  {id: 't1', title: '给设置页补上导出 / 导入 JSON', done: false, due: '今天 18:00', priority: 'high' as const},
  {id: 't2', title: '把笔记本三栏的折叠状态持久化', done: false, due: '今天', priority: 'normal' as const},
  {id: 't3', title: '为图谱节点补上类型色板', done: false, due: '本周', priority: 'normal' as const},
  {id: 't4', title: '整理紫蓝设计系统的 token 表', done: true, due: '昨天', priority: 'normal' as const},
  {id: 't5', title: '检查深浅主题的对比度', done: true, due: '昨天', priority: 'low' as const},
]

export const inspirations = [
  {
    id: 'i1',
    title: '把「来源」做成万能入口',
    content: '网页剪藏、本地 PDF、一条灵感、一次对话，都可以先成为一个来源，再被整理成笔记。',
    time: '3 小时前',
  },
  {
    id: 'i2',
    title: '让 AI 只在需要时出现',
    content: '不配置模型也能完整使用；配置之后，它才在对话抽屉里出现。默认不打搅。',
    time: '今天 08:10',
  },
  {
    id: 'i3',
    title: '关系的三种类型',
    content: '引用、派生、矛盾。图谱里只画这三种边，避免变成一团乱麻。',
    time: '昨天',
  },
  {
    id: 'i4',
    title: '空态不是占位，是第一课',
    content: '每个空态都应该告诉用户下一步该做什么，而不是放一个灰色插画就完事。',
    time: '11 月 8 日',
  },
]
