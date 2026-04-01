import CookPage from "./CookPage";

// Required for Next.js static export (output: "export").
// Recipes live in localStorage so there are no paths to pre-render;
// all rendering happens client-side at runtime.
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <CookPage />;
}
