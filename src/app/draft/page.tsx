import { redirect } from "next/navigation";

type DraftPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DraftPage({ searchParams }: DraftPageProps) {
  const params = await searchParams;
  redirect(`/draft-command-center${buildQueryString(params)}`);
}

function buildQueryString(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}
