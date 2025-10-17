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

        // 7. Atualizar saldo do user
        const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({ coins: userData.coins + totalGain })
            .eq("id", user.id);
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

        return NextResponse.json({ success: true, message: "Venda realizada!" });
    } catch (error) {
        console.error("Erro em /api/sell:", error);
        return NextResponse.json({ error: "Erro Inesperado!" }, { status: 500 });
    }
}
