"use client"

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from 'next/navigation';
import Link from "next/link";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("")

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('');
        setLoading(true);

        const { data, error } = await supabase.auth.signInWithPassword({
            email, password
        })

        setLoading(false);

        console.log(error) // verificar erros
        if (error) {
            setError('Email ou password incorretos');
            return;
        }

        alert('Login com Sucesso!');
        router.push('/');
    }

    // console.log(error) //verificar erro
    // if (error) setError(error.message)

    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
            <h1 className="text-3xl font-bold mb-6">Iniciar Sessão</h1>
            <form
                onSubmit={handleLogin}
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
                    {loading ? 'A entrar...' : 'Entrar'}
                </button>
                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </form>

            <p className="mt-4 text-sm">
                Ainda não tens conta?{" "}
                <Link href="/register" className="text-blue-400 hover:underline">
                    Regista-te aqui
                </Link>
            </p>

            <Link
                href="/"
                className="mt-6 text-gray-400 hover:text-gray-200 text-sm underline"
            >
                ← Voltar à página inicial
            </Link>

        </main>
    )
}
