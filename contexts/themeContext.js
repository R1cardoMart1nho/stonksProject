'use client';
import { createContext, useContext, useEffect, useState } from 'react';

// Cria o contexto
const ThemeContext = createContext();

// Provider para envolver a app toda
export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Verificar se existe tema guardado no localStorage
        const savedTheme = localStorage.getItem('stonks-theme');

        if (savedTheme) {
            // Usar tema guardado
            setIsDark(savedTheme === 'dark');
            document.documentElement.classList.toggle('dark', savedTheme === 'dark');
        } else {
            // Verificar preferência do sistema
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDark(systemPrefersDark);
            document.documentElement.classList.toggle('dark', systemPrefersDark);
        }
    }, []);

    // Função para alternar entre temas
    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);

        // Aplicar a classe .dark no html element
        document.documentElement.classList.toggle('dark', newTheme);

        // Guardar no localStorage
        localStorage.setItem('stonks-theme', newTheme ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// Hook personalizado para usar o tema
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};