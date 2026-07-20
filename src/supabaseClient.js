const SUPABASE_URL = 'https://qamxhbhybcfsvcarksgi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbXhoYmh5YmNmc3ZjYXJrc2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTI3NDgsImV4cCI6MjEwMDEyODc0OH0.zDghN0kvWOzp1BUz53qOLLcxZgCpNGq_p7bxMpVbtcY';

export const isSupabaseConfigured = !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_');

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
