var fs = require('fs');
var path = require('path');
var util = require('./utils.js');
var semver = require('semver');
var shell = require('shelljs');

module.exports = function(grunt) {

  /*
   * 
   * Create tasks
   *
   */

  // Run tests on multiple versions of angular
  grunt.registerTask('karmangular', 'Run tests against multiple versions of angular', function() {
    // Start karma servers
    var karmaOpts = grunt.config('karma');

    if (grunt.option('browsers')) {
      grunt.config('karma.options.browsers', grunt.option('browsers').split(/,/).map(function(b) { return b.trim(); }));
    }

    var angularTasks = [];
    for (var o in karmaOpts) {
      if (/^angular-/.test(o)) {
        angularTasks.push(o);
      }
    }


    // If there's a start/run argument, run that argument on each angular task
    if (this.args.length > 0) {
      // Run a test on the most recent angular
      if (this.args[0] === 'latest') {
        var latest = 'angular-' + util.latestAngular();
        var configNamespace = 'karma.' + grunt.config.escape(latest);
        grunt.config(configNamespace + '.background', false);
        grunt.config(configNamespace + '.singleRun', true);
        grunt.task.run('karma:' + latest);
      }

      if (this.args[0] === 'start') {
        angularTasks.forEach(function(t) {
          // Set this karma config to background running
          var configNamespace = 'karma.' + grunt.config.escape(t);
          grunt.config(configNamespace + '.background', true);
          grunt.config(configNamespace + '.singleRun', false);
          grunt.task.run('karma:' + t + ':start');
        });
      }
      else if (this.args[0] === 'run') {
        angularTasks.forEach(function(t) {
          // Set this karma config to background running
          var configNamespace = 'karma.' + grunt.config.escape(t);
          grunt.config(configNamespace + '.background', true);
          grunt.config(configNamespace + '.singleRun', false);
          grunt.task.run('karma:' + t + ':run');
        });
      }
    }
    else {
      angularTasks.forEach(function(t) {
        // Set this task to single running
        var configNamespace = 'karma.' + grunt.config.escape(t);
        grunt.config(configNamespace + '.background', false);
        grunt.config(configNamespace + '.singleRun', true);

        grunt.task.run('karma:' + t);
      });
    }
  });

  // Run multiple tests serially, but continue if one of them fails.
  // Adapted from http://stackoverflow.com/questions/16487681/gruntfile-getting-error-codes-from-programs-serially
  grunt.registerTask('serialsauce', function(){
    var options = grunt.config('serialsauce');

    var done = this.async();

    var tasks = {}; options.map(function(t) { tasks[t] = 0 });

    // console.log('options', this.options());

    // grunt.task.run(options);

    var success = true;
    grunt.util.async.forEachSeries(Object.keys(tasks),
      function(task, next) {
        grunt.util.spawn({
          grunt: true,  // use grunt to spawn
          args: [task], // spawn this task
          opts: { stdio: 'inherit' } // print to the same stdout
        }, function(err, result, code) {
          tasks[task] = code;
          if (code !== 0) {
            success = false;
          }
          next();
        });
      },
      function() {
        done(success);
    });
  });

  grunt.registerTask('angulars', 'List available angular versions', function() {
    grunt.log.subhead("AngularJS versions available");
    grunt.log.writeln();
    util.angulars().forEach(function (a) {
      grunt.log.writeln(a);
    });
  });

  grunt.registerTask('saucebrowsers', 'List available saucelabs browsers', function() {
    grunt.log.subhead('SauceLabs Browsers Configured');
    grunt.log.writeln();

    var browsers = util.customLaunchers();
    for (var name in browsers) {
      var b = browsers[name];

      var outs = [];
      ['browserName', 'version', 'platform'].map(function (o) {
        if (b[o]) { outs.push(b[o]); }
      });

      grunt.log.write(grunt.log.wordlist([name], { color: 'yellow' }));

      grunt.log.writeln(grunt.log.wordlist([
        ' [',
        outs.join(' | '),
        ']'
      ], { color: 'green', separator: '' }));
    };
  });

  // Utility functions for showing the version
  grunt.registerTask('current-version', function () {
    grunt.log.writeln(util.getVersion());
  });
  grunt.registerTask('stable-version', function () {
    grunt.log.writeln(util.getStableVersion());
  });

  grunt.registerMultiTask('cutrelease', 'Release the built code', function() {
    // Require the build and ngdocs tassk to be run first
    grunt.task.requires(['build']);

    var options = this.options({
      stableSuffix: '-stable',
      unstableSuffix: '-unstable',
      cleanup: false
    });

    var done = this.async(),
        self = this;

    var tag = util.getVersion();

    grunt.log.writeln("Version: " + tag);

    if (!tag) {
      grunt.fatal("Couldn't get git version");
    }

    // Figure out if the tag is stable or not
    var stable = !/-\w+$/.test(tag);
    grunt.log.writeln('stable', stable);

    // Log release type
    grunt.log.writeln(
     'Preparing '
     + grunt.log.wordlist([stable ? 'stable' : 'unstable'], { color: stable ? 'green' : 'yellow'})
     + ' release version '
     + tag
    );

    // If this is a stable release, create a directory for it in the releases dir
    var extension = stable ? options.stableSuffix : options.unstableSuffix;

    self.files.forEach(function (file) {
      var stableDir;

      // If we're on a stable release or we want to keep unstable releases, create a directory for this release and copy the built files there
      if (stable || options.keepUnstable) {
        grunt.log.writeln("DEST: " + file.dest);
        grunt.log.writeln("TAG: " + tag);
        stableDir = path.join(file.dest, tag);
      }
      
      file.src.forEach(function (f) {
        var oldFileName = path.basename(f);
        var ext = path.extname(f);
        var basename = path.basename(f, ext);

        if (basename.match(/.min/)) {
          ext = '.min' + ext;
          basename = path.basename(f, ext);
        }

        // Skip file if it was already released
        var re = new RegExp('(' + options.stableSuffix + '|' + options.unstableSuffix + ')');
        if (basename.match(re)) {
          return;
        }

        var newFileName = basename + extension + ext;

        // If this is a stable release
        if (stableDir) {
          // Create the stable directory if it doesn't exist
          if (!fs.existsSync(stableDir)) {
            fs.mkdirSync(stableDir);
          }

          var stablePath = path.join(stableDir, oldFileName);

          grunt.log.writeln('Copying ' + f + ' to ' + stablePath);
          // fs.createReadStream(f).pipe(fs.createWriteStream(stablePath));
          shell.cp(f, stablePath);
        }

        var newPath = path.join(file.dest, newFileName)

        grunt.log.writeln('Copying ' + f + ' to ' + newPath);
        // fs.createReadStream(f).pipe(fs.createWriteStream(newPath));
        shell.cp(f, newPath);

        if (options.cleanup) {
          shell.rm(f);
        }
      });
    });
  });
};