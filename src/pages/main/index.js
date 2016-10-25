try{
    var log = require('../../log');

    log("Begin to load App.");
    var App = require('../../app');
    log("Loaded App.");
} catch (e){
    alert("Error: got an exception when initializing: " + e);
}

$(function(){
    try {
        if (!App) {
            alert("Error: Invalid App!");
            return;
        }

        var $logs = $('#logs');
        log.addLogger(function(msg){
            var $log = $('<li></li>').text(msg).appendTo($logs);
            $log[0].scrollIntoView();
        });

        var refreshLogsSize = function(){
            $logs.css('height', $(window).height() - $('#programs').height() - 40);
            $logs.css('width', $(window).width() - 50);
        };

        $(window).on('resize', refreshLogsSize).trigger('resize');

        var programTpl = $('#programTpl').html();
        var programs = {};

        App.getPrograms()
            .then(function(programs){
                log("Got programs...", programs);
                $.each(programs, function(i, program){
                    programs[program.id] = addProgram(program);
                });
                refreshLogsSize();
            })
            .catch(reportError);

        App.on('add-program', function(program){
            programs[program.id] = addProgram(program);
            refreshLogsSize();
        });

        App.on('remove-program', function(program){
            if (programs[program.id]){
                programs[program.id].remove();
                delete programs[program.id];
            }
        });

        App.on('update-program', function(program){
            if (programs[program.id]){
                updateProgram(programs[program.id], program);
            }
        });

        $('#programs')
            .on('click', '.btn-start', function(){
                App.startProgram($(this).closest('.program').data('id'))
                    .catch(reportError);
            })
            .on('click', '.btn-stop', function(){
                App.stopProgram($(this).closest('.program').data('id'))
                    .catch(reportError);
            })
            .on('click', '.btn-restart', function(){
                App.restartProgram($(this).closest('.program').data('id'))
                    .catch(reportError);
            });

        log("Begin to start App...");
        App.start()
            .catch(reportError);
        log("App started.");
    } catch (e){
        alert("Error: got an exception when rendering: " + e);
    }


    function reportError(e)
    {
        alert("Error: got an unexpected error: " + e);
    }

    function addProgram(program)
    {
        var $program = $(programTpl);

        updateProgram($program, program);

        $program.appendTo('#programs');

        return $program;
    }

    function updateProgram($program, program)
    {
        $program.data('id', program.id);
        $program.attr('class', 'program ' + program.status);
        $program.find('.name').text(program.name).attr('title', program.desc);
        $program.find('.status').text(program.status);
        $program.find('.pid').text(program.pid);
    }
});
