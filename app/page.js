"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useAuth from "@/hooks/useAuth";

export default function Home() {
  // Busca assets  + user info
  const [assets, setAssets] = useState([]);
  const user = useAuth();

  // Logout
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
    else alert("Logout realizado!");
  };

  // Buscar assets e dados do user
  useEffect(() => {
    async function fetchData() {
      const { data: assetsData, error } = await supabase
        .from('assets')
        .select('*')
        .order('current_price', { ascending: false });

      if (!error) { setAssets(assetsData); }
    }
    fetchData();
  }, []);

  // Função para comprar asset (apenas logado)
  const buy = async (assetId, quantity = 1) => {
    try {
      // 1 - Verifica se existe sessão
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Precisas de fazer login primeiro!");
        return;
      }

      // 2 - Faz o pedido à API com o token JWT
      const res = await fetch("/api/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`, // token enviado!
        },
        body: JSON.stringify({ asset_id: assetId, quantity }),
      });

      // 3 - Lê resposta
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao realizar compra");
      }

      // 4 - Mostra feedback
      alert("Compra realizada com sucesso!");
      console.log("Resposta da API:", data);

    } catch (error) {
      console.error("Erro:", error.message);
      alert(error.message);
    }
  };

  // Função para vender asset (apenas logado)
  // 1 - Verifica se existe sessão
  const sell = async (asset_id, quantity = 1) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert("Precisas de fazer login primeiro!");
      return;
    }

    // 2 - Faz o pedido à API com o token JWT
    const res = await fetch("/api/sell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ asset_id, quantity }),
    });

    // 3 - Lê resposta
    const data = await res.json();
    if (data.error) alert(data.error);
    else alert("Venda realizada!");
  }
};

// HTML
return (
  <main className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100 p-8">
    <h1 className="text-4xl font-bold mb-2">Bem-vindo ao OneStonks! </h1>
    <p className="mb-4">(ou um Comédia Stonks... Vamos ver)</p>

    <div className="flex gap-4 mb-8">
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

    {user ? (
      <div className="mb-4">
        <p className="self-center">Olá, {user.email}</p>
        <button
          className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    ) : (
      <p>Não está logado</p>
    )}

    <h2 className="text-2xl font-bold mb-4">Mercado de Humoristas</h2>
    <div className="grid gap-4 w-full max-w-2xl">
      {assets.map(asset => (
        <div key={asset.id} className="flex justify-between items-center p-4 border rounded bg-gray-800">
          <div>
            <strong>{asset.name}</strong> | {asset.symbol} | {asset.current_price}€
          </div>
          <button
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded"
            onClick={() => buy(asset.id)}
          >
            <button
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded"
              onClick={() => sell(asset.id)}>Vender</button>
            Comprar
          </button>
        </div>
      ))}
    </div>

  </main>
);


