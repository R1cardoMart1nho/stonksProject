import { supabase } from '@/lib/supabaseClient';

export default async function ProfilePage() {
    const user = supabase.auth.user();
    if (!user) return <p>Por favor faça login</p>;

    const { data: userInfo } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    const { data: transactions } = await supabase
        .from('transactions')
        .select('*, asset(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Perfil de {userInfo.username}</h1>
            <p>Coins: {userInfo.coins.toFixed(2)}</p>
            <p>Bio: {userInfo.bio || 'Sem bio ainda'}</p>

            <h2 className="text-xl mt-6 mb-2">Histórico de transações</h2>
            <ul>
                {transactions.map(tx => (
                    <li key={tx.id}>
                        {tx.type.toUpperCase()} {tx.quantity}x {tx.asset.name} a ${tx.price_at_transaction}
                    </li>
                ))}
            </ul>
        </div>
    );
}
