'use strict';

var gulp = require('gulp');
var bump = require('gulp-bump');
var concat = require('gulp-concat');
var filter = require('gulp-filter');
var inject = require('gulp-inject');
var minifyCSS = require('gulp-minify-css');
var minifyHTML = require('gulp-minify-html');
var plumber = require('gulp-plumber');
var sourcemaps = require('gulp-sourcemaps');
var template = require('gulp-template');
var tsc = require('gulp-typescript');
var uglify = require('gulp-uglify');
var watch = require('gulp-watch');
var sass = require('gulp-sass');
var cssInlineImages = require('gulp-css-inline-images');
//var MaterialCustomizer = require('./docs/_assets/customizer.js');
var file = require('gulp-file');


var Builder = require('systemjs-builder');
var del = require('del');
var fs = require('fs');
var join = require('path').join;
var runSequence = require('run-sequence');
var semver = require('semver');
var series = require('stream-series');

var http = require('http');
var connect = require('connect');
var serveStatic = require('serve-static');
var openResource = require('open');

// --------------
// Configuration.
var APP_BASE = '/';

var PATH = {
  dest: {
    all: 'dist',
    dev: {
      all: 'dist/dev',
      lib: 'dist/dev/lib',
      ng2: 'dist/dev/lib/angular2.js',
      router: 'dist/dev/lib/router.js'
    },
    prod: {
      all: 'dist/prod',
      lib: 'dist/prod/lib'
    }
  },
  src: {
    // Order is quite important here for the HTML tag injection.
    lib: [
      './node_modules/angular2/node_modules/traceur/bin/traceur-runtime.js',
      './node_modules/es6-module-loader/dist/es6-module-loader-sans-promises.js',
      './node_modules/es6-module-loader/dist/es6-module-loader-sans-promises.js.map',
      './node_modules/reflect-metadata/Reflect.js',
      './node_modules/reflect-metadata/Reflect.js.map',
      './node_modules/systemjs/dist/system.src.js',
      './node_modules/angular2/node_modules/zone.js/dist/zone.js'
    ]
  }
};

var ng2Builder = new Builder({
  paths: {
    'angular2/*': 'node_modules/angular2/es6/dev/*.js',
    rx: 'node_modules/angular2/node_modules/rx/dist/rx.js'
  },
  meta: {
    rx: {
      format: 'cjs'
    }
  }
});

var appProdBuilder = new Builder({
  baseURL: 'file:./tmp',
  meta: {
    'angular2/angular2': { build: false },
    'angular2/router': { build: false }
  }
});

var HTMLMinifierOpts = { conditionals: true };

var tsProject = tsc.createProject('tsconfig.json', {
  typescript: require('typescript')
});

var semverReleases = ['major', 'premajor', 'minor', 'preminor', 'patch',
                      'prepatch', 'prerelease'];

var port = 5555;

// --------------
// Clean.

gulp.task('clean', function (done) {
  del(PATH.dest.all, done);
});

gulp.task('clean.dev', function (done) {
  del(PATH.dest.dev.all, done);
});

gulp.task('clean.app.dev', function (done) {
  // TODO: rework this part.
  del([join(PATH.dest.dev.all, '**/*'), '!' +
       PATH.dest.dev.lib, '!' + join(PATH.dest.dev.lib, '*')], done);
});

gulp.task('clean.prod', function (done) {
  del(PATH.dest.prod.all, done);
});

gulp.task('clean.app.prod', function (done) {
  // TODO: rework this part.
  del([join(PATH.dest.prod.all, '**/*'), '!' +
       PATH.dest.prod.lib, '!' + join(PATH.dest.prod.lib, '*')], done);
});

gulp.task('clean.tmp', function(done) {
  del('tmp', done);
});

// --------------
// Build dev.

gulp.task('build.ng2.dev', function () {
  ng2Builder.build('angular2/router', PATH.dest.dev.router, {});
  return ng2Builder.build('angular2/angular2', PATH.dest.dev.ng2, {});
});

