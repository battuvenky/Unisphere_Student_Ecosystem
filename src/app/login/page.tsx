import { AuthForm } from "@/components/auth-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  return <AuthForm mode="login" nextPath={query.next} />;
}
