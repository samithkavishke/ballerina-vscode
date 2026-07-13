/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com) All Rights Reserved.
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { test } from '@playwright/test';
import * as path from 'path';
import { initTest, logStep, page } from '../utils/helpers';
import { ProjectExplorer, ConfigEditor } from '../utils/pages';
import { DEFAULT_PROJECT_NAME } from '../utils/helpers/constants';
import { FileUtils } from '../utils/helpers/fileSystem';

const RUN_BUTTON_SELECTOR = 'ul.actions-container[role="toolbar"] li.action-item a[role="button"][aria-label="Run Integration"]';
const RUNNING_EXECUTABLE_TEXT = 'Running executable';

// Single-package template with a pre-baked runnable automation (`main` that
// prints a marker and exits). We start from this fixture instead of building an
// Automation through the UI — that artifact-creation flow is already covered by
// automation.spec.ts, so rebuilding it here was pure duplicated setup.
const PROJECT_TEMPLATE = path.join(__dirname, '..', 'data', 'automation_run_project');

async function clickRunButton() {
    const runButton = page.page.locator(RUN_BUTTON_SELECTOR).first();
    await runButton.waitFor({ timeout: 10000 });
    await runButton.click();
}

function runningMarker() {
    return page.page.locator('.xterm-screen', { hasText: RUNNING_EXECUTABLE_TEXT }).first();
}

// Clicks the debug toolbar Stop button until no session remains (bounded).
// Runs are stopped between tests so a live process never leaks into the next
// test (which would trigger the run-conflict prompt and make this suite flaky).
async function stopAllRunningIntegrations() {
    for (let i = 0; i < 4; i++) {
        const stopButton = page.page.locator('.debug-toolbar a[aria-label^="Stop"]').first();
        if (!await stopButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            return;
        }
        await stopButton.click().catch(() => undefined);
        await page.page.waitForTimeout(1500);
    }
}

export default function createTests() {
    test.describe.serial('Run Integration Tests', {
    }, async () => {
        initTest(true, true, undefined, undefined, PROJECT_TEMPLATE);

        test.afterAll(async () => {
            logStep('automation-run: cleaning up any leftover runs');
            // Dismiss any dialog/quickpick a failed test may have left open, then
            // stop any surviving run so it does not leak into subsequent suites
            // on the soft-reload path.
            await page.page.keyboard.press('Escape').catch(() => undefined);
            await stopAllRunningIntegrations();
        });

        test('Run from toolbar', async () => {
            // Confirm the fixture's automation is present as a runnable entry point.
            const projectExplorer = new ProjectExplorer(page.page);
            const mainEntryPoint = await projectExplorer.findItem([DEFAULT_PROJECT_NAME, 'Entry Points', 'main']);

            // Open automation.bal in the text editor so VS Code's ${file} launch
            // variable resolves when the run session starts. Without an active
            // text editor, `debug.startDebugging` fails with
            // "Variable ${file} can not be resolved. Please open an editor."
            await FileUtils.openProjectFileInEditor('automation.bal');
            await mainEntryPoint.click();

            logStep('Clicking the Run Integration toolbar button');
            // The "Run Integration" button must be visible in the editor toolbar.
            await clickRunButton();

            // The VS Code terminal panel opens and the run reaches execution.
            const terminal = page.page.locator('.xterm-screen').first();
            await terminal.waitFor({ timeout: 10000 });
            await runningMarker().waitFor({ timeout: 30000 });
            logStep('Toolbar run reached execution');

            // Stop the run so it does not leak into the next test.
            await stopAllRunningIntegrations();
        });

        test('Run with missing config prompts to update configurables, then runs', async () => {
            // Introduce a required configurable so the run detects a missing
            // value. Writing config.bal here IS the scenario trigger (the
            // project having a required-but-unconfigured value at run time).
            FileUtils.updateProjectFile('config.bal', 'configurable string url = ?;');

            // Open the file so VS Code sends an explicit didOpen to the
            // language server. A raw fs write alone only trips the slower
            // workspace file-watcher, which can race with the Run click below
            // and leave the extension's missing-config check unaware of the
            // new configurable — confirmed via trace: without this, Run
            // proceeds straight to `bal run` and fails with a plain compiler
            // error instead of surfacing the missing-config prompt.
            await FileUtils.openProjectFileInEditor('config.bal');
            await page.page.waitForTimeout(3000);

            // Re-focus the automation entry point: the "Run Integration"
            // toolbar button is scoped to the currently active entry point,
            // and opening config.bal above switched focus away from it.
            const projectExplorer = new ProjectExplorer(page.page);
            const mainEntryPoint = await projectExplorer.findItem([DEFAULT_PROJECT_NAME, 'Entry Points', 'main']);
            await FileUtils.openProjectFileInEditor('automation.bal');
            await mainEntryPoint.click();

            logStep('Running with a required config missing');
            await clickRunButton();

            // The current product flow surfaces "Missing required configurations
            // in Config.toml file" with an "Update Configurables" action — it
            // does NOT auto-create Config.toml and continue running (that was
            // stale behavior from an older UI version).
            const missingConfigText = page.page.getByText('Missing required configurations in Config.toml file', { exact: true });
            await missingConfigText.waitFor({ timeout: 15000 });

            logStep('Opening the Configurable Variables view to fill the missing value');
            await page.page.getByRole('button', { name: 'Update Configurables' }).click();

            // Fill the required "url" configurable through the Configurable
            // Variables webview, same helper used by configuration.spec.ts.
            const configEditor = new ConfigEditor(page.page);
            await configEditor.init();
            await configEditor.addConfigTomlValue('url', 'https://example.com');

            logStep('Re-running now that the required config is set');
            await clickRunButton();

            await runningMarker().waitFor({ timeout: 30000 });
            logStep('Run after filling the missing config reached execution');

            await stopAllRunningIntegrations();
        });

        test('Run from command palette', async () => {
            logStep('Running via the command palette');
            // 1. Open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
            await page.page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+P' : 'Control+Shift+P');
            await page.page.waitForTimeout(500);

            // 2. Type "Run Integration" and select the BI.project.run command.
            await page.page.keyboard.type('Run Integration');
            await page.page.waitForTimeout(500);
            await page.page.keyboard.press('Enter');
            await page.page.waitForTimeout(2000);

            await runningMarker().waitFor({ timeout: 30000 });
            logStep('Palette run reached execution');
        });
    });
}
