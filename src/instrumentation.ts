export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDemoDatabase } = await import("@/server/ensure-db");
  await ensureDemoDatabase();
}
