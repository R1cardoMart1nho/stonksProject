"use client"
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function useAuth() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        // Pega sessão atual
        supabase.auth.getUser().then(({ data }) => {
            setUser(data.user ?? null);
        });

        // Listener de login/logout em tempo real
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => listener.subscription.unsubscribe();
    }, []);

    return user;
}
