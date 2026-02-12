import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Vienna transit colors
        'u1': '#E20A16', // U1 Red
        'u2': '#A065AA', // U2 Purple
        'u3': '#F39315', // U3 Orange
        'u4': '#00984A', // U4 Green
        'u6': '#9D6E50', // U6 Brown
      },
    },
  },
  plugins: [],
}
export default config
