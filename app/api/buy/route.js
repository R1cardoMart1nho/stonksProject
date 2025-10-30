import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Variáveis do ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

//Cria um client com permissões do servidor (bypass RLS)
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

export async function POST(req) {
    try {
        // 1 -  Obter utilizador atual
        const token = req.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) {
            return NextResponse.json({ error: "Sem token" }, { status: 401 });
        }

        const supabase = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        // Verifica user autenticado via token
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (userError || !user) {
            return NextResponse.json({ error: "User não autenticado" }, { status: 401 });
        }

        const { asset_id, quantity } = await req.json();

        // 2 - Buscar utilizador na tabela "public.users"
        const { data: userData, error: userDataError } = await supabaseAdmin
            .from("users")
            .select("coins")
            .eq("id", user.id)
            .single();

        if (userDataError || !userData) {
            console.log("Erro ao buscar user data:", userDataError);
            console.log("User data:", userData);
            return NextResponse.json({ error: "User não encontrado" }, { status: 404 });
        }

        // 3 - Buscar dados do asset
        const { data: assetData, error: assetError } = await supabaseAdmin
            .from("assets")
            .select("id, current_price")
            .eq("id", asset_id)
            .single();

        if (assetError || !assetData) {
            return NextResponse.json({ error: "Asset não encontrado" }, { status: 404 });
        }

        // if (!userData) return new Response(JSON.stringify({ error: "User não encontrado" }), { status: 404 });
        // if (!assetData) return new Response(JSON.stringify({ error: "Asset não encontrado" }), { status: 404 });

        // 4 - Calcular / Validar custo total 
        const totalCost = assetData.current_price * quantity;
        if (userData.coins < totalCost) {
            return NextResponse.json({ error: "Coins insuficientes" }, { status: 400 });
        }

        // 5 - Criar transação
        const { error: txError } = await supabaseAdmin
            .from("transactions")
            .insert({
                user_id: user.id,
                asset_id,
                quantity,
                price_at_transaction: assetData.current_price,
                total: totalCost,
                type: "buy",
                created_at: new Date().toISOString(),
            });

        if (txError) {
            return NextResponse.json({ error: txError.message }, { status: 500 });
        }

        // 6 - Atualizar coins do user
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ coins: userData.coins - totalCost })
            .eq("id", user.id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // 7 - Atualizar preço (flutuação de 0.5% por compra)

        // Define um passo de quantidade para flutuação, ex: 5 unidades
        // ✅ NOVO: Buscar net volume atual da VIEW
        const { data: volumeData, error: volumeError } = await supabaseAdmin
            .from("v_asset_volume")
            .select("net_volume")
            .eq("asset_id", asset_id)
            .single();

        if (volumeError) {
            console.warn("⚠️ Erro ao buscar volume:", volumeError);
            // Continua com volume zero se der erro
        }

        // Net volume atual (pode ser negativo se houver mais vendas)
        const currentNetVolume = volumeData?.net_volume || 0;
        // ✅ NOVA COMPRA: AUMENTA o net volume (mais procura)
        const newNetVolume = currentNetVolume + quantity;
        const netVolumeChange = newNetVolume - currentNetVolume;

        // Calcular flutuação baseada no NET VOLUME
        const step = 5;
        const changePerStep = 0.005; // 0.5% por step

        // Usa o VALOR ABSOLUTO do net volume para os "steps"
        //const steps = Math.floor(Math.abs(newNetVolume) / step);
        let newPrice = assetData.current_price;

        if (netVolumeChange > 0) {
            // NET VOLUME AUMENTOU = mais procura = preço SOBE
            const steps = Math.floor(netVolumeChange / step);
            newPrice = assetData.current_price * (1 + changePerStep * steps);
            console.log(`📈 NET VOLUME ↑ ${currentNetVolume} → ${newNetVolume} | Preço SOBE ${assetData.current_price} → ${newPrice}`);
        } else if (netVolumeChange < 0) {
            // NET VOLUME DIMINUIU = mais oferta = preço DESCE
            const steps = Math.floor(Math.abs(netVolumeChange) / step);
            newPrice = assetData.current_price * (1 - changePerStep * steps);
            console.log(`📉 NET VOLUME ↓ ${currentNetVolume} → ${newNetVolume} | Preço DESCE ${assetData.current_price} → ${newPrice}`);
        } else {
            // Sem mudança
            console.log(`➡️ NET VOLUME = ${currentNetVolume} | Preço mantém ${assetData.current_price}`);
        }

        const { error: priceError } = await supabaseAdmin
            .from("assets")
            .update({ current_price: newPrice })
            .eq("id", asset_id);

        if (priceError) {
            console.error("Erro ao atualizar preço:", priceError);
            return NextResponse.json({ error: priceError.message }, { status: 500 });
        }

        // ✅ REGISTAR PREÇO HISTÓRICO (apenas o NOVO preço)
        const { error: historyError } = await supabaseAdmin
            .from("asset_prices")
            .insert({
                asset_id: asset_id,
                price: newPrice, // ← NOVO preço (após flutuação)
                recorded_at: new Date().toISOString()
            });

        if (historyError) {
            console.warn("⚠️ Erro ao registrar preço histórico:", historyError);
        }

        // Retornar sucesso
        return NextResponse.json({ success: true, message: "Compra realizada!" });

    } catch (error) {
        console.error("Erro inesperado em /api/buy:", error);
        return NextResponse.json({ error: "Erro Inesperado!" }, { status: 500 });
    }
}