gulp.task('build.lib.dev', ['build.ng2.dev'], function () {
  return gulp.src(PATH.src.lib)
    .pipe(gulp.dest(PATH.dest.dev.lib));
});

gulp.task('build.js.dev', function () {
  var result = gulp.src(['./app/**/*ts', './app/**/*js'])
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(tsc(tsProject));

  return result.js
    .pipe(sourcemaps.write())
    .pipe(template(templateLocals()))
    .pipe(gulp.dest(PATH.dest.dev.all));
});

gulp.task('build.assets.dev', ['build.js.dev'], function () {
  return gulp.src(['./app/**/*.html', './app/**/*.css', './app/**/*.jpg','./app/**/*.js', './app/**/*.png'])
    .pipe(gulp.dest(PATH.dest.dev.all));
});

gulp.task('build.index.dev', function() {
  var target = gulp.src(injectableDevAssetsRef(), { read: false });
  return gulp.src('./app/index.html')
    .pipe(inject(target, { transform: transformPath('dev') }))
    .pipe(template(templateLocals()))
    .pipe(gulp.dest(PATH.dest.dev.all));
});

// ***** Production build tasks ****** //

// Optimize Images
// TODO: Update image paths in final CSS to match root/images
gulp.task('imagesMaterial', function () {
  return gulp.src('app/src/**/*.{svg,png,jpg}')
    .pipe(gulp.dest('dist/dev'))
});

gulp.task('templates', function() {
  return gulp.src([
    'app/**/*.scss'
  ])
    .pipe(sass({
      precision: 10,
      onError: console.error.bind(console, 'Sass error:')
    }))
    .pipe(cssInlineImages({
      webRoot: 'app/src'
    }))
    .pipe(gulp.dest('dist/dev'));
});

// Compile and Automatically Prefix Stylesheet Templates (production)
gulp.task('styletemplates', function () {
  // For best performance, don't add Sass partials to `gulp.src`
  return gulp.src([
    'app/src/template.scss'
  ])
    // Generate Source Maps
    .pipe (sourcemaps.init())
    .pipe(sass({
      precision: 10,
      onError: console.error.bind(console, 'Sass error:')
    }))
    .pipe(cssInlineImages({
      webRoot: 'app/src'
    }))
    // Concatenate Styles
    .pipe(concat('material.css.template'))
    .pipe(gulp.dest('./dist'))
    // Minify Styles
    .pipe(concat('material.min.css.template'))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist'))
});



// Compile and Automatically Prefix Stylesheets (production)
gulp.task('styles', ['styletemplates'], function () {
  // For best performance, don't add Sass partials to `gulp.src`
  return gulp.src([
    'app/src/styleguide.scss'
  ])
    // Generate Source Maps
    .pipe (sourcemaps.init())
    .pipe(sass({
      precision: 10,
      onError: console.error.bind(console, 'Sass error:')
    }))
    .pipe(cssInlineImages({
      webRoot: 'app/src'
    }))
    .pipe(gulp.dest('.tmp'))
    // Concatenate Styles
    .pipe(concat('material.css'))
    .pipe(gulp.dest('./dist'))
    // Minify Styles
    .pipe(concat('material.min.css'))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist'))
});

// Only generate CSS styles for the MDL grid
gulp.task('styles-grid', function () {
  return gulp.src(['app/src/material-design-lite-grid.scss'])
    .pipe(sass({
      precision: 10,
      onError: console.error.bind(console, 'Sass error:')
    }))
    .pipe(gulp.dest('.tmp'))
    // Concatenate Styles
    .pipe(concat('material-grid.css'))
    .pipe(gulp.dest('./dist'))
    // Minify Styles
    .pipe(concat('material-grid.min.css'))
    .pipe(gulp.dest('./dist'))
});

