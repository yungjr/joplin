const gulp = require('gulp');
const utils = require('@joplin/tools/gulp/utils');
const compileSass = require('@joplin/tools/compileSass');
const compilePackageInfo = require('@joplin/tools/compilePackageInfo');
import buildDefaultPlugins from '@joplin/default-plugins/commands/buildAll';
import copy7Zip from './tools/copy7Zip';

const tasks = {
	compileScripts: {
		fn: require('./tools/compileScripts'),
	},
	compilePackageInfo: {
		fn: async () => {
			await compilePackageInfo(`${__dirname}/package.json`, `${__dirname}/packageInfo.js`);
		},
	},
	copyPluginAssets: {
		fn: require('./tools/copyPluginAssets.js'),
	},
	copyApplicationAssets: {
		fn: require('./tools/copyApplicationAssets.js'),
	},
	electronRebuild: {
		fn: require('./tools/electronRebuild.js'),
	},
	electronBuilder: {
		fn: require('./tools/electronBuilder.js'),
	},
	copyDefaultPluginsAssets: {
		fn: async () => {
			await copy7Zip();
		},
	},
	buildDefaultPlugins: {
		fn: async () => {
			const outputDir = `${__dirname}/build/defaultPlugins/`;
			await buildDefaultPlugins(outputDir);
		},
	},
	tsc: require('@joplin/tools/gulp/tasks/tsc'),
	updateIgnoredTypeScriptBuild: require('@joplin/tools/gulp/tasks/updateIgnoredTypeScriptBuild'),
	buildCommandIndex: require('@joplin/tools/gulp/tasks/buildCommandIndex'),
	compileSass: {
		fn: async () => {
			await compileSass(
				`${__dirname}/style.scss`,
				`${__dirname}/style.min.css`,
			);
		},
	},
};

utils.registerGulpTasks(gulp, tasks);

const buildBeforeStartParallel = [
	'compileScripts',
	'compilePackageInfo',
	'copyPluginAssets',
	'copyApplicationAssets',
	'updateIgnoredTypeScriptBuild',
	'buildCommandIndex',
	'compileSass',
];

gulp.task('before-start', gulp.parallel(...buildBeforeStartParallel));

const buildAllSequential = [
	'before-start',
	'copyDefaultPluginsAssets',
	'buildDefaultPlugins',
];

gulp.task('build', gulp.series(buildAllSequential));
