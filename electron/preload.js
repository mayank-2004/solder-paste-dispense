const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fs', {
  saveJobLog: (opts) => ipcRenderer.invoke('fs:saveJobLog', opts),
  saveSettings: (data) => ipcRenderer.invoke('fs:saveSettings', data),
  loadSettings: () => ipcRenderer.invoke('fs:loadSettings'),
});

contextBridge.exposeInMainWorld('serial', {
    list: () => ipcRenderer.invoke('serial:list'),
    open: (opts) => ipcRenderer.invoke('serial:open', opts),
    close: () => ipcRenderer.invoke('serial:close'),
    writeLine: (line) => ipcRenderer.invoke('serial:writeLine', line),
    sendGcode: (text) => ipcRenderer.invoke('serial:sendGcode', text),
    writeMany: (lines, delayMs = 3) => ipcRenderer.invoke('serial:writeMany', { lines, delayMs }),
    onData: (handler) => {
        // Allow multiple listeners
        const subscription = (_evt, line) => handler(line);
        ipcRenderer.on('serial:data', subscription);
        return () => ipcRenderer.removeListener('serial:data', subscription);
    },
    onPortClosed: (handler) => {
        const subscription = () => handler();
        ipcRenderer.on('serial:port-closed', subscription);
        return () => ipcRenderer.removeListener('serial:port-closed', subscription);
    }
});
