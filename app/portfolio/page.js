"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import useAuth from "@/hooks/useAuth";
import Link from "next/link";
import { useTheme } from '@/contexts/themeContext';

export default function Portfolio() {
    const user = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [isLoadingUser, setIsLoadingUser] = useState(true);
    const [portfolio, setPortfolio] = useState([]);
    const [coins, setCoins] = useState(0);
    const { isDark, toggleTheme } = useTheme(); // Tema da página

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

    // HTML principal
    return (
        <main className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">

            {/* Botão de tema */}
            <button
                onClick={toggleTheme}
                className="absolute top-4 right-4 p-2 sm:p-3 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-all duration-300 shadow-lg border border-gray-300 dark:border-gray-600"
                aria-label="Alternar tema"
            >
                {isDark ? '🌙' : '☀️'}
            </button>

            {/* Cabeçalho */}
            <div className="text-center mb-8 sm:mb-12 max-w-2xl mx-auto">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    O teu Portefólio
                </h1>

                {/* Saldo */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
                    <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                        Saldo: <span className="text-green-600 dark:text-green-400">{coins.toFixed(2)}€</span>
                    </p>
                </div>

                {/* Botão Voltar */}
                <Link
                    href="/"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl hover:scale-105"
                >
                    ← Voltar ao Mercado
                </Link>
            </div>

            {/* Container Principal */}
            <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto">

                {/* Portfólio */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-3">
                        📊 Os teus Ativos
                    </h2>

                    {portfolio.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-xl">
                            <p className="text-gray-600 dark:text-gray-300 text-lg">
                                Não tens ativos ainda 😅
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-hidden"> {/* ← Mudado de overflow-x-auto para hidden */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* ← Grid responsivo */}
                                {portfolio.map((p) => (
                                    <div key={p.asset.symbol} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                                        {/* Cabeçalho do card */}
                                        <div className="flex items-center gap-3 mb-3">
                                            {p.asset.image_url && (
                                                <img
                                                    src={p.asset.image_url}
                                                    alt={p.asset.name}
                                                    className="w-10 h-10 rounded-lg object-cover border border-gray-300 dark:border-gray-600 flex-shrink-0"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-gray-800 dark:text-white text-sm truncate">
                                                    {p.asset.name}
                                                </div>
                                                <div className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                                                    {p.asset.symbol}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detalhes */}
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Quantidade:</span>
                                                <span className="font-mono text-gray-800 dark:text-white">{p.quantity}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Preço atual:</span>
                                                <span className="font-mono text-gray-800 dark:text-white">{p.asset.current_price.toFixed(2)}€</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Investido:</span>
                                                <span className="font-mono text-gray-800 dark:text-white">{p.invested.toFixed(2)}€</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-600 dark:text-gray-400">Lucro:</span>
                                                <span className={`font-mono font-semibold ${p.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                    }`}>
                                                    {p.profit >= 0 ? "+" : ""}{p.profit.toFixed(2)}€
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2">
                                                <span className="text-gray-600 dark:text-gray-400">Percentagem:</span>
                                                <span className={`font-mono font-semibold ${p.percent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                                    }`}>
                                                    {p.percent >= 0 ? "+" : ""}{p.percent.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Histórico - Versão simplificada */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-3">
                        📈 Histórico de Transações
                    </h2>

                    {transactions.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-xl">
                            <p className="text-gray-600 dark:text-gray-300 text-lg">
                                Sem transações ainda 📉
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3"> {/* ← Lista vertical em vez de tabela */}
                            {transactions.map((t) => (
                                <div key={t.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        {/* Info principal */}
                                        <div className="flex items-center gap-3 flex-1">
                                            {t.assets?.image_url && (
                                                <img
                                                    src={t.assets.image_url}
                                                    alt={t.assets.name}
                                                    className="w-8 h-8 rounded object-cover border border-gray-300 dark:border-gray-600 flex-shrink-0"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-gray-800 dark:text-white text-sm">
                                                    {t.assets?.name}
                                                </div>
                                                <div className="text-gray-600 dark:text-gray-400 text-xs">
                                                    {formatTimestamp(t.created_at)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detalhes da transação */}
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${t.type === "buy"
                                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                                }`}>
                                                {t.type === "buy" ? "🔼 Compra" : "🔻 Venda"}
                                            </span>
                                            <div className="text-right">
                                                <div className="font-mono text-gray-800 dark:text-white">
                                                    {t.quantity} × {t.price_at_transaction.toFixed(2)}€
                                                </div>
                                                <div className="font-mono text-gray-600 dark:text-gray-400 text-xs">
                                                    Total: {(t.quantity * t.price_at_transaction).toFixed(2)}€
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );

}
