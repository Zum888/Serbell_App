import { PlaidLinkDemo } from "@/components/plaid-link-demo";
import { StateView } from "@/components/state-view";
import { pageContext } from "@/server/context";

export default async function ConnectAccountPage() {
  const session = await pageContext();
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para conectar una cuenta." />;
  const company = session.companies.find((item) => item.id === session.companyId);
  return <PlaidLinkDemo companyName={company?.name ?? "tu empresa"} />;
}
