import { FirmScreen } from "@/components/firm-screen";
import { StateView } from "@/components/state-view";
import { isAppError } from "@/lib/errors";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { getFirm } from "@/server/queries";

export default async function FirmPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const session = await pageContext();
  const params = await searchParams;
  try {
    const summary = await getFirm(db(), session.actor);
    return (
      <div className="space-y-3">
        {params.error ? <StateView variant="error" title={params.error} testId="server-error" /> : null}
        <FirmScreen name={session.actor.name} q={params.q || ""} summary={summary} />
      </div>
    );
  } catch (error) {
    if (isAppError(error)) return <StateView variant="error" title={error.message} testId="server-error" />;
    throw error;
  }
}
