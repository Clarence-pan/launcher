var log = require('./src/log');

log("Launcher begin to open main window.");
nw.Window.open('./src/pages/main/index.html', function(){
    log("Opened main window.");
});
