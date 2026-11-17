import { ChatScreen } from "@/components/chat-screen";
import { StateView } from "@/components/state-view";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { getChat } from "@/server/queries";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ documento?: string; subir?: string; error?: string }>;
}) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para usar el chat." />;
  const chat = await getChat(db(), session.actor, session.companyId, params.documento);
  return (
    <ChatScreen
      companyId={session.companyId}
      companyName={chat.companyName}
      uploadHint={params.subir === "1"}
      error={params.error}
      messages={chat.messages}
      document={chat.document}
    />
  );
}
