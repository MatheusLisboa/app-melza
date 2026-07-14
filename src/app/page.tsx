import { redirect } from "next/navigation";

/** Fallback se o middleware não rodar (ex.: env ausente no Edge). */
export default function HomePage() {
  redirect("/login");
}
