"use client";

import dynamic from "next/dynamic";

const Scene = dynamic(() => import("@/components/Scene"), {
  ssr: false,
  loading: () => <div className="boot">falling toward the horizon…</div>,
});

export default function Home() {
  return <Scene />;
}
