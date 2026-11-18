export function PostLink({
  action,
  fields,
  className,
  testId,
  children,
}: {
  action: string;
  fields: Record<string, string>;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action} method="post" className="inline">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" data-testid={testId} className={className}>
        {children}
      </button>
    </form>
  );
}

/** Turns a state-changing session URL into a POST button. Other links stay anchors. */
export function SessionLink({
  href,
  className,
  testId,
  children,
}: {
  href: string;
  className?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  const url = new URL(href, "http://serbell.local");
  if (url.pathname === "/api/session/company" || url.pathname === "/api/session/enter") {
    const fields: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      fields[key] = value;
    });
    return (
      <PostLink action={url.pathname} fields={fields} className={className} testId={testId}>
        {children}
      </PostLink>
    );
  }
  return (
    <a href={href} data-testid={testId} className={className}>
      {children}
    </a>
  );
}
