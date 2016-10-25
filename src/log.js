var fs = require("fs");
var util = require('util');
var path = require('path');

var LOG_PATH = path.join(__dirname, "../logs/launcher.log");
var loggers = [];

function log(msg){
    try {
        msg = (new Date()).toISOString() + ": " + util.format.apply(util, arguments);
        fs.appendFileSync(LOG_PATH, msg + "\n");
        loggers.forEach(function(logger){
            logger(msg);
        });
    } catch (e){
        console.error("Got an exception when logging: ", e);
    }
}

function addLogger(logger){
    loggers.push(logger);
}

function debug(msg){
    return log(msg);
}

function dir(x, depth){
    if (typeof depth === 'undefined'){
        depth = 5;
    } else if (!depth){
        return '<' + (typeof x) + '>';
    }

    if (typeof x === 'undefined'){
        return '<undefined>';
    }

    if (typeof x === null){
        return '<null>';
    }

    if (typeof x === 'number'){
        return x;
    }

    if (typeof x === 'string'){
        return x;
    }

    var obj = {
        __type__: typeof x
    };
    for (var k in x){
        var val = x[k];
        obj[k] = dir(val, depth - 1);
    }


    return obj;
}

log.debug = debug;
log.dir = dir;
log.addLogger = addLogger;

module.exports = log;
