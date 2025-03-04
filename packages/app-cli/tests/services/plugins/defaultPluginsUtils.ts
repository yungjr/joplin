import { afterDefaultPluginsLoaded, getDefaultPluginPathsAndSettings } from '@joplin/lib/services/plugins/defaultPlugins/defaultPluginsUtils';
import PluginRunner from '../../../app/services/plugins/PluginRunner';
import { checkThrow, setupDatabaseAndSynchronizer, supportDir, switchClient } from '@joplin/lib/testing/test-utils';
import PluginService, { defaultPluginSetting, DefaultPluginsInfo } from '@joplin/lib/services/plugins/PluginService';
import Setting from '@joplin/lib/models/Setting';


function newPluginService(appVersion = '1.4') {
	const runner = new PluginRunner();
	const service = new PluginService();
	service.initialize(
		appVersion,
		{
			joplin: {},
		},
		runner,
		{
			dispatch: () => {},
			getState: () => {},
		},
	);
	return service;
}

describe('defaultPluginsUtils', () => {

	const pluginsId = ['joplin.plugin.ambrt.backlinksToNote', 'org.joplinapp.plugins.ToggleSidebars'];
	const defaultPluginsInfo = {
		'joplin.plugin.ambrt.backlinksToNote': {},
		'org.joplinapp.plugins.ToggleSidebars': {},
	};

	beforeEach(async () => {
		await setupDatabaseAndSynchronizer(1);
		await switchClient(1);
	});

	it('should load default plugins when nor previously installed', (async () => {
		const testPluginDir = `${supportDir}/pluginRepo/plugins`;
		Setting.setValue('installedDefaultPlugins', []);

		const service = newPluginService('2.1');

		const pluginSettings = service.unserializePluginSettings(Setting.value('plugins.states'));

		for (const pluginId of pluginsId) {
			expect(pluginSettings[pluginId]).toBeFalsy();
		}

		const pluginPathsAndNewSettings = await getDefaultPluginPathsAndSettings(testPluginDir, defaultPluginsInfo, pluginSettings);

		for (const pluginId of pluginsId) {
			expect(
				pluginPathsAndNewSettings.pluginSettings[pluginId],
			).toMatchObject(defaultPluginSetting());
		}
	}));

	it('should keep already created default plugins disabled with previous default plugins installed', (async () => {
		const testPluginDir = `${supportDir}/pluginRepo/plugins`;
		Setting.setValue('installedDefaultPlugins', ['org.joplinapp.plugins.ToggleSidebars']);
		Setting.setValue('plugins.states', {
			'org.joplinapp.plugins.ToggleSidebars': { ...defaultPluginSetting(), enabled: false },
		});

		const service = newPluginService('2.1');

		const pluginSettings = service.unserializePluginSettings(Setting.value('plugins.states'));
		const pluginPathsAndNewSettings = await getDefaultPluginPathsAndSettings(testPluginDir, defaultPluginsInfo, pluginSettings);

		// Should still be disabled
		expect(
			pluginPathsAndNewSettings.pluginSettings['org.joplinapp.plugins.ToggleSidebars'].enabled,
		).toBe(false);
	}));

	const sampleJsBundlePlugin = `
	/* joplin-manifest:
	{
		"id": "io.github.jackgruber.backup",
		"manifest_version": 1,
		"app_min_version": "1.4",
		"name": "JS Bundle test",
		"version": "1.0.0"
	}
	*/
	joplin.plugins.register({
		onStart: async function() {
			await joplin.settings.registerSettings({
				path: {
					value: "initial-path",
					type: 2,
					section: "backupSection",
					public: true,
					label: "Backup path",
				  },
			})
		},
	});`;

	it('should set initial settings for default plugins', async () => {
		const service = newPluginService();


		const plugin = await service.loadPluginFromJsBundle('', sampleJsBundlePlugin);
		plugin.builtIn = true;
		await service.runPlugin(plugin);
		const runningPlugins = { 'io.github.jackgruber.backup': plugin };

		const defaultPluginsInfo: DefaultPluginsInfo = {
			'io.github.jackgruber.backup': {
				settings: {
					'path': `${Setting.value('profileDir')}`,
				},
			},
			'plugin.calebjohn.rich-markdown': {
			},
		};

		// with pre-installed default plugin
		Setting.setValue('installedDefaultPlugins', ['io.github.jackgruber.backup']);
		const pluginSettings = { 'io.github.jackgruber.backup': defaultPluginSetting() };

		await afterDefaultPluginsLoaded(
			runningPlugins,
			defaultPluginsInfo,
			pluginSettings,
		);
		expect(Setting.value('plugin-io.github.jackgruber.backup.path')).toBe('initial-path');

		// with no pre-installed default plugin
		Setting.setValue('installedDefaultPlugins', ['']);
		await afterDefaultPluginsLoaded(
			runningPlugins,
			defaultPluginsInfo,
			pluginSettings,
		);
		expect(Setting.value('plugin-io.github.jackgruber.backup.path')).toBe(`${Setting.value('profileDir')}`);
		await service.destroy();
	});

	it('should not overwrite existing settings for a user-installed version of a built-in plugin', async () => {
		const service = newPluginService();

		const plugin = await service.loadPluginFromJsBundle('', sampleJsBundlePlugin);
		plugin.builtIn = false;
		await service.runPlugin(plugin);

		const defaultPluginsInfo: DefaultPluginsInfo = {
			'io.github.jackgruber.backup': {
				settings: {
					'path': 'overwrite?',
				},
			},
		};

		// No pre-installed default plugins
		Setting.setValue('installedDefaultPlugins', []);

		// The plugin is running and enabled
		const runningPlugins = { 'io.github.jackgruber.backup': plugin };
		const pluginSettings = { 'io.github.jackgruber.backup': defaultPluginSetting() };

		await afterDefaultPluginsLoaded(
			runningPlugins,
			defaultPluginsInfo,
			pluginSettings,
		);

		// Should not overwrite
		expect(Setting.value('plugin-io.github.jackgruber.backup.path')).toBe('initial-path');
	});

	it('should not throw error on missing setting key', async () => {

		const service = newPluginService();

		const plugin = await service.loadPluginFromJsBundle('', sampleJsBundlePlugin);
		plugin.builtIn = true;
		await service.runPlugin(plugin);

		const defaultPluginsInfo: DefaultPluginsInfo = {
			'io.github.jackgruber.backup': {
				settings: {
					'path': `${Setting.value('profileDir')}`,
					'missing-key1': 'someValue',
				},
			},
			'plugin.calebjohn.rich-markdown': {
				settings: {
					'missing-key2': 'someValue',
				},
			},
		};

		Setting.setValue('installedDefaultPlugins', ['']);
		const pluginSettings = { 'io.github.jackgruber.backup': defaultPluginSetting() };
		const runningPlugins = { 'io.github.jackgruber.backup': plugin };

		expect(checkThrow(() => afterDefaultPluginsLoaded(runningPlugins, defaultPluginsInfo, pluginSettings))).toBe(false);
		expect(Setting.value('plugin-io.github.jackgruber.backup.path')).toBe(`${Setting.value('profileDir')}`);
		await service.destroy();
	});

});
