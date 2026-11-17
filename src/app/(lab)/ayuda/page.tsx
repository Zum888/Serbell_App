export default function HelpPage() {
  return (
    <article className="max-w-2xl space-y-3 rounded-2xl border border-border bg-white p-5 text-sm leading-6">
      <h1 className="text-2xl font-semibold">Ayuda del laboratorio</h1>
      <p>El menú superior cambia entre Padrino, Luis Rivera, Carlos Ruiz y Ana Martínez. No hay contraseña. Todos ven la misma base.</p>
      <p>Para volver al inicio de los datos: <code>npm run db:reset</code></p>
      <p>El saldo bancario, los movimientos, los vínculos, los sellos y la auditoría salen de la base. Utilidad, por cobrar, por pagar y el resumen de hoy están marcados como demostración.</p>
      <p>No hay Plaid, WhatsApp, libro mayor, cierre de mes ni conciliación de extracto. Un comprobante vinculado no aprueba ni concilia el banco.</p>
    </article>
  );
}
