import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

export async function POST(req) {
    try {
        // 1. Autenticação
        const token = req.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) return NextResponse.json({ error: "Sem token" }, { status: 401 });

        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !user) return NextResponse.json({ error: "User não autenticado" }, { status: 401 });

        const { asset_id, quantity } = await req.json();

        // 2. Buscar user
        const { data: userData, error: userDataError } = await supabaseAdmin
            .from("users")
            .select("coins")
            .eq("id", user.id)
            .single();
        if (userDataError || !userData) return NextResponse.json({ error: "User não encontrado" }, { status: 404 });

        // 3. Buscar asset
        const { data: assetData, error: assetError } = await supabaseAdmin
            .from("assets")
            .select("id, current_price")
            .eq("id", asset_id)
            .single();
        if (assetError || !assetData) return NextResponse.json({ error: "Asset não encontrado" }, { status: 404 });

        // 4. Validar que o user tem esse asset em carteira
        const { data: position, error: positionError } = await supabaseAdmin
            .from("transactions")
            .select("quantity")
            .eq("user_id", user.id)
            .eq("asset_id", asset_id)
            .eq("type", "buy"); // Somar todas as compras para ver quantas tem

        const totalBought = position?.reduce((sum, t) => sum + t.quantity, 0) || 0;

        const { data: sold, error: soldError } = await supabaseAdmin
            .from("transactions")
            .select("quantity")
            .eq("user_id", user.id)
            .eq("asset_id", asset_id)
            .eq("type", "sell");

        const totalSold = sold?.reduce((sum, t) => sum + t.quantity, 0) || 0;
        const currentHeld = totalBought - totalSold;

        if (currentHeld < quantity) {
            return NextResponse.json({ error: "Quantidade insuficiente para vender!" }, { status: 400 });
        }

        // 5. Calcular valor da venda
        const totalGain = assetData.current_price * quantity;

        // 6. Criar transação
        const { error: txError } = await supabaseAdmin
            .from("transactions")
            .insert({
                user_id: user.id,
                asset_id,
                quantity,
                price_at_transaction: assetData.current_price,
                total: totalGain,
                type: "sell",
                created_at: new Date().toISOString(),
            });
        if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

        // 7 - Atualizar preço (flutuação baseada no NET VOLUME do mercado)

        // ✅ Buscar net volume atual da VIEW
        const { data: volumeData, error: volumeError } = await supabaseAdmin
            .from("v_asset_volume")
            .select("net_volume")
            .eq("asset_id", asset_id)
            .single();

        if (volumeError) {
            console.warn("⚠️ Erro ao buscar volume:", volumeError);
        }

        // Net volume atual
        const currentNetVolume = volumeData?.net_volume || 0;
        // ✅ VENDA: DIMINUI o net volume (mais oferta)
        const newNetVolume = currentNetVolume - quantity;
        const netVolumeChange = newNetVolume - currentNetVolume;

        // Calcular flutuação baseada no NET VOLUME
        const step = 5;
        const changePerStep = 0.005; // 0.5% por step

        //const steps = Math.floor(Math.abs(newNetVolume) / step);
        let newPrice = assetData.current_price;

        if (netVolumeChange > 0) {
            // NET VOLUME AUMENTOU = preço SOBE
            const steps = Math.floor(netVolumeChange / step);
            newPrice = assetData.current_price * (1 + changePerStep * steps);
            console.log(`📈 VENDA mas NET VOLUME ↑ | Preço SOBE`);
        } else if (netVolumeChange < 0) {
            // NET VOLUME DIMINUIU = preço DESCE
            const steps = Math.floor(Math.abs(netVolumeChange) / step);
            newPrice = assetData.current_price * (1 - changePerStep * steps);
            console.log(`📉 VENDA e NET VOLUME ↓ | Preço DESCE`);
        } else {
            // Net volume = 0, preço mantém-se
            console.log(`➡️ VENDA: Net Volume ${currentNetVolume} → ${newNetVolume} | Preço mantém ${assetData.current_price}`);
        }

        // Atualizar preço na tabela assets
        const { error: priceError } = await supabaseAdmin
            .from("assets")
            .update({ current_price: newPrice })
            .eq("id", asset_id);

        if (priceError) {
            console.error("Erro ao atualizar preço:", priceError);
            return NextResponse.json({ error: priceError.message }, { status: 500 });
        }

        // ✅ REGISTAR PREÇO HISTÓRICO
        const { error: historyError } = await supabaseAdmin
            .from("asset_prices")
            .insert({
                asset_id: asset_id,
                price: newPrice,
                recorded_at: new Date().toISOString()
            });

        if (historyError) {
            console.warn("⚠️ Erro ao registrar preço histórico:", historyError);
        }

        return NextResponse.json({ success: true, message: "Venda realizada!" });

    } catch (error) {
        console.error("Erro inesperado em /api/sell:", error);
        return NextResponse.json({ error: "Erro Inesperado!" }, { status: 500 });
    }
}
