import { HomeChat } from "@/components/home-chat";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { loadBriefing } from "@/server/assistant";

export async function ChatRail({ flujo }: { flujo?: string | null }) {
  const session = await pageContext();
  if (!session.companyId) return null;
  const briefing = await loadBriefing(await db(), session.actor, session.companyId);
  return (
    <aside data-testid="chat-rail" className="sticky top-0 flex h-[calc(100vh-5rem)] w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-white p-3">
      <HomeChat dock landed={flujo ?? null} name={session.actor.name} briefing={briefing} starts={[]} />
    </aside>
  );
}
