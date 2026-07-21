export const config = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  // Marketing site — where the logged-out gate's brand + footer link back to.
  landingUrl: import.meta.env.VITE_LANDING_URL ?? "http://localhost:4321",
} as const;
