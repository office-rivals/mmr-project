// Some plugins (e.g. tailwindcss/nesting) must run before Tailwind,
// others (autoprefixer) after — hence the explicit order.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
