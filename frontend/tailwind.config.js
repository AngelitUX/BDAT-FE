/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // 📏 Sistema de Tipografía Parametrizado (tamaños reducidos)
      fontSize: {
        // Tamaños extra pequeños
        'xxs': ['0.625rem', { lineHeight: '0.875rem' }],    // 10px
        'xs': ['0.6875rem', { lineHeight: '1rem' }],        // 11px

        // Tamaños pequeños
        'sm': ['0.75rem', { lineHeight: '1.125rem' }],      // 12px
        'base': ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px (nuevo base)

        // Tamaños medianos
        'md': ['0.875rem', { lineHeight: '1.375rem' }],     // 14px
        'lg': ['0.9375rem', { lineHeight: '1.5rem' }],      // 15px
        'xl': ['1rem', { lineHeight: '1.625rem' }],         // 16px

        // Tamaños grandes (títulos)
        '2xl': ['1.125rem', { lineHeight: '1.75rem' }],     // 18px
        '3xl': ['1.25rem', { lineHeight: '1.875rem' }],     // 20px
        '4xl': ['1.5rem', { lineHeight: '2.125rem' }],      // 24px
        '5xl': ['1.75rem', { lineHeight: '2.25rem' }],      // 28px
        '6xl': ['2rem', { lineHeight: '2.5rem' }],          // 32px
      },

      colors: {
        // 🎨 Colores Principales
        background: "oklch(0.98 0.005 270)",     // Blanco casi puro con un toque de púrpura
        primary: "oklch(0.55 0.18 270)",         // Púrpura medio vibrante
        accent: "oklch(0.65 0.2 250)",           // Azul-púrpura brillante
        success: "oklch(0.65 0.15 150)",         // Verde suave
        warning: "oklch(0.7 0.18 80)",           // Amarillo/naranja suave

        // 🎨 Colores Secundarios
        card: "oklch(0.97 0.008 270)",           // Gris muy claro con tinte púrpura
        secondary: "oklch(0.92 0.015 270)",      // Gris claro púrpura
        muted: "oklch(0.94 0.01 270)",           // Gris medio claro

        // 🌫️ Sombras Neumórficas (pueden usarse en box-shadow personalizados)
        shadowLight: "rgba(255, 255, 255, 0.8)",
        shadowDark: "rgba(163, 177, 198, 0.3)",
      },
      backgroundImage: {
        "mono-grid":
          "linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)",
        "mono-diagonal":
          "repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1) 1px, transparent 1px, transparent 10px)",
        "mono-radial":
          "radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.05) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.05) 0%, transparent 50%)",
        "radial-gradient": "radial-gradient(circle at center, #222222 0%, #050505 100%)",
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-200%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [],
}
