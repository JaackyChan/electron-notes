const { contextBridge, ipcRenderer } = require('electron');

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('noteAPI', {
  // 文档操作
  createDocument: (title, categoryId, content) =>
    ipcRenderer.invoke('document:create', { title, categoryId, content }),

  readDocument: (id) =>
    ipcRenderer.invoke('document:read', id),

  saveDocument: (id, title, content, categoryId) =>
    ipcRenderer.invoke('document:save', { id, title, content, categoryId }),

  deleteDocument: (id) =>
    ipcRenderer.invoke('document:delete', id),

  listDocuments: (categoryId, tagId) =>
    ipcRenderer.invoke('document:list', { categoryId, tagId }),

  searchDocuments: (keyword) =>
    ipcRenderer.invoke('document:search', keyword),

  // 分类操作
  listCategories: () =>
    ipcRenderer.invoke('category:list'),

  createCategory: (name, parentId) =>
    ipcRenderer.invoke('category:create', { name, parentId }),

  deleteCategory: (id) =>
    ipcRenderer.invoke('category:delete', id),

  // 标签操作
  listTags: () =>
    ipcRenderer.invoke('tag:list'),

  createTag: (name) =>
    ipcRenderer.invoke('tag:create', name),

  addTagToDocument: (documentId, tagId) =>
    ipcRenderer.invoke('tag:addToDocument', { documentId, tagId }),

  removeTagFromDocument: (documentId, tagId) =>
    ipcRenderer.invoke('tag:removeFromDocument', { documentId, tagId }),

  deleteTag: (id) =>
    ipcRenderer.invoke('tag:delete', id),

  // 菜单事件监听
  onMenuNew: (callback) => {
    const handler = (event) => callback();
    ipcRenderer.on('menu:new', handler);
    return () => ipcRenderer.removeListener('menu:new', handler);
  }
});