// Concatenate And Minify JavaScript
gulp.task('scripts', function () {
  var sources = [
    // Component handler
    'app/src/mdlComponentHandler.js',
    // Polyfills/dependencies
    'app/src/third_party/**/*.js',
    // Base components
    'app/src/button/button.js',
    'app/src/checkbox/checkbox.js',
    'app/src/icon-toggle/icon-toggle.js',
    'app/src/menu/menu.js',
    'app/src/progress/progress.js',
    'app/src/radio/radio.js',
    'app/src/slider/slider.js',
    'app/src/spinner/spinner.js',
    'app/src/switch/switch.js',
    'app/src/tabs/tabs.js',
    'app/src/textfield/textfield.js',
    'app/src/tooltip/tooltip.js',
    // Complex components (which reuse base components)
    'app/src/layout/layout.js',
    'app/src/data-table/data-table.js',
    // And finally, the ripples
    'app/src/ripple/ripple.js'
  ];
  return gulp.src(sources)
    .pipe(sourcemaps.init())
    // Concatenate Scripts
    .pipe(concat('material.js'))
    .pipe(gulp.dest('./dist'))
    // Minify Scripts
    .pipe(uglify({
      sourceRoot: '.',
      sourceMapIncludeSources: true
    }))
    .pipe(concat('material.min.js'))
    // Write Source Maps
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist'))
});

/*
gulp.task('styles:gen', ['styles'], function() {
  // TODO: This task needs refactoring once we turn MaterialCustomizer
  // into a proper Node module.
  var mc = new MaterialCustomizer();
  mc.template = fs.readFileSync('./dist/material.min.css.template').toString();

  var stream = gulp.src('');
  mc.paletteIndices.forEach(function(primary) {
    mc.paletteIndices.forEach(function(accent) {
      if (mc.forbiddenAccents.indexOf(accent) !== -1) {
        return;
      }
      var primaryName = primary.toLowerCase().replace(' ', '_');
      var accentName = accent.toLowerCase().replace(' ', '_');
      stream = stream.pipe(file(
        'material.' + primaryName + '-' + accentName + '.min.css',
        mc.processTemplate(primary, accent)
      ));
    });
  });
  stream.pipe(gulp.dest('dist'));
});*/


gulp.task('build.app.dev', function (done) {
  runSequence('clean.app.dev', 'build.assets.dev', 'build.index.dev', done);
});

gulp.task('build.dev', function (done) {
  runSequence('clean.dev', 'build.lib.dev', 'build.app.dev','imagesMaterial','templates', done);
});

// --------------
// Build prod.

gulp.task('build.ng2.prod', function () {
  ng2Builder.build('angular2/router', join('tmp', 'router.js'), {});
  return ng2Builder.build('angular2/angular2', join('tmp', 'angular2.js'), {});
});

gulp.task('build.lib.prod', ['build.ng2.prod'], function () {
  var jsOnly = filter('**/*.js');
  var lib = gulp.src(PATH.src.lib);
  var ng2 = gulp.src('tmp/angular2.js');
  var router = gulp.src('tmp/router.js');

  return series(lib, ng2, router)
    .pipe(jsOnly)
    .pipe(concat('lib.js'))
    .pipe(uglify())
    .pipe(gulp.dest(PATH.dest.prod.lib));
});

gulp.task('build.js.tmp', function () {
  var result = gulp.src(['./app/**/*ts', '!./app/init.ts'])
    .pipe(plumber())
    .pipe(tsc(tsProject));

  return result.js
    .pipe(template({ VERSION: getVersion() }))
    .pipe(gulp.dest('tmp'));
});

// TODO: add inline source maps (System only generate separate source maps file).
gulp.task('build.js.prod', ['build.js.tmp'], function() {
  return appProdBuilder.build('app', join(PATH.dest.prod.all, 'app.js'),
    { minify: true }).catch(function (e) { console.log(e); });
});

