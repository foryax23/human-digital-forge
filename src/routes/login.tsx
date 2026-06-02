import { createFileRoute, Link } from "@tanstack/react-router";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const title = "Login | Vortex Hub";
const description = "Access your Vortex Hub projects, messages and completed deliveries.";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthLayout
      heading="Welcome back to Vortex Hub."
      intro="Access your projects, messages and completed deliveries."
      footer={
        <span>
          New here?{" "}
          <Link to="/register" className="text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button type="button" className="text-xs text-primary hover:underline">
              Forgot password
            </button>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required />
        </div>
        <Button asChild type="submit" className="w-full" size="lg">
          <Link to="/dashboard">Log in</Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
