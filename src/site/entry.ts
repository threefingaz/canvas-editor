// The entry of the prototype site in the folder of the tool. The frame server
// of `canvas dev` serves it at `/__frame/site.html` (`/site.html` sends the
// browser there); the editor links to it (the button "Open as a full page"
// of a frame), and the build writes it as `index.html` (`tools/site-plugin.ts`).
// The tools load this module with no bundler (the module runner of Vite), thus
// it has no imports.
export const siteEntry = 'site.html'
