import CapabilityService from '../CapabilityService';
import CapabilityPolicyService from '../CapabilityPolicyService';
import { crossDeviceMesh } from '../CrossDeviceMesh';
import type { Tool } from './types';

/**
 * capabilities_scan — device-first inventory.
 *
 * Call BEFORE installing anything (packages, models, tools). It reports what
 * is already available on the device so GIA can reuse it instead of asking
 * for an install, and when something IS missing it grounds the choice GIA
 * presents to the user (reuse existing / install via the detected package
 * manager / pick an alternative).
 */
const capabilitiesScanTool: Tool = {
  id: 'capabilities_scan',
  name: 'capabilities_scan',
  description:
    'Scan what is already installed and available on this device: shell binaries with versions, the package manager, OS, CPU/RAM/storage, GPU/WebGPU, local AI engines (LLM/STT readiness), connected API connectors and active MCP tools. ALWAYS call this before suggesting or running any installation (sandbox_install, or pip/npm/apk in a terminal) so you reuse what exists and give the user a real choice when something is missing.',
  schema: {
    type: 'object',
    properties: {
      force: {
        type: 'boolean',
        description: 'Skip the 45s cache and rescan the device now (default: false)',
      },
    },
    required: [],
  },
  execute: async (args) => {
    try {
      const force = args.force === true || args.force === 'true';
      const scan = await CapabilityService.scan(force);
      const inventory = CapabilityService.formatScan(scan, true);
      const policy = CapabilityPolicyService.getContext();
      const fleet = crossDeviceMesh.getFleetContext();
      const extra: string[] = [];
      if (policy) extra.push(`## Install policy\n${policy}`);
      if (fleet) extra.push(`## Paired devices (fleet)\n${fleet}`);
      const found = scan.shell.kind === 'none'
        ? '(no shell on this platform)'
        : scan.present.length > 0
          ? `${scan.present.length} binary(ies) found on the shell`
          : 'no binaries found on the shell';
      return {
        success: true,
        content: `## On-device capability inventory\n${inventory}\n\n${found}.${extra.length ? `\n\n${extra.join('\n\n')}` : ''}`,
      };
    } catch (e) {
      return {
        success: false,
        content: '',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
};

export const capabilityTools: Tool[] = [capabilitiesScanTool];