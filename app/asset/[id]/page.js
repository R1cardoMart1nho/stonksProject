import { supabase } from '@/lib/supabaseClient';

// Classe para detalhe de cada asset
export async function buyAsset(user_id, asset_id, quantity) {
    // Busca asset
    const { data: asset, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', asset_id)
        .single();

    if (error) throw error;

    const totalPrice = asset.current_price * quantity;

    // Busca user
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user_id)
        .single();

    if (userError) throw userError;

    if (user.coins < totalPrice) throw new Error('Saldo insuficiente');

    // Cria transação
    await supabase.from('transactions').insert({
        user_id,
        asset_id,
        quantity,
        price_at_transaction: asset.current_price,
        type: 'buy',
    });

    // Atualiza coins
    await supabase.from('users').update({
        coins: user.coins - totalPrice
    }).eq('id', user_id);

    return { success: true };
}
