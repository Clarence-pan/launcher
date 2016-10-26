const log = require('./src/log')
const electron = require('electron')

// Module to control application life.
const ElectronApp = electron.app

// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

// my app...
const Launcher = require('./src/app')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null


function createWindow() {
    log("Launcher begin to open main window.")

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 600,
        height: 400,
        center: true,
        title: "Launcher"
    })

    mainWindow.setMenu(null);

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__dirname}/src/pages/main/index.html`)

    // Open the DevTools.
    //mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        log("Main window closed.")

        // since we only have one window in this app, when it is close, the app should quit...
        cleanup().then(quit, quit)
    })

    log("Main window opened.")
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
ElectronApp.on('ready', createWindow)

// cleanup before quit
function cleanup() {
    try {
        return Launcher.stopAllPrograms({timeout: 3000});
    } catch (e) {
        return Promise.reject(e);
    }
}

// quit the application
function quit() {
    log("Application quit.")

    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null

    // quit...
    ElectronApp.quit()
}

// Quit when all windows are closed.
//ElectronApp.on('window-all-closed', function () {
//    log("Window has all closed so it is time to quit.");
//    // On OS X it is common for applications and their menu bar
//    // to stay active until the user quits explicitly with Cmd + Q
//    if (process.platform !== 'darwin') {
//        ElectronApp.quit()
//    }
//})

//ElectronApp.on('activate', function () {
//    // On OS X it's common to re-create a window in the app when the
//    // dock icon is clicked and there are no other windows open.
//    if (mainWindow === null) {
//        createWindow()
//    }
//})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

