var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var tsify = require('tsify');
var watchify = require('watchify');
var fancy_log = require('fancy-log');
var uglify = require("gulp-uglify");
var buffer = require("vinyl-buffer");

var paths = {
    pages: ['static/*.html', 'static/*.css']
};

var watchedBrowserify = watchify(browserify({
    basedir: '.',
    debug: true,
    entries: ['js/main.tsx'],
    cache: {},
    packageCache: {}
}).plugin(tsify));

gulp.task('copy-html', function () {
    return gulp.src(paths.pages)
        .pipe(gulp.dest('app/static'));
});

function bundle() {
    return watchedBrowserify
        .bundle()
        .on('error', fancy_log)
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(uglify())
        .pipe(gulp.dest('app/static'));
}

gulp.task('default', gulp.series(gulp.parallel('copy-html'), bundle));



watchedBrowserify.on('update', bundle);
watchedBrowserify.on('log', fancy_log);