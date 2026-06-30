const { app, BrowserWindow, ipcMain, Menu } = require('electron/main');
const path = require('node:path');
const fs = require('node:fs');
const { pool, initDatabase } = require('./database/connection');

// 文档存储目录
const documentsDir = path.join(__dirname, 'documents');
// 确保文档目录存在
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// 创建主窗口
const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '笔记管理工具',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');

  // 创建中文菜单
  createMenu(win);
};

// 创建应用菜单
const createMenu = (win) => {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建文档',
          accelerator: 'CmdOrCtrl+N',
          click: () => win.webContents.send('menu:new')
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit'
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '强制重新加载', accelerator: 'Shift+CmdOrCtrl+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: '开发',
      submenu: [
        { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(win, {
              type: 'info',
              title: '关于笔记管理工具',
              message: '笔记管理工具 v1.0.0',
              detail: '基于 Electron + React + MySQL 开发的桌面笔记管理工具\n支持 Markdown 编辑、分类管理、标签系统和全文搜索'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// 应用启动
app.whenReady().then(async () => {
  // 初始化数据库
  await initDatabase();
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ========== IPC 处理器 ==========

// 创建文档
ipcMain.handle('document:create', async (event, { title, categoryId, content }) => {
  const fileName = `${Date.now()}.md`;
  const filePath = path.join(documentsDir, fileName);

  // 写入文件
  fs.writeFileSync(filePath, content || '');

  // 写入数据库
  const [result] = await pool.execute(
    'INSERT INTO documents (title, file_path, category_id, content_preview) VALUES (?, ?, ?, ?)',
    [title, filePath, categoryId || null, content ? content.substring(0, 500) : '']
  );

  return {
    id: result.insertId,
    title,
    filePath,
    categoryId,
    createdAt: new Date(),
    updatedAt: new Date()
  };
});

// 读取文档内容
ipcMain.handle('document:read', async (event, documentId) => {
  const [rows] = await pool.execute(
    'SELECT * FROM documents WHERE id = ?',
    [documentId]
  );

  if (rows.length === 0) {
    return null;
  }

  const doc = rows[0];
  const content = fs.readFileSync(doc.file_path, 'utf-8');

  return { ...doc, content };
});

// 保存文档
ipcMain.handle('document:save', async (event, { id, title, content, categoryId }) => {
  const [rows] = await pool.execute(
    'SELECT file_path FROM documents WHERE id = ?',
    [id]
  );

  if (rows.length === 0) {
    return false;
  }

  const filePath = rows[0].file_path;

  // 更新文件
  fs.writeFileSync(filePath, content);

  // 更新数据库
  await pool.execute(
    'UPDATE documents SET title = ?, category_id = ?, content_preview = ?, updated_at = NOW() WHERE id = ?',
    [title, categoryId || null, content.substring(0, 500), id]
  );

  return true;
});

// 删除文档
ipcMain.handle('document:delete', async (event, documentId) => {
  const [rows] = await pool.execute(
    'SELECT file_path FROM documents WHERE id = ?',
    [documentId]
  );

  if (rows.length > 0) {
    // 删除文件
    if (fs.existsSync(rows[0].file_path)) {
      fs.unlinkSync(rows[0].file_path);
    }
    // 删除数据库记录
    await pool.execute('DELETE FROM document_tags WHERE document_id = ?', [documentId]);
    await pool.execute('DELETE FROM documents WHERE id = ?', [documentId]);
  }

  return true;
});

// 获取文档列表
ipcMain.handle('document:list', async (event, { categoryId, tagId }) => {
  let query = `
    SELECT d.*, GROUP_CONCAT(t.name) as tags
    FROM documents d
    LEFT JOIN document_tags dt ON d.id = dt.document_id
    LEFT JOIN tags t ON dt.tag_id = t.id
  `;
  const conditions = [];
  const params = [];

  if (categoryId) {
    conditions.push('d.category_id = ?');
    params.push(categoryId);
  }

  if (tagId) {
    conditions.push('dt.tag_id = ?');
    params.push(tagId);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY d.id ORDER BY d.updated_at DESC';

  const [rows] = await pool.execute(query, params);
  return rows;
});

// 搜索文档
ipcMain.handle('document:search', async (event, keyword) => {
  const [rows] = await pool.execute(
    `SELECT d.*, GROUP_CONCAT(t.name) as tags
     FROM documents d
     LEFT JOIN document_tags dt ON d.id = dt.document_id
     LEFT JOIN tags t ON dt.tag_id = t.id
     WHERE d.title LIKE ? OR d.content_preview LIKE ?
     GROUP BY d.id ORDER BY d.updated_at DESC`,
    [`%${keyword}%`, `%${keyword}%`]
  );
  return rows;
});

// ========== 分类操作 ==========

ipcMain.handle('category:list', async () => {
  const [rows] = await pool.execute(
    'SELECT * FROM categories ORDER BY name'
  );
  return rows;
});

ipcMain.handle('category:create', async (event, { name, parentId }) => {
  const [result] = await pool.execute(
    'INSERT INTO categories (name, parent_id) VALUES (?, ?)',
    [name, parentId || null]
  );
  return { id: result.insertId, name, parentId };
});

ipcMain.handle('category:delete', async (event, categoryId) => {
  // 将该分类下的文档移到默认分类
  await pool.execute(
    'UPDATE documents SET category_id = NULL WHERE category_id = ?',
    [categoryId]
  );
  await pool.execute('DELETE FROM categories WHERE id = ?', [categoryId]);
  return true;
});

// ========== 标签操作 ==========

ipcMain.handle('tag:list', async () => {
  const [rows] = await pool.execute(
    'SELECT t.*, COUNT(dt.document_id) as document_count FROM tags t LEFT JOIN document_tags dt ON t.id = dt.tag_id GROUP BY t.id ORDER BY t.name'
  );
  return rows;
});

ipcMain.handle('tag:create', async (event, name) => {
  try {
    const [result] = await pool.execute(
      'INSERT INTO tags (name) VALUES (?)',
      [name]
    );
    return { id: result.insertId, name };
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      // 标签已存在，返回现有标签
      const [rows] = await pool.execute('SELECT * FROM tags WHERE name = ?', [name]);
      return rows[0];
    }
    throw err;
  }
});

ipcMain.handle('tag:addToDocument', async (event, { documentId, tagId }) => {
  await pool.execute(
    'INSERT IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)',
    [documentId, tagId]
  );
  return true;
});

ipcMain.handle('tag:removeFromDocument', async (event, { documentId, tagId }) => {
  await pool.execute(
    'DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?',
    [documentId, tagId]
  );
  return true;
});

ipcMain.handle('tag:delete', async (event, tagId) => {
  await pool.execute('DELETE FROM document_tags WHERE tag_id = ?', [tagId]);
  await pool.execute('DELETE FROM tags WHERE id = ?', [tagId]);
  return true;
});