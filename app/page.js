"use client"

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useAuth from "@/hooks/useAuth";
import { useTheme } from '@/contexts/themeContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import LoginForm from '@/app/login/page';
import RegisterForm from '@/app/register/page';

// Dados de exemplo do gráfico - SUBSTITUI pelos teus dados reais
// const sampleChartData = [
//   { date: '01 Jan', topPerformer: { name: 'Ricardo Araújo Pereira', image: '/images/rap.jpg', price: 120 } },
//   { date: '08 Jan', topPerformer: { name: 'João Monteiro', image: '/images/monteiro.jpg', price: 135 } },
//   { date: '15 Jan', topPerformer: { name: 'Nuno Markl', image: '/images/markl.jpg', price: 110 } },
//   { date: '22 Jan', topPerformer: { name: 'Ricardo Araújo Pereira', image: '/images/rap.jpg', price: 150 } },
//   { date: '29 Jan', topPerformer: { name: 'Bruno Nogueira', image: '/images/nogueira.jpg', price: 140 } },
//   { date: '05 Fev', topPerformer: { name: 'João Monteiro', image: '/images/monteiro.jpg', price: 165 } },
// ];

export default function Home() {

  const { isDark, toggleTheme } = useTheme(); // Tema da página
  const [authModal, setAuthModal] = useState(null); // null, 'login', ou 'register'
  const [showInputFor, setShowInputFor] = useState(null); // Estado do componente (quantidade a comprar/vender)
  const closeAuthModal = () => setAuthModal(null); // Fechar modal
  // Alternar entre login/registo
  const switchToRegister = () => setAuthModal('register');
  const switchToLogin = () => setAuthModal('login');
  // Para busca de assets  + user info
  const [assets, setAssets] = useState([]);
  const user = useAuth();
  const [quantities, setQuantities] = useState({});
  // Para filtros e ordenação - Gráfico
  const [chartData, setChartData] = useState([]);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price_asc', 'price_desc'
  const [chartTimeRange, setChartTimeRange] = useState('1M');
  const [chartMode, setChartMode] = useState('all'); // 'all', 'portfolio', 'search'

  // Função para quando login/registo é bem sucedido
  const handleAuthSuccess = () => {
    closeAuthModal();
    // Aqui podes adicionar refresh de dados se necessário
  };

  // Logout
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
    else alert("Logout realizado!");
  };

  // Busca data para colocar na tabela
  const getChartData = () => {
    if (isLoadingChart || chartData.length === 0) {
      return [];
    }

    let filteredData = chartData;

    // FILTRO DE PESQUISA DINÂMICO - aplica-se a TODOS os modos
    if (searchTerm) {
      filteredData = chartData.map(day => {
        // Filtrar os assets deste dia que correspondem à pesquisa
        const matchingAssets = day.allAssets.filter(asset =>
          asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          asset.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (matchingAssets.length === 0) return null; // Remove dias sem matches

        // Encontrar novo top performer entre os filtrados
        const newTopPerformer = matchingAssets.reduce((max, current) =>
          current.price > max.price ? current : max
        );

        return {
          date: day.date,
          // Manter apenas os assets que correspondem à pesquisa
          ...matchingAssets.reduce((acc, asset) => {
            acc[asset.symbol] = asset.price;
            return acc;
          }, {}),
          topPerformer: {
            name: newTopPerformer.name,
            image: newTopPerformer.image_url,
            price: newTopPerformer.price,
            symbol: newTopPerformer.symbol
          },
          allAssets: matchingAssets
        };
      }).filter(Boolean); // Remove dias null
    }

    return filteredData;
  };

  // Função para buscar dados históricos dos assets
  const fetchChartData = async (timeRange = '1M') => {
    try {
      setIsLoadingChart(true);

      let query = supabase
        .from('transactions')
        .select(`
        price_at_transaction,
        created_at,
        user_id,
        assets (
          id,
          name,
          symbol,
          image_url
        )
      `)
        .order('created_at', { ascending: true });

      // SE estiver no modo portfolio E user logado, filtrar por user_id
      if (chartMode === 'portfolio' && user) {
        query = query.eq('user_id', user.id);
      }

      const { data: transactionsData, error } = await query;

      if (error) throw error;

      const processedData = processTransactionsData(transactionsData, timeRange);
      setChartData(processedData);

    } catch (error) {
      console.error('Erro ao buscar dados do gráfico:', error);
    } finally {
      setIsLoadingChart(false);
    }
  };

  // Processar dados - ENCONTRAR O TOP PERFORMER DE CADA DIA
  const processTransactionsData = (transactions, timeRange) => {
    if (!transactions || transactions.length === 0) return [];

    // Agrupar por data E por asset
    const groupedByDate = {};

    transactions.forEach(transaction => {
      const date = new Date(transaction.created_at);
      const dateKey = date.toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'short'
      });

      const asset = transaction.assets;

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = {};
      }

      // Para cada asset, guardar o preço nesse dia
      if (!groupedByDate[dateKey][asset.symbol]) {
        groupedByDate[dateKey][asset.symbol] = {
          name: asset.name,
          symbol: asset.symbol,
          image_url: asset.image_url,
          price: transaction.price_at_transaction,
          timestamp: date
        };
      }
    });

    // Transformar em array de datas com todos os assets
    const result = Object.entries(groupedByDate).map(([date, assetsBySymbol]) => {
      const assetsArray = Object.values(assetsBySymbol);

      // Encontrar o top performer do dia (para a imagem)
      const topPerformer = assetsArray.reduce((max, current) =>
        current.price > max.price ? current : max
      );

      return {
        date,
        // Dados para cada asset (para as múltiplas linhas)
        ...assetsArray.reduce((acc, asset) => {
          acc[asset.symbol] = asset.price;
          return acc;
        }, {}),
        // Info do top performer (para as imagens)
        topPerformer: {
          name: topPerformer.name,
          image: topPerformer.image_url,
          price: topPerformer.price,
          symbol: topPerformer.symbol
        },
        // Todos os assets para o tooltip
        allAssets: assetsArray
      };
    });

    return filterByTimeRange(result, timeRange);
  };

  // Filtrar por timeframe
  const filterByTimeRange = (data, timeRange) => {
    const now = new Date();
    let cutoffDate = new Date();

    switch (timeRange) {
      case '1D':
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case '1S':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '1M':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'YTD':
        cutoffDate = new Date(now.getFullYear(), 0, 1); // Início do ano
        break;
      default:
        cutoffDate.setMonth(now.getMonth() - 1); // Default 1 mês
    }

    return data.filter(item => {
      // Assumindo que a data do item é a mais recente dos assets nesse dia
      const itemDate = item.allAssets[0]?.timestamp;
      return itemDate && itemDate >= cutoffDate;
    }).sort((a, b) => {
      // Ordenar por data
      return new Date(a.allAssets[0]?.timestamp) - new Date(b.allAssets[0]?.timestamp);
    });
    ;
  };

  // Buscar assets e dados do user
  useEffect(() => {
    async function fetchData() {
      await fetchChartData(chartTimeRange);

      let assetsQuery = supabase
        .from('assets')
        .select('*')
        .order('current_price', { ascending: false });

      // Se está no modo portfolio, buscar apenas assets do user
      if (chartMode === 'portfolio' && user) {
        const { data: userTransactions } = await supabase
          .from('transactions')
          .select('asset_id')
          .eq('user_id', user.id)
          .not('asset_id', 'is', null);

        if (userTransactions && userTransactions.length > 0) {
          const assetIds = [...new Set(userTransactions.map(t => t.asset_id))];
          assetsQuery = assetsQuery.in('id', assetIds);
        }
      }

      const { data: assetsData, error } = await assetsQuery;
      if (!error) {
        setAssets(assetsData);
      }
    }

    fetchData();
  }, [chartTimeRange, chartMode, user]); // Recarrega quando assets ou timeframe mudam []);

  // Pesquisa DINÂMICA - não precisa de recarregar dados da BD
  useEffect(() => {
    // Apenas força o re-render do gráfico quando searchTerm muda
    if (chartData.length > 0) {
      setChartData(prev => [...prev]); // Force update
    }
  }, [searchTerm]);

  // Filtragem e ordenação
  const filteredAndSortedAssets = useMemo(() => {
    let filtered = assets.filter(asset =>
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortBy) {
      case 'price_asc': return filtered.sort((a, b) => a.current_price - b.current_price);
      case 'price_desc': return filtered.sort((a, b) => b.current_price - a.current_price);
      case 'name':
      default: return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [assets, searchTerm, sortBy]);

  // Componente Customizado do Tooltip do Gráfico
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;


      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg max-w-xs">
          <p className="font-semibold text-gray-900 dark:text-white mb-3 border-b pb-2">
            {label}
          </p>

          {/* Top Performer destacado */}
          <div className="flex items-center gap-3 mb-3 p-2 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <img
              src={data.topPerformer.image}
              alt={data.topPerformer.name}
              className="w-8 h-8 rounded-full border-2 border-blue-500"
            />
            <div className="flex-1">
              <p className="font-bold text-gray-900 dark:text-white text-sm">
                {data.topPerformer.name}
              </p>
              <p className="text-green-600 dark:text-green-400 font-bold">
                {data.topPerformer.price}€
              </p>
            </div>
            <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
              TOP
            </span>
          </div>

          {/* Lista de todos os assets */}
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data.allAssets && data.allAssets.map((asset, index) => (
              <div key={asset.symbol} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <img
                    src={asset.image_url}
                    alt={asset.name}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {asset.symbol}
                  </span>
                </div>
                <span className={`font-semibold ${asset.price === data.topPerformer.price
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-600 dark:text-gray-400'
                  }`}>
                  {asset.price}€
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Componente Customizado do Ponto com Imagem
  const CustomDot = (props) => {
    const { cx, cy, payload } = props;

    // Verificar se a imagem existe
    if (!payload.topPerformer.image) {
      return (
        <circle cx={cx} cy={cy} r={6} fill="#3B82F6" stroke="#fff" strokeWidth={2} />
      );
    }
    return (
      <g>
        <circle cx={cx} cy={cy} r={8} fill="#3B82F6" stroke="#fff" strokeWidth={2} />
        <image
          href={payload.topPerformer.image}
          x={cx - 12}
          y={cy - 12}
          height={24}
          width={24}
          className="rounded-full border-2 border-white shadow-lg"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    );
  };

  // Função para comprar asset (apenas logado)
  async function handleBuy(assetId, quantity) {
    try {
      // 1 - Verifica se existe sessão
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Precisas de fazer login primeiro!");
        return;
      }

      // 2 - Faz o pedido à API com o token JWT
      const res = await fetch("/api/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`, // token enviado!
        },
        body: JSON.stringify({ user_id: user.id, asset_id: assetId, quantity }),
      });

      // 3 - Lê resposta
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao realizar compra");
      }

      // 4 - Mostra feedback
      alert("Compra realizada com sucesso!");
      console.log("Resposta da API:", data);

    } catch (error) {
      console.error("Erro:", error.message);
      alert(error.message);
    }
  };

  // Função para vender asset (apenas logado)
  // 1 - Verifica se existe sessão
  async function handleSell(assetId, quantity) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      alert("Precisas de fazer login primeiro!");
      return;
    }

    // 2 - Faz o pedido à API com o token JWT
    const res = await fetch("/api/sell", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: user.id, asset_id: assetId, quantity }),
    });

    // 3 - Lê resposta
    const data = await res.json();
    if (data.error) alert(data.error);
    else alert("Venda realizada!");
  }

  // HTML
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground p-4 sm:p-6 lg:p-8">

      {/* Botão de tema */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 sm:p-3 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-all duration-300 shadow-lg border border-gray-300 dark:border-gray-600 z-10"
        aria-label="Alternar tema"
      >
        {isDark ? '🌙' : '☀️'}
      </button>

      <div className="text-center w-full max-w-7xl mx-auto px-2 sm:px-4">
        {/* Cabeçalho */}
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            OneStonks
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
            Bem-vindo ao OneStonks!
          </p>
          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-500">
            (ou um Comédia Stonks... Vamos ver)
          </p>
        </div>

        {/* Botões de autenticação */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-12 justify-center">
          <button
            onClick={() => setAuthModal('login')}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-xl transition-all duration-300 font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl hover:scale-105"
          >
            Login
          </button>
          <button
            onClick={() => setAuthModal('register')}
            className="px-6 py-3 sm:px-8 sm:py-4 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white rounded-xl transition-all duration-300 font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl hover:scale-105"
          >
            Registar
          </button>
        </div>

        {/* Estado do usuário */}
        {user ? (
          <div className="mb-8 sm:mb-12 p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl border border-gray-200 dark:border-gray-700 max-w-2xl mx-auto">
            <p className="text-xl sm:text-2xl mb-4 sm:mb-6 text-gray-800 dark:text-white">
              Olá, <span className="font-bold text-blue-600 dark:text-blue-400">{user.email}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/portfolio"
                className="px-6 py-2 sm:px-8 sm:py-3 bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-lg transition-all duration-200 font-semibold text-sm sm:text-base hover:scale-105"
              >
                Portefólio
              </Link>
              <button
                className="px-6 py-2 sm:px-8 sm:py-3 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white rounded-lg transition-all duration-200 font-semibold text-sm sm:text-base hover:scale-105"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-8 sm:mb-12 p-4 sm:p-6 bg-yellow-100 dark:bg-yellow-900 rounded-lg sm:rounded-xl border border-yellow-300 dark:border-yellow-700 max-w-md mx-auto">
            <p className="text-yellow-800 dark:text-yellow-200 text-base sm:text-lg">
              Não está logado
            </p>
          </div>
        )}

        {/* GRÁFICO COM CONTROLES */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
              📈 Performance do Mercado
            </h2>

            {/* Controles do Gráfico */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Modos de Visualização */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {[
                  { key: 'all', label: '🌍 Todos', desc: 'Todo o mercado' },
                  { key: 'portfolio', label: '💼 Meu Portfólio', desc: 'Os teus ativos' },
                  { key: 'search', label: '🔍 Filtrado', desc: 'Por pesquisa' }
                ].map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => {
                      setChartMode(mode.key);
                      // Limpar searchTerm quando muda para outro modo
                      if (mode.key !== 'search') {
                        setSearchTerm('');
                      }
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${chartMode === mode.key
                      ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              {/* Timeframes */}
              <select
                value={chartTimeRange}
                onChange={(e) => setChartTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="1D">1 Dia</option>
                <option value="1S">1 Semana</option>
                <option value="1M">1 Mês</option>
                <option value="3M">3 Meses</option>
                <option value="6M">6 Meses</option>
                <option value="1Y">1 Ano</option>
                <option value="YTD">YTD</option>
              </select>
            </div>
          </div>

          {/* Gráfico */}
          <div className="h-80 w-full">
            {isLoadingChart ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 dark:text-gray-400">A carregar dados do mercado...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip content={<CustomTooltip />} />
                  {/* //<Legend /> */}

                  {/* Gerar uma linha para cada asset único */}
                  {chartData.length > 0 && Object.keys(chartData[0])
                    .filter(key => key !== 'date' && key !== 'topPerformer' && key !== 'allAssets')
                    .map((symbol, index) => {
                      const asset = assets.find(a => a.symbol === symbol);
                      if (!asset) return null;

                      // Cores consistentes para cada asset
                      const colors = [
                        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
                        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
                      ];

                      return (
                        <Line
                          key={asset.symbol}
                          type="monotone"
                          dataKey={asset.symbol}
                          name={asset.name}
                          stroke={`#${Math.floor(Math.random() * 16777215).toString(16)}`} // Cor aleatória
                          strokeWidth={2}
                          dot={false} // Sem dots normais - só o top performer tem
                          activeDot={{ r: 4 }}
                        />
                      );
                    })}

                  {/* Linha especial só para o top performer com imagens */}
                  <Line
                    type="monotone"
                    dataKey="topPerformer.price"
                    name="Top Performer"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={<CustomDot />}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* MERCADO COM FILTROS */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">
                🎭 Mercado de Humoristas
              </h2>

              {/* Filtros e Ordenação */}
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Barra de pesquisa */}
                <div className="sm:w-64">
                  <input
                    type="text"
                    placeholder="🔍 Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Ordenação */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="name">Nome A-Z</option>
                  <option value="price_asc">Preço ↑</option>
                  <option value="price_desc">Preço ↓</option>
                </select>
              </div>
            </div>

            {/* Contador de resultados */}
            <div className="text-center mb-6">
              <p className="text-gray-600 dark:text-gray-400">
                Mostrando <span className="font-semibold">{filteredAndSortedAssets.length}</span> de{' '}
                <span className="font-semibold">{assets.length}</span> ativos
              </p>
            </div>

            {/* Grid de Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
              {filteredAndSortedAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-600 flex flex-col w-full min-w-0 group"
                >
                  {/* IMAGEM GRANDE */}
                  <div className="flex justify-center mb-3">
                    {asset.image_url && (
                      <img
                        src={asset.image_url}
                        alt={asset.name}
                        className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl object-cover border-4 border-white dark:border-gray-600 shadow-lg group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                  </div>

                  {/* Nome e Símbolo JUNTOS */}
                  <div className="text-center mb-3 min-w-0">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-800 dark:text-white text-lg sm:text-xl">
                        {asset.name}
                      </h3>
                      <span className="text-blue-600 dark:text-blue-400 font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded-full border border-blue-200 dark:border-blue-700">
                        {asset.symbol}
                      </span>
                    </div>
                  </div>

                  {/* Preço */}
                  <div className="text-center mb-4">
                    <p className="text-green-600 dark:text-green-400 font-bold text-2xl sm:text-3xl">
                      {asset.current_price}€
                    </p>
                  </div>

                  {/* Botões */}
                  {/* Botões com input toggle - Versão Compacta */}
                  <div className="space-y-2 w-full min-w-0 mt-auto">
                    {showInputFor === asset.id && (
                      <input
                        type="number"
                        min="1"
                        defaultValue="1"
                        className="w-full text-center rounded-lg bg-white dark:bg-gray-600 border-2 border-blue-500 text-gray-900 dark:text-white px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 shadow-inner animate-scale-in"
                        onChange={(e) => setQuantities({ ...quantities, [asset.id]: Number(e.target.value) })}
                        autoFocus
                      />
                    )}

                    <div className="flex gap-2 w-full min-w-0">
                      <button
                        className={`flex-1 py-3 rounded-lg transition-all duration-200 font-semibold text-sm transform hover:scale-[1.02] shadow-md ${showInputFor === asset.id
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 text-white'
                          }`}
                        onClick={() => {
                          if (showInputFor === asset.id) {
                            handleBuy(asset.id, quantities[asset.id] || 1);
                            setShowInputFor(null);
                          } else {
                            setShowInputFor(asset.id);
                            setQuantities({ ...quantities, [asset.id]: 1 });
                          }
                        }}
                      >
                        {showInputFor === asset.id ? 'Comprar' : 'Comprar'}
                      </button>
                      <button
                        className={`flex-1 py-3 rounded-lg transition-all duration-200 font-semibold text-sm transform hover:scale-[1.02] shadow-md ${showInputFor === asset.id
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white'
                          }`}
                        onClick={() => {
                          if (showInputFor === asset.id) {
                            handleSell(asset.id, quantities[asset.id] || 1);
                            setShowInputFor(null);
                          } else {
                            setShowInputFor(asset.id);
                            setQuantities({ ...quantities, [asset.id]: 1 });
                          }
                        }}
                      >
                        {showInputFor === asset.id ? 'Vender' : 'Vender'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal de Autenticação */}
        {authModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-scale-in">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {authModal === 'login' ? 'Entrar' : 'Criar Conta'}
                </h3>
                <button
                  onClick={closeAuthModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>

              <form className="space-y-4">
                {authModal === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="O teu nome"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="exemplo@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                {authModal === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirmar Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition-colors duration-200"
                >
                  {authModal === 'login' ? 'Entrar' : 'Criar Conta'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  {authModal === 'login' ? 'Não tens conta?' : 'Já tens conta?'}
                  <button
                    onClick={authModal === 'login' ? switchToRegister : switchToLogin}
                    className="ml-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-semibold transition-colors"
                  >
                    {authModal === 'login' ? 'Regista-te' : 'Entrar'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main >
  );

}