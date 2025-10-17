"use client"

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // 1 - Cria o utilizador na auth.users
        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
        }

        // 2 - Garante que o utilizador foi criado, que vem do signup
        const user = data?.user;
        if (!user) {
            setError("Erro ao criar conta. Tenta novamente.");
            setLoading(false);
            return;
        }

        // 3 - Cria logo o registo na tabela public.users após o registo na tabela auth.users
        const { error: insertError } = await supabase
            .from("users")
            .insert([
                {
                    id: user.id,      // mesmo ID do auth.users
                    username: user.email, // usar email como username inicial
                    coins: 1000,      // saldo inicial
                    bio: "",          // opcional
                    created_at: new Date().toISOString(),
                },
            ]);

        if (insertError) {
            console.error("Erro ao criar registo em public.users:", insertError);
            setError("Erro ao criar perfil do utilizador.");
            setLoading(false);
            return;
        }

        // 4 - Caso o utilizador seja criado com sucesso
        alert('Conta criada! Verifica o teu email para confirmar.');
        setLoading(false);
        router.push('/login');
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
            <h1 className="text-3xl font-bold mb-6">Criar Conta</h1>
            <form
                onSubmit={handleRegister}
                className="flex flex-col gap-4 w-80 bg-gray-800 p-6 rounded-xl shadow-lg"
            >
                <input
                    type="email"
                    placeholder="Email"
                    className="p-3 rounded bg-gray-700 focus:outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    className="p-3 rounded bg-gray-700 focus:outline-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold"
                >
                    {loading ? 'A criar...' : 'Registar'}
                </button>

                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </form>

            <p className="mt-4 text-sm">
                Já tens conta?{" "}
                <Link href="/login" className="text-green-400 hover:underline">
                    Faz login aqui
                </Link>
            </p>

            <Link
                href="/"
                className="mt-6 text-gray-400 hover:text-gray-200 text-sm underline"
            >
                ← Voltar à página inicial
            </Link>

        </main>
    );
}