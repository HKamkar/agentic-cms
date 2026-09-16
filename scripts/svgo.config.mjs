// svgo settings for the site's vector illustrations (not the bitmap wrappers,
// those go through optimize-svg-rasters.mjs):
//
//   pnpm dlx svgo@3 --config scripts/svgo.config.mjs -p 1 -i public/images/<dir>/<file>.svg -o public/images/<dir>/<file>.svg
//
// The viewBox must survive: the site sizes these SVGs through <img width/height>
// and CSS, and svgo's default drops it when it equals width/height, which stops
// the image from scaling. Precision 1 (0.1px) is invisible on a
// large illustration and halves its size; check a render before and after.
const config = {
  multipass: true,
  plugins: [{ name: "preset-default", params: { overrides: { removeViewBox: false } } }],
};

export default config;
