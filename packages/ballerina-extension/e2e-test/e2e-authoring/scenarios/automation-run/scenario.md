# Run Integration Tests Scenario (DRAFT — for review)

## Goal

Like `http-try-it-existing` and `run-conflict`, this scenario opens a
**pre-existing fixture project** with an already-runnable automation, and
verifies the "Run Integration" flow works from every entry point a user would
actually use — without rebuilding the automation through the UI (that
artifact-creation flow is already covered by `automation.spec.ts`).

This is a **retroactive** scenario doc: `automation-run.spec.ts` already
exists and passes, written directly as a promoted spec without an authoring
pass. The one behavioral fix in scope here (per your instruction) is: **the
"missing config" test currently creates its missing-configurable scenario by
directly writing `configurable string url = ?;` into `config.bal` via a raw
file edit** (`FileUtils.updateProjectFile`), bypassing the UI. That gets
replaced with the real UI flow: **Add Artifact → Configuration**, using the
same `ConfigEditor` page object `configuration.spec.ts` already uses.

## Fixture

`e2e-playwright-tests/data/automation_run_project` (already exists, unchanged):

```ballerina
// automation.bal
import ballerina/io;

public function main() {
    io:println("automation-run started");
}
```

`config.bal` starts empty — the configurable variable gets added **through
the UI during the test**, not pre-baked into the fixture.

## Steps (3 tests, run serially — state carries over)

| # | Test | What it covers | Change from current spec |
|---|------|-----------------|---------------------------|
| 1 | **Run from toolbar** | Select the `main` entry point in Project Explorer, open `automation.bal` (so `${file}` resolves for the launch config), click the **Run Integration** toolbar button, verify the terminal reaches `Running executable`. Stop the run after. | None — unchanged. |
| 2 | **Run with missing config prompts to update configurables, then runs** | Navigate to the Overview, **Add Artifact → Configuration**, fill the Configurable Variable form (Name: `url`, Type: `string`, **no default value** — via `Form`, same fields `configuration.spec.ts` uses), Save. This produces `configurable string url = ?;` in `config.bal` the *same way a real user would*. Re-focus the `main` entry point, click Run, expect the **"Missing required configurations in Config.toml file"** prompt, click **"Update Configurables"**, fill the value via `ConfigEditor.addConfigTomlValue('url', 'https://example.com')` (unchanged, already UI-driven), re-run, verify execution. | **Replaces** the raw `FileUtils.updateProjectFile('config.bal', ...)` call with the Add-Artifact-Configuration UI flow. Everything after that (the missing-config prompt → Update Configurables → fill value → re-run) is unchanged, since that part was already UI-driven. |
| 3 | **Run from command palette** | Open Command Palette, type "Run Integration", Enter, verify execution starts. | None — unchanged. |

## Decisions to confirm during authoring

- Whether `addArtifact('Configuration', 'configurable')` (the existing
  helper) can be called directly after test 1, or whether we first need to
  navigate back to the project **Overview** (test 1 leaves the view focused
  on the automation entry point's diagram, not the Overview where "Add
  Artifact" lives) — likely via the sidebar's "Open Overview" button.
- Confirming the `Form` field values/labels for the Configuration creation
  form match `configuration.spec.ts`'s pattern exactly (`Variable Name*Name
  of the variable`, `Variable Type`), and that leaving `defaultValue` empty
  is sufficient to produce a required-without-default configurable (rather
  than needing an explicit "no default" toggle).
- Whether creating the `Configuration` artifact on a project that already has
  a **running** automation (left running from test 1, or already stopped by
  `afterAll`-style cleanup) causes any interfering prompt.

## Out of scope (unless you want it added)

- Deleting/editing the configurable variable afterward (covered separately in
  `configuration.spec.ts`).
- Any config scenarios beyond the one "required, missing, then filled" path
  already in the current spec.

---

**Please confirm this covers what you want before I run it through the
authoring daemon and update the promoted spec.**
