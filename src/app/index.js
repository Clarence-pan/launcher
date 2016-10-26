var path = require('path');
var glob = require('glob');
var fs = require('fs');
var delay = require('delay');
var child_process = require('child_process');
var isRunning = require('is-running');
var treeKill = require('tree-kill');

var log = require('../log');

var CONFIG_DIR = path.join(__dirname, '../../config');

var EVENT_ADD_PROGRAM = 'add-program';
var EVENT_REMOVE_PROGRAM = 'remove-program';
var EVENT_UPDATE_PROGRAM = 'update-program';

var STATUS_INITIAL = 'initial';
var STATUS_STARTING = 'starting';
var STATUS_RUNNING = 'running';
var STATUS_ABORT = 'abort';
var STATUS_STOPPING = 'stopping';
var STATUS_STOPPED = 'stopped';

var programs = {};
var eventListeners = {};

function startApp() {
    return loadConfigs()
        .then(function (configs) {
            log("Loaded configs: ", configs);
            each(configs, function (config, id) {
                programs[id] = {
                    id: id,
                    config: config,
                    name: config.name,
                    desc: config.desc,
                    pid: 0,
                    status: STATUS_INITIAL
                };

                notifyEvent(EVENT_ADD_PROGRAM, programs[id]);
                notifyEvent(EVENT_UPDATE_PROGRAM, programs[id]);

                if (config.autoStart) {
                    startProgram(id);
                }
            });
        });
}

function addEventListener(eventType, callback) {
    if (!eventListeners[eventType]) {
        eventListeners[eventType] = [];
    }

    eventListeners[eventType].push(callback);
}

function notifyEvent(eventType, data) {
    if (eventListeners[eventType]) {
        each(eventListeners[eventType], function (listener) {
            if (listener && listener.call) {
                listener.call(null, data);
            }
        });
    }
}

function getPrograms() {
    return Promise.resolve(programs);
}

function loadConfigs() {
    return new Promise(function (resolve, reject) {
        glob(CONFIG_DIR + '/*.json', function (er, files) {
            try {
                var configs = {};

                each(files, function (file) {
                    var id = path.basename(file, '.json');
                    var config = extend({
                        id: id,
                        name: 'unnamed',
                        enabled: false,
                        shell: false,
                        exec: '',
                        cwd: '',
                        autoStart: false,
                        autoRestart: false,
                        retryTimes: 3,
                        stdout: null,
                        stderr: null,
                        stop: null
                    }, parseJsonFile(file));

                    if (config.args && (typeof config.args === 'string')){
                        config.args = config.args.split(' ');
                    }

                    if (config.enabled){
                        configs[id] = config;
                    }
                });

                resolve(configs);
            } catch (e) {
                reject(e);
            }
        });
    });
}

function parseJsonFile(file) {
    var fileContent = fs.readFileSync(file, 'utf8');
    return JSON.parse(fileContent);
}

function startProgram(programId) {
    return new Promise(function (resolve, reject) {
        log("Starting program " + programId);

        var program = programs[programId];
        if (!program) {
            reject(new Error("No such program: #" + programId));
            return;
        }

        if (!program.config) {
            reject(new Error("No config of program#" + programId));
            return;
        }

        updateProgram(program, { status: STATUS_STARTING });

        exec(program.config)
            .then(function(programProcess){
                if (!isRunning(programProcess.pid)){
                    log(programId + " exit very quickly...");
                    updateProgram(program, {status: STATUS_ABORT, pid: programProcess.pid });
                    resolve();
                    return;
                }

                var pid = programProcess.pid;
                var watchingTimer = setInterval(function(){
                    if (!isRunning(pid)){
                        clearInterval(watchingTimer);
                        log("Program " + programId + " exit -- watched by timer...");
                        updateProgram(program, { status: STATUS_ABORT });
                    }
                }, 250);

                programProcess.on('exit', function(code, signal){
                    clearInterval(watchingTimer);
                    log("Program " + programId + " exit. Code = " + code + " Signal = " + signal);
                    updateProgram(program, { status: STATUS_ABORT });
                });

                programProcess.on('error', function(err){
                    log("There is an error when starting " + programId + ": ", err);
                    updateProgram(program, { status: STATUS_ABORT });
                    reject();
                });

                updateProgram(program, { status: STATUS_RUNNING, pid: programProcess.pid });
                resolve();


            }, function(err){
                log("There is an error when starting " + programId + ": ", err);
                updateProgram(program, { status: STATUS_ABORT });
                reject();
                throw err;
            });
    });
}

