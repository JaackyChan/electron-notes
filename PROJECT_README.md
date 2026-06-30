# 桌面笔记/文档管理系统

## 项目简介

基于 Electron + React + Node.js + MySQL 技术栈开发的跨平台桌面笔记管理工具，支持 Markdown 文档的创建、编辑、分类管理、标签系统及全文搜索功能。项目采用现代化的前后端分离架构，通过 IPC 通信实现主进程与渲染进程的高效数据交互，为用户提供流畅的本地文档管理体验。

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 应用框架 | Electron | 28.0.0 |
| 前端框架 | React | 18.2.0 |
| 数据库 | MySQL | mysql2 3.6.5 |
| 构建工具 | Webpack + Babel | 5.89.0 / 7.23.5 |
| Markdown 渲染 | react-markdown + remark-gfm | 9.0.1 / 4.0.0 |
| 环境配置 | dotenv | 16.3.1 |

---

## 项目架构

```
electron_app/
├── main.js                 # Electron 主进程（文件系统操作 + IPC 处理）
├── preload.js              # 预加载脚本（安全暴露 API 给渲染进程）
├── database/
│   ├── connection.js       # MySQL 连接池管理
│   └── schema.sql          # 数据库表结构定义
├── src/                    # React 前端源码
│   ├── App.jsx             # 主组件（状态管理 + 业务逻辑）
│   ├── components/
│   │   ├── Sidebar.jsx     # 侧边栏（分类/标签导航）
│   │   ├── NoteList.jsx    # 文档列表展示
│   │   ├── Editor.jsx      # Markdown 编辑器（实时预览）
│   │   └── SearchBar.jsx   # 全文搜索栏
│   └── styles/main.css     # 简约浅色主题样式
├── documents/              # 本地 Markdown 文件存储目录
└── webpack.config.js       # 前端构建配置
```

---

## 核心功能模块

### 1. 文档管理模块
- **创建文档**：新建 Markdown 文件，自动生成唯一文件名，同步写入数据库元数据
- **编辑文档**：实时 Markdown 编辑，支持编辑/预览模式切换
- **保存文档**：自动提取标题（首行 # 标题），更新内容预览字段用于搜索
- **删除文档**：同步删除本地文件、数据库记录及标签关联

### 2. 分类系统
- 支持创建多级分类结构（parent_id 实现层级关系）
- 分类导航快速筛选文档
- 删除分类时自动解除文档关联

### 3. 标签系统
- 文档可关联多个标签
- 标签统计显示关联文档数量
- 标签筛选快速定位相关文档

### 4. 全文搜索
- 基于 MySQL FULLTEXT 索引实现标题 + 内容预览搜索
- 支持模糊匹配，实时返回搜索结果

---

## 技术实现细节

### IPC 通信设计

采用 Electron 安全通信模式，主进程通过 `ipcMain.handle()` 注册处理器，渲染进程通过 preload.js 暴露的 API 调用：

```javascript
// preload.js - 安全暴露 API
contextBridge.exposeInMainWorld('noteAPI', {
  createDocument: (title, categoryId, content) =>
    ipcRenderer.invoke('document:create', { title, categoryId, content }),
  // ... 其他 API
});

// 渲染进程调用
await window.noteAPI.createDocument('新文档', 1, '# 内容');
```

**实现的 IPC 接口：**

| 接口 | 功能 | 参数 |
|------|------|------|
| document:create | 创建文档 | title, categoryId, content |
| document:read | 读取文档详情 | id |
| document:save | 保存文档内容 | id, title, content, categoryId |
| document:delete | 删除文档 | id |
| document:list | 获取文档列表 | categoryId, tagId |
| document:search | 全文搜索 | keyword |
| category:list | 分类列表 | - |
| category:create | 创建分类 | name, parentId |
| tag:list | 标签列表 | - |
| tag:addToDocument | 添加标签关联 | documentId, tagId |

### 数据库设计

**documents 表（文档元数据）：**
```sql
CREATE TABLE documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255),            -- 文档标题
  file_path VARCHAR(500),        -- 本地文件路径
  category_id INT,               -- 所属分类
  created_at DATETIME,           -- 创建时间
  updated_at DATETIME,           -- 更新时间
  content_preview TEXT           -- 内容预览（用于全文搜索）
);
```

**document_tags 表（文档-标签关联）：**
```sql
CREATE TABLE document_tags (
  document_id INT,
  tag_id INT,
  PRIMARY KEY (document_id, tag_id)
);
```

### React 状态管理

采用 React Hooks 进行状态管理，主要状态包括：

- `documents`：当前文档列表
- `categories`：分类列表
- `tags`：标签列表
- `selectedDocument`：当前编辑文档
- `searchKeyword`：搜索关键词

通过 `useEffect` 实现数据加载与响应式更新，确保界面与数据同步。

### 文件系统操作

主进程直接操作本地文件系统，确保数据安全存储：

```javascript
// 创建文档文件
fs.writeFileSync(filePath, content);

// 读取文档内容
const content = fs.readFileSync(filePath, 'utf-8');

// 删除文档文件
fs.unlinkSync(filePath);
```

---

## 项目亮点

1. **安全的 IPC 通信**：采用 contextBridge 安全暴露 API，避免直接启用 nodeIntegration
2. **混合存储策略**：MySQL 存储元数据 + 本地文件存储内容，兼顾查询效率与数据持久化
3. **实时预览编辑**：react-markdown + remark-gfm 支持 GitHub 风格 Markdown 渲染
4. **原生模块重建**：通过 electron-rebuild 解决 mysql2 原生模块兼容问题
5. **模块化组件设计**：Sidebar、NoteList、Editor、SearchBar 独立组件，易于维护扩展

---

## 运行方式

```bash
# 安装依赖
npm install

# 重建原生模块
npm run rebuild

# 构建前端
npm run build

# 启动应用
npm start
```

---

## 项目成果

- 实现完整的桌面笔记管理功能
- 支持 Markdown 文档的 CRUD 操作
- 支持分类与标签多维管理
- 支持全文搜索快速定位
- 提供简约浅色主题界面
- 数据安全存储于本地