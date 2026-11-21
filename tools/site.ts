// The names of the files of the built prototype site.
//
// The build has one entry, `site.html`. A static host serves `index.html` for
// the address of a folder, thus the built entry gets that name, and the site
// opens at the address of its folder.

// The entry of the site in the project root.
export const siteEntry = 'site.html'

// The name of the entry in the built folder.
export const siteIndex = 'index.html'

// Pure: the name in the built folder of a file of the bundle. The entry of the
// site becomes `index.html`; each other file keeps its name.
export function siteFileName(name: string): string {
  return name === siteEntry ? siteIndex : name
}
