import { Capacitor } from '@capacitor/core';
import { GIAIntent } from './GIAIntent';

class TermuxService {
  async isInstalled(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    return (await GIAIntent.termuxStatus()).installed;
  }

  async open(): Promise<void> {
    await GIAIntent.openTermux();
  }

  async run(command: string, args: string[] = [], workdir?: string): Promise<{ jobId: string; stdout?: string; stderr?: string; exitCode?: number }> {
    if (!(await this.isInstalled())) throw new Error('Termux is not installed');
    return GIAIntent.runTermuxCommand({ command, args, workdir });
  }
}

export default new TermuxService();
