// The business's name and logo, set by an admin on the Branding page.
export interface Brand {
  name: string;
  tagline: string;
  /** Show the name beside the logo (turn off if the logo already contains the name). */
  showName: boolean;
  hasLogo: boolean;
  hasDarkLogo: boolean;
  hasIcon: boolean;
  /** Changes whenever the branding is saved, so browsers fetch the new logo. */
  version: string;
}

export const DEFAULT_BRAND: Brand = { name: 'AI Publisher', tagline: '', showName: true, hasLogo: false, hasDarkLogo: false, hasIcon: false, version: '0' };

/** Swaps the default product name in help text and messages for the business name. */
export const brandify = (text: string, name: string) => (name && name !== DEFAULT_BRAND.name ? text.replaceAll(DEFAULT_BRAND.name, name) : text);
