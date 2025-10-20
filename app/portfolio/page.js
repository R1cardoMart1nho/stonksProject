"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useAuth from "@/hooks/useAuth";
import Link from "next/link";

export default function Portfolio() {
    const user = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [isLoadingUser, setIsLoadingUser] = useState(true);
    const [portfolio, setPortfolio] = useState([]);
    const [coins, setCoins] = useState(0);

    useEffect(() => {
        if (!user) return; // garante que só corre depois do login

        async function fetchPortfolio() {
            if (user !== undefined) {
                setIsLoadingUser(false);

                // 1 - Buscar saldo atual do user
                const { data: userData, error: userError } = await supabase
                    .from("users")
                    .select("coins")
                    .eq("id", user.id)
                    .single();

                if (userData) setCoins(userData.coins);

                // 2 - Buscar todas as transações do user + info dos assets
                const { data: txData, error: txError } = await supabase
                    .from("transactions")
                    .select(`
                    asset_id,
                    quantity,
                    price_at_transaction,
                    type,
                    created_at,
                    total,
                    assets (name, symbol, current_price)
                    `)
                    .eq("user_id", user.id)
                    .order('created_at', { ascending: false }); // ← DESCENDENTE;

                if (txError) {
                    console.error(txError);
                    return;
                }

                // Guardar transações para histórico
                setTransactions(txData);

                // 3 - Agrupar transações por asset
                const grouped = {};
                txData.forEach((tx) => {
                    const id = tx.asset_id;
                    if (!grouped[id]) {
                        grouped[id] = {
                            asset: tx.assets,
                            quantity: 0,
                            invested: 0,
                        };
                    }

                    if (tx.type === "buy") {
                        grouped[id].quantity += tx.quantity;
                        grouped[id].invested += tx.price_at_transaction * tx.quantity;
                    } else if (tx.type === "sell") {
                        grouped[id].quantity -= tx.quantity;
                        grouped[id].invested -= tx.price_at_transaction * tx.quantity;
                    }
                });

                // 4 - Transformar em array e calcular valor atual + lucro/prejuízo
                const portfolioData = Object.values(grouped)
                    .filter((p) => p.quantity > 0)
                    .map((p) => {
                        const currentValue = p.asset.current_price * p.quantity;
                        const profit = currentValue - p.invested;
                        const percent = (profit / p.invested) * 100;
                        return { ...p, currentValue, profit, percent };
                    });

                setPortfolio(portfolioData);
            }
        }

        fetchPortfolio();
    }, [user]);

    // Enquanto carrega user
    if (isLoadingUser) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
                <p>A carregar...</p>
            </main>
        );
    }

    if (!user)
        return (
            //console.log("Estive aqui!")
            <main className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100">
                <div className="text-center">
                    <p>Precisas de fazer login para veres o teu portefólio.</p>
                    <Link href="/login" className="text-blue-400 underline mt-4 block">
                        Ir para Login
                    </Link>
                </div>
            </main>
        );

    //Converte o timestamp para formato legível
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Sem data';
        return new Date(timestamp).toLocaleString('pt-PT');
    };
    // console.log("t.created_at:", transactions.created_at);
    // console.log("tipo:", typeof transactions.created_at);
    // console.log("é Date?", transactions.created_at instanceof Date);



    return (
        <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
            <div className="bg-red-500 text-white p-4 rounded-lg">
                Se isto ficar vermelho, o Tailwind está funcionando!
            </div>
            <div className="text-center mt-6">
                <Link
                    href="/"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                    Voltar ao Mercado
                </Link>
            </div>

            <h1 className="text-3xl font-bold mb-6 text-center">O teu Portefólio</h1>

            <div className="mb-6 text-center">
                <p className="text-xl">
                    <strong>Saldo atual:</strong> {coins.toFixed(2)}€
                </p>
            </div>

            <div className="max-w-3xl mx-auto bg-gray-900 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl mb-4 font-semibold">Os teus ativos</h2>
                {portfolio.length === 0 ? (
                    <p>Não tens ativos ainda 😅</p>
                ) : (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="text-left border-b border-gray-700">
                                <th className="py-2">Nome</th>
                                <th>Qtd</th>
                                <th>Preço Atual</th>
                                <th>Investido</th>
                                <th>Lucro</th>
                                <th>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {portfolio.map((p) => (
                                <tr key={p.asset.symbol} className="border-b border-gray-800">
                                    <td className="py-2">{p.asset.name}</td>
                                    <td>{p.quantity}</td>
                                    <td>{p.asset.current_price.toFixed(2)}€</td>
                                    <td>{p.invested.toFixed(2)}€</td>
                                    <td className={p.profit >= 0 ? "text-green-400" : "text-red-400"}>
                                        {p.profit.toFixed(2)}€
                                    </td>
                                    <td className={p.percent >= 0 ? "text-green-400" : "text-red-400"}>
                                        {p.percent.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* --- Histórico --- */}
            <div className="max-w-3xl mx-auto bg-gray-900 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl mb-4 font-semibold">Histórico de Transações</h2>
                {transactions.length === 0 ? (
                    <p>Sem transações ainda 📉</p>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="text-left border-b border-gray-700">
                                <th className="py-2">Data</th>
                                <th>Ativo</th>
                                <th>Tipo</th>
                                <th>Qtd</th>
                                <th>Preço (€)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((t) => (
                                <tr key={t.id} className="border-b border-gray-800">
                                    <td>{formatTimestamp(t.created_at)} | </td>
                                    <td>{t.assets?.name} | </td>
                                    <td className={t.type === "buy" ? "text-green-400" : "text-red-400"}>
                                        {t.type === "buy" ? "Compra" : "Venda"} |
                                    </td>
                                    <td>{t.quantity} | </td>
                                    <td>{t.price_at_transaction.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

        </main>
    );
}
