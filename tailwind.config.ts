import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F4EE',
        surface: '#FFFDF9',
        ink: '#2B2A27',
        muted: '#6F6A60',
        line: '#E6DFD3',
        sage: {
          50: '#F2F4EE',
          100: '#E3E8DA',
          500: '#71805F',
          600: '#5D6B4D',
          700: '#49543C',
        },
        clay: '#B9765A',
        paper: '#FBF8F1',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        serif: [
          '"Songti SC"',
          '"Noto Serif SC"',
          'STSong',
          '"SimSun"',
          'serif',
        ],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 10px 40px rgba(43, 42, 39, 0.07)',
        lift: '0 18px 60px rgba(43, 42, 39, 0.12)',
      },
      maxWidth: {
        page: '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