gulp.task('build.init.prod', function() {
  var result = gulp.src('./app/init.ts')
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(tsc(tsProject));

  return result.js
    .pipe(uglify())
    .pipe(template(templateLocals()))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(PATH.dest.prod.all));
});

gulp.task('build.assets.prod', ['build.js.prod'], function () {
  var filterHTML = filter('**/*.html');
  var filterCSS = filter('**/*.css');
  return gulp.src(['./app/**/*.html', './app/**/*.css'])
    .pipe(filterHTML)
    .pipe(minifyHTML(HTMLMinifierOpts))
    .pipe(filterHTML.restore())
    .pipe(filterCSS)
    .pipe(minifyCSS())
    .pipe(filterCSS.restore())
    .pipe(gulp.dest(PATH.dest.prod.all));
});

gulp.task('build.index.prod', function() {
  var target = gulp.src([join(PATH.dest.prod.lib, 'lib.js'),
                         join(PATH.dest.prod.all, '**/*.css')], { read: false });
  return gulp.src('./app/index.html')
    .pipe(inject(target, { transform: transformPath('prod') }))
    .pipe(template(templateLocals()))
    .pipe(gulp.dest(PATH.dest.prod.all));
});

gulp.task('build.app.prod', function (done) {
  // build.init.prod does not work as sub tasks dependencies so placed it here.
  runSequence('clean.app.prod', 'build.init.prod', 'build.assets.prod',
              'build.index.prod', 'clean.tmp', done);
});

gulp.task('build.prod', function (done) {
  runSequence('clean.prod', 'build.lib.prod', 'clean.tmp', 'build.app.prod',
              done);
});

// --------------
// Version.

registerBumpTasks();

gulp.task('bump.reset', function() {
  return gulp.src('package.json')
    .pipe(bump({ version: '0.0.0' }))
    .pipe(gulp.dest('./'));
});

// --------------
// Test.

// To be implemented.

// --------------
// Serve dev.

gulp.task('serve.dev', ['build.dev'], function () {
  var app;

  watch('./app/**', function () {
    gulp.start('build.app.dev');
  });

  app = connect().use(serveStatic(join(__dirname, PATH.dest.dev.all)));
  http.createServer(app).listen(port, function () {
    openResource('http://localhost:' + port);
  });
});

// --------------
// Serve prod.

gulp.task('serve.prod', ['build.prod'], function () {
  var app;

  watch('./app/**', function () {
    gulp.start('build.app.prod');
  });

  app = connect().use(serveStatic(join(__dirname, PATH.dest.prod.all)));
  http.createServer(app).listen(port, function () {
    openResource('http://localhost:' + port);
  });
});

// --------------
// Utils.

function transformPath(env) {
  var v = '?v=' + getVersion();
  return function (filepath) {
    arguments[0] = filepath.replace('/' + PATH.dest[env].all, '') + v;
    return inject.transform.apply(inject.transform, arguments);
  };
}

function injectableDevAssetsRef() {
  var src = PATH.src.lib.map(function(path) {
    return join(PATH.dest.dev.lib, path.split('/').pop());
  });
  src.push(PATH.dest.dev.ng2, PATH.dest.dev.router,
           join(PATH.dest.dev.all, '**/*.css'));
  return src;
}

function getVersion(){
  var pkg = JSON.parse(fs.readFileSync('package.json'));
  return pkg.version;
}

function templateLocals() {
  return {
    VERSION: getVersion(),
    APP_BASE: APP_BASE
  };
}

function registerBumpTasks() {
  semverReleases.forEach(function (release) {
    var semverTaskName = 'semver.' + release;
    var bumpTaskName = 'bump.' + release;
    gulp.task(semverTaskName, function() {
      var version = semver.inc(getVersion(), release);
      return gulp.src('package.json')
        .pipe(bump({ version: version }))
        .pipe(gulp.dest('./'));
    });
    gulp.task(bumpTaskName, function(done) {
        runSequence(semverTaskName, 'build.app.prod', done);
    });
  });
}
