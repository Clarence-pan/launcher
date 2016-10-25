module.exports = function(func, context) {
    return function () {
        var args = [].slice.call(arguments, 0);

        return new Promise(function (resolve, reject) {
            args.push(function (x) {
                resolve(x);
            });

            func.apply(context, args);
        });
    }
};

