const { app, BrowserWindow, ipcMain, screen } = require('electron')
const path = require('path')
const fs   = require('fs')
const { exec } = require('child_process')

const DATA_PATH = path.join(app.getPath('userData'), 'mocha-data.json')

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    const defaults = { tasks: [], streak: 0, lastDate: null, totalCompleted: 0 }
    fs.writeFileSync(DATA_PATH, JSON.stringify(defaults, null, 2))
    return defaults
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
}

let win = null

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    width: 160,
    height: 180,
    x: width - 180,
    y: height - 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('index.html')
  win.setIgnoreMouseEvents(false)

  ipcMain.on('expand', () => {
    win.setSize(300, 560)
    win.setPosition(width - 320, height - 580)
  })
  ipcMain.on('collapse', () => {
    win.setSize(160, 180)
    win.setPosition(width - 180, height - 200)
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('load-data', () => loadData())
ipcMain.handle('save-data', (_, data) => { saveData(data); return true })
ipcMain.on('quit', () => app.quit())
ipcMain.on('drag-window', (_, x, y) => {
  win.setPosition(Math.round(x), Math.round(y))
})
ipcMain.handle('check-spotify', () => new Promise(resolve => {
  exec(
    'powershell -command "Get-Process spotify -ErrorAction SilentlyContinue | Select-Object -ExpandProperty MainWindowTitle"',
    (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null)
      const title = stdout.trim()
      resolve(title && title !== 'Spotify' ? title : null)
    }
  )
}))
ipcMain.on('set-on-top', (_, flag) => {
  win.setAlwaysOnTop(flag)
})