function exec(exe) {
    return new Promise(function(resolve, reject){
        if (!exe){
            reject("Invalid exec info!");
        }

        var options = {
            cwd: exe.cwd || process.cwd(),
            shell: !!exe.shell
        };

        var stdout = 'ignore', stderr = 'ignore', stdin = 'ignore';

        if (exe.stdout){
            stdout = fs.openSync(exe.stdout, 'a+');
        }

        if (exe.stderr){
            if (exe.stderr.toLowerCase() === 'stdout'){
                stderr = stdout;
            } else {
                stdout = fs.openSync(exe.stdout, 'a+');
            }
        }

        options.stdio = [stdin, stdout, stderr];

        log("exec ", [exe.exec, exe.args || [], options]);

        resolve(child_process.spawn(exe.exec, exe.args || [], options));
    });
}

function stopProgram(programId) {
    return new Promise(function (resolve, reject) {
        var program = programs[programId];
        if (!program) {
            reject(new Error("No such program: #" + programId));
            return;
        }

        if (!program.config) {
            reject(new Error("No config of program#" + programId));
            return;
        }

        updateProgram(program, {status: STATUS_STOPPING});

        if (!program.config.stop) {
            treeKill(program.pid);
            delay(100)
                .then(function(){
                    updateProgram(program, {status: STATUS_STOPPED});
                    resolve();
                }, reject);
        } else {
            return exec(program.config.stop)
                .then(function(stopProcess){
                    if (!isRunning(stopProcess.pid)){
                        log("Stop process for " + programId + " exit very quickly...");
                        updateProgram(program, {status: STATUS_STOPPED});
                        resolve();
                        return;
                    }

                    var pid = program.pid;
                    var watchingTimer = setInterval(function(){
                        if (!isRunning(pid)){
                            clearInterval(watchingTimer);
                            log("Program " + programId + " exit -- watched by timer...");
                            updateProgram(program, { status: STATUS_STOPPED });
                            resolve();
                        }
                    }, 250);

                    stopProcess.on('exit', function(){
                        log("Stop process for " + programId + " exit. Code = " + code + " Signal = " + signal);
                        updateProgram(program, {status: STATUS_STOPPED});
                        resolve();
                    });

                    stopProcess.on('error', function(err){
                        log("There is an error when running stop process for " + programId + ": ", err);
                        updateProgram(program, {status: STATUS_RUNNING});
                        reject();
                    });
                }, function(){
                    updateProgram(program, {status: STATUS_RUNNING});
                    reject();
                });
        }
    });
}

function restartProgram(programId) {
    return stopProgram(programId)
        .then(function () {
            return startProgram(programId);
        });
}


function updateProgram(program, data){
    extend(program, data);
    notifyEvent(EVENT_UPDATE_PROGRAM, program);
}

function each(x, cb) {
    if (!x) {
        return;
    }

    for (var k in x) {
        if (x.hasOwnProperty(k)) {
            if (cb(x[k], k) === false) {
                break;
            }
        }
    }
}

function extend(receiver) {
    receiver = receiver || {};

    for (var i = 1; i < arguments.length; i++) {
        var arg = arguments[i];
        if (!arg) {
            continue;
        }

        for (var k in arg) {
            if (arg.hasOwnProperty(k)) {
                receiver[k] = arg[k];
            }
        }
    }

    return receiver;
}

function stopAllPrograms()
{
    return Promise.all(Object.keys(programs).map(function(programId){
        return stopProgram(programId);
    }));
}


module.exports = {
    start: startApp,
    on: addEventListener,
    getPrograms: getPrograms,
    startProgram: startProgram,
    stopProgram: stopProgram,
    restartProgram: restartProgram,
    stopAllPrograms: stopAllPrograms,
    STATUS_INITIAL: STATUS_INITIAL,
    STATUS_STARTING: STATUS_STARTING,
    STATUS_RUNNING: STATUS_RUNNING,
    STATUS_ABORT: STATUS_ABORT,
    STATUS_STOPPING: STATUS_STOPPING,
    STATUS_STOPPED: STATUS_STOPPED,
    EVENT_ADD_PROGRAM: EVENT_ADD_PROGRAM,
    EVENT_REMOVE_PROGRAM: EVENT_REMOVE_PROGRAM,
    EVENT_UPDATE_PROGRAM: EVENT_UPDATE_PROGRAM,
};

