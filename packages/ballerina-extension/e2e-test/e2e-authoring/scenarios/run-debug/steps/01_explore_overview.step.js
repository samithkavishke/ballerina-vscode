{
  await ensureWorkbench();
  const snap = await snapshot();
  console.log('FRESH OVERVIEW SNAPSHOT:\n' + snap);
}
