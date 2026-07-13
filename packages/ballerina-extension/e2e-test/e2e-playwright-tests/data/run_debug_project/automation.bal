import ballerina/io;

// Runnable automation pre-baked into the template (per the e2e-writer rule that
// scenarios must not create Ballerina sources at runtime). This lets the
// run-debug suite start from an existing runnable entry point instead of
// building one through the UI — the artifact-creation flow is already covered by
// automation.spec.ts.
public function main() {
    io:println("run-debug started");
}
