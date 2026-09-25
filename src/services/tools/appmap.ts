import type { Tool } from './types';
import { findAppLocations, MODULES, SETTINGS_PAGES, type AppLocation } from '../AppMap';

/**
 * app_map — GIA's self-knowledge lookup.
 *
 * When the user asks "how do I turn on X?", "where is the Y setting?", or
 * "can you do Z?", GIA queries the app's own map and answers with the exact
 * navigation path and the controls involved — no vague or invented
 * directions. Pairs with the digest embedded in the system prompt.
 */
function formatLocations(locs: AppLocation[]): string {
  return locs
    .map(l => [
      `— ${l.path}`,
      `What: ${l.what}`,
      ...(l.controls.length ? [`Controls: ${l.controls.join('; ')}`] : []),
    ].join('\n'))
    .join('\n\n');
}

export const appMapTools: Tool[] = [
  {
    id: 'app_map',
    name: 'app_map',
    description: 'Look up where any feature, setting, or control lives in GIA — modules, settings pages, and their controls. Use whenever the user asks how to find, enable, or configure something in the app, or when you need to know your own capabilities before promising something. Pass a query like "wake word", "api key", "permissions", "export brain".',
    execute: async ({ query }) => {
      const q = String(query ?? '').trim();
      if (!q) {
        return {
          success: true,
          content: `Full map —\n\nMODULES\n${formatLocations(MODULES)}\n\nSETTINGS PAGES\n${formatLocations(SETTINGS_PAGES)}`,
        };
      }
      const hits = findAppLocations(q);
      if (hits.length === 0) {
        return {
          success: true,
          content: `No match for "${q}" in the app map. The main places are: ${[...MODULES, ...SETTINGS_PAGES].map(l => l.id).join(', ')}. If the user wants something the app cannot do, say so honestly and point them to Settings → About → Report a problem.`,
        };
      }
      return {
        success: true,
        content: `Where "${q}" lives:\n\n${formatLocations(hits)}\n\nAnswer the user with the exact path(s) in plain language. If several places matched, list the most relevant one first.`,
      };
    },
  },
];
