// Imported first by every test file: ESM imports run before the file's own
// code, so setting MAGNUS_DEMO inside a test file is too late for modules
// like lib/supabase.js that pick demo vs real at load time.
process.env.MAGNUS_DEMO = '1';
