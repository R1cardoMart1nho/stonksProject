"use client"

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
      <h1 className="text-4xl font-bold">Bem-vindo ao OneStonks! </h1>
      <p>(ou um Comédia Stonks... Vamos ver)</p>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
        >
          Login<br></br>
        </Link>
        <Link
          href="/register"
          className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg transition"
        >
          Registar
        </Link>
      </div>

    </main>
  );

